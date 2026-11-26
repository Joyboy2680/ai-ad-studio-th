import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Layers,
} from "lucide-react";

const CARDS = [
  {
    key: "total_products",
    label: "สินค้าทั้งหมด",
    sublabel: "ในระบบ Pipeline",
    filterValue: "ALL",
    icon: Layers,
    accentClass: "text-slate-700 bg-slate-100",
    activeRing: "ring-2 ring-slate-900/15 border-slate-300",
  },
  {
    key: "pending_approval",
    label: "รออนุมัติ",
    sublabel: "AI ให้คะแนนแล้ว (SCORED)",
    filterValue: "SCORED",
    icon: ClipboardCheck,
    accentClass: "text-amber-700 bg-amber-50",
    activeRing: "ring-2 ring-amber-500/25 border-amber-300",
  },
  {
    key: "ready_to_post",
    label: "พร้อมโพสต์",
    sublabel: "ซิงก์ Google Drive แล้ว",
    filterValue: "READY_TO_POST",
    icon: CheckCircle2,
    accentClass: "text-emerald-700 bg-emerald-50",
    activeRing: "ring-2 ring-emerald-500/25 border-emerald-300",
  },
  {
    key: "failed_jobs",
    label: "งานที่ล้มเหลว",
    sublabel: "รอ Retry จาก Checkpoint",
    filterValue: "FAILED",
    icon: AlertTriangle,
    accentClass: "text-red-700 bg-red-50",
    activeRing: "ring-2 ring-red-500/25 border-red-300",
  },
];

export default function KpiBar({ kpi, activeStatus, onSelectStatus }) {
  return (
    <section
      aria-label="สรุปภาพรวมคิวงาน"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {CARDS.map((card) => {
        const Icon = card.icon;
        const count = kpi?.[card.key] ?? 0;
        const isActive = activeStatus === card.filterValue;

        return (
          <button
            key={card.key}
            type="button"
            id={`kpi-card-${card.key}`}
            onClick={() => onSelectStatus(card.filterValue)}
            className={`group flex items-start justify-between rounded-2xl border bg-white p-5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm ${
              isActive
                ? card.activeRing
                : "border-slate-200/90 hover:border-slate-300"
            }`}
          >
            <div>
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {count}
              </p>
              <p className="mt-1 text-xs text-slate-400">{card.sublabel}</p>
            </div>
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.accentClass}`}
            >
              <Icon className="h-5 w-5" />
            </span>
          </button>
        );
      })}
    </section>
  );
}
