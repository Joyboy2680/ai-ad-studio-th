from __future__ import annotations

import base64
import logging
import os
import shutil
import subprocess
import textwrap
from abc import ABC, abstractmethod
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Optional

import httpx
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from backend.config import PROJECT_ROOT, Settings, get_settings

logger = logging.getLogger(__name__)

# Candidate Thai-capable fonts across Linux, macOS, and Windows
CANDIDATE_THAI_FONTS: tuple[str, ...] = (
    "/usr/share/fonts/opentype/tlwg/Loma-Bold.otf",
    "/usr/share/fonts/opentype/tlwg/Loma.otf",
    "/usr/share/fonts/truetype/noto/NotoSansThai-Bold.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf",
    "/usr/share/fonts/truetype/tlwg/Loma-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "C:/Windows/Fonts/LeelaUIb.ttf",
    "C:/Windows/Fonts/leelawdb.ttf",
    "C:/Windows/Fonts/tahomabd.ttf",
    "C:/Windows/Fonts/tahoma.ttf",
    "/System/Library/Fonts/Thonburi.ttc",
)


@dataclass
class VideoGenerationRequest:
    """Inputs passed to any BaseVideoProvider implementation."""

    job_id: str
    product_name: str
    image_url: str
    video_prompt: str
    hook_text: str
    output_dir: Path
    price: float = 0.0
    commission_pct: float = 0.0


class BaseVideoProvider(ABC):
    """Strategy/Adapter interface for local FFmpeg or external Image-to-Video APIs."""

    @abstractmethod
    def generate(self, request: VideoGenerationRequest) -> Path:
        """Generate a 9:16 vertical MP4 at `{request.output_dir}/video_final.mp4` and return its Path."""


class FFmpegLocalProvider(BaseVideoProvider):
    """
    Default safe/free local video provider.

    Takes the real product image, composes a clean 9:16 vertical studio frame,
    applies smooth Ken Burns pan/zoom animation via FFmpeg, overlays the Thai
    hook banner, and outputs `video_final.mp4` (1080x1920, 30fps, H.264).
    """

    OUTPUT_WIDTH = 1080
    OUTPUT_HEIGHT = 1920

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def generate(self, request: VideoGenerationRequest) -> Path:
        ffmpeg_bin = self.settings.ffmpeg_bin
        if not shutil.which(ffmpeg_bin):
            raise RuntimeError(
                f"FFmpeg binary '{ffmpeg_bin}' not found on PATH. "
                "Please install FFmpeg before running local video generation."
            )

        request.output_dir.mkdir(parents=True, exist_ok=True)
        raw_img = self._load_source_image(request)

        # Build high-res 9:16 studio canvas (1620x2880) so zoompan stays sharp at 1080x1920
        canvas_path = request.output_dir / "source_canvas_9x16.png"
        self._build_vertical_canvas(raw_img, canvas_path)

        # Render crisp Thai hook overlay PNG (transparent 1080x1920)
        overlay_path = request.output_dir / "hook_overlay.png"
        self._render_hook_overlay(request.hook_text or request.product_name, overlay_path)

        output_video = request.output_dir / "video_final.mp4"
        fps = max(24, int(self.settings.video_fps or 30))
        duration = max(3, int(self.settings.video_duration_seconds or 5))
        total_frames = fps * duration

        # Smooth Ken Burns zoom-in (1.0 -> 1.16) + gentle horizontal drift, then composite hook overlay
        filter_complex = (
            f"[0:v]zoompan="
            f"z='min(zoom+0.0011,1.16)':"
            f"x='iw/2-(iw/zoom/2)+sin(on/45)*18':"
            f"y='ih/2-(ih/zoom/2)':"
            f"d={total_frames}:s={self.OUTPUT_WIDTH}x{self.OUTPUT_HEIGHT}:fps={fps},"
            f"format=rgba[bg];"
            f"[bg][1:v]overlay=0:0:shortest=1,format=yuv420p[vout]"
        )

        cmd = [
            ffmpeg_bin,
            "-y",
            "-loop",
            "1",
            "-i",
            str(canvas_path),
            "-loop",
            "1",
            "-i",
            str(overlay_path),
            "-filter_complex",
            filter_complex,
            "-map",
            "[vout]",
            "-t",
            str(duration),
            "-r",
            str(fps),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "22",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(output_video),
        ]

        logger.info("Running FFmpeg local video render for job %s", request.job_id)
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=180,
            check=False,
        )
        if proc.returncode != 0 or not output_video.exists():
            stderr_tail = (proc.stderr or "")[-800:]
            raise RuntimeError(
                f"FFmpeg exited with code {proc.returncode}: {stderr_tail}"
            )

        return output_video

    def _load_source_image(self, request: VideoGenerationRequest) -> Image.Image:
        url = (request.image_url or "").strip()

        # 1. Data URI (base64 image)
        if url.startswith("data:image/") and "," in url:
            _, b64_part = url.split(",", 1)
            return Image.open(BytesIO(base64.b64decode(b64_part))).convert("RGB")

        # 2. Local uploaded file path (/uploads/xxx or relative/absolute filesystem path)
        local_candidates: list[Path] = []
        if url.startswith("/uploads/"):
            filename = url.removeprefix("/uploads/").lstrip("/")
            local_candidates.append(self.settings.resolved_tmp_outputs_dir / "uploads" / filename)
        elif not url.startswith(("http://", "https://")):
            p = Path(url)
            local_candidates.append(p)
            if not p.is_absolute():
                local_candidates.append(PROJECT_ROOT / p)

        for cand in local_candidates:
            if cand.exists() and cand.is_file():
                return Image.open(cand).convert("RGB")

        # 3. Remote HTTP/HTTPS image URL
        if url.startswith(("http://", "https://")):
            try:
                with httpx.Client(
                    timeout=15.0,
                    follow_redirects=True,
                    headers={"User-Agent": "AffiliateStudioBot/1.0"},
                ) as client:
                    resp = client.get(url)
                    resp.raise_for_status()
                    return Image.open(BytesIO(resp.content)).convert("RGB")
            except Exception as exc:
                if not self.settings.mock_mode:
                    raise RuntimeError(
                        f"Failed to download product image from '{url}': {exc}"
                    ) from exc
                logger.warning(
                    "MOCK_MODE fallback: could not download image '%s' (%s). Generating clean studio card.",
                    url,
                    exc,
                )
                return self._create_mock_product_image(request)

        if self.settings.mock_mode:
            return self._create_mock_product_image(request)

        raise RuntimeError(f"Unsupported or missing product image source: '{url}'")

    def _create_mock_product_image(self, request: VideoGenerationRequest) -> Image.Image:
        """Generate a clean product studio placeholder ONLY when MOCK_MODE=true and image URL is offline."""
        img = Image.new("RGB", (1080, 1080), (24, 28, 38))
        draw = ImageDraw.Draw(img)

        # Subtle warm studio gradient bands
        for y in range(1080):
            ratio = y / 1080
            r = int(28 + ratio * 38)
            g = int(34 + ratio * 24)
            b = int(52 + ratio * 28)
            draw.line([(0, y), (1080, y)], fill=(r, g, b))

        # Product pedestal card
        draw.rounded_rectangle(
            [(140, 180), (940, 900)],
            radius=48,
            fill=(248, 250, 252),
            outline=(226, 232, 240),
            width=6,
        )
        # Accent emblem inside product card
        draw.rounded_rectangle(
            [(220, 260), (860, 620)],
            radius=32,
            fill=(15, 118, 110),
        )

        title_font = self._load_thai_font(44)
        sub_font = self._load_thai_font(34)
        wrapped = textwrap.fill(request.product_name[:60], width=22)
        draw.multiline_text(
            (540, 440),
            wrapped,
            font=title_font,
            fill=(255, 255, 255),
            anchor="mm",
            align="center",
        )
        price_label = f"ราคาพิเศษ ฿{request.price:,.0f}" if request.price else "สินค้าแนะนำ"
        draw.text(
            (540, 760),
            price_label,
            font=sub_font,
            fill=(15, 23, 42),
            anchor="mm",
        )
        return img

    def _build_vertical_canvas(self, src: Image.Image, dest_path: Path) -> None:
        """
        Compose any aspect ratio product photo onto a crisp 1620x2880 (9:16) canvas:
        blurred darkened ambient background + sharp centered product photo with soft drop frame.
        """
        canvas_w, canvas_h = 1620, 2880

        # Background: cover-cropped + heavily blurred + slightly darkened
        src_ratio = src.width / max(src.height, 1)
        canvas_ratio = canvas_w / canvas_h
        if src_ratio > canvas_ratio:
            bg_h = canvas_h
            bg_w = int(bg_h * src_ratio)
        else:
            bg_w = canvas_w
            bg_h = int(bg_w / src_ratio)

        bg = src.resize((bg_w, bg_h), Image.Resampling.LANCZOS)
        left = (bg_w - canvas_w) // 2
        top = (bg_h - canvas_h) // 2
        bg = bg.crop((left, top, left + canvas_w, top + canvas_h))
        bg = bg.filter(ImageFilter.GaussianBlur(radius=42))

        dark_tint = Image.new("RGBA", (canvas_w, canvas_h), (10, 14, 22, 125))
        canvas = Image.alpha_composite(bg.convert("RGBA"), dark_tint)

        # Foreground: fit cleanly within central safe area preserving exact product proportions
        max_fg_w = int(canvas_w * 0.86)
        max_fg_h = int(canvas_h * 0.62)
        fg = src.copy()
        fg.thumbnail((max_fg_w, max_fg_h), Image.Resampling.LANCZOS)

        fg_x = (canvas_w - fg.width) // 2
        fg_y = (canvas_h - fg.height) // 2 + 80

        # Soft shadow plate behind product image
        shadow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        shadow_draw = ImageDraw.Draw(shadow)
        shadow_draw.rounded_rectangle(
            [(fg_x - 12, fg_y - 12), (fg_x + fg.width + 12, fg_y + fg.height + 16)],
            radius=36,
            fill=(0, 0, 0, 130),
        )
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=22))
        canvas = Image.alpha_composite(canvas, shadow)

        # Rounded mask for product image
        mask = Image.new("L", fg.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [(0, 0), (fg.width, fg.height)], radius=32, fill=255
        )
        fg_rgba = fg.convert("RGBA")
        canvas.paste(fg_rgba, (fg_x, fg_y), mask)

        canvas.convert("RGB").save(dest_path, format="PNG")

    def _render_hook_overlay(self, hook_text: str, dest_path: Path) -> None:
        """Render a transparent 1080x1920 PNG with a high-contrast Thai hook text banner."""
        overlay = Image.new("RGBA", (self.OUTPUT_WIDTH, self.OUTPUT_HEIGHT), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        clean_hook = " ".join((hook_text or "").split())[:90]
        if not clean_hook:
            overlay.save(dest_path, format="PNG")
            return

        font = self._load_thai_font(54)
        wrapped = textwrap.fill(clean_hook, width=22)

        bbox = draw.multiline_textbbox((0, 0), wrapped, font=font, spacing=14, align="center")
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]

        pad_x, pad_y = 48, 30
        box_w = min(self.OUTPUT_WIDTH - 96, text_w + pad_x * 2)
        box_h = text_h + pad_y * 2
        box_x = (self.OUTPUT_WIDTH - box_w) // 2
        box_y = 220  # Safe zone below TikTok top UI chrome

        # Subtle amber/coral accent strip + dark frosted pill background
        draw.rounded_rectangle(
            [(box_x, box_y), (box_x + box_w, box_y + box_h)],
            radius=28,
            fill=(15, 23, 42, 220),
            outline=(251, 191, 36, 230),
            width=4,
        )

        text_x = self.OUTPUT_WIDTH // 2
        text_y = box_y + box_h // 2
        draw.multiline_text(
            (text_x, text_y),
            wrapped,
            font=font,
            fill=(255, 255, 255, 255),
            anchor="mm",
            spacing=14,
            align="center",
        )

        # Subtle bottom CTA pill in TikTok-safe zone (above bottom caption overlay)
        cta_font = self._load_thai_font(34)
        cta_text = "กดดูพิกัดที่ตะกร้าเหลือง 👇"
        cta_bbox = draw.textbbox((0, 0), cta_text, font=cta_font)
        cta_w = (cta_bbox[2] - cta_bbox[0]) + 64
        cta_h = (cta_bbox[3] - cta_bbox[1]) + 32
        cta_x = (self.OUTPUT_WIDTH - cta_w) // 2
        cta_y = 1520
        draw.rounded_rectangle(
            [(cta_x, cta_y), (cta_x + cta_w, cta_y + cta_h)],
            radius=999,
            fill=(234, 88, 12, 230),
        )
        draw.text(
            (self.OUTPUT_WIDTH // 2, cta_y + cta_h // 2),
            cta_text,
            font=cta_font,
            fill=(255, 255, 255, 255),
            anchor="mm",
        )

        overlay.save(dest_path, format="PNG")

    def _load_thai_font(self, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
        candidates: list[str] = []
        if self.settings.thai_font_path:
            candidates.append(self.settings.thai_font_path)
        candidates.extend(CANDIDATE_THAI_FONTS)

        for path_str in candidates:
            if path_str and os.path.exists(path_str):
                try:
                    return ImageFont.truetype(path_str, size=size)
                except OSError:
                    continue

        logger.warning("No Thai TTF/OTF font found; falling back to PIL default font.")
        return ImageFont.load_default()


class ExternalVideoAPIProvider(BaseVideoProvider):
    """
    Clean adapter skeleton ready for external Image-to-Video APIs (Veo / Kling / Runway).

    Uses `request.image_url` + `request.video_prompt` to submit an async I2V job,
    polls until completion, and downloads the resulting 9:16 MP4 into
    `{request.output_dir}/video_final.mp4`.
    """

    DEFAULT_ENDPOINTS: dict[str, str] = {
        "veo": "https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning",
        "kling": "https://api.klingai.com/v1/videos/image2video",
        "runway": "https://api.dev.runwayml.com/v1/image_to_video",
    }

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def build_payload(self, request: VideoGenerationRequest) -> dict:
        """Build provider-specific Image-to-Video request payload."""
        provider = self.settings.external_video_api_provider
        if provider == "veo":
            return {
                "instances": [
                    {
                        "prompt": request.video_prompt,
                        "image": {"imageUri": request.image_url},
                    }
                ],
                "parameters": {
                    "aspectRatio": "9:16",
                    "durationSeconds": self.settings.video_duration_seconds,
                },
            }
        if provider == "kling":
            return {
                "model_name": "kling-v1-6",
                "image": request.image_url,
                "prompt": request.video_prompt,
                "aspect_ratio": "9:16",
                "duration": str(self.settings.video_duration_seconds),
            }
        # runway
        return {
            "model": "gen3a_turbo",
            "promptImage": request.image_url,
            "promptText": request.video_prompt,
            "ratio": "768:1280",
            "duration": self.settings.video_duration_seconds,
        }

    def generate(self, request: VideoGenerationRequest) -> Path:
        provider = self.settings.external_video_api_provider
        api_key = self.settings.external_video_api_key.strip()
        endpoint = (
            self.settings.external_video_api_base_url.strip()
            or self.DEFAULT_ENDPOINTS[provider]
        )

        if not api_key:
            raise RuntimeError(
                f"ExternalVideoAPIProvider ({provider}) requires EXTERNAL_VIDEO_API_KEY in .env. "
                "Switch VIDEO_PROVIDER=ffmpeg for free local video rendering."
            )

        request.output_dir.mkdir(parents=True, exist_ok=True)
        payload = self.build_payload(request)

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if provider == "runway":
            headers["X-Runway-Version"] = "2024-11-06"

        # Step 1: Submit generation job
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(endpoint, json=payload, headers=headers)
            resp.raise_for_status()
            job_data = resp.json()

        # Step 2: Poll job status & download resulting MP4
        # NOTE: Provider polling URLs and video download fields vary by account tier/API version.
        # Implement provider-specific polling once your Veo/Kling/Runway API plan is provisioned.
        video_download_url: Optional[str] = (
            job_data.get("video_url")
            or job_data.get("output_url")
        )
        if not video_download_url:
            raise NotImplementedError(
                f"ExternalVideoAPIProvider ({provider}) submitted job successfully "
                f"(response keys: {list(job_data.keys())}), but polling for async job completion "
                "must be wired to your active provider status endpoint."
            )

        output_video = request.output_dir / "video_final.mp4"
        with httpx.Client(timeout=180.0, follow_redirects=True) as client:
            video_resp = client.get(video_download_url)
            video_resp.raise_for_status()
            output_video.write_bytes(video_resp.content)

        return output_video


def get_video_provider(settings: Settings | None = None) -> BaseVideoProvider:
    """Factory returning the configured video provider strategy."""
    cfg = settings or get_settings()
    if cfg.video_provider == "external":
        return ExternalVideoAPIProvider(cfg)
    return FFmpegLocalProvider(cfg)
