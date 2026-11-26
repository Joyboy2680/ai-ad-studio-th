const STORAGE_KEY = "affiliate_pipeline_api_base";
const ENV_API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

// Allow passing ?api=https://your-backend-url directly in the URL
if (typeof window !== "undefined") {
  const params = new URLSearchParams(window.location.search);
  const apiFromQuery = params.get("api");
  if (apiFromQuery && apiFromQuery.trim()) {
    window.localStorage.setItem(
      STORAGE_KEY,
      apiFromQuery.trim().replace(/\/+$/, "")
    );
  }
}

export function isGitHubPagesHost() {
  if (typeof window === "undefined") return false;
  return window.location.hostname.endsWith(".github.io");
}

export function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, "");
    }
  }
  return ENV_API_BASE;
}

export function setApiBaseUrl(url) {
  if (typeof window === "undefined") return "";
  const cleaned = (url || "").trim().replace(/\/+$/, "");
  if (cleaned) {
    window.localStorage.setItem(STORAGE_KEY, cleaned);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return cleaned;
}

async function request(path, options = {}) {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;
  const resp = await fetch(url, options);

  if (resp.status === 204) {
    return null;
  }

  let data = null;
  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await resp.json();
  } else {
    const text = await resp.text();
    data = text ? { detail: text } : null;
  }

  if (!resp.ok) {
    const message =
      (data && (data.detail || data.message)) ||
      `เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (${resp.status})`;
    const error = new Error(message);
    error.status = resp.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function resolveMediaUrl(url) {
  if (!url) return "";
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${getApiBaseUrl()}${url}`;
  }
  return url;
}

export function getProductVideoUrl(productId, cacheBust = "") {
  const suffix = cacheBust ? `?v=${encodeURIComponent(cacheBust)}` : "";
  return `${getApiBaseUrl()}/api/products/${productId}/video${suffix}`;
}

export function fetchHealth() {
  return request("/api/health");
}

export function fetchProducts({ status = "", search = "", sortBy = "score" } = {}) {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.set("status", status);
  if (search && search.trim()) params.set("search", search.trim());
  if (sortBy) params.set("sort_by", sortBy);
  const qs = params.toString();
  return request(`/api/products${qs ? `?${qs}` : ""}`);
}

export function fetchProduct(id) {
  return request(`/api/products/${id}`);
}

export function createProduct(payload) {
  return request("/api/products", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function uploadProductImage(file) {
  const form = new FormData();
  form.append("file", file);
  return request("/api/uploads/image", {
    method: "POST",
    body: form,
  });
}

export function importProductsCsv(file, autoScore = true) {
  const form = new FormData();
  form.append("file", file);
  return request(`/api/products/import-csv?auto_score=${autoScore ? "true" : "false"}`, {
    method: "POST",
    body: form,
  });
}

export function scoreProduct(id) {
  return request(`/api/products/${id}/score`, {
    method: "POST",
  });
}

export function updateProduct(id, payload) {
  return request(`/api/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function approveProduct(id, edits = null) {
  return request(`/api/products/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: edits ? JSON.stringify(edits) : "{}",
  });
}

export function retryProduct(id) {
  return request(`/api/products/${id}/retry`, {
    method: "POST",
  });
}

export function deleteProduct(id) {
  return request(`/api/products/${id}`, {
    method: "DELETE",
  });
}

export function formatCopyableCaption(product) {
  const parts = [];
  if (product.hook_text) {
    parts.push(product.hook_text.trim());
  }
  if (product.caption_th) {
    parts.push(product.caption_th.trim());
  }
  if (Array.isArray(product.hashtags) && product.hashtags.length > 0) {
    parts.push(product.hashtags.join(" "));
  }
  const link = (product.affiliate_url || product.product_url || "").trim();
  if (link) {
    parts.push(`พิกัดสินค้า: ${link}`);
  }
  return parts.join("\n\n");
}
