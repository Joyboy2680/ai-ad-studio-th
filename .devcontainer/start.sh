#!/usr/bin/env bash
set -euo pipefail

if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
  echo "✅ Affiliate Pipeline server is already running on port 8000."
  exit 0
fi

echo "==> Starting Affiliate Auto-Content & Video Pipeline on port 8000..."
nohup .venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 >/tmp/affiliate_server.log 2>&1 &

for _ in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    echo "✅ Server ready! Open the forwarded port 8000 tab (Affiliate Pipeline App) in your browser."
    echo "   Logs: tail -f /tmp/affiliate_server.log"
    exit 0
  fi
  sleep 1
done

echo "⚠️  Server is starting slowly; check logs with: cat /tmp/affiliate_server.log"
