# ============================================================
# Stage 1: Build React (Vite + Tailwind) Frontend
# ============================================================
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ============================================================
# Stage 2: Python 3.12 + FFmpeg + Thai Fonts + FastAPI Runtime
# ============================================================
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    MOCK_MODE=true \
    VIDEO_PROVIDER=ffmpeg \
    DATABASE_URL=sqlite:////data/affiliate_pipeline.db \
    TMP_OUTPUTS_DIR=/data/tmp_outputs \
    THAI_FONT_PATH=/usr/share/fonts/opentype/tlwg/Loma-Bold.otf

WORKDIR /app

# Install FFmpeg and Thai OpenType font (Loma) for crisp 9:16 Thai hook rendering
RUN apt-get update -qq \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        fonts-tlwg-loma-otf \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r backend/requirements.txt

COPY backend/ ./backend/
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Prepare persistent data directory (writable for both root and non-root cloud runners)
RUN mkdir -p /data/tmp_outputs/uploads && chmod -R 777 /data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/health" || exit 1

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
