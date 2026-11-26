# Affiliate Auto-Content & Video Pipeline (TikTok / Shopee)

Production-ready **Human-in-the-Loop (Semi-Auto 90%)** web application for TikTok & Shopee Affiliate content automation.

> **Safety First:** Video generation **never** triggers automatically on product ingestion. Every product stops at `SCORED` until a human reviews the score, product image, I2V prompt, Thai caption, and hashtags, then clicks **`[อนุมัติและสร้างวิดีโอ]`**.

---

## 1. Architecture & State Machine

Every product is tracked in SQLite (SQLAlchemy + WAL mode) through a strict state machine:

```text
DRAFT ──► SCORED ──► APPROVED ──► GENERATING_VIDEO ──► SYNCING_DRIVE ──► READY_TO_POST
   │         │           │                │                  │
   └─────────┴───────────┴────────────────┴──────────────────┴──► FAILED (Checkpoint Retry)
```

- **Deduplication**: Product URLs are normalized (tracking parameters such as `utm_*`, `sp_atk`, `fbclid`, `xptdk` stripped) and hashed via `SHA-256` with a `UNIQUE` DB constraint.
- **AI Analyzer (`google-genai`)**: Uses strict Pydantic v2 `response_schema` structured output (zero regex JSON parsing) and rotates `content_angle` (`PAIN_POINT`, `HONEST_REVIEW`, `COMPARISON`, `PROBLEM_SOLVER`).
- **Async Background Worker**: Uses Python `concurrent.futures.ThreadPoolExecutor` — **no Redis/Celery required**, runs cleanly on Windows, macOS, and Linux.
- **Video Provider Strategy (`BaseVideoProvider`)**:
  - `FFmpegLocalProvider` *(default)*: Smooth 9:16 vertical Ken Burns pan/zoom + Thai hook banner overlay -> `video_final.mp4` (`1080x1920`, `30fps`).
  - `ExternalVideoAPIProvider`: Clean adapter skeleton ready for Veo / Kling / Runway Image-to-Video APIs.
- **Checkpoint Recovery (`POST /api/products/{id}/retry`)**: Persists `local_video_path`, `drive_folder_url`, `failed_stage`, and `last_error`. If Drive sync fails, retrying uploads the existing local `video_final.mp4` **without regenerating the video**.
- **Google Drive Auto-Sync (Service Account, Drive API v3)**: Creates `/{YYYY-MM-DD}/{product_slug}/` inside `GOOGLE_DRIVE_ROOT_FOLDER_ID` and uploads:
  1. `video_final.mp4`
  2. `caption_hashtags.txt` (Hook + Thai Caption + Hashtags + Affiliate Link)
  3. `metadata.json` (Product info, Demand Score, Angle, Prompt used, Timestamp)

---

## 2. Directory Structure

```text
├── .env.example
├── pytest.ini
├── backend/
│   ├── requirements.txt
│   ├── config.py                  # Startup .env & FFmpeg validation
│   ├── database.py                # SQLAlchemy (SQLite WAL mode)
│   ├── models.py                  # Product ORM + ProductStatus / FailedStage enums
│   ├── schemas.py                 # Pydantic v2 + Gemini AIAnalysisResult schema
│   ├── main.py                    # FastAPI REST API + CORS + image uploads
│   ├── services/
│   │   ├── url_utils.py           # URL normalization, SHA-256 hash, slugify
│   │   ├── ai_analyzer.py         # google-genai structured output + MOCK_MODE
│   │   ├── video_providers.py     # BaseVideoProvider, FFmpegLocalProvider, ExternalVideoAPIProvider
│   │   ├── drive_sync.py          # Google Service Account Drive v3 sync + MOCK_MODE
│   │   └── pipeline_runner.py     # State machine, ThreadPoolExecutor, checkpoint retry
│   └── tests/
│       └── test_pipeline.py       # Unit tests (dedup, state transitions, retry, FFmpeg)
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx                # Thai dashboard + 3s auto-polling
        ├── api/client.js          # Backend API client
        └── components/
            ├── KpiBar.jsx
            ├── AddProductModal.jsx
            ├── PipelineTable.jsx
            └── InspectionDrawer.jsx
```

---

## 3. Prerequisites & FFmpeg Verification

1. **Python 3.11+** and **Node.js 20+**
2. **FFmpeg** installed and available on `PATH`:
   - **Windows (PowerShell)**:
     ```powershell
     winget install Gyan.FFmpeg
     ```
     *(Restart your terminal after installing.)*
   - **Ubuntu / Debian**:
     ```bash
     sudo apt-get update && sudo apt-get install -y ffmpeg
     ```
   - **macOS (Homebrew)**:
     ```bash
     brew install ffmpeg
     ```
   - **Verify installation**:
     ```bash
     ffmpeg -version
     ```

---

## 4. Quick Start (Test Immediately with `MOCK_MODE=true`)

### Step 1: Configure `.env`
```bash
cp .env.example .env
```
By default `.env.example` sets `MOCK_MODE=true`, allowing you to test the full pipeline end-to-end (Mock AI scoring + real local FFmpeg 1080×1920 video rendering + simulated Drive folder sync under `./tmp_outputs/mock_drive/`) without needing API keys first.

### Step 2: Run the Backend (FastAPI)
```bash
python3 -m venv .venv
# Linux / macOS:
source .venv/bin/activate
# Windows PowerShell:
# .venv\Scripts\Activate.ps1

pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
API docs: `http://localhost:8000/docs` | Health check: `http://localhost:8000/api/health`

### Step 3: Run the Frontend (React + Vite + Tailwind)
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`.

---

## 5. Production Setup (`MOCK_MODE=false`)

### A. Gemini API Key
1. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Set in `.env`:
   ```env
   MOCK_MODE=false
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   ```

### B. Google Drive Auto-Sync via Service Account (No 7-Day OAuth Expiry)
Do **not** use personal OAuth tokens (which expire every 7 days in Testing mode). Use a Google Cloud Service Account instead:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Library** → Enable **Google Drive API**.
2. Go to **IAM & Admin** → **Service Accounts** → **Create Service Account** (e.g., `affiliate-drive-sync`).
3. Open the newly created Service Account → **Keys** tab → **Add Key** → **Create new key** → **JSON**.
4. Save the downloaded JSON file as `./service_account.json` in the project root (already ignored by `.gitignore`).
5. Copy the `"client_email"` field from `service_account.json` (looks like `affiliate-drive-sync@your-project.iam.gserviceaccount.com`).
6. Open **Google Drive** → create or open your target root folder → click **Share** → paste the `client_email` → grant **Editor** access → click **Send**.
7. Copy the Folder ID from the Google Drive URL (`https://drive.google.com/drive/folders/<THIS_IS_THE_FOLDER_ID>`).
8. Update `.env`:
   ```env
   GOOGLE_SERVICE_ACCOUNT_FILE=./service_account.json
   GOOGLE_DRIVE_ROOT_FOLDER_ID=your_shared_folder_id_here
   ```

### C. Optional: Switch to External Image-to-Video API (Veo / Kling / Runway)
Update `.env`:
```env
VIDEO_PROVIDER=external
EXTERNAL_VIDEO_API_PROVIDER=veo
EXTERNAL_VIDEO_API_KEY=your_provider_key
```

---

## 6. Cloud Deployment (GitHub Codespaces + GitHub Pages + Cloud Containers)

โปรเจกต์นี้รองรับทั้งการใช้งานบน **GitHub โดยตรง** และ Deploy แบบ **Single Container** (Multi-stage [`Dockerfile`](./Dockerfile) รวม React Frontend + FastAPI + FFmpeg + ฟอนต์ภาษาไทย Loma)

### ตัวเลือก A: GitHub Codespaces (รันครบ 100% บน GitHub — ฟรี 60 ชม./เดือน ไม่ต้องสมัครเว็บอื่น)
[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Joyboy2680/ai-ad-studio-th?quickstart=1)

1. กดปุ่ม **Open in GitHub Codespaces** ด้านบน (ระบบจะอ่าน [`.devcontainer/devcontainer.json`](./.devcontainer/devcontainer.json) ติดตั้ง FFmpeg + ฟอนต์ไทย + Build เว็บ และสตาร์ทเซิร์ฟเวอร์พอร์ต `8000` ให้อัตโนมัติ)
2. เมื่อรันเสร็จ กดเปิดพอร์ต `8000` (`Affiliate Pipeline App`) เพื่อใช้งานเต็มระบบทั้ง UI + AI + FFmpeg + Google Drive ได้ทันที
3. หากต้องการเปิดโหมดจริง (`MOCK_MODE=false`) สามารถใส่คีย์ใน `.env` หรือตั้งค่าใน **GitHub Settings → Secrets and variables → Codespaces**

### ตัวเลือก B: GitHub Pages Dashboard (`/pipeline/`) + เชื่อมต่อ Backend URL
- เปิดหน้า Dashboard ออนไลน์ฟรี 24 ชม.: **https://joyboy2680.github.io/ai-ad-studio-th/pipeline/**
- กดปุ่ม **Backend API** มุมขวาบน เพื่อวางลิงก์ Backend (จาก Render / Railway / Codespaces พอร์ต 8000) หรือส่งผ่านพารามิเตอร์ `?api=https://your-backend-url` ได้ทันที
- อัปเดตหน้า GitHub Pages ใหม่ได้ด้วยคำสั่ง `cd frontend && npm run build:pages`

### ตัวเลือก C: Render.com (Backend + UI ครบจบใน 1 คลิก — ฟรีเริ่มต้น)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Joyboy2680/ai-ad-studio-th)

1. กดปุ่ม **Deploy to Render** ด้านบน (ระบบจะอ่าน [`render.yaml`](./render.yaml) อัตโนมัติ)
2. กด **Apply** → รอ Build Docker ประมาณ 2–3 นาที จะได้ URL ใช้งานได้ทันทีในโหมด `MOCK_MODE=true`
3. เมื่อพร้อมใช้งานจริง ให้ไปที่ **Render Dashboard → Environment** แล้วตั้งค่า:
   - `MOCK_MODE=false`
   - `GEMINI_API_KEY` = คีย์จาก Google AI Studio
   - `GOOGLE_DRIVE_ROOT_FOLDER_ID` = Folder ID ที่แชร์ให้ Service Account แล้ว
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = วางเนื้อหา JSON ทั้งไฟล์ของ `service_account.json` (หรือ Base64)

### ตัวเลือกที่ 2: Railway.app
1. ไปที่ [Railway](https://railway.com/) → **New Project → Deploy from GitHub Repo** → เลือก `Joyboy2680/ai-ad-studio-th`
2. Railway จะตรวจจับ [`railway.json`](./railway.json) + `Dockerfile` อัตโนมัติ
3. แนะนำเพิ่ม **Volume** mount ที่ `/data` เพื่อเก็บ SQLite DB และ Checkpoint ถาวร

### ตัวเลือกที่ 3: Google Cloud Run (Pay-per-use)
```bash
gcloud run deploy affiliate-video-pipeline \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --set-env-vars "MOCK_MODE=true,DATABASE_URL=sqlite:////tmp/affiliate_pipeline.db,TMP_OUTPUTS_DIR=/tmp/tmp_outputs"
```

### ตัวเลือกที่ 4: VPS / Self-Hosted Cloud (Docker Compose)
```bash
cp .env.example .env
docker compose up -d --build
```
ข้อมูล SQLite และไฟล์วิดีโอจะถูกเก็บถาวรไว้ในโฟลเดอร์ `./data`

---

## 7. Running Unit Tests

```bash
.venv/bin/pytest -v
```
Tests verify URL normalization & SHA-256 deduplication, strict state machine transitions, Human-in-the-Loop approval gate enforcement, checkpoint recovery (confirming `DRIVE_SYNC` retry never regenerates video), startup config validation (including Cloud `GOOGLE_SERVICE_ACCOUNT_JSON`), and real FFmpeg `1080x1920` `30fps` H.264 rendering.

---

> *Note: The legacy static GitHub Pages prompt studio (`index.html`, `styles.css`, `js/`) remains preserved at the repository root.*
