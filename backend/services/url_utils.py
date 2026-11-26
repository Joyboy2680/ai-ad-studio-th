from __future__ import annotations

import hashlib
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

# Common e-commerce / affiliate tracking query parameters stripped before hashing
TRACKING_PARAM_PREFIXES = ("utm_", "af_", "tt_", "shopee_")
TRACKING_PARAM_EXACT = {
    "fbclid",
    "gclid",
    "igshid",
    "sp_atk",
    "xptdk",
    "sender_device",
    "is_from_webapp",
    "ref",
    "referrer",
    "click_id",
    "pid",
    "c",
    "uls_trackid",
    "mmp_pid",
    "smtt",
}


def normalize_product_url(raw_url: str) -> str:
    """
    Normalize a Shopee/TikTok/e-commerce product URL for reliable SHA-256 deduplication.

    - Lowercases scheme and host, removes default ports (:80, :443)
    - Strips trailing slashes from the path
    - Strips known affiliate/analytics tracking query parameters
    - Sorts remaining query parameters deterministically
    - Drops URL fragments
    """
    cleaned = raw_url.strip()
    if not cleaned:
        raise ValueError("product_url cannot be empty")

    if "://" not in cleaned:
        cleaned = f"https://{cleaned}"

    parts = urlsplit(cleaned)
    scheme = (parts.scheme or "https").lower()
    hostname = (parts.hostname or "").lower()
    if not hostname:
        raise ValueError(f"Invalid product_url: {raw_url}")

    port = parts.port
    if (scheme == "http" and port == 80) or (scheme == "https" and port == 443):
        netloc = hostname
    elif port:
        netloc = f"{hostname}:{port}"
    else:
        netloc = hostname

    path = re.sub(r"/{2,}", "/", parts.path or "").rstrip("/")

    filtered_query: list[tuple[str, str]] = []
    for k, v in parse_qsl(parts.query, keep_blank_values=False):
        kl = k.lower()
        if kl in TRACKING_PARAM_EXACT or any(
            kl.startswith(prefix) for prefix in TRACKING_PARAM_PREFIXES
        ):
            continue
        filtered_query.append((k, v))

    filtered_query.sort(key=lambda item: (item[0], item[1]))
    query = urlencode(filtered_query, doseq=True)

    return urlunsplit((scheme, netloc, path, query, ""))


def compute_url_hash(raw_url: str) -> tuple[str, str]:
    """Return (normalized_url, sha256_hex) for duplicate prevention."""
    normalized = normalize_product_url(raw_url)
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return normalized, digest


def slugify_product_name(name: str, product_id: int | None = None) -> str:
    """
    Create a filesystem- and Google-Drive-safe folder slug preserving Thai & ASCII characters.
    """
    text = (name or "product").strip().lower()
    # Replace disallowed filesystem characters and whitespace with hyphens
    text = re.sub(r'[\\/:*?"<>|\s]+', "-", text)
    # Keep Thai unicode block (\u0E00-\u0E7F), word chars, and hyphens
    text = re.sub(r"[^\w\u0E00-\u0E7F\-]", "", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    if not text:
        text = "product"
    text = text[:48].rstrip("-")
    if product_id is not None:
        return f"{text}-p{product_id}"
    return text
