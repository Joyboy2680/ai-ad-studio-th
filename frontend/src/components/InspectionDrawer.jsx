import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Film,
  Hash,
  Loader2,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { getProductVideoUrl, resolveMediaUrl } from "../api/client";
import { ANGLE_LABELS, DemandScoreBadge, STATUS_META } from "./PipelineTable";

const CONTENT_ANGLE_OPTIONS = [
  { value: "PAIN_POINT", label: "PAIN_POINT — ขยี้ปัญหา" },
  { value: "HONEST_REVIEW", label: "HONEST_REVIEW — รีวิวจริงใจ" },
  { value: "COMPARISON", label: "COMPARISON — เทียบความคุ้มค่า" },
  { value: "PROBLEM_SOLVER", label: "PROBLEM_SOLVER — แก้ปัญหาตรงจุด" },
];

export default function InspectionDrawer({
  product,
  onClose,
  onSaveEdits,
  onApprove,
  onRetry,
  onCopyCaption,
  copied,
}) {
  const [contentAngle, setContentAngle] = useState("PAIN_POINT");
  const [hookText, setHookText] = useState("");
  const [i2vPrompt, setI2vPrompt] = useState("");
  const [captionTh, setCaptionTh] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [mediaTab, setMediaTab] = useState("image");

  useEffect(() => {
    if (!product) return;
    setContentAngle(product.content_angle || "PAIN_POINT");
    setHookText(product.hook_text || "");
    setI2vPrompt(product.i2v_video_prompt || "");
    setCaptionTh(product.caption_th || "");
    setHashtagsText((product.hashtags || []).join(" "));
    setMediaTab(product.local_video_path ? "video" : "image");
  }, [product?.id, product?.updated_at]);

  if (!product) return null;

  const isLocked =
    product.status === "GENERATING_VIDEO" || product.status === "SYNCING_DRIVE";
  const canApprove = product.status === "SCORED";
  const statusMeta = STATUS_META[product.status] || STATUS_META.DRAFT;

  const parseHashtags = (raw) =>
    raw
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));

  const collectEdits = () => ({
    content_angle: contentAngle,
    hook_text: hookText.trim(),
    i2v_video_prompt: i2vPrompt.trim(),
    caption_th: captionTh.trim(),
    hashtags: parseHashtags(hashtagsText),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveEdits(product.id, collectEdits());
    } finally {
      setSaving(false);
    }
  };

  const handleApproveClick = async () => {
    setApproving(true);
    try {
      await onApprove(product.id, collectEdits());
    } finally {
      setApproving(false);
    }
  };

  const handleRetryClick = async () => {
    setRetrying(true);
    try {
      await onRetry(product);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-product-title"
    >
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Panel */}
      <aside className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-400">
                ID #{product.id}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.badgeClass}`}
              >
                {statusMeta.spinning && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                {statusMeta.label}
              </span>
              <DemandScoreBadge score={product.demand_score} />
            </div>
            <h2
              id="drawer-product-title"
              className="mt-1.5 truncate text-lg font-bold text-slate-900"
            >
              {product.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="ปิดหน้าต่างตรวจสอบ"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Failed Banner with Checkpoint Info */}
          {product.status === "FAILED" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold">
                    งานหยุดที่ขั้นตอน: {product.failed_stage || "UNKNOWN"}
                  </p>
                  <p className="mt-1 text-xs text-red-700">
                    {product.last_error || "ไม่ทราบสาเหตุ"}
                  </p>
                  {product.failed_stage === "DRIVE_SYNC" &&
                    product.local_video_path && (
                      <p className="mt-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-medium text-emerald-800">
                        ✓ พบ Checkpoint ไฟล์วิดีโอในเครื่องแล้ว — กด Retry
                        เพื่ออัปโหลดเข้า Google Drive ต่อโดยไม่เสียเครดิตสร้างวิดีโอใหม่
                      </p>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* Media + Product Info Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            {/* Image / Video Preview */}
            <div className="sm:col-span-2">
              {product.local_video_path && (
                <div className="mb-2 flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setMediaTab("image")}
                    className={`flex-1 rounded-md py-1 transition ${
                      mediaTab === "image"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500"
                    }`}
                  >
                    รูปสินค้าจริง
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaTab("video")}
                    className={`flex-1 rounded-md py-1 transition ${
                      mediaTab === "video"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500"
                    }`}
                  >
                    วิดีโอ 9:16
                  </button>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                {mediaTab === "video" && product.local_video_path ? (
                  <video
                    key={product.local_video_path}
                    src={getProductVideoUrl(product.id, product.updated_at)}
                    controls
                    playsInline
                    className="aspect-[9/16] max-h-[300px] w-full bg-black object-contain"
                  />
                ) : (
                  <img
                    src={resolveMediaUrl(product.image_url)}
                    alt={product.name}
                    className="aspect-square w-full bg-slate-100 object-cover"
                  />
                )}
              </div>
            </div>

            {/* AI Brutally Honest Evaluation & Product Specs */}
            <div className="flex flex-col justify-between space-y-3 sm:col-span-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-medium text-slate-500">ราคาขาย</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900 tabular-nums">
                    ฿{Number(product.price).toLocaleString("th-TH")}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-medium text-slate-500">
                    ค่าคอมมิชชัน
                  </p>
                  <p className="mt-0.5 text-lg font-bold text-emerald-700 tabular-nums">
                    {Number(product.commission_pct).toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  บทวิเคราะห์ความน่าซื้อจาก AI (ตรงไปตรงมา)
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-800">
                  {product.buy_probability_reasoning ||
                    "ยังไม่มีผลการวิเคราะห์จาก AI"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {product.trend_keyword && (
                  <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700">
                    เทรนด์: {product.trend_keyword}
                  </span>
                )}
                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-orange-600 hover:underline"
                >
                  เปิดหน้าสินค้าต้นทาง
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Editable Content Fields */}
          <div className="space-y-4 border-t border-slate-200 pt-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  มุมมองคอนเทนต์ (Content Angle)
                </label>
                <select
                  id="drawer-content-angle"
                  disabled={isLocked}
                  value={contentAngle}
                  onChange={(e) => setContentAngle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:bg-slate-50"
                >
                  {CONTENT_ANGLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Hook 3 วินาทีแรก (ขึ้นบนวิดีโอ 9:16)
                </label>
                <input
                  id="drawer-hook-text"
                  type="text"
                  disabled={isLocked}
                  value={hookText}
                  onChange={(e) => setHookText(e.target.value)}
                  placeholder="ประโยคหยุดนิ้วภาษาไทยสั้นๆ กระชับ"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-700">
                <span className="inline-flex items-center gap-1.5">
                  <Film className="h-3.5 w-3.5 text-slate-500" />
                  Image-to-Video (I2V) Prompt (English)
                </span>
                <span className="font-normal text-slate-400">
                  สำหรับ Veo / Kling / Runway หรือเก็บใน metadata.json
                </span>
              </label>
              <textarea
                id="drawer-i2v-prompt"
                rows={4}
                disabled={isLocked}
                value={i2vPrompt}
                onChange={(e) => setI2vPrompt(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3.5 py-2.5 font-mono text-xs leading-relaxed text-slate-900 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                แคปชันภาษาไทย (TikTok / Shopee Tone)
              </label>
              <textarea
                id="drawer-caption-th"
                rows={4}
                disabled={isLocked}
                value={captionTh}
                onChange={(e) => setCaptionTh(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Hash className="h-3.5 w-3.5 text-slate-500" />
                แฮชแท็ก (คั่นด้วยเว้นวรรค)
              </label>
              <input
                id="drawer-hashtags"
                type="text"
                disabled={isLocked}
                value={hashtagsText}
                onChange={(e) => setHashtagsText(e.target.value)}
                placeholder="#ป้ายยา #ของมันต้องมี #TikTokShopTH #ShopeeTH"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 disabled:bg-slate-50"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {parseHashtags(hashtagsText).map((tag, idx) => (
                  <span
                    key={`${tag}-${idx}`}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Drive Sync Deliverable Summary */}
          {product.drive_folder_url && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  อัปโหลดครบ 3 ไฟล์เข้า Google Drive แล้ว
                </div>
                <a
                  href={product.drive_folder_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  เปิด Google Drive
                </a>
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-emerald-800/80 break-all">
                video_final.mp4 • caption_hashtags.txt • metadata.json
              </p>
            </div>
          )}
        </div>

        {/* Sticky Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/90 px-6 py-4">
          <div className="flex items-center gap-2">
            {!isLocked && (
              <button
                type="button"
                id="btn-drawer-save"
                disabled={saving || approving}
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                บันทึกการแก้ไข
              </button>
            )}

            <button
              type="button"
              id="btn-drawer-copy"
              onClick={() =>
                onCopyCaption({
                  ...product,
                  hook_text: hookText,
                  caption_th: captionTh,
                  hashtags: parseHashtags(hashtagsText),
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  คัดลอกแล้ว
                </>
              ) : (
                <>
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  Copy แคปชัน
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {product.status === "FAILED" && (
              <button
                type="button"
                id="btn-drawer-retry"
                disabled={retrying}
                onClick={handleRetryClick}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-red-700 disabled:opacity-60"
              >
                {retrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
                Retry จากขั้นตอนที่ล้มเหลว
              </button>
            )}

            {canApprove && (
              <button
                type="button"
                id="btn-drawer-approve"
                disabled={approving || saving}
                onClick={handleApproveClick}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-60"
              >
                {approving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
                อนุมัติและสร้างวิดีโอ
              </button>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
