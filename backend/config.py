from __future__ import annotations

import logging
import os
import shutil
from functools import lru_cache
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

# Project root is parent of backend/
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = Path(__file__).resolve().parent

# Load .env from project root first, then backend/.env if present
load_dotenv(PROJECT_ROOT / ".env", override=False)
load_dotenv(BACKEND_DIR / ".env", override=False)


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    mock_mode: bool = Field(default=True, alias="MOCK_MODE")
    database_url: str = Field(
        default="sqlite:///./affiliate_pipeline.db", alias="DATABASE_URL"
    )
    tmp_outputs_dir: str = Field(default="./tmp_outputs", alias="TMP_OUTPUTS_DIR")
    worker_max_workers: int = Field(default=2, alias="WORKER_MAX_WORKERS")
    cors_origins: str = Field(
        default="http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000",
        alias="CORS_ORIGINS",
    )

    # Gemini AI
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-2.5-flash", alias="GEMINI_MODEL")

    # Video Provider
    video_provider: Literal["ffmpeg", "external"] = Field(
        default="ffmpeg", alias="VIDEO_PROVIDER"
    )
    ffmpeg_bin: str = Field(default="ffmpeg", alias="FFMPEG_BIN")
    thai_font_path: str = Field(default="", alias="THAI_FONT_PATH")
    video_duration_seconds: int = Field(default=5, alias="VIDEO_DURATION_SECONDS")
    video_fps: int = Field(default=30, alias="VIDEO_FPS")

    # External Video API (Veo / Kling / Runway)
    external_video_api_provider: Literal["veo", "kling", "runway"] = Field(
        default="veo", alias="EXTERNAL_VIDEO_API_PROVIDER"
    )
    external_video_api_key: str = Field(default="", alias="EXTERNAL_VIDEO_API_KEY")
    external_video_api_base_url: str = Field(
        default="", alias="EXTERNAL_VIDEO_API_BASE_URL"
    )

    # Google Drive Service Account (file path for local dev OR JSON/base64 env var for Cloud PaaS)
    google_service_account_file: str = Field(
        default="./service_account.json", alias="GOOGLE_SERVICE_ACCOUNT_FILE"
    )
    google_service_account_json: str = Field(
        default="", alias="GOOGLE_SERVICE_ACCOUNT_JSON"
    )
    google_drive_root_folder_id: str = Field(
        default="", alias="GOOGLE_DRIVE_ROOT_FOLDER_ID"
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def resolved_tmp_outputs_dir(self) -> Path:
        p = Path(self.tmp_outputs_dir)
        if not p.is_absolute():
            p = PROJECT_ROOT / p
        return p.resolve()

    @property
    def resolved_service_account_path(self) -> Path:
        p = Path(self.google_service_account_file)
        if not p.is_absolute():
            p = PROJECT_ROOT / p
        return p.resolve()

    @property
    def ffmpeg_available(self) -> bool:
        return shutil.which(self.ffmpeg_bin) is not None

    def get_service_account_info(self) -> dict | None:
        """
        Load Google Service Account JSON dict from GOOGLE_SERVICE_ACCOUNT_JSON
        (supports raw JSON or base64-encoded JSON for Render/Railway/Cloud Run)
        or from GOOGLE_SERVICE_ACCOUNT_FILE.
        """
        import base64
        import json

        raw_env = (self.google_service_account_json or "").strip()
        if raw_env:
            try:
                parsed = json.loads(raw_env)
            except json.JSONDecodeError:
                try:
                    decoded = base64.b64decode(raw_env).decode("utf-8")
                    parsed = json.loads(decoded)
                except Exception as exc:
                    raise RuntimeError(
                        "GOOGLE_SERVICE_ACCOUNT_JSON is neither valid JSON nor valid Base64 JSON."
                    ) from exc
            if not isinstance(parsed, dict) or "client_email" not in parsed:
                raise RuntimeError(
                    "GOOGLE_SERVICE_ACCOUNT_JSON must be a valid Google Service Account JSON object."
                )
            return parsed

        sa_path = self.resolved_service_account_path
        if sa_path.exists() and sa_path.is_file():
            try:
                parsed = json.loads(sa_path.read_text(encoding="utf-8"))
            except Exception as exc:
                raise RuntimeError(
                    f"Failed to parse GOOGLE_SERVICE_ACCOUNT_FILE at '{sa_path}': {exc}"
                ) from exc
            return parsed

        return None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def validate_startup_config(settings: Settings | None = None, strict: bool = True) -> list[str]:
    """
    Validate required environment variables and system binaries on startup.

    - When MOCK_MODE=false and strict=True, raises RuntimeError if critical API
      credentials or Service Account settings are missing.
    - Returns a list of non-fatal warnings.
    """
    cfg = settings or get_settings()
    errors: list[str] = []
    warnings: list[str] = []

    # Ensure local checkpoint & SQLite parent directories exist (cloud-safe)
    cfg.resolved_tmp_outputs_dir.mkdir(parents=True, exist_ok=True)
    (cfg.resolved_tmp_outputs_dir / "uploads").mkdir(parents=True, exist_ok=True)

    if cfg.database_url.startswith("sqlite:///"):
        db_file_str = cfg.database_url.removeprefix("sqlite:///")
        if db_file_str and db_file_str != ":memory:":
            db_parent = Path(db_file_str).parent
            if str(db_parent) not in {"", "."}:
                db_parent.mkdir(parents=True, exist_ok=True)

    if cfg.video_provider == "ffmpeg" and not cfg.ffmpeg_available:
        msg = (
            f"FFmpeg binary '{cfg.ffmpeg_bin}' was not found on PATH. "
            "Install FFmpeg (see README.md) before generating videos."
        )
        warnings.append(msg)
        logger.warning(msg)

    if cfg.mock_mode:
        warnings.append(
            "Running with MOCK_MODE=true (AI scoring & Google Drive upload are simulated; FFmpeg renders real videos)."
        )
        return warnings

    # Production / live mode strict checks
    if not cfg.gemini_api_key.strip():
        errors.append("GEMINI_API_KEY is required when MOCK_MODE=false.")

    if not cfg.google_drive_root_folder_id.strip():
        errors.append("GOOGLE_DRIVE_ROOT_FOLDER_ID is required when MOCK_MODE=false.")

    try:
        sa_info = cfg.get_service_account_info()
    except RuntimeError as exc:
        sa_info = None
        errors.append(str(exc))

    if sa_info is None:
        sa_path = cfg.resolved_service_account_path
        errors.append(
            f"Google Service Account credentials missing: set GOOGLE_SERVICE_ACCOUNT_JSON (for Cloud) "
            f"or place GOOGLE_SERVICE_ACCOUNT_FILE at '{sa_path}'."
        )

    if cfg.video_provider == "external" and not cfg.external_video_api_key.strip():
        errors.append(
            "EXTERNAL_VIDEO_API_KEY is required when VIDEO_PROVIDER=external and MOCK_MODE=false."
        )

    if errors and strict:
        raise RuntimeError(
            "Invalid startup configuration:\n - " + "\n - ".join(errors)
        )

    warnings.extend(errors)
    return warnings


def reload_settings() -> Settings:
    """Clear settings cache (useful in tests when mutating environment)."""
    get_settings.cache_clear()
    return get_settings()
