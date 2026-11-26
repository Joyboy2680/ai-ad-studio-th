#!/usr/bin/env bash
set -euo pipefail

echo "==> [1/4] Installing FFmpeg and Thai OpenType font (Loma)..."
sudo apt-get update -qq
sudo apt-get install -y -qq --no-install-recommends ffmpeg fonts-tlwg-loma-otf

echo "==> [2/4] Setting up Python virtualenv & backend dependencies..."
python3 -m venv .venv
.venv/bin/pip install --upgrade pip -q
.venv/bin/pip install -r backend/requirements.txt -q

echo "==> [3/4] Installing & building React frontend..."
(cd frontend && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund) && npm run build)

echo "==> [4/4] Preparing .env file..."
if [ ! -f .env ]; then
  cp .env.example .env
fi

echo "✅ Setup complete! FastAPI + React + FFmpeg are ready on GitHub Codespaces."
