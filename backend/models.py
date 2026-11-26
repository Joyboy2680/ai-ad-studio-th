from __future__ import annotations

import enum
import json
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ProductStatus(str, enum.Enum):
    """Strict state machine stages for every affiliate product item."""

    DRAFT = "DRAFT"
    SCORED = "SCORED"
    APPROVED = "APPROVED"
    GENERATING_VIDEO = "GENERATING_VIDEO"
    SYNCING_DRIVE = "SYNCING_DRIVE"
    READY_TO_POST = "READY_TO_POST"
    FAILED = "FAILED"


class FailedStage(str, enum.Enum):
    """Checkpoint stage recording where a failure occurred for targeted retry."""

    SCORING = "SCORING"
    VIDEO_GENERATION = "VIDEO_GENERATION"
    DRIVE_SYNC = "DRIVE_SYNC"


class ContentAngle(str, enum.Enum):
    """Rotated content angles to avoid repetitive AI-generated scripts."""

    PAIN_POINT = "PAIN_POINT"
    HONEST_REVIEW = "HONEST_REVIEW"
    COMPARISON = "COMPARISON"
    PROBLEM_SOLVER = "PROBLEM_SOLVER"


class Product(Base):
    """SQLite-persisted product record tracking AI scoring, approval, video checkpoint, and Drive sync."""

    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Ingested Product & Trend Information
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    product_url: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_url: Mapped[str] = mapped_column(Text, nullable=False)
    url_hash: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    affiliate_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    commission_pct: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    image_url: Mapped[str] = mapped_column(Text, nullable=False)
    raw_reviews: Mapped[str] = mapped_column(Text, nullable=False, default="")
    trend_keyword: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    # State Machine
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=ProductStatus.DRAFT.value, index=True
    )

    # AI Analyzer Structured Output
    demand_score: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    buy_probability_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_angle: Mapped[str | None] = mapped_column(String(32), nullable=True)
    hook_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    i2v_video_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    caption_th: Mapped[str | None] = mapped_column(Text, nullable=True)
    hashtags_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")

    # Fault Tolerance & Checkpoint Recovery
    job_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    local_video_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    local_caption_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    local_metadata_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    drive_folder_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    drive_folder_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    failed_stage: Mapped[str | None] = mapped_column(String(32), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Audit Timestamps
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    @property
    def hashtags(self) -> list[str]:
        try:
            data = json.loads(self.hashtags_json or "[]")
            return [str(tag) for tag in data] if isinstance(data, list) else []
        except (TypeError, json.JSONDecodeError):
            return []

    @hashtags.setter
    def hashtags(self, value: list[str] | None) -> None:
        cleaned = [str(tag).strip() for tag in (value or []) if str(tag).strip()]
        self.hashtags_json = json.dumps(cleaned, ensure_ascii=False)
