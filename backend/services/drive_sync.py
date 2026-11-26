from __future__ import annotations

import json
import logging
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from backend.config import Settings, get_settings
from backend.models import Product
from backend.services.url_utils import slugify_product_name

logger = logging.getLogger(__name__)

DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder"
DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"]


@dataclass
class DriveSyncResult:
    """Result returned after syncing all 3 deliverables to Google Drive (or mock Drive)."""

    folder_id: str
    folder_url: str
    caption_path: Path
    metadata_path: Path
    uploaded_files: list[str]


class GoogleDriveSyncService:
    """
    Syncs product video deliverables to Google Drive via Service Account (Drive API v3).

    Folder hierarchy inside GOOGLE_DRIVE_ROOT_FOLDER_ID:
        /{YYYY-MM-DD}/{product_slug}/
            ├── video_final.mp4
            ├── caption_hashtags.txt
            └── metadata.json
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def build_local_text_artifacts(
        self, product: Product, output_dir: Path
    ) -> tuple[Path, Path]:
        """Create caption_hashtags.txt and metadata.json locally before uploading."""
        output_dir.mkdir(parents=True, exist_ok=True)

        affiliate_link = (product.affiliate_url or product.product_url).strip()
        hashtags_line = " ".join(product.hashtags)

        caption_lines = [
            f"[HOOK 3 วินาที]\n{product.hook_text or ''}",
            f"[แคปชันภาษาไทย]\n{product.caption_th or ''}",
            f"[แฮชแท็ก]\n{hashtags_line}",
            f"[ลิงก์ Affiliate / พิกัดสินค้า]\n{affiliate_link}",
        ]
        caption_path = output_dir / "caption_hashtags.txt"
        caption_path.write_text("\n\n".join(caption_lines).strip() + "\n", encoding="utf-8")

        metadata = {
            "product_id": product.id,
            "job_id": product.job_id,
            "name": product.name,
            "product_url": product.product_url,
            "normalized_url": product.normalized_url,
            "affiliate_url": affiliate_link,
            "price_thb": product.price,
            "commission_pct": product.commission_pct,
            "trend_keyword": product.trend_keyword,
            "demand_score": product.demand_score,
            "buy_probability_reasoning": product.buy_probability_reasoning,
            "content_angle": product.content_angle,
            "hook_text": product.hook_text,
            "i2v_video_prompt": product.i2v_video_prompt,
            "caption_th": product.caption_th,
            "hashtags": product.hashtags,
            "video_provider": self.settings.video_provider,
            "synced_at_utc": datetime.now(timezone.utc).isoformat(),
        }
        metadata_path = output_dir / "metadata.json"
        metadata_path.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

        return caption_path, metadata_path

    def sync_product_bundle(
        self,
        product: Product,
        local_video_path: Path,
        output_dir: Path,
    ) -> DriveSyncResult:
        """Upload video_final.mp4, caption_hashtags.txt, and metadata.json into /{YYYY-MM-DD}/{product_slug}/."""
        if not local_video_path.exists():
            raise FileNotFoundError(
                f"Local video checkpoint not found at '{local_video_path}'"
            )

        caption_path, metadata_path = self.build_local_text_artifacts(product, output_dir)
        date_folder_name = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        product_slug = slugify_product_name(product.name, product.id)

        if self.settings.mock_mode:
            return self._mock_sync(
                date_folder_name=date_folder_name,
                product_slug=product_slug,
                local_video_path=local_video_path,
                caption_path=caption_path,
                metadata_path=metadata_path,
            )

        return self._real_drive_sync(
            date_folder_name=date_folder_name,
            product_slug=product_slug,
            local_video_path=local_video_path,
            caption_path=caption_path,
            metadata_path=metadata_path,
        )

    def _mock_sync(
        self,
        *,
        date_folder_name: str,
        product_slug: str,
        local_video_path: Path,
        caption_path: Path,
        metadata_path: Path,
    ) -> DriveSyncResult:
        """Simulate Google Drive folder creation and 3-file upload inside ./tmp_outputs/mock_drive/."""
        mock_dir = (
            self.settings.resolved_tmp_outputs_dir
            / "mock_drive"
            / date_folder_name
            / product_slug
        )
        mock_dir.mkdir(parents=True, exist_ok=True)

        shutil.copy2(local_video_path, mock_dir / "video_final.mp4")
        shutil.copy2(caption_path, mock_dir / "caption_hashtags.txt")
        shutil.copy2(metadata_path, mock_dir / "metadata.json")

        folder_id = f"mock-{date_folder_name}-{product_slug}"
        folder_url = f"https://drive.google.com/drive/folders/{folder_id}"

        logger.info("MOCK_MODE Drive sync complete -> %s", mock_dir)
        return DriveSyncResult(
            folder_id=folder_id,
            folder_url=folder_url,
            caption_path=caption_path,
            metadata_path=metadata_path,
            uploaded_files=["video_final.mp4", "caption_hashtags.txt", "metadata.json"],
        )

    def _real_drive_sync(
        self,
        *,
        date_folder_name: str,
        product_slug: str,
        local_video_path: Path,
        caption_path: Path,
        metadata_path: Path,
    ) -> DriveSyncResult:
        root_folder_id = self.settings.google_drive_root_folder_id.strip()
        if not root_folder_id:
            raise RuntimeError("GOOGLE_DRIVE_ROOT_FOLDER_ID is required when MOCK_MODE=false.")

        sa_info = self.settings.get_service_account_info()
        if sa_info is None:
            sa_path = self.settings.resolved_service_account_path
            raise RuntimeError(
                f"Service Account credentials missing: set GOOGLE_SERVICE_ACCOUNT_JSON "
                f"or place service_account.json at '{sa_path}'."
            )

        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload

        creds = service_account.Credentials.from_service_account_info(
            sa_info,
            scopes=DRIVE_SCOPES,
        )
        service = build("drive", "v3", credentials=creds, cache_discovery=False)

        date_folder_id = self._get_or_create_folder(
            service, date_folder_name, root_folder_id
        )
        product_folder_id = self._get_or_create_folder(
            service, product_slug, date_folder_id
        )

        uploads = [
            ("video_final.mp4", local_video_path, "video/mp4"),
            ("caption_hashtags.txt", caption_path, "text/plain"),
            ("metadata.json", metadata_path, "application/json"),
        ]
        uploaded_names: list[str] = []
        for target_name, local_path, mime_type in uploads:
            self._upload_or_replace_file(
                service=service,
                parent_id=product_folder_id,
                filename=target_name,
                local_path=local_path,
                mime_type=mime_type,
                media_upload_cls=MediaFileUpload,
            )
            uploaded_names.append(target_name)

        folder_url = f"https://drive.google.com/drive/folders/{product_folder_id}"
        logger.info("Google Drive sync complete -> %s", folder_url)
        return DriveSyncResult(
            folder_id=product_folder_id,
            folder_url=folder_url,
            caption_path=caption_path,
            metadata_path=metadata_path,
            uploaded_files=uploaded_names,
        )

    @staticmethod
    def _escape_drive_query(value: str) -> str:
        return value.replace("\\", "\\\\").replace("'", "\\'")

    def _get_or_create_folder(self, service, folder_name: str, parent_id: str) -> str:
        escaped = self._escape_drive_query(folder_name)
        query = (
            f"name = '{escaped}' and '{parent_id}' in parents "
            f"and mimeType = '{DRIVE_FOLDER_MIME}' and trashed = false"
        )
        result = (
            service.files()
            .list(
                q=query,
                spaces="drive",
                fields="files(id, name)",
                pageSize=1,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        files = result.get("files", [])
        if files:
            return files[0]["id"]

        created = (
            service.files()
            .create(
                body={
                    "name": folder_name,
                    "mimeType": DRIVE_FOLDER_MIME,
                    "parents": [parent_id],
                },
                fields="id",
                supportsAllDrives=True,
            )
            .execute()
        )
        return created["id"]

    def _upload_or_replace_file(
        self,
        *,
        service,
        parent_id: str,
        filename: str,
        local_path: Path,
        mime_type: str,
        media_upload_cls,
    ) -> str:
        escaped = self._escape_drive_query(filename)
        query = f"name = '{escaped}' and '{parent_id}' in parents and trashed = false"
        existing = (
            service.files()
            .list(
                q=query,
                spaces="drive",
                fields="files(id)",
                pageSize=1,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
            .get("files", [])
        )

        media = media_upload_cls(
            str(local_path),
            mimetype=mime_type,
            resumable=True,
        )
        if existing:
            file_id = existing[0]["id"]
            service.files().update(
                fileId=file_id,
                media_body=media,
                supportsAllDrives=True,
            ).execute()
            return file_id

        created = (
            service.files()
            .create(
                body={"name": filename, "parents": [parent_id]},
                media_body=media,
                fields="id",
                supportsAllDrives=True,
            )
            .execute()
        )
        return created["id"]
