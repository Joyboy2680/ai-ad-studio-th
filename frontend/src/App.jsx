import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clapperboard,
  ExternalLink,
  Plus,
  RefreshCw,
  Server,
} from "lucide-react";
import {
  approveProduct,
  deleteProduct,
  fetchHealth,
  fetchProducts,
  formatCopyableCaption,
  getApiBaseUrl,
  isGitHubPagesHost,
  retryProduct,
  scoreProduct,
  setApiBaseUrl,
  updateProduct,
} from "./api/client";
import AddProductModal from "./components/AddProductModal";
import InspectionDrawer from "./components/InspectionDrawer";
import KpiBar from "./components/KpiBar";
import PipelineTable from "./components/PipelineTable";

const ACTIVE_PIPELINE_STATUSES = new Set([
  "APPROVED",
  "GENERATING_VIDEO",
  "SYNCING_DRIVE",
]);

const CODESPACES_LAUNCH_URL =
  "https://codespaces.new/Joyboy2680/ai-ad-studio-th?quickstart=1";
const RENDER_DEPLOY_URL =
  "https://render.com/deploy?repo=https://github.com/Joyboy2680/ai-ad-studio-th";

export default function App() {
  const [health, setHealth] = useState(null);
  const [products, setProducts] = useState([]);
  const [kpi, setKpi] = useState({
    total_products: 0,
    draft_count: 0,
    pending_approval: 0,
    in_progress: 0,
    ready_to_post: 0,
    failed_jobs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState("");

  // Backend URL settings (especially useful when opened from GitHub Pages)
  const onGitHubPages = useMemo(() => isGitHubPagesHost(), []);
  const [apiUrlInput, setApiUrlInput] = useState(() => getApiBaseUrl());
  const [apiSettingsOpen, setApiSettingsOpen] = useState(
    () => isGitHubPagesHost() && !getApiBaseUrl()
  );

  // Filters & Selection
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("score");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);

  // Per-row action loading + toast
  const [busyIds, setBusyIds] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, tone = "success") => {
    setToast({ message, tone });
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
      return h;
    } catch {
      setHealth(null);
      return null;
    }
  }, []);

  const loadData = useCallback(
    async ({ silent = false } = {}) => {
      // On GitHub Pages without a Backend URL configured yet, avoid noisy 404 errors
      if (onGitHubPages && !getApiBaseUrl()) {
        setLoading(false);
        setErrorBanner("");
        return;
      }

      if (!silent) setLoading(true);
      try {
        const data = await fetchProducts({
          status: activeStatus,
          search: searchQuery,
          sortBy,
        });
        setProducts(data.items || []);
        setKpi(data.kpi);
        setErrorBanner("");
      } catch (err) {
        setErrorBanner(
          err.message ||
            "ไม่สามารถเชื่อมต่อ Backend API ได้ กรุณาตรวจสอบลิงก์ Backend หรือเปิดเซิร์ฟเวอร์"
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activeStatus, searchQuery, sortBy, onGitHubPages]
  );

  // Initial health check
  useEffect(() => {
    if (onGitHubPages && !getApiBaseUrl()) return;
    refreshHealth();
  }, [onGitHubPages, refreshHealth]);

  // Load products whenever filters/sort change
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-poll every 3 seconds when ANY job is APPROVED / GENERATING_VIDEO / SYNCING_DRIVE
  const hasRunningJobs = useMemo(() => {
    if ((kpi?.in_progress || 0) > 0) return true;
    return products.some((p) => ACTIVE_PIPELINE_STATUSES.has(p.status));
  }, [kpi, products]);

  useEffect(() => {
    if (!hasRunningJobs) return undefined;
    const timer = window.setInterval(() => {
      loadData({ silent: true });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [hasRunningJobs, loadData]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const handleSaveApiUrl = async (e) => {
    e.preventDefault();
    const cleaned = setApiBaseUrl(apiUrlInput);
    setApiUrlInput(cleaned);
    const h = await refreshHealth();
    if (h) {
      showToast("เชื่อมต่อ Backend สำเร็จ!");
      setApiSettingsOpen(false);
      await loadData();
    } else {
      showToast(
        "เชื่อมต่อไม่ได้ กรุณาเช็กว่า Backend URL ถูกต้องและเซิร์ฟเวอร์เปิดอยู่",
        "error"
      );
    }
  };

  const markBusy = (id, busy) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleScore = async (product) => {
    markBusy(product.id, true);
    try {
      await scoreProduct(product.id);
      showToast(`AI ประเมินคะแนน "${product.name}" เสร็จแล้ว`);
      await loadData({ silent: true });
    } catch (err) {
      showToast(err.message || "AI ประเมินคะแนนไม่สำเร็จ", "error");
    } finally {
      markBusy(product.id, false);
    }
  };

  const handleSaveEdits = async (productId, edits) => {
    try {
      await updateProduct(productId, edits);
      showToast("บันทึกการแก้ไขเรียบร้อยแล้ว");
      await loadData({ silent: true });
    } catch (err) {
      showToast(err.message || "บันทึกการแก้ไขไม่สำเร็จ", "error");
    }
  };

  const handleApprove = async (productId, edits) => {
    try {
      await approveProduct(productId, edits);
      showToast("อนุมัติแล้ว! ระบบกำลังสร้างวิดีโอ 9:16 และซิงก์เข้า Google Drive");
      await loadData({ silent: true });
    } catch (err) {
      showToast(err.message || "ไม่สามารถอนุมัติรายการนี้ได้", "error");
    }
  };

  const handleRetry = async (product) => {
    markBusy(product.id, true);
    try {
      await retryProduct(product.id);
      const isDriveResume =
        product.failed_stage === "DRIVE_SYNC" && Boolean(product.local_video_path);
      showToast(
        isDriveResume
          ? "กำลัง Retry อัปโหลดเข้า Google Drive โดยใช้ไฟล์วิดีโอเดิม"
          : "ส่งงานเข้าคิว Retry จากขั้นตอนที่ล้มเหลวแล้ว"
      );
      await loadData({ silent: true });
    } catch (err) {
      showToast(err.message || "ไม่สามารถ Retry ได้", "error");
    } finally {
      markBusy(product.id, false);
    }
  };

  const handleDelete = async (product) => {
    const confirmed = window.confirm(
      `ยืนยันลบสินค้า "${product.name}" ออกจากระบบหรือไม่?`
    );
    if (!confirmed) return;
    markBusy(product.id, true);
    try {
      await deleteProduct(product.id);
      if (selectedProductId === product.id) {
        setSelectedProductId(null);
      }
      showToast("ลบรายการสินค้าแล้ว");
      await loadData({ silent: true });
    } catch (err) {
      showToast(err.message || "ลบรายการไม่สำเร็จ", "error");
    } finally {
      markBusy(product.id, false);
    }
  };

  const handleCopyCaption = async (product) => {
    const text = formatCopyableCaption(product);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(product.id);
      showToast("คัดลอก Hook + แคปชัน + แฮชแท็ก + ลิงก์แล้ว!");
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === product.id ? null : curr));
      }, 2000);
    } catch {
      showToast("เบราว์เซอร์ไม่อนุญาตให้เข้าถึงคลิปบอร์ด", "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
              <Clapperboard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                Affiliate Auto-Content & Video Pipeline
              </h1>
              <p className="text-xs text-slate-500">
                TikTok & Shopee Semi-Auto 90% • อนุมัติก่อนสร้างวิดีโอทุกชิ้น
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {health && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  health.mock_mode
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                {health.mock_mode
                  ? "โหมดทดสอบ (MOCK_MODE)"
                  : "โหมดใช้งานจริง (LIVE)"}
                <span className="text-slate-400">•</span>
                <span>
                  {health.video_provider === "ffmpeg"
                    ? "FFmpeg Local"
                    : "External I2V"}
                </span>
              </span>
            )}

            {hasRunningJobs && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <Activity className="h-3.5 w-3.5 animate-pulse" />
                อัปเดตสถานะอัตโนมัติทุก 3 วิ
              </span>
            )}

            <button
              type="button"
              id="btn-api-settings"
              onClick={() => setApiSettingsOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                apiSettingsOpen || (onGitHubPages && !health)
                  ? "border-orange-300 bg-orange-50 text-orange-800"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              title="ตั้งค่า Backend API URL"
            >
              <Server className="h-3.5 w-3.5" />
              Backend API
            </button>

            <button
              type="button"
              id="btn-refresh-pipeline"
              onClick={() => loadData()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              รีเฟรช
            </button>

            <button
              type="button"
              id="btn-open-add-modal"
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-orange-700"
            >
              <Plus className="h-4 w-4" />
              เพิ่มสินค้า / CSV
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* GitHub Pages / External Backend Connection Panel */}
        {apiSettingsOpen && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-900">
                  เชื่อมต่อ Backend Server (FastAPI + FFmpeg + SQLite)
                </h2>
                <p className="text-xs text-slate-500">
                  {onGitHubPages
                    ? "หน้าเว็บนี้โฮสต์อยู่บน GitHub Pages (Static) — วางลิงก์ Backend จาก Render / Railway หรือเปิดรันครบชุดบน GitHub Codespaces ได้ทันที"
                    : "ปล่อยว่างไว้เพื่อใช้ Backend บนโดเมนเดียวกัน (ค่าเริ่มต้นสำหรับ Docker / Render / Codespaces)"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={CODESPACES_LAUNCH_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  เปิดรันครบชุดบน GitHub Codespaces
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <a
                  href={RENDER_DEPLOY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Deploy Backend ฟรีบน Render
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <form
              onSubmit={handleSaveApiUrl}
              className="mt-4 flex flex-col gap-2 sm:flex-row"
            >
              <input
                id="input-backend-api-url"
                type="url"
                value={apiUrlInput}
                onChange={(e) => setApiUrlInput(e.target.value)}
                placeholder="https://affiliate-video-pipeline.onrender.com (หรือลิงก์ Codespaces port 8000)"
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              <button
                type="submit"
                id="btn-save-api-url"
                className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-700"
              >
                ทดสอบและบันทึก
              </button>
            </form>
          </section>
        )}

        {errorBanner && (
          <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
            <span>{errorBanner}</span>
          </div>
        )}

        {health &&
          !health.ffmpeg_available &&
          health.video_provider === "ffmpeg" && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <span>
                ไม่พบคำสั่ง <code>ffmpeg</code> ในเครื่อง กรุณาติดตั้ง FFmpeg
                ตามคู่มือใน README.md ก่อนกดอนุมัติสร้างวิดีโอ
              </span>
            </div>
          )}

        {/* Top KPI Bar */}
        <KpiBar
          kpi={kpi}
          activeStatus={activeStatus}
          onSelectStatus={setActiveStatus}
        />

        {/* Pipeline Board / Table */}
        <PipelineTable
          products={products}
          loading={loading}
          activeStatus={activeStatus}
          onStatusChange={setActiveStatus}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          copiedId={copiedId}
          busyIds={busyIds}
          onInspect={(product) => setSelectedProductId(product.id)}
          onScore={handleScore}
          onRetry={handleRetry}
          onCopyCaption={handleCopyCaption}
          onDelete={handleDelete}
        />
      </main>

      {/* Add Product / CSV Import Modal */}
      <AddProductModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={({ message, product }) => {
          showToast(message);
          loadData({ silent: true });
          if (product?.id) {
            setSelectedProductId(product.id);
          }
        }}
      />

      {/* Inspection & Approval Slide-over Drawer */}
      <InspectionDrawer
        product={selectedProduct}
        onClose={() => setSelectedProductId(null)}
        onSaveEdits={handleSaveEdits}
        onApprove={handleApprove}
        onRetry={handleRetry}
        onCopyCaption={handleCopyCaption}
        copied={selectedProduct && copiedId === selectedProduct.id}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg transition ${
            toast.tone === "error"
              ? "border-red-200 bg-red-600 text-white"
              : "border-slate-800 bg-slate-900 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
