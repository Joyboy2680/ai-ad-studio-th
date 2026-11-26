import React, { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  Plus,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import {
  createProduct,
  importProductsCsv,
  resolveMediaUrl,
  uploadProductImage,
} from "../api/client";

const INITIAL_FORM = {
  name: "",
  product_url: "",
  affiliate_url: "",
  price: "",
  commission_pct: "10",
  image_url: "",
  trend_keyword: "",
  raw_reviews: "",
};

const SAMPLE_CSV = `name,product_url,price,commission_pct,image_url,raw_reviews,trend_keyword,affiliate_url
"แก้วเก็บความเย็นสแตนเลส 30oz","https://shopee.co.th/stainless-tumbler-30oz",189,12.5,"https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800","เก็บน้ำแข็งข้ามคืนได้จริง ไม่มีไอน้ำเกาะ สีสวยตรงปก","แก้วเก็บความเย็น","https://shope.ee/sample-tumbler"
"พัดลมพกพาความแรงสูง พับได้","https://shopee.co.th/mini-turbo-fan-pro",259,15,"https://images.unsplash.com/photo-1585338107529-13afc5f02586?w=800","ลมแรงเกินคาด แบตอึดพกไปออฟฟิศหรือคอนเสิร์ตสะดวกมาก","พัดลมพกพา","https://shope.ee/sample-fan"
"โคมไฟตั้งโต๊ะไร้สายปรับสีได้","https://shopee.co.th/minimal-desk-lamp-led",349,11,"https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800","แสงนวลอ่านหนังสือสบายตา ชาร์จ Type-C ใช้งานง่าย","แต่งห้องมินิมอล","https://shope.ee/sample-lamp"
`;

export default function AddProductModal({ isOpen, onClose, onSuccess }) {
  const [tab, setTab] = useState("manual");
  const [form, setForm] = useState(INITIAL_FORM);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [imgLoadFailed, setImgLoadFailed] = useState(false);

  // CSV state
  const [csvFile, setCsvFile] = useState(null);
  const [csvResult, setCsvResult] = useState(null);

  if (!isOpen) return null;

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "image_url") {
      setImgLoadFailed(false);
    }
    setError("");
  };

  const handleImageFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    setError("");
    try {
      const res = await uploadProductImage(file);
      setForm((prev) => ({ ...prev, image_url: res.image_url }));
      setImgLoadFailed(false);
    } catch (err) {
      setError(err.message || "อัปโหลดรูปภาพไม่สำเร็จ");
    } finally {
      setUploadingImg(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.name.trim() || !form.product_url.trim() || !form.image_url.trim()) {
      setError("กรุณากรอกชื่อสินค้า ลิงก์สินค้า และรูปภาพสินค้าให้ครบถ้วน");
      return;
    }

    const priceNum = Number(form.price);
    const commNum = Number(form.commission_pct || 0);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError("กรุณากรอกราคาเป็นตัวเลขที่ถูกต้อง");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createProduct({
        name: form.name.trim(),
        product_url: form.product_url.trim(),
        affiliate_url: form.affiliate_url.trim() || form.product_url.trim(),
        price: priceNum,
        commission_pct: Number.isNaN(commNum) ? 0 : commNum,
        image_url: form.image_url.trim(),
        trend_keyword: form.trend_keyword.trim(),
        raw_reviews: form.raw_reviews.trim(),
        auto_score: true,
      });
      setForm(INITIAL_FORM);
      onSuccess({
        type: "single",
        product: created,
        message: `เพิ่ม "${created.name}" และ AI ประเมินคะแนนเสร็จแล้ว (รออนุมัติ)`,
      });
      onClose();
    } catch (err) {
      setError(err.message || "ไม่สามารถเพิ่มสินค้าได้");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!csvFile) {
      setError("กรุณาเลือกไฟล์ CSV ก่อนนำเข้า");
      return;
    }

    setSubmitting(true);
    try {
      const result = await importProductsCsv(csvFile, true);
      setCsvResult(result);
      onSuccess({
        type: "csv",
        result,
        message: `นำเข้าสำเร็จ ${result.imported} รายการ (ข้ามลิงก์ซ้ำ ${result.duplicates_skipped} รายการ)`,
      });
    } catch (err) {
      setError(err.message || "นำเข้าไฟล์ CSV ไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadSampleCsv = () => {
    const blob = new Blob(["\uFEFF" + SAMPLE_CSV], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sample_affiliate_products.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-product-modal-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2
              id="add-product-modal-title"
              className="text-lg font-bold text-slate-900"
            >
              เพิ่มสินค้าเข้าสู่ Pipeline
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              รองรับทั้งกรอกข้อมูลทีละรายการและนำเข้าแบบกลุ่มด้วยไฟล์ CSV
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-6 pt-3">
          <button
            type="button"
            id="tab-manual-product"
            onClick={() => {
              setTab("manual");
              setError("");
            }}
            className={`mr-2 inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === "manual"
                ? "border-orange-600 text-orange-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Plus className="h-4 w-4" />
            เพิ่มสินค้าทีละชิ้น
          </button>
          <button
            type="button"
            id="tab-csv-import"
            onClick={() => {
              setTab("csv");
              setError("");
            }}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === "csv"
                ? "border-orange-600 text-orange-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            นำเข้าไฟล์ CSV
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {tab === "manual" ? (
            <form id="manual-product-form" onSubmit={handleManualSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Form Inputs */}
                <div className="space-y-3.5 md:col-span-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      ชื่อสินค้า *
                    </label>
                    <input
                      id="input-product-name"
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      placeholder="เช่น พัดลมพกพาความเย็นสูง 3 ระดับ"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">
                      ลิงก์สินค้า (Shopee / TikTok URL) *
                    </label>
                    <input
                      id="input-product-url"
                      type="url"
                      required
                      value={form.product_url}
                      onChange={(e) => handleFieldChange("product_url", e.target.value)}
                      placeholder="https://shopee.co.th/..."
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        ราคา (บาท) *
                      </label>
                      <input
                        id="input-product-price"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={form.price}
                        onChange={(e) => handleFieldChange("price", e.target.value)}
                        placeholder="199"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        ค่าคอมมิชชัน (%)
                      </label>
                      <input
                        id="input-product-commission"
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={form.commission_pct}
                        onChange={(e) =>
                          handleFieldChange("commission_pct", e.target.value)
                        }
                        placeholder="12"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Live Image Preview Card */}
                <div className="flex flex-col">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    พรีวิวรูปสินค้า
                  </label>
                  <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                    {form.image_url && !imgLoadFailed ? (
                      <img
                        src={resolveMediaUrl(form.image_url)}
                        alt="พรีวิวรูปสินค้า"
                        onError={() => setImgLoadFailed(true)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center p-3 text-center text-slate-400">
                        <ImageIcon className="h-8 w-8" />
                        <span className="mt-1.5 text-xs">
                          {imgLoadFailed
                            ? "โหลดรูปพรีวิวไม่ได้"
                            : "วาง URL หรืออัปโหลดรูป"}
                        </span>
                      </div>
                    )}
                    {uploadingImg && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                        <Loader2 className="h-6 w-6 animate-spin text-orange-600" />
                      </div>
                    )}
                  </div>
                  <label className="mt-2 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                    <Upload className="h-3.5 w-3.5" />
                    อัปโหลดรูปจากเครื่อง
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  URL รูปภาพสินค้า (หรือใช้ปุ่มอัปโหลดด้านขวา) *
                </label>
                <input
                  id="input-image-url"
                  type="text"
                  required
                  value={form.image_url}
                  onChange={(e) => handleFieldChange("image_url", e.target.value)}
                  placeholder="https://... หรือ /uploads/..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    คีย์เวิร์ดเทรนด์ (Trend Keyword)
                  </label>
                  <input
                    id="input-trend-keyword"
                    type="text"
                    value={form.trend_keyword}
                    onChange={(e) =>
                      handleFieldChange("trend_keyword", e.target.value)
                    }
                    placeholder="เช่น พัดลมพกพา, ของแต่งโต๊ะ"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    ลิงก์ Affiliate (ถ้าต่างจากลิงก์สินค้า)
                  </label>
                  <input
                    id="input-affiliate-url"
                    type="url"
                    value={form.affiliate_url}
                    onChange={(e) =>
                      handleFieldChange("affiliate_url", e.target.value)
                    }
                    placeholder="https://shope.ee/..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  รีวิวลูกค้าดิบ (Raw Customer Reviews)
                </label>
                <textarea
                  id="input-raw-reviews"
                  rows={3}
                  value={form.raw_reviews}
                  onChange={(e) => handleFieldChange("raw_reviews", e.target.value)}
                  placeholder="วางรีวิวลูกค้าจริงจาก Shopee / TikTok เพื่อให้ AI วิเคราะห์ Pain Point และจุดเด่นได้แม่นยำขึ้น..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-900">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  <strong>ระบบป้องกันเครดิต (Human-in-the-Loop):</strong>{" "}
                  หลังเพิ่มสินค้า AI จะประเมินคะแนนและเขียนสคริปต์ให้ก่อนเท่านั้น{" "}
                  <u>จะไม่สร้างวิดีโออัตโนมัติ</u> จนกว่าคุณจะตรวจสอบและกดอนุมัติด้วยตนเอง
                </span>
              </div>
            </form>
          ) : (
            <form id="csv-import-form" onSubmit={handleCsvSubmit} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <div>
                  <p className="font-semibold text-slate-800">
                    คอลัมน์ที่รองรับในไฟล์ CSV (UTF-8)
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                    name, product_url, price, commission_pct, image_url, raw_reviews, trend_keyword
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <Download className="h-3.5 w-3.5" />
                  ดาวน์โหลดไฟล์ตัวอย่าง
                </button>
              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center transition hover:border-orange-400 hover:bg-orange-50/30">
                <FileSpreadsheet className="h-10 w-10 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  {csvFile ? csvFile.name : "คลิกเพื่อเลือกไฟล์ .CSV ของคุณ"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  ระบบจะตรวจจับและข้ามลิงก์สินค้าที่ซ้ำกัน (SHA-256) โดยอัตโนมัติ
                </p>
                <input
                  id="input-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    setCsvFile(e.target.files?.[0] || null);
                    setCsvResult(null);
                    setError("");
                  }}
                  className="hidden"
                />
              </label>

              {csvResult && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">สรุปผลการนำเข้า CSV</p>
                  <ul className="mt-1.5 space-y-1 text-xs">
                    <li>• นำเข้าและให้ AI ประเมินแล้ว: {csvResult.imported} รายการ</li>
                    <li>• ข้ามลิงก์ซ้ำ (Deduplicated): {csvResult.duplicates_skipped} รายการ</li>
                    {csvResult.errors.length > 0 && (
                      <li className="text-red-700">
                        • แถวที่ข้อมูลไม่ครบ: {csvResult.errors.length} แถว
                      </li>
                    )}
                  </ul>
                  {csvResult.errors.length > 0 && (
                    <div className="mt-2 max-h-24 overflow-y-auto rounded-lg bg-white/80 p-2 text-xs text-red-700">
                      {csvResult.errors.map((err, idx) => (
                        <div key={idx}>
                          แถว {err.row}: {err.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/80 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ปิด
          </button>
          {tab === "manual" ? (
            <button
              type="submit"
              form="manual-product-form"
              id="btn-submit-product"
              disabled={submitting || uploadingImg}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              เพิ่มและให้ AI ประเมินคะแนน
            </button>
          ) : (
            <button
              type="submit"
              form="csv-import-form"
              id="btn-submit-csv"
              disabled={submitting || !csvFile}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              นำเข้าและให้ AI ประเมินคะแนน
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
