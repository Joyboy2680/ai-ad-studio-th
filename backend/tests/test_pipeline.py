from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.config import Settings, validate_startup_config
from backend.database import Base, get_db
from backend.main import create_app
from backend.models import ContentAngle, FailedStage, Product, ProductStatus
from backend.schemas import ProductApproveRequest
from backend.services.ai_analyzer import AIAnalyzerService
from backend.services.drive_sync import DriveSyncResult, GoogleDriveSyncService
from backend.services.pipeline_runner import (
    InvalidStateTransitionError,
    PipelineRunner,
    transition_status,
)
from backend.services.url_utils import compute_url_hash, normalize_product_url
from backend.services.video_providers import (
    BaseVideoProvider,
    FFmpegLocalProvider,
    VideoGenerationRequest,
)


class CountingStubVideoProvider(BaseVideoProvider):
    """Test double that counts invocations and optionally fails on demand."""

    def __init__(self, should_fail: bool = False) -> None:
        self.call_count = 0
        self.should_fail = should_fail

    def generate(self, request: VideoGenerationRequest) -> Path:
        self.call_count += 1
        if self.should_fail:
            raise RuntimeError("Simulated video API failure")
        request.output_dir.mkdir(parents=True, exist_ok=True)
        out = request.output_dir / "video_final.mp4"
        out.write_bytes(b"FAKE-MP4-CONTENT-CHECKPOINT")
        return out


class FlakyDriveSyncService(GoogleDriveSyncService):
    """Test double that fails once (or while configured) to test checkpoint recovery."""

    def __init__(self, settings: Settings, fail_times: int = 1) -> None:
        super().__init__(settings)
        self.fail_times = fail_times
        self.call_count = 0

    def sync_product_bundle(
        self,
        product: Product,
        local_video_path: Path,
        output_dir: Path,
    ) -> DriveSyncResult:
        self.call_count += 1
        if self.call_count <= self.fail_times:
            raise RuntimeError("Simulated Google Drive 503 transient failure")
        return super().sync_product_bundle(product, local_video_path, output_dir)


class FailingAIAnalyzer(AIAnalyzerService):
    """Test double that fails on first call then succeeds."""

    def __init__(self, settings: Settings, fail_times: int = 1) -> None:
        super().__init__(settings)
        self.fail_times = fail_times
        self.call_count = 0

    def analyze_product(self, product: Product, recent_angles=None):
        self.call_count += 1
        if self.call_count <= self.fail_times:
            raise RuntimeError("Simulated Gemini rate limit")
        return super().analyze_product(product, recent_angles=recent_angles)


@pytest.fixture()
def isolated_env(tmp_path: Path):
    db_file = tmp_path / "test_pipeline.db"
    engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(
        autocommit=False, autoflush=False, bind=engine, expire_on_commit=False
    )
    settings = Settings(
        MOCK_MODE=True,
        DATABASE_URL=f"sqlite:///{db_file}",
        TMP_OUTPUTS_DIR=str(tmp_path / "tmp_outputs"),
        VIDEO_DURATION_SECONDS=3,
        VIDEO_FPS=30,
    )
    return engine, TestingSessionLocal, settings, tmp_path


def test_url_normalization_and_deduplication_hash():
    u1 = "https://Shopee.co.th/Product-ABC-i.123.456/?sp_atk=abc123&utm_source=tiktok&b=2&a=1#reviews"
    u2 = "https://shopee.co.th/Product-ABC-i.123.456?a=1&b=2&fbclid=xyz999"
    n1, h1 = compute_url_hash(u1)
    n2, h2 = compute_url_hash(u2)

    assert n1 == n2 == "https://shopee.co.th/Product-ABC-i.123.456?a=1&b=2"
    assert h1 == h2
    assert len(h1) == 64

    # Different product path produces distinct hash
    _, h3 = compute_url_hash("https://shopee.co.th/Product-XYZ-i.123.999")
    assert h3 != h1
    assert normalize_product_url("shopee.co.th/item/1/") == "https://shopee.co.th/item/1"


def test_strict_state_machine_transitions():
    p = Product(
        name="Test",
        product_url="https://example.com/1",
        normalized_url="https://example.com/1",
        url_hash="a" * 64,
        price=199.0,
        commission_pct=10.0,
        image_url="https://example.com/img.jpg",
        status=ProductStatus.DRAFT.value,
    )

    # Cannot jump directly from DRAFT to APPROVED or GENERATING_VIDEO
    with pytest.raises(InvalidStateTransitionError):
        transition_status(p, ProductStatus.APPROVED)
    with pytest.raises(InvalidStateTransitionError):
        transition_status(p, ProductStatus.GENERATING_VIDEO)

    # Valid flow: DRAFT -> SCORED -> APPROVED -> GENERATING_VIDEO -> SYNCING_DRIVE -> READY_TO_POST
    transition_status(p, ProductStatus.SCORED)
    assert p.status == ProductStatus.SCORED.value

    # Cannot jump from SCORED directly to GENERATING_VIDEO without human approval
    with pytest.raises(InvalidStateTransitionError):
        transition_status(p, ProductStatus.GENERATING_VIDEO)

    transition_status(p, ProductStatus.APPROVED)
    transition_status(p, ProductStatus.GENERATING_VIDEO)
    transition_status(p, ProductStatus.SYNCING_DRIVE)
    transition_status(p, ProductStatus.READY_TO_POST)
    assert p.status == ProductStatus.READY_TO_POST.value

    # Terminal state cannot transition further
    with pytest.raises(InvalidStateTransitionError):
        transition_status(p, ProductStatus.APPROVED)


def test_human_approval_gate_never_auto_generates_video(isolated_env):
    _, SessionCls, settings, _ = isolated_env
    video_stub = CountingStubVideoProvider()
    drive_sync = GoogleDriveSyncService(settings)
    runner = PipelineRunner(
        session_factory=SessionCls,
        settings=settings,
        video_provider=video_stub,
        drive_sync=drive_sync,
    )

    with SessionCls() as db:
        norm, digest = compute_url_hash("https://shopee.co.th/item-1")
        p = Product(
            name="เครื่องฟอกอากาศพกพา",
            product_url="https://shopee.co.th/item-1",
            normalized_url=norm,
            url_hash=digest,
            price=390.0,
            commission_pct=12.0,
            image_url="https://example.com/air.jpg",
            raw_reviews="เสียงเงียบมาก ใช้งานดีจริง ส่งไว",
            trend_keyword="ฝุ่นPM25",
            status=ProductStatus.DRAFT.value,
        )
        db.add(p)
        db.commit()
        db.refresh(p)

        scored = runner.score_product(db, p)
        assert scored.status == ProductStatus.SCORED.value
        assert scored.demand_score is not None and 0 <= scored.demand_score <= 100
        assert scored.content_angle in {a.value for a in ContentAngle}
        # CRITICAL: Video provider must NOT have been called during scoring
        assert video_stub.call_count == 0
        assert scored.local_video_path is None

        # Only after explicit human approval does video generation + Drive sync execute
        edits = ProductApproveRequest(
            hook_text="อากาศดีขึ้นทันทีในงบ 390 บาท!",
            caption_th="แคปชันที่แก้ไขโดยคนก่อนอนุมัติ คุ้มมาก กดตะกร้าเลย",
            hashtags=["#PM25", "#เครื่องฟอกอากาศ", "#ป้ายยา", "#TikTokShopTH", "#ShopeeTH"],
        )
        approved = runner.approve_product(db, scored, edits=edits, run_async=False)
        assert approved.status == ProductStatus.READY_TO_POST.value
        assert approved.hook_text == "อากาศดีขึ้นทันทีในงบ 390 บาท!"
        assert approved.caption_th == "แคปชันที่แก้ไขโดยคนก่อนอนุมัติ คุ้มมาก กดตะกร้าเลย"
        assert video_stub.call_count == 1
        assert approved.local_video_path and Path(approved.local_video_path).exists()
        assert approved.drive_folder_url and approved.drive_folder_url.startswith("https://drive.google.com/drive/folders/")
    runner.shutdown(wait=True)


def test_checkpoint_retry_skips_video_regeneration_when_drive_sync_fails(isolated_env):
    _, SessionCls, settings, _ = isolated_env
    video_stub = CountingStubVideoProvider()
    flaky_drive = FlakyDriveSyncService(settings, fail_times=1)
    runner = PipelineRunner(
        session_factory=SessionCls,
        settings=settings,
        video_provider=video_stub,
        drive_sync=flaky_drive,
    )

    with SessionCls() as db:
        norm, digest = compute_url_hash("https://shopee.co.th/item-retry-drive")
        p = Product(
            name="พัดลมพกพาความเย็นสูง",
            product_url="https://shopee.co.th/item-retry-drive",
            normalized_url=norm,
            url_hash=digest,
            price=259.0,
            commission_pct=15.0,
            image_url="https://example.com/fan.jpg",
            trend_keyword="พัดลมพกพา",
            status=ProductStatus.DRAFT.value,
        )
        db.add(p)
        db.commit()
        db.refresh(p)

        runner.score_product(db, p)
        failed_after_approve = runner.approve_product(db, p, run_async=False)

        assert failed_after_approve.status == ProductStatus.FAILED.value
        assert failed_after_approve.failed_stage == FailedStage.DRIVE_SYNC.value
        assert "503" in (failed_after_approve.last_error or "")
        assert failed_after_approve.local_video_path is not None
        assert Path(failed_after_approve.local_video_path).exists()
        assert video_stub.call_count == 1
        assert flaky_drive.call_count == 1

        # Retry: MUST reuse local_video_path and NOT regenerate video!
        recovered = runner.retry_product(db, failed_after_approve, run_async=False)
        assert recovered.status == ProductStatus.READY_TO_POST.value
        assert recovered.failed_stage is None
        assert recovered.last_error is None
        assert recovered.retry_count == 1
        assert video_stub.call_count == 1  # CRITICAL: still 1, NOT 2!
        assert flaky_drive.call_count == 2
        assert recovered.drive_folder_url is not None
    runner.shutdown(wait=True)


def test_checkpoint_retry_from_video_generation_and_scoring(isolated_env):
    _, SessionCls, settings, _ = isolated_env
    failing_ai = FailingAIAnalyzer(settings, fail_times=1)
    video_stub = CountingStubVideoProvider(should_fail=True)
    drive_sync = GoogleDriveSyncService(settings)
    runner = PipelineRunner(
        session_factory=SessionCls,
        settings=settings,
        ai_analyzer=failing_ai,
        video_provider=video_stub,
        drive_sync=drive_sync,
    )

    with SessionCls() as db:
        norm, digest = compute_url_hash("https://shopee.co.th/item-retry-stages")
        p = Product(
            name="โคมไฟตั้งโต๊ะไร้สาย",
            product_url="https://shopee.co.th/item-retry-stages",
            normalized_url=norm,
            url_hash=digest,
            price=299.0,
            commission_pct=11.0,
            image_url="https://example.com/lamp.jpg",
            status=ProductStatus.DRAFT.value,
        )
        db.add(p)
        db.commit()
        db.refresh(p)

        # 1. Fail at SCORING
        p = runner.score_product(db, p)
        assert p.status == ProductStatus.FAILED.value
        assert p.failed_stage == FailedStage.SCORING.value

        # Retry SCORING -> lands safely at SCORED (does NOT run video)
        p = runner.retry_product(db, p, run_async=False)
        assert p.status == ProductStatus.SCORED.value
        assert video_stub.call_count == 0

        # 2. Approve, fail at VIDEO_GENERATION
        p = runner.approve_product(db, p, run_async=False)
        assert p.status == ProductStatus.FAILED.value
        assert p.failed_stage == FailedStage.VIDEO_GENERATION.value
        assert video_stub.call_count == 1

        # Fix video provider and retry -> completes READY_TO_POST
        video_stub.should_fail = False
        p = runner.retry_product(db, p, run_async=False)
        assert p.status == ProductStatus.READY_TO_POST.value
        assert video_stub.call_count == 2
        assert p.drive_folder_url is not None
    runner.shutdown(wait=True)


def test_api_deduplication_and_csv_import(isolated_env):
    _, SessionCls, settings, _ = isolated_env
    video_stub = CountingStubVideoProvider()
    runner = PipelineRunner(
        session_factory=SessionCls,
        settings=settings,
        video_provider=video_stub,
        drive_sync=GoogleDriveSyncService(settings),
    )
    app = create_app(runner=runner, strict_config=False)

    def _override_get_db():
        db = SessionCls()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db

    with TestClient(app) as client:
        # Create first product
        resp1 = client.post(
            "/api/products",
            json={
                "name": "แก้วเก็บความเย็น 30oz",
                "product_url": "https://shopee.co.th/tumbler-30oz?utm_source=fb",
                "price": 189,
                "commission_pct": 12.5,
                "image_url": "https://example.com/tumbler.jpg",
                "raw_reviews": "เก็บน้ำแข็งข้ามคืนได้จริง ไม่เป็นไอน้ำ",
                "trend_keyword": "แก้วเก็บความเย็น",
            },
        )
        assert resp1.status_code == 201
        data1 = resp1.json()
        assert data1["status"] == "SCORED"
        assert video_stub.call_count == 0

        # Duplicate with different tracking params -> 409 Conflict
        resp_dup = client.post(
            "/api/products",
            json={
                "name": "แก้วเก็บความเย็น ซ้ำ",
                "product_url": "https://SHOPEE.co.th/tumbler-30oz/?sp_atk=9999#top",
                "price": 189,
                "commission_pct": 12.5,
                "image_url": "https://example.com/tumbler.jpg",
            },
        )
        assert resp_dup.status_code == 409

        # CSV import containing: 1 existing duplicate, 1 new item, 1 in-CSV duplicate
        csv_body = (
            "name,product_url,price,commission_pct,image_url,raw_reviews,trend_keyword\n"
            "แก้วซ้ำ,https://shopee.co.th/tumbler-30oz?fbclid=111,189,12,https://example.com/t.jpg,ดีมาก,แก้ว\n"
            "ขาตั้งมือถือแม่เหล็ก,https://shopee.co.th/magsafe-stand,149,14,https://example.com/stand.jpg,แน่นมากไม่หลุด,MagSafe\n"
            "ขาตั้งซ้ำในไฟล์,https://shopee.co.th/magsafe-stand?utm_medium=cpc,149,14,https://example.com/stand.jpg,แน่นมาก,MagSafe\n"
        )
        csv_resp = client.post(
            "/api/products/import-csv",
            files={"file": ("products.csv", csv_body.encode("utf-8"), "text/csv")},
        )
        assert csv_resp.status_code == 200
        csv_data = csv_resp.json()
        assert csv_data["imported"] == 1
        assert csv_data["duplicates_skipped"] == 2
        assert len(csv_data["errors"]) == 0
        assert video_stub.call_count == 0

        # List products sorted by demand_score
        list_resp = client.get("/api/products")
        assert list_resp.status_code == 200
        payload = list_resp.json()
        assert payload["kpi"]["total_products"] == 2
        assert payload["kpi"]["pending_approval"] == 2
    runner.shutdown(wait=True)


def test_startup_config_validation(tmp_path: Path):
    # MOCK_MODE=true succeeds with warning
    mock_cfg = Settings(
        MOCK_MODE=True,
        TMP_OUTPUTS_DIR=str(tmp_path / "out_mock"),
    )
    warnings = validate_startup_config(mock_cfg, strict=True)
    assert any("MOCK_MODE=true" in w for w in warnings)

    # MOCK_MODE=false without keys raises RuntimeError
    live_cfg = Settings(
        MOCK_MODE=False,
        GEMINI_API_KEY="",
        GOOGLE_DRIVE_ROOT_FOLDER_ID="",
        GOOGLE_SERVICE_ACCOUNT_FILE=str(tmp_path / "missing_sa.json"),
        TMP_OUTPUTS_DIR=str(tmp_path / "out_live"),
    )
    with pytest.raises(RuntimeError) as exc_info:
        validate_startup_config(live_cfg, strict=True)
    msg = str(exc_info.value)
    assert "GEMINI_API_KEY" in msg
    assert "GOOGLE_DRIVE_ROOT_FOLDER_ID" in msg
    assert "GOOGLE_SERVICE_ACCOUNT_JSON" in msg

    # MOCK_MODE=false with Cloud env var GOOGLE_SERVICE_ACCOUNT_JSON (raw & base64) succeeds
    import base64

    sa_payload = json.dumps(
        {
            "type": "service_account",
            "client_email": "bot@test-project.iam.gserviceaccount.com",
            "private_key": "-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n",
        }
    )
    sa_b64 = base64.b64encode(sa_payload.encode("utf-8")).decode("ascii")
    cloud_cfg = Settings(
        MOCK_MODE=False,
        GEMINI_API_KEY="fake-gemini-key",
        GOOGLE_DRIVE_ROOT_FOLDER_ID="folder123",
        GOOGLE_SERVICE_ACCOUNT_JSON=sa_b64,
        TMP_OUTPUTS_DIR=str(tmp_path / "out_cloud"),
    )
    validate_startup_config(cloud_cfg, strict=True)
    parsed_sa = cloud_cfg.get_service_account_info()
    assert parsed_sa is not None
    assert parsed_sa["client_email"] == "bot@test-project.iam.gserviceaccount.com"


def test_ffmpeg_local_provider_renders_real_vertical_1080x1920_mp4(tmp_path: Path):
    # Create a real local product image
    sample_img_path = tmp_path / "sample_product.png"
    img = Image.new("RGB", (800, 800), (240, 110, 60))
    img.save(sample_img_path)

    settings = Settings(
        MOCK_MODE=True,
        TMP_OUTPUTS_DIR=str(tmp_path / "out"),
        VIDEO_DURATION_SECONDS=3,
        VIDEO_FPS=30,
    )
    provider = FFmpegLocalProvider(settings)
    out_dir = tmp_path / "out" / "job-ffmpeg-test"
    video_path = provider.generate(
        VideoGenerationRequest(
            job_id="job-ffmpeg-test",
            product_name="แก้วเก็บความเย็นพรีเมียม",
            image_url=str(sample_img_path),
            video_prompt="Vertical 9:16 commercial showcase",
            hook_text="เก็บเย็นข้ามคืน ราคาไม่ถึงสองร้อย!",
            output_dir=out_dir,
            price=189.0,
            commission_pct=12.0,
        )
    )

    assert video_path.exists()
    assert video_path.name == "video_final.mp4"
    assert video_path.stat().st_size > 10_000

    # Verify resolution (1080x1920) & frame rate (30fps) via ffprobe
    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate,codec_name",
            "-of",
            "json",
            str(video_path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    stream = json.loads(probe.stdout)["streams"][0]
    assert stream["width"] == 1080
    assert stream["height"] == 1920
    assert stream["r_frame_rate"] == "30/1"
    assert stream["codec_name"] == "h264"
