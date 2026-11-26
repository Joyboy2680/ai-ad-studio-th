from __future__ import annotations

import csv
import io
import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.config import get_settings, validate_startup_config
from backend.database import SessionLocal, get_db, init_db
from backend.models import Product, ProductStatus
from backend.schemas import (
    CsvImportError,
    CsvImportResponse,
    HealthResponse,
    KpiStats,
    ProductApproveRequest,
    ProductCreate,
    ProductListResponse,
    ProductResponse,
    ProductUpdate,
)
from backend.services.pipeline_runner import InvalidStateTransitionError, PipelineRunner
from backend.services.url_utils import compute_url_hash

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

ALLOWED_IMAGE_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def create_app(
    runner: PipelineRunner | None = None,
    strict_config: bool = True,
) -> FastAPI:
    """Application factory enabling clean dependency injection in tests and production."""
    settings = get_settings()
    startup_warnings: list[str] = []

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        nonlocal startup_warnings
        startup_warnings = validate_startup_config(settings, strict=strict_config)
        init_db()
        if app.state.runner is None:
            app.state.runner = PipelineRunner(
                session_factory=SessionLocal,
                settings=settings,
            )
        app.state.startup_warnings = startup_warnings
        yield
        if app.state.runner is not None:
            app.state.runner.shutdown(wait=False)

    app = FastAPI(
        title="Affiliate Auto-Content & Video Pipeline API",
        description="Human-in-the-Loop (Semi-Auto 90%) TikTok & Shopee Affiliate automation backend.",
        version="1.0.0",
        lifespan=lifespan,
    )
    app.state.runner = runner
    app.state.startup_warnings = startup_warnings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=r"^https://([a-zA-Z0-9-]+\.github\.io|[a-zA-Z0-9-]+\.app\.github\.dev|[a-zA-Z0-9-]+\.onrender\.com)$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    uploads_dir = settings.resolved_tmp_outputs_dir / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

    def get_runner() -> PipelineRunner:
        if app.state.runner is None:
            app.state.runner = PipelineRunner(
                session_factory=SessionLocal,
                settings=get_settings(),
            )
        return app.state.runner

    def _compute_kpi(db: Session) -> KpiStats:
        all_statuses = [row[0] for row in db.query(Product.status).all()]
        counts: dict[str, int] = {}
        for st in all_statuses:
            counts[st] = counts.get(st, 0) + 1

        in_progress = (
            counts.get(ProductStatus.APPROVED.value, 0)
            + counts.get(ProductStatus.GENERATING_VIDEO.value, 0)
            + counts.get(ProductStatus.SYNCING_DRIVE.value, 0)
        )
        return KpiStats(
            total_products=len(all_statuses),
            draft_count=counts.get(ProductStatus.DRAFT.value, 0),
            pending_approval=counts.get(ProductStatus.SCORED.value, 0),
            in_progress=in_progress,
            ready_to_post=counts.get(ProductStatus.READY_TO_POST.value, 0),
            failed_jobs=counts.get(ProductStatus.FAILED.value, 0),
        )

    @app.get("/api/health", response_model=HealthResponse)
    def health_check():
        cfg = get_settings()
        return HealthResponse(
            status="ok",
            mock_mode=cfg.mock_mode,
            video_provider=cfg.video_provider,
            ffmpeg_available=cfg.ffmpeg_available,
            warnings=list(getattr(app.state, "startup_warnings", [])),
        )

    @app.post("/api/uploads/image")
    async def upload_product_image(file: UploadFile = File(...)):
        content_type = (file.content_type or "").lower()
        ext = ALLOWED_IMAGE_EXTENSIONS.get(content_type)
        if not ext:
            suffix = Path(file.filename or "").suffix.lower()
            if suffix in {".jpg", ".jpeg", ".png", ".webp"}:
                ext = suffix
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="รองรับเฉพาะไฟล์รูปภาพ JPG, PNG หรือ WEBP เท่านั้น",
                )

        raw = await file.read()
        if not raw or len(raw) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ไฟล์รูปภาพว่างเปล่าหรือมีขนาดเกิน 10MB",
            )

        filename = f"prod-{uuid.uuid4().hex[:12]}{ext}"
        target_dir = get_settings().resolved_tmp_outputs_dir / "uploads"
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / filename).write_bytes(raw)
        return {"image_url": f"/uploads/{filename}"}

    @app.get("/api/products", response_model=ProductListResponse)
    def list_products(
        status_filter: Optional[ProductStatus] = Query(default=None, alias="status"),
        search: Optional[str] = Query(default=None),
        sort_by: str = Query(default="score", pattern="^(score|created_at)$"),
        db: Session = Depends(get_db),
    ):
        query = db.query(Product)
        if status_filter is not None:
            query = query.filter(Product.status == status_filter.value)
        if search and search.strip():
            like = f"%{search.strip()}%"
            query = query.filter(
                (Product.name.ilike(like)) | (Product.trend_keyword.ilike(like))
            )

        if sort_by == "score":
            query = query.order_by(
                Product.demand_score.is_(None),
                desc(Product.demand_score),
                desc(Product.created_at),
            )
        else:
            query = query.order_by(desc(Product.created_at))

        items = query.all()
        return ProductListResponse(
            items=[ProductResponse.model_validate(item) for item in items],
            kpi=_compute_kpi(db),
        )

    @app.get("/api/products/{product_id}", response_model=ProductResponse)
    def get_product(product_id: int, db: Session = Depends(get_db)):
        product = db.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="ไม่พบสินค้านี้ในระบบ")
        return ProductResponse.model_validate(product)

    @app.post(
        "/api/products",
        response_model=ProductResponse,
        status_code=status.HTTP_201_CREATED,
    )
    def create_product(
        payload: ProductCreate,
        db: Session = Depends(get_db),
        pipeline: PipelineRunner = Depends(get_runner),
    ):
        try:
            normalized_url, url_hash = compute_url_hash(payload.product_url)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        existing = db.query(Product).filter(Product.url_hash == url_hash).first()
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"ลิงก์สินค้านี้มีอยู่ในระบบแล้ว (ID #{existing.id}: {existing.name})",
            )

        product = Product(
            name=payload.name.strip(),
            product_url=payload.product_url.strip(),
            normalized_url=normalized_url,
            url_hash=url_hash,
            affiliate_url=(payload.affiliate_url or payload.product_url).strip(),
            price=payload.price,
            commission_pct=payload.commission_pct,
            image_url=payload.image_url.strip(),
            raw_reviews=payload.raw_reviews.strip(),
            trend_keyword=payload.trend_keyword.strip(),
            status=ProductStatus.DRAFT.value,
        )
        db.add(product)
        try:
            db.commit()
            db.refresh(product)
        except IntegrityError as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="ลิงก์สินค้านี้ซ้ำกับรายการที่มีอยู่แล้ว",
            ) from exc

        if payload.auto_score:
            product = pipeline.score_product(db, product)

        return ProductResponse.model_validate(product)

    @app.post("/api/products/import-csv", response_model=CsvImportResponse)
    async def import_products_csv(
        file: UploadFile = File(...),
        auto_score: bool = Query(default=True),
        db: Session = Depends(get_db),
        pipeline: PipelineRunner = Depends(get_runner),
    ):
        raw_bytes = await file.read()
        if not raw_bytes:
            raise HTTPException(status_code=400, detail="ไฟล์ CSV ว่างเปล่า")

        try:
            text = raw_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = raw_bytes.decode("tis-620", errors="replace")

        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail="ไม่พบหัวตาราง (Header) ในไฟล์ CSV")

        imported_products: list[Product] = []
        duplicates_skipped = 0
        errors: list[CsvImportError] = []
        seen_hashes: set[str] = set()

        def pick(row: dict, *keys: str, default: str = "") -> str:
            lowered = {str(k).strip().lower(): (v or "").strip() for k, v in row.items() if k}
            for k in keys:
                if k in lowered and lowered[k]:
                    return lowered[k]
            return default

        for row_idx, row in enumerate(reader, start=2):
            name = pick(row, "name", "product_name", "title", "ชื่อสินค้า")
            product_url = pick(row, "product_url", "url", "link", "ลิงก์สินค้า")
            image_url = pick(row, "image_url", "image", "รูปสินค้า")
            price_raw = pick(row, "price", "ราคา", default="0")
            comm_raw = pick(row, "commission_pct", "commission", "ค่าคอม", default="0")
            reviews = pick(row, "raw_reviews", "reviews", "รีวิว")
            trend = pick(row, "trend_keyword", "keyword", "trend", "คีย์เวิร์ด")
            affiliate_url = pick(row, "affiliate_url", "aff_url")

            if not name or not product_url:
                errors.append(
                    CsvImportError(row=row_idx, reason="ต้องระบุชื่อสินค้า (name) และลิงก์สินค้า (product_url)")
                )
                continue

            if not image_url:
                errors.append(
                    CsvImportError(row=row_idx, reason="ต้องระบุ image_url ของสินค้า")
                )
                continue

            try:
                price = float(price_raw.replace(",", "").replace("฿", ""))
                commission_pct = float(comm_raw.replace("%", "").strip())
            except ValueError:
                errors.append(
                    CsvImportError(row=row_idx, reason="ราคา (price) หรือค่าคอม (commission_pct) ไม่ใช่ตัวเลข")
                )
                continue

            try:
                normalized_url, url_hash = compute_url_hash(product_url)
            except ValueError as exc:
                errors.append(CsvImportError(row=row_idx, reason=str(exc)))
                continue

            if url_hash in seen_hashes:
                duplicates_skipped += 1
                continue

            exists = db.query(Product.id).filter(Product.url_hash == url_hash).first()
            if exists is not None:
                duplicates_skipped += 1
                continue

            seen_hashes.add(url_hash)
            product = Product(
                name=name[:255],
                product_url=product_url,
                normalized_url=normalized_url,
                url_hash=url_hash,
                affiliate_url=affiliate_url or product_url,
                price=max(0.0, price),
                commission_pct=max(0.0, min(100.0, commission_pct)),
                image_url=image_url,
                raw_reviews=reviews,
                trend_keyword=trend[:255],
                status=ProductStatus.DRAFT.value,
            )
            db.add(product)
            try:
                db.commit()
                db.refresh(product)
            except IntegrityError:
                db.rollback()
                duplicates_skipped += 1
                continue

            if auto_score:
                product = pipeline.score_product(db, product)
            imported_products.append(product)

        return CsvImportResponse(
            imported=len(imported_products),
            duplicates_skipped=duplicates_skipped,
            errors=errors,
            products=[ProductResponse.model_validate(p) for p in imported_products],
        )

    @app.post("/api/products/{product_id}/score", response_model=ProductResponse)
    def score_product_endpoint(
        product_id: int,
        db: Session = Depends(get_db),
        pipeline: PipelineRunner = Depends(get_runner),
    ):
        product = db.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="ไม่พบสินค้านี้ในระบบ")
        try:
            updated = pipeline.score_product(db, product)
        except InvalidStateTransitionError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return ProductResponse.model_validate(updated)

    @app.patch("/api/products/{product_id}", response_model=ProductResponse)
    def update_product(
        product_id: int,
        payload: ProductUpdate,
        db: Session = Depends(get_db),
    ):
        product = db.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="ไม่พบสินค้านี้ในระบบ")

        if ProductStatus(product.status) in {
            ProductStatus.GENERATING_VIDEO,
            ProductStatus.SYNCING_DRIVE,
        }:
            raise HTTPException(
                status_code=400,
                detail="ไม่สามารถแก้ไขข้อมูลระหว่างที่กำลังสร้างวิดีโอหรือซิงก์ Google Drive ได้",
            )

        data = payload.model_dump(exclude_unset=True)
        for field, value in data.items():
            if field == "content_angle" and value is not None:
                setattr(product, field, value.value)
            else:
                setattr(product, field, value)

        db.commit()
        db.refresh(product)
        return ProductResponse.model_validate(product)

    @app.post("/api/products/{product_id}/approve", response_model=ProductResponse)
    def approve_product_endpoint(
        product_id: int,
        payload: Optional[ProductApproveRequest] = None,
        db: Session = Depends(get_db),
        pipeline: PipelineRunner = Depends(get_runner),
    ):
        product = db.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="ไม่พบสินค้านี้ในระบบ")
        try:
            updated = pipeline.approve_product(db, product, edits=payload, run_async=True)
        except InvalidStateTransitionError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return ProductResponse.model_validate(updated)

    @app.post("/api/products/{product_id}/retry", response_model=ProductResponse)
    def retry_product_endpoint(
        product_id: int,
        db: Session = Depends(get_db),
        pipeline: PipelineRunner = Depends(get_runner),
    ):
        product = db.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="ไม่พบสินค้านี้ในระบบ")
        try:
            updated = pipeline.retry_product(db, product, run_async=True)
        except InvalidStateTransitionError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return ProductResponse.model_validate(updated)

    @app.get("/api/products/{product_id}/video")
    def stream_product_video(product_id: int, db: Session = Depends(get_db)):
        product = db.get(Product, product_id)
        if not product or not product.local_video_path:
            raise HTTPException(status_code=404, detail="ยังไม่มีไฟล์วิดีโอสำหรับสินค้านี้")
        video_path = Path(product.local_video_path)
        if not video_path.exists():
            raise HTTPException(status_code=404, detail="ไม่พบไฟล์วิดีโอในเครื่อง")
        return FileResponse(
            path=str(video_path),
            media_type="video/mp4",
            filename=f"video_product_{product.id}.mp4",
        )

    @app.delete("/api/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_product(product_id: int, db: Session = Depends(get_db)):
        product = db.get(Product, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="ไม่พบสินค้านี้ในระบบ")
        if ProductStatus(product.status) in {
            ProductStatus.GENERATING_VIDEO,
            ProductStatus.SYNCING_DRIVE,
        }:
            raise HTTPException(
                status_code=400,
                detail="ไม่สามารถลบรายการระหว่างที่กำลังประมวลผลได้",
            )
        db.delete(product)
        db.commit()
        return None

    # Single-container Cloud mode: serve built React SPA from frontend/dist if present
    from backend.config import PROJECT_ROOT

    frontend_dist = PROJECT_ROOT / "frontend" / "dist"
    frontend_index = frontend_dist / "index.html"
    if frontend_index.exists():
        assets_dir = frontend_dist / "assets"
        if assets_dir.exists():
            app.mount(
                "/assets",
                StaticFiles(directory=str(assets_dir)),
                name="frontend-assets",
            )

        @app.get("/", include_in_schema=False)
        def serve_spa_root():
            return FileResponse(str(frontend_index))

        @app.get("/{full_path:path}", include_in_schema=False)
        def serve_spa_fallback(full_path: str):
            if full_path.startswith(("api/", "uploads/")):
                raise HTTPException(status_code=404, detail="Not Found")
            candidate = (frontend_dist / full_path).resolve()
            if (
                candidate.is_file()
                and frontend_dist.resolve() in candidate.parents
            ):
                return FileResponse(str(candidate))
            return FileResponse(str(frontend_index))

    return app


app = create_app()
