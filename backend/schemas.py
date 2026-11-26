from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from backend.models import ContentAngle, FailedStage, ProductStatus


class AIAnalysisResult(BaseModel):
    """
    Strict Pydantic schema passed directly to google-genai response_schema.
    Never parsed via regex from markdown.
    """

    demand_score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Purchase probability & market demand score from 0 to 100 based on trend relevance, price-to-value ratio, and pain-point urgency.",
    )
    buy_probability_reasoning: str = Field(
        ...,
        min_length=5,
        description="Concise & brutally honest Thai evaluation highlighting strengths and dealbreakers.",
    )
    content_angle: ContentAngle = Field(
        ...,
        description="Selected content angle rotated across products to avoid repetitive AI slop.",
    )
    hook_text: str = Field(
        ...,
        min_length=2,
        description="Punchy 3-second Thai scroll-stopper hook (max 12 words).",
    )
    i2v_video_prompt: str = Field(
        ...,
        min_length=15,
        description="English cinematic 9:16 vertical Image-to-Video prompt preserving exact product appearance, lighting, and smooth camera motion.",
    )
    caption_th: str = Field(
        ...,
        min_length=10,
        description="Natural conversational Thai TikTok/Shopee affiliate caption with a clear CTA.",
    )
    hashtags: list[str] = Field(
        ...,
        min_length=5,
        max_length=8,
        description="5 to 8 targeted Thai and English hashtags.",
    )

    @field_validator("hashtags")
    @classmethod
    def normalize_hashtags(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        for raw in value:
            tag = raw.strip().replace(" ", "")
            if not tag:
                continue
            if not tag.startswith("#"):
                tag = f"#{tag}"
            if tag not in normalized:
                normalized.append(tag)
        if len(normalized) < 5:
            defaults = ["#ป้ายยา", "#ของมันต้องมี", "#TikTokShopTH", "#ShopeeTH", "#รีวิวของดี"]
            for d in defaults:
                if d not in normalized:
                    normalized.append(d)
                if len(normalized) >= 5:
                    break
        return normalized[:8]


class ProductCreate(BaseModel):
    """Manual product ingestion payload."""

    name: str = Field(..., min_length=1, max_length=255)
    product_url: str = Field(..., min_length=4)
    affiliate_url: Optional[str] = None
    price: float = Field(..., ge=0)
    commission_pct: float = Field(default=0.0, ge=0, le=100)
    image_url: str = Field(..., min_length=1)
    raw_reviews: str = Field(default="")
    trend_keyword: str = Field(default="", max_length=255)
    auto_score: bool = Field(
        default=True,
        description="Automatically run AI Analyzer (DRAFT -> SCORED). Never triggers video generation.",
    )


class ProductUpdate(BaseModel):
    """Inline human edits before or during approval review."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    affiliate_url: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    commission_pct: Optional[float] = Field(default=None, ge=0, le=100)
    image_url: Optional[str] = None
    raw_reviews: Optional[str] = None
    trend_keyword: Optional[str] = None
    content_angle: Optional[ContentAngle] = None
    hook_text: Optional[str] = Field(default=None, max_length=255)
    i2v_video_prompt: Optional[str] = None
    caption_th: Optional[str] = None
    hashtags: Optional[list[str]] = None


class ProductApproveRequest(BaseModel):
    """Optional inline edits submitted atomically with human approval."""

    content_angle: Optional[ContentAngle] = None
    hook_text: Optional[str] = Field(default=None, max_length=255)
    i2v_video_prompt: Optional[str] = None
    caption_th: Optional[str] = None
    hashtags: Optional[list[str]] = None


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    product_url: str
    normalized_url: str
    url_hash: str
    affiliate_url: Optional[str] = None
    price: float
    commission_pct: float
    image_url: str
    raw_reviews: str
    trend_keyword: str
    status: ProductStatus

    demand_score: Optional[int] = None
    buy_probability_reasoning: Optional[str] = None
    content_angle: Optional[str] = None
    hook_text: Optional[str] = None
    i2v_video_prompt: Optional[str] = None
    caption_th: Optional[str] = None
    hashtags: list[str] = Field(default_factory=list)

    job_id: Optional[str] = None
    local_video_path: Optional[str] = None
    local_caption_path: Optional[str] = None
    local_metadata_path: Optional[str] = None
    drive_folder_id: Optional[str] = None
    drive_folder_url: Optional[str] = None
    failed_stage: Optional[FailedStage] = None
    last_error: Optional[str] = None
    retry_count: int = 0

    approved_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class KpiStats(BaseModel):
    total_products: int
    draft_count: int
    pending_approval: int
    in_progress: int
    ready_to_post: int
    failed_jobs: int


class ProductListResponse(BaseModel):
    items: list[ProductResponse]
    kpi: KpiStats


class CsvImportError(BaseModel):
    row: int
    reason: str


class CsvImportResponse(BaseModel):
    imported: int
    duplicates_skipped: int
    errors: list[CsvImportError]
    products: list[ProductResponse]


class HealthResponse(BaseModel):
    status: str
    mock_mode: bool
    video_provider: str
    ffmpeg_available: bool
    warnings: list[str]
