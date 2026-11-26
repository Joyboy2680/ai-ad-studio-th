import React from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Eye,
  Film,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { resolveMediaUrl } from "../api/client";

export const STATUS_META = {
  DRAFT: {
    label: "ร่าง (DRAFT)",
    short: "DRAFT",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
  },
  SCORED: {
    label: "รออนุมัติ (SCORED)",
    short: "รออนุมัติ",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  APPROVED: {
    label: "อนุมัติแล้ว (APPROVED)",
    short: "อนุมัติแล้ว",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    spinning: true,
  },
  GENERATING_VIDEO: {
    label: "กำลังสร้างวิดีโอ",
    short: "สร้างวิดีโอ",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    spinning: true,
  },
  SYNCING_DRIVE: {
    label: "กำลังซิงก์ Drive",
    short: "ซิงก์ Drive",
    badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200",
    spinning: true,
  },
  READY_TO_POST: {
    label: "พร้อมโพสต์",
    short: "พร้อมโพสต์",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  FAILED: {
    label: "ล้มเหลว (FAILED)",
    short: "ล้มเหลว",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
  },
};

export const ANGLE_LABELS = {
  PAIN_POINT: "ขยี้ปัญหา (Pain Point)",
  HONEST_REVIEW: "รีวิวจริงใจ (Honest Review)",
  COMPARISON: "เทียบความคุ้มค่า (Comparison)",
  PROBLEM_SOLVER: "แก้ปัญหาตรงจุด (Problem Solver)",
};

const FILTER_TABS = [
  { value: "ALL", label: "ทั้งหมด" },
  { value: "DRAFT", label: "DRAFT" },
  { value: "SCORED", label: "รออนุมัติ" },
  { value: "APPROVED", label: "อนุมัติแล้ว" },
  { value: "GENERATING_VIDEO", label: "กำลังสร้างวิดีโอ" },
  { value: "SYNCING_DRIVE", label: "ซิงก์ Drive" },
  { value: "READY_TO_POST", label: "พร้อมโพสต์" },
  { value: "FAILED", label: "ล้มเหลว" },
];

export function DemandScoreBadge({ score }) {
  if (score === null || score === undefined) {
    return (
      <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-400">
        ยังไม่ประเมิน
      </span>
    );
  }

  let tone = "border-rose-200 bg-rose-50 text-rose-700";
  if (score >= 75) {
    tone = "border-emerald-200 bg-emerald-50 text-emerald-800";
  } else if (score >= 55) {
    tone = "border-amber-200 bg-amber-50 text-amber-800";
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`inline-flex min-w-[3.25rem] items-center justify-center rounded-lg border px-2 py-1 text-sm font-bold tabular-nums ${tone}`}
      >
        {score}
        <span className="ml-0.5 text-[10px] font-medium opacity-70">/100</span>
      </span>
    </div>
  );
}

export default function PipelineTable({
  products,
  loading,
  activeStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  copiedId,
  busyIds,
  onInspect,
  onScore,
  onRetry,
  onCopyCaption,
  onDelete,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      {/* Filter Toolbar */}
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_TABS.map((tab) => {
              const active = activeStatus === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  id={`filter-status-${tab.value}`}
                  onClick={() => onStatusChange(tab.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search & Sort */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="search-products-input"
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="ค้นหาสินค้าหรือคีย์เวิร์ด..."
                className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 sm:w-56"
              />
            </div>

            <select
              id="sort-products-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              <option value="score">เรียงตามคะแนน Demand สูงสุด</option>
              <option value="created_at">เรียงตามเพิ่มล่าสุด</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      {loading && products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-7 w-7 animate-spin text-orange-600" />
          <p className="mt-3 text-sm font-medium text-slate-600">
            กำลังโหลดรายการ Pipeline...
          </p>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Film className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-800">
            ยังไม่มีรายการสินค้าในสถานะนี้
          </h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            กดปุ่ม “เพิ่มสินค้า / CSV” ด้านบนเพื่อนำเข้าสินค้า ให้ AI ประเมินคะแนนความน่าซื้อ
            แล้วตรวจสอบก่อนอนุมัติสร้างวิดีโอ
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3">สินค้า & เทรนด์</th>
                <th className="px-4 py-3">ราคา / ค่าคอม</th>
                <th className="px-4 py-3">Demand Score</th>
                <th className="px-4 py-3">Hook & มุมคอนเทนต์</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-5 py-3 text-right">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {products.map((product) => {
                const statusMeta = STATUS_META[product.status] || STATUS_META.DRAFT;
                const isBusy = busyIds.has(product.id);
                const isProcessing =
                  product.status === "APPROVED" ||
                  product.status === "GENERATING_VIDEO" ||
                  product.status === "SYNCING_DRIVE";

                return (
                  <tr
                    key={product.id}
                    className="group transition hover:bg-slate-50/80"
                  >
                    {/* Product Thumbnail + Name */}
                    <td className="px-5 py-3.5 align-middle">
                      <div className="flex items-center gap-3.5">
                        <button
                          type="button"
                          onClick={() => onInspect(product)}
                          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                        >
                          <img
                            src={resolveMediaUrl(product.image_url)}
                            alt={product.name}
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                            className="h-full w-full object-cover"
                          />
                        </button>
                        <div className="min-w-0 max-w-[260px]">
                          <button
                            type="button"
                            onClick={() => onInspect(product)}
                            className="block truncate text-left font-semibold text-slate-900 transition hover:text-orange-600"
                            title={product.name}
                          >
                            {product.name}
                          </button>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                            <span className="font-mono text-[11px] text-slate-400">
                              #{product.id}
                            </span>
                            {product.trend_keyword && (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                {product.trend_keyword}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Price & Commission */}
                    <td className="whitespace-nowrap px-4 py-3.5 align-middle">
                      <div className="font-semibold text-slate-900 tabular-nums">
                        ฿{Number(product.price).toLocaleString("th-TH")}
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-emerald-700 tabular-nums">
                        คอม {Number(product.commission_pct).toFixed(1)}%
                      </div>
                    </td>

                    {/* Demand Score */}
                    <td className="whitespace-nowrap px-4 py-3.5 align-middle">
                      <DemandScoreBadge score={product.demand_score} />
                    </td>

                    {/* Hook & Angle */}
                    <td className="max-w-[260px] px-4 py-3.5 align-middle">
                      {product.hook_text ? (
                        <div>
                          <p
                            className="line-clamp-2 text-xs font-medium text-slate-800"
                            title={product.hook_text}
                          >
                            “{product.hook_text}”
                          </p>
                          {product.content_angle && (
                            <span className="mt-1 inline-block rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                              {ANGLE_LABELS[product.content_angle] ||
                                product.content_angle}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          รอ AI วิเคราะห์สคริปต์
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 align-middle">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.spinning && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        {product.status === "READY_TO_POST" && (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {product.status === "FAILED" && (
                          <AlertCircle className="h-3.5 w-3.5" />
                        )}
                        {statusMeta.label}
                      </span>

                      {product.status === "FAILED" && (
                        <p
                          className="mt-1 max-w-[190px] truncate text-[11px] text-red-600"
                          title={product.last_error || ""}
                        >
                          [{product.failed_stage || "ERROR"}]{" "}
                          {product.last_error || "เกิดข้อผิดพลาด"}
                        </p>
                      )}
                    </td>

                    {/* Contextual Action Buttons */}
                    <td className="whitespace-nowrap px-5 py-3.5 text-right align-middle">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {product.status === "DRAFT" && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onScore(product)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            ให้ AI ประเมิน
                          </button>
                        )}

                        {product.status === "SCORED" && (
                          <button
                            type="button"
                            id={`btn-inspect-approve-${product.id}`}
                            onClick={() => onInspect(product)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-orange-700"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            ตรวจสอบและอนุมัติ
                          </button>
                        )}

                        {product.status === "FAILED" && (
                          <button
                            type="button"
                            id={`btn-retry-${product.id}`}
                            disabled={isBusy}
                            onClick={() => onRetry(product)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                            Retry
                          </button>
                        )}

                        {product.drive_folder_url &&
                          product.status === "READY_TO_POST" && (
                            <a
                              href={product.drive_folder_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              id={`btn-open-drive-${product.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              เปิด Google Drive
                            </a>
                          )}

                        {product.caption_th && (
                          <button
                            type="button"
                            id={`btn-copy-caption-${product.id}`}
                            onClick={() => onCopyCaption(product)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            title="คัดลอก Hook + แคปชัน + แฮชแท็ก + ลิงก์"
                          >
                            {copiedId === product.id ? (
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
                        )}

                        {product.status !== "SCORED" && (
                          <button
                            type="button"
                            onClick={() => onInspect(product)}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                            title="ดูรายละเอียด"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}

                        {!isProcessing && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => onDelete(product)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            title="ลบรายการ"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
