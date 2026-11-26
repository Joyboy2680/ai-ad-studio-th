from __future__ import annotations

import logging
import uuid
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from sqlalchemy.orm import Session

from backend.config import Settings, get_settings
from backend.models import FailedStage, Product, ProductStatus
from backend.schemas import ProductApproveRequest
from backend.services.ai_analyzer import AIAnalyzerService
from backend.services.drive_sync import GoogleDriveSyncService
from backend.services.video_providers import (
    BaseVideoProvider,
    VideoGenerationRequest,
    get_video_provider,
)

logger = logging.getLogger(__name__)


class InvalidStateTransitionError(ValueError):
    """Raised when an operation violates the strict product pipeline state machine."""


VALID_TRANSITIONS: dict[ProductStatus, set[ProductStatus]] = {
    ProductStatus.DRAFT: {ProductStatus.SCORED, ProductStatus.FAILED},
    ProductStatus.SCORED: {
        ProductStatus.APPROVED,
        ProductStatus.SCORED,
        ProductStatus.FAILED,
    },
    ProductStatus.APPROVED: {ProductStatus.GENERATING_VIDEO, ProductStatus.FAILED},
    ProductStatus.GENERATING_VIDEO: {ProductStatus.SYNCING_DRIVE, ProductStatus.FAILED},
    ProductStatus.SYNCING_DRIVE: {ProductStatus.READY_TO_POST, ProductStatus.FAILED},
    ProductStatus.READY_TO_POST: set(),
    ProductStatus.FAILED: {
        ProductStatus.SCORED,
        ProductStatus.GENERATING_VIDEO,
        ProductStatus.SYNCING_DRIVE,
        ProductStatus.FAILED,
    },
}


def transition_status(product: Product, target: ProductStatus) -> None:
    """Validate and apply a strict state machine transition on a Product model."""
    current = ProductStatus(product.status)
    allowed = VALID_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise InvalidStateTransitionError(
            f"Invalid state transition: {current.value} -> {target.value}"
        )
    product.status = target.value


class PipelineRunner:
    """
    Coordinates the Human-in-the-Loop state machine and background worker execution.

    Uses ThreadPoolExecutor (zero Redis dependency) so it runs cleanly on Windows & Linux.
    """

    def __init__(
        self,
        session_factory: Callable[[], Session],
        settings: Settings | None = None,
        ai_analyzer: AIAnalyzerService | None = None,
        video_provider: BaseVideoProvider | None = None,
        drive_sync: GoogleDriveSyncService | None = None,
    ) -> None:
        self.session_factory = session_factory
        self.settings = settings or get_settings()
        self.ai_analyzer = ai_analyzer or AIAnalyzerService(self.settings)
        self.video_provider = video_provider or get_video_provider(self.settings)
        self.drive_sync = drive_sync or GoogleDriveSyncService(self.settings)
        self._executor = ThreadPoolExecutor(
            max_workers=max(1, self.settings.worker_max_workers),
            thread_name_prefix="affiliate-pipeline",
        )
        self._futures: dict[int, Future] = {}

    def shutdown(self, wait: bool = False) -> None:
        self._executor.shutdown(wait=wait, cancel_futures=False)

    def _recent_angles(self, db: Session, exclude_id: int | None = None) -> list[str]:
        query = db.query(Product.content_angle).filter(Product.content_angle.isnot(None))
        if exclude_id is not None:
            query = query.filter(Product.id != exclude_id)
        rows = query.order_by(Product.id.desc()).limit(5).all()
        return [row[0] for row in rows if row[0]]

    def score_product(self, db: Session, product: Product) -> Product:
        """
        Run AI Analyzer (`DRAFT` -> `SCORED`, or re-score `SCORED`/`FAILED`).
        CRITICAL: Never triggers video generation automatically.
        """
        current = ProductStatus(product.status)
        if current not in {ProductStatus.DRAFT, ProductStatus.SCORED, ProductStatus.FAILED}:
            raise InvalidStateTransitionError(
                f"Cannot score product in status '{current.value}'"
            )

        try:
            recent = self._recent_angles(db, exclude_id=product.id)
            analysis = self.ai_analyzer.analyze_product(product, recent_angles=recent)
            product.demand_score = analysis.demand_score
            product.buy_probability_reasoning = analysis.buy_probability_reasoning
            product.content_angle = analysis.content_angle.value
            product.hook_text = analysis.hook_text
            product.i2v_video_prompt = analysis.i2v_video_prompt
            product.caption_th = analysis.caption_th
            product.hashtags = analysis.hashtags
            product.failed_stage = None
            product.last_error = None
            transition_status(product, ProductStatus.SCORED)
            db.commit()
            db.refresh(product)
            return product
        except Exception as exc:
            logger.exception("AI scoring failed for product id=%s", product.id)
            product.failed_stage = FailedStage.SCORING.value
            product.last_error = str(exc)
            transition_status(product, ProductStatus.FAILED)
            db.commit()
            db.refresh(product)
            return product

    def approve_product(
        self,
        db: Session,
        product: Product,
        edits: ProductApproveRequest | None = None,
        run_async: bool = True,
    ) -> Product:
        """
        Explicit Human Approval Gate (`SCORED` -> `APPROVED`), then enqueue async video + Drive pipeline.
        """
        current = ProductStatus(product.status)
        if current != ProductStatus.SCORED:
            raise InvalidStateTransitionError(
                f"Human approval is only allowed from SCORED state (current: {current.value})"
            )

        if edits is not None:
            if edits.content_angle is not None:
                product.content_angle = edits.content_angle.value
            if edits.hook_text is not None:
                product.hook_text = edits.hook_text
            if edits.i2v_video_prompt is not None:
                product.i2v_video_prompt = edits.i2v_video_prompt
            if edits.caption_th is not None:
                product.caption_th = edits.caption_th
            if edits.hashtags is not None:
                product.hashtags = edits.hashtags

        transition_status(product, ProductStatus.APPROVED)
        product.approved_at = datetime.now(timezone.utc)
        product.failed_stage = None
        product.last_error = None
        if not product.job_id:
            product.job_id = f"job-{product.id}-{uuid.uuid4().hex[:8]}"
        db.commit()
        db.refresh(product)

        if run_async:
            self._submit_worker(product.id, start_stage=FailedStage.VIDEO_GENERATION)
        else:
            self._run_worker(product.id, start_stage=FailedStage.VIDEO_GENERATION)
            db.refresh(product)

        return product

    def retry_product(
        self,
        db: Session,
        product: Product,
        run_async: bool = True,
    ) -> Product:
        """
        Checkpoint recovery: resume ONLY from `failed_stage`.

        If `failed_stage == DRIVE_SYNC` and `local_video_path` exists on disk,
        retries Google Drive upload WITHOUT regenerating the video.
        """
        current = ProductStatus(product.status)
        if current != ProductStatus.FAILED:
            raise InvalidStateTransitionError(
                f"Retry is only allowed for FAILED products (current: {current.value})"
            )

        product.retry_count = (product.retry_count or 0) + 1
        stage = FailedStage(product.failed_stage) if product.failed_stage else FailedStage.SCORING

        if stage == FailedStage.SCORING:
            return self.score_product(db, product)

        if stage == FailedStage.DRIVE_SYNC:
            if product.local_video_path and Path(product.local_video_path).exists():
                transition_status(product, ProductStatus.SYNCING_DRIVE)
                product.last_error = None
                db.commit()
                db.refresh(product)
                if run_async:
                    self._submit_worker(product.id, start_stage=FailedStage.DRIVE_SYNC)
                else:
                    self._run_worker(product.id, start_stage=FailedStage.DRIVE_SYNC)
                    db.refresh(product)
                return product
            # Checkpoint video missing on disk -> safely fall back to video generation
            logger.warning(
                "Local video checkpoint missing for product id=%s; falling back to VIDEO_GENERATION.",
                product.id,
            )

        # Resume from VIDEO_GENERATION
        if not product.job_id:
            product.job_id = f"job-{product.id}-{uuid.uuid4().hex[:8]}"
        transition_status(product, ProductStatus.GENERATING_VIDEO)
        product.last_error = None
        db.commit()
        db.refresh(product)

        if run_async:
            self._submit_worker(product.id, start_stage=FailedStage.VIDEO_GENERATION)
        else:
            self._run_worker(product.id, start_stage=FailedStage.VIDEO_GENERATION)
            db.refresh(product)

        return product

    def _submit_worker(self, product_id: int, start_stage: FailedStage) -> Future:
        future = self._executor.submit(self._run_worker, product_id, start_stage)
        self._futures[product_id] = future
        return future

    def _run_worker(self, product_id: int, start_stage: FailedStage) -> None:
        """Background worker executing video generation and/or Drive sync with checkpoint commits."""
        db = self.session_factory()
        try:
            product = db.get(Product, product_id)
            if product is None:
                logger.error("Worker could not find product id=%s", product_id)
                return

            if not product.job_id:
                product.job_id = f"job-{product.id}-{uuid.uuid4().hex[:8]}"
                db.commit()

            output_dir = self.settings.resolved_tmp_outputs_dir / product.job_id
            output_dir.mkdir(parents=True, exist_ok=True)

            # Stage A: Video Generation
            if start_stage == FailedStage.VIDEO_GENERATION:
                if ProductStatus(product.status) != ProductStatus.GENERATING_VIDEO:
                    transition_status(product, ProductStatus.GENERATING_VIDEO)
                    db.commit()

                try:
                    req = VideoGenerationRequest(
                        job_id=product.job_id,
                        product_name=product.name,
                        image_url=product.image_url,
                        video_prompt=product.i2v_video_prompt or "",
                        hook_text=product.hook_text or product.name,
                        output_dir=output_dir,
                        price=product.price,
                        commission_pct=product.commission_pct,
                    )
                    video_path = self.video_provider.generate(req)
                    product.local_video_path = str(video_path.resolve())
                    product.failed_stage = None
                    product.last_error = None
                    transition_status(product, ProductStatus.SYNCING_DRIVE)
                    db.commit()
                except Exception as exc:
                    logger.exception("Video generation failed for product id=%s", product.id)
                    product.failed_stage = FailedStage.VIDEO_GENERATION.value
                    product.last_error = str(exc)
                    transition_status(product, ProductStatus.FAILED)
                    db.commit()
                    return

            # Stage B: Google Drive Auto-Sync
            if ProductStatus(product.status) != ProductStatus.SYNCING_DRIVE:
                transition_status(product, ProductStatus.SYNCING_DRIVE)
                db.commit()

            try:
                if not product.local_video_path:
                    raise RuntimeError("Missing local_video_path checkpoint before Drive sync.")
                video_file = Path(product.local_video_path)
                sync_result = self.drive_sync.sync_product_bundle(
                    product=product,
                    local_video_path=video_file,
                    output_dir=output_dir,
                )
                product.local_caption_path = str(sync_result.caption_path.resolve())
                product.local_metadata_path = str(sync_result.metadata_path.resolve())
                product.drive_folder_id = sync_result.folder_id
                product.drive_folder_url = sync_result.folder_url
                product.failed_stage = None
                product.last_error = None
                product.completed_at = datetime.now(timezone.utc)
                transition_status(product, ProductStatus.READY_TO_POST)
                db.commit()
            except Exception as exc:
                logger.exception("Google Drive sync failed for product id=%s", product.id)
                product.failed_stage = FailedStage.DRIVE_SYNC.value
                product.last_error = str(exc)
                transition_status(product, ProductStatus.FAILED)
                db.commit()
        finally:
            db.close()
