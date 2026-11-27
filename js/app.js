/* ==========================================================================
   AI Ad Studio TH (Google Flow Edition) — Main Interactive Controller
   ========================================================================== */

import {
  FLOW_MODES,
  CLIP_STYLES,
  SAMPLE_PRODUCTS,
  buildLocalStudioPlan
} from './presets.js';
import {
  autoFillFromUrl,
  fetchProductPreviewFromUrl,
  generateAdStudioPlan,
  analyzeProductAndBuildUgcPrompt,
  buildUgc4GridLocalPrompt,
  generateUgcImageWithGemini
} from './gemini.js';
import {
  APPS_SCRIPT_TEMPLATE,
  uploadViaAppsScript,
  uploadViaOAuthDrive,
  STORAGE_DRIVE_WEBHOOK,
  STORAGE_DRIVE_CLIENT_ID,
  STORAGE_DRIVE_FOLDER,
  STORAGE_DRIVE_HISTORY
} from './drive.js';
import { renderUgc4GridCanvas } from './ugc-canvas.js';

const STORAGE_API_KEY = 'ai_ad_studio_th_gemini_api_key';
const MAX_IMAGE_DIM = 640;

const PROGRESS_STAGES = [
  { maxSec: 2, label: '0–2 วิ • วิเคราะห์สินค้า & องค์ประกอบ Ingredient 1+2...' },
  { maxSec: 4, label: '2–4 วิ • ล็อกตัวละคร/มือ & ตั้งค่าโหมด Google Flow...' },
  { maxSec: 7, label: '4–7 วิ • เขียนสคริปต์ & พรอมคลิป 0–10 วิ (Fast Mode)...' },
  { maxSec: 9, label: '7–9 วิ • สร้างพรอมภาพนิ่ง Imagen 3 ช็อตหลัก...' },
  { maxSec: 10, label: '9–10 วิ • เรียบเรียงแคปชั่น แฮชแท็ก & ตรวจสอบความต่อเนื่อง...' }
];

// Application State
const state = {
  apiKey: '',
  preferredModel: 'auto',
  flowMode: 'veo3',
  clipStyle: 'fast-hands-on',
  lockCharacter: true,
  ingredient1: null, // { dataUrl, base64, width, height, sizeKB, name, fromAutoUrl?, sourcePageUrl? }
  ingredient2: null,
  activeTab: 'slides',
  currentSlide: 0,
  isGenerating: false,
  plan: null,
  ugcImage: null, // { dataUrl, base64, mimeType, modelId }
  driveHistory: [],
  isSamplePreload: false,
  lastPrefetchedUrl: ''
};

// DOM References
const el = {};

function cacheDom() {
  const ids = [
    'apiKeyInput',
    'toggleApiKeyBtn',
    'apiStatusDot',
    'modelSelect',
    'productUrlInput',
    'autoFillBtn',
    'groundingSources',
    'productNameInput',
    'productBenefitsInput',
    'productPromoInput',
    'productAudienceInput',
    'productVisualInput',
    'aspectRatioSelect',
    'ingredient1Slot',
    'ingredient1Input',
    'ingredient1Img',
    'ingredient1Badge',
    'ingredient1Remove',
    'ingredient2Slot',
    'ingredient2Input',
    'ingredient2Img',
    'ingredient2Badge',
    'ingredient2Remove',
    'lockCharacterCard',
    'lockCharacterToggle',
    'characterAnchorWrap',
    'characterAnchorInput',
    'flowModesContainer',
    'clipStylesContainer',
    'generateBtn',
    'generateBtnText',
    'progressPanel',
    'progressStage',
    'progressTimer',
    'progressFill',
    'outputMetaChips',
    'copyAllBtn',
    'exportTxtBtn',
    'tabsNav',
    'tabSlides',
    'tabImagen',
    'tabCaptions',
    'tabTimeline',
    'tabUgcGrid',
    'timecodePills',
    'prevSlideBtn',
    'nextSlideBtn',
    'carouselViewport',
    'carouselTrack',
    'carouselDots',
    'imagenContainer',
    'captionsContainer',
    'timelineVisualBar',
    'timelineList',
    'ugcOneClickBtn',
    'ugcRebuildPromptBtn',
    'ugcLabel1',
    'ugcLabel2',
    'ugcLabel3',
    'ugcLabel4',
    'ugcCopyPromptBtn',
    'ugcPromptTextarea',
    'ugcImageModelSelect',
    'ugcOpenGeminiWebBtn',
    'ugcImportImageBtn',
    'ugcGenGeminiImgBtn',
    'ugcGenCanvasBtn',
    'ugcUploadImgInput',
    'ugcGeminiWorkflowBanner',
    'ugcImageStatus',
    'ugcImageStage',
    'ugcEmptyState',
    'ugcPreviewImg',
    'ugcStageFooter',
    'ugcStageMeta',
    'ugcChangeImgBtn',
    'ugcUseAsIng1Btn',
    'driveMethodSelect',
    'driveFolderInput',
    'driveAppsScriptBox',
    'driveWebhookInput',
    'toggleAppsScriptGuideBtn',
    'driveOAuthBox',
    'driveClientIdInput',
    'appsScriptGuideDrawer',
    'copyAppsScriptBtn',
    'appsScriptCodePreview',
    'ugcSaveDriveBtn',
    'ugcDownloadPngBtn',
    'driveUploadResult',
    'driveHistoryList',
    'toastContainer'
  ];
  ids.forEach((id) => {
    el[id] = document.getElementById(id);
  });
}

/* ==========================================================================
   Utilities: Escaping, Clipboard, Toast Notifications
   ========================================================================== */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  el.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    setTimeout(() => toast.remove(), 220);
  }, 2800);
}

async function copyText(text, triggerBtn = null, successMsg = 'คัดลอกเรียบร้อยแล้ว') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }

  if (triggerBtn) {
    const orig = triggerBtn.innerHTML;
    triggerBtn.classList.add('copied');
    triggerBtn.innerHTML = '✓ คัดลอกแล้ว';
    setTimeout(() => {
      triggerBtn.classList.remove('copied');
      triggerBtn.innerHTML = orig;
    }, 1500);
  }
  showToast(successMsg, 'success');
}

/* ==========================================================================
   Image Upload & Client-Side Compression (<= 640px)
   ========================================================================== */

function compressImageTo640(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WebP)'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์รูปภาพเสียหายหรือไม่รองรับ'));
      img.onload = () => {
        let { width, height } = img;
        const origW = width;
        const origH = height;

        if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_IMAGE_DIM) / width);
            width = MAX_IMAGE_DIM;
          } else {
            width = Math.round((width * MAX_IMAGE_DIM) / height);
            height = MAX_IMAGE_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const base64 = dataUrl.split(',')[1];
        const sizeKB = Math.max(1, Math.round((base64.length * 3) / 4 / 1024));

        resolve({
          dataUrl,
          base64,
          width,
          height,
          origW,
          origH,
          sizeKB,
          name: file.name
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function compressImageFromUrlTo640(imageUrl) {
  if (!imageUrl) throw new Error('ไม่มี URL รูปภาพสินค้า');

  const tryFetchBlob = async (targetUrl, timeoutMs = 6000) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(targetUrl, { signal: ctrl.signal, mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob || !blob.size || (blob.type && !blob.type.startsWith('image/'))) {
        return null;
      }
      return blob;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const candidates = [
    imageUrl,
    `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&w=640&h=640&fit=inside&output=jpeg&q=85`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`
  ];

  for (const candidateUrl of candidates) {
    const blob = await tryFetchBlob(candidateUrl);
    if (blob) {
      const ext = (blob.type || 'image/jpeg').includes('png') ? 'png' : 'jpg';
      const file = new File([blob], `product-from-link.${ext}`, {
        type: blob.type || 'image/jpeg'
      });
      return await compressImageTo640(file);
    }
  }

  throw new Error('ไม่สามารถโหลดไฟล์รูปภาพข้ามโดเมนจากลิงก์นี้ได้');
}

async function applyRemoteProductImageToIngredient1(imageUrl, sourcePageUrl = '') {
  const compressed = await compressImageFromUrlTo640(imageUrl);
  compressed.fromAutoUrl = true;
  compressed.sourcePageUrl = sourcePageUrl;
  compressed.sourceImageUrl = imageUrl;

  state.ingredient1 = compressed;
  el.ingredient1Img.src = compressed.dataUrl;
  el.ingredient1Badge.textContent = `${compressed.width}×${compressed.height}px • ${compressed.sizeKB} KB`;
  el.ingredient1Slot.classList.add('has-image');
  return compressed;
}

function setupIngredientSlot(slotNum) {
  const key = `ingredient${slotNum}`;
  const slotEl = el[`${key}Slot`];
  const inputEl = el[`${key}Input`];
  const imgEl = el[`${key}Img`];
  const badgeEl = el[`${key}Badge`];
  const removeBtn = el[`${key}Remove`];

  const handleFile = async (file) => {
    try {
      const compressed = await compressImageTo640(file);
      state[key] = compressed;
      imgEl.src = compressed.dataUrl;
      badgeEl.textContent = `${compressed.width}×${compressed.height}px • ${compressed.sizeKB} KB`;
      slotEl.classList.add('has-image');
      showToast(
        `อัปโหลด Ingredient ${slotNum} สำเร็จ (บีบอัดเป็น ${compressed.width}×${compressed.height}px, ${compressed.sizeKB} KB)`,
        'success'
      );
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  slotEl.addEventListener('click', (e) => {
    if (e.target.closest('.ingredient-remove-btn')) return;
    inputEl.click();
  });

  slotEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputEl.click();
    }
  });

  inputEl.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    inputEl.value = '';
  });

  slotEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    slotEl.classList.add('dragover');
  });

  slotEl.addEventListener('dragleave', () => {
    slotEl.classList.remove('dragover');
  });

  slotEl.addEventListener('drop', (e) => {
    e.preventDefault();
    slotEl.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    state[key] = null;
    imgEl.src = '';
    slotEl.classList.remove('has-image');
    showToast(`ลบภาพ Ingredient ${slotNum} แล้ว`, 'info');
  });
}

/* ==========================================================================
   Render Left Panel Selectors: 3 Flow Modes & 5 Clip Styles
   ========================================================================== */

function renderFlowModes() {
  el.flowModesContainer.innerHTML = Object.values(FLOW_MODES)
    .map(
      (mode) => `
      <button
        type="button"
        class="flow-mode-btn ${state.flowMode === mode.id ? 'active' : ''}"
        data-flow-mode="${mode.id}"
        aria-pressed="${state.flowMode === mode.id}"
      >
        <div class="flow-mode-name">
          <span>${escapeHtml(mode.name)}</span>
          <span class="flow-mode-tag">${escapeHtml(mode.tag)}</span>
        </div>
        <div class="flow-mode-desc">${escapeHtml(mode.shortDesc)}</div>
      </button>
    `
    )
    .join('');

  el.flowModesContainer.querySelectorAll('.flow-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.flowMode = btn.dataset.flowMode;
      renderFlowModes();
    });
  });
}

function renderClipStyles() {
  el.clipStylesContainer.innerHTML = CLIP_STYLES.map(
    (style) => `
      <button
        type="button"
        class="style-option-btn ${state.clipStyle === style.id ? 'active' : ''}"
        data-clip-style="${style.id}"
        aria-pressed="${state.clipStyle === style.id}"
      >
        <div class="style-option-left">
          <div class="style-option-title">
            <span>${escapeHtml(style.name)}</span>
            ${style.isDefault ? '<span class="default-star">ค่าเริ่มต้น</span>' : ''}
            ${style.isNew ? '<span class="default-star new-badge">ไม่เห็นหน้า • ใหม่</span>' : ''}
          </div>
          <div class="style-option-sub">${escapeHtml(style.shortDesc)}</div>
        </div>
        <div class="style-radio" aria-hidden="true"></div>
      </button>
    `
  ).join('');

  el.clipStylesContainer.querySelectorAll('.style-option-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.clipStyle = btn.dataset.clipStyle;
      renderClipStyles();
    });
  });
}

/* ==========================================================================
   Sample Product Loader & AI Auto-Fill from URL (Search Grounding)
   ========================================================================== */

function loadSampleProduct(sampleKey, silent = false) {
  const sample = SAMPLE_PRODUCTS[sampleKey];
  if (!sample) return;
  el.productUrlInput.value = sample.url;
  el.productNameInput.value = sample.name;
  el.productBenefitsInput.value = sample.benefits;
  el.productPromoInput.value = sample.pricePromo;
  el.productAudienceInput.value = sample.audience;
  el.productVisualInput.value = sample.visualDetails;
  el.characterAnchorInput.value = sample.characterAnchor;
  el.groundingSources.innerHTML = '';
  state.isSamplePreload = true;
  state.lastPrefetchedUrl = '';

  if (state.ingredient1?.fromAutoUrl) {
    state.ingredient1 = null;
    el.ingredient1Img.src = '';
    el.ingredient1Slot.classList.remove('has-image');
  }

  if (!silent) {
    showToast(`โหลดข้อมูลตัวอย่าง "${sample.name}" แล้ว`, 'info');
  }
}

async function prefetchProductFromUrlOnPaste(rawUrl, options = {}) {
  const { silentNoKey = false } = options;
  const url = (rawUrl || '').trim();
  if (!url || !/(https?:\/\/|[a-z0-9-]+\.[a-z]{2,})/i.test(url)) return null;
  if (url === state.lastPrefetchedUrl && state.ingredient1?.sourcePageUrl === url) {
    return null;
  }
  state.lastPrefetchedUrl = url;

  el.groundingSources.innerHTML =
    '<span class="grounding-chip">⏳ กำลังดึงรูปสินค้า &amp; ข้อมูลจากลิงก์...</span>';

  const preview = await fetchProductPreviewFromUrl(url);

  const canOverwriteSample = state.isSamplePreload;
  if (preview.title && (canOverwriteSample || !el.productNameInput.value.trim())) {
    el.productNameInput.value = preview.title;
    state.isSamplePreload = false;
  }
  if (preview.description && (canOverwriteSample || !el.productBenefitsInput.value.trim())) {
    el.productBenefitsInput.value = preview.description;
    state.isSamplePreload = false;
  }

  let loadedIng = null;
  if (preview.imageUrl && (!state.ingredient1 || state.ingredient1.fromAutoUrl)) {
    try {
      loadedIng = await applyRemoteProductImageToIngredient1(preview.imageUrl, url);
    } catch {
      loadedIng = null;
    }
  }

  if (loadedIng) {
    el.groundingSources.innerHTML = `<span class="grounding-chip">✓ ดึงรูปสินค้าลง Ingredient 1 แล้ว (${loadedIng.width}×${loadedIng.height}px)</span>`;
    if (!silentNoKey) {
      showToast(
        `ดึงรูปสินค้าจากลิงก์ลง Ingredient 1 สำเร็จ! (${loadedIng.width}×${loadedIng.height}px)`,
        'success'
      );
    }
  } else if (preview.blockedReason) {
    el.groundingSources.innerHTML = `<span class="sample-label" style="color:#fde047;">⚠️ ${escapeHtml(preview.blockedReason)} — ลากรูปมาวางใน Ingredient 1 ได้เลย</span>`;
    if (!silentNoKey) {
      showToast(`${preview.blockedReason} (สามารถลากรูปสินค้ามาวางใน Ingredient 1 เองได้)`, 'warn');
    }
  } else if (preview.title) {
    el.groundingSources.innerHTML = `<span class="grounding-chip">✓ ดึงชื่อสินค้าจากลิงก์แล้ว (ไม่พบไฟล์รูป — ลากรูปใส่ Ingredient 1 เพิ่มได้)</span>`;
  } else {
    el.groundingSources.innerHTML =
      '<span class="sample-label" style="color:var(--text-muted);">ลิงก์นี้ไม่ส่งรูปภาพเปิดเผย (og:image) — ลากรูปสินค้ามาวางใน Ingredient 1 เองได้</span>';
  }

  if (typeof rebuildUgcPromptFromInputs === 'function') {
    rebuildUgcPromptFromInputs();
  }

  return { preview, loadedIng };
}

async function handleAutoFill() {
  const url = el.productUrlInput.value.trim();
  const hasIng1 = Boolean(state.ingredient1?.base64);
  if (!url && !hasIng1) {
    showToast('กรุณาวางลิงก์สินค้า หรืออัปโหลดรูป Ingredient 1 ก่อนกด AI Auto-Fill', 'warn');
    el.productUrlInput.focus();
    return;
  }

  const apiKey = state.apiKey.trim();
  if (!apiKey) {
    // Still fetch image + OpenGraph title/desc from pasted URL even without a Gemini API key!
    if (url) {
      const origHtml = el.autoFillBtn.innerHTML;
      el.autoFillBtn.disabled = true;
      el.autoFillBtn.innerHTML =
        '<svg class="spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> กำลังดึงลิงก์...';
      try {
        const fetched = await prefetchProductFromUrlOnPaste(url, { silentNoKey: true });
        if (!fetched?.preview?.title) {
          try {
            const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
            const slug = decodeURIComponent(parsedUrl.pathname)
              .replace(/[-_/]+/g, ' ')
              .trim();
            if (slug && slug.length > 3) {
              el.productNameInput.value = slug
                .split(' ')
                .slice(0, 6)
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
            }
          } catch {
            // ignore URL parse error
          }
        }
        if (fetched?.loadedIng) {
          showToast(
            'ดึงรูปสินค้าเข้า Ingredient 1 แล้ว! (ใส่ Gemini API Key ด้านบนเพื่อวิเคราะห์สรรพคุณด้วย AI)',
            'success'
          );
          return;
        }
      } finally {
        el.autoFillBtn.disabled = false;
        el.autoFillBtn.innerHTML = origHtml;
      }
    }
    showToast(
      'ใส่ Gemini API Key ด้านบนเพื่อเปิดใช้งาน AI Auto-Fill (หรือกดเลือกสินค้าตัวอย่างด้านล่าง)',
      'warn'
    );
    el.apiKeyInput.focus();
    return;
  }

  const origHtml = el.autoFillBtn.innerHTML;
  el.autoFillBtn.disabled = true;
  el.autoFillBtn.innerHTML =
    '<svg class="spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> กำลังค้นหา...';
  el.groundingSources.innerHTML = '';

  try {
    const previewPromise = url ? fetchProductPreviewFromUrl(url) : Promise.resolve(null);
    const geminiPromise = autoFillFromUrl(apiKey, url, {
      preferredModel: state.preferredModel,
      ingredient1: state.ingredient1
    });

    const [geminiSettled, previewSettled] = await Promise.allSettled([
      geminiPromise,
      previewPromise
    ]);

    const preview = previewSettled.status === 'fulfilled' ? previewSettled.value : null;

    if (geminiSettled.status !== 'fulfilled') {
      // Even if Gemini failed, still try applying the fetched product image from URL!
      if (preview?.imageUrl && (!state.ingredient1 || state.ingredient1.fromAutoUrl)) {
        try {
          await applyRemoteProductImageToIngredient1(preview.imageUrl, url);
        } catch {
          // ignore
        }
      }
      throw geminiSettled.reason;
    }

    const result = geminiSettled.value;
    state.isSamplePreload = false;
    if (result.productName) el.productNameInput.value = result.productName;
    if (result.benefits) el.productBenefitsInput.value = result.benefits;
    if (result.pricePromo) el.productPromoInput.value = result.pricePromo;
    if (result.audience) el.productAudienceInput.value = result.audience;
    if (result.visualDetails) el.productVisualInput.value = result.visualDetails;
    if (result.characterAnchor) el.characterAnchorInput.value = result.characterAnchor;

    // Try loading product image from Gemini productImageUrl or OpenGraph preview into Ingredient 1
    let ingLoaded = null;
    const imgCandidates = [result.productImageUrl, preview?.imageUrl].filter(Boolean);
    if (imgCandidates.length && (!state.ingredient1 || state.ingredient1.fromAutoUrl || state.ingredient1.sourcePageUrl !== url)) {
      for (const candidateImg of imgCandidates) {
        try {
          ingLoaded = await applyRemoteProductImageToIngredient1(candidateImg, url);
          break;
        } catch {
          // try next image candidate
        }
      }
    }

    const noteBadge = result.note
      ? `<span class="sample-label" style="color:#fde047;">หมายเหตุ: ${escapeHtml(result.note)}</span>`
      : '';

    const ingBadgeHtml = ingLoaded
      ? `<span class="grounding-chip">✓ ดึงรูปลง Ingredient 1 (${ingLoaded.width}×${ingLoaded.height}px)</span>`
      : '';

    const modeBadge = `<span class="grounding-chip">${escapeHtml(result.modelId)} • ${escapeHtml(result.strategyName || 'Auto-Fill')}</span>`;

    el.groundingSources.innerHTML =
      modeBadge +
      ingBadgeHtml +
      (result.sources?.length
        ? result.sources
            .slice(0, 3)
            .map(
              (s) =>
                `<a class="grounding-chip" href="${escapeHtml(s.uri)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title || s.uri)}</a>`
            )
            .join('')
        : '') +
      noteBadge;

    if (typeof rebuildUgcPromptFromInputs === 'function') {
      rebuildUgcPromptFromInputs();
    }

    showToast(
      ingLoaded
        ? `AI Auto-Fill + ดึงรูปลง Ingredient 1 สำเร็จด้วย ${result.modelId}!`
        : `AI Auto-Fill สำเร็จด้วย ${result.modelId} (${result.strategyName})!`,
      'success'
    );
  } catch (err) {
    el.groundingSources.innerHTML = `<span class="sample-label" style="color:#fca5a5;">⚠️ ${escapeHtml(err.message)}</span>`;
    showToast(`Auto-Fill ไม่สำเร็จ: ${err.message}`, 'error');
  } finally {
    el.autoFillBtn.disabled = false;
    el.autoFillBtn.innerHTML = origHtml;
  }
}

/* ==========================================================================
   15-Second Progress Bar Controller + Generation Workflow
   ========================================================================== */

function getStageText(sec) {
  for (const s of PROGRESS_STAGES) {
    if (sec <= s.maxSec) return s.label;
  }
  return PROGRESS_STAGES[PROGRESS_STAGES.length - 1].label;
}

function collectInputPayload() {
  return {
    productUrl: el.productUrlInput.value.trim(),
    productName: el.productNameInput.value.trim(),
    benefits: el.productBenefitsInput.value.trim(),
    pricePromo: el.productPromoInput.value.trim(),
    audience: el.productAudienceInput.value.trim(),
    visualDetails: el.productVisualInput.value.trim(),
    aspectRatio: el.aspectRatioSelect.value,
    flowMode: state.flowMode,
    clipStyle: state.clipStyle,
    lockCharacter: state.lockCharacter,
    characterAnchor: el.characterAnchorInput.value.trim(),
    ingredient1: state.ingredient1,
    ingredient2: state.ingredient2,
    preferredModel: state.preferredModel
  };
}

async function handleGenerate() {
  if (state.isGenerating) return;

  const payload = collectInputPayload();
  if (!payload.productName) {
    showToast('กรุณากรอกชื่อสินค้าก่อนเริ่มสร้างพรอม', 'warn');
    el.productNameInput.focus();
    return;
  }

  state.isGenerating = true;
  el.generateBtn.disabled = true;
  el.generateBtnText.textContent = 'กำลังประมวลผลด้วย Gemini Flash...';
  el.progressPanel.classList.add('visible');

  const TOTAL_SECONDS = 10;
  let displaySec = 0;
  el.progressFill.style.width = '0%';
  el.progressTimer.textContent = '0.0s / 10.0s';
  el.progressStage.textContent = getStageText(0);

  const startedAt = performance.now();
  const hasApiKey = Boolean(state.apiKey.trim());

  // Tick progress bar along the 10-second studio scale
  const tickInterval = setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    if (hasApiKey) {
      // Smoothly pace up to 9.5s while waiting for live Gemini API
      displaySec = Math.min(9.5, elapsed * 1.15);
    } else {
      // In Demo Mode, map 1.8s smooth animation across 0 -> 9.7s
      displaySec = Math.min(9.7, (elapsed / 1.8) * 9.7);
    }
    const pct = Math.min(96, (displaySec / TOTAL_SECONDS) * 100);
    el.progressFill.style.width = `${pct.toFixed(1)}%`;
    el.progressTimer.textContent = `${displaySec.toFixed(1)}s / 10.0s`;
    el.progressStage.textContent = getStageText(displaySec);
  }, 80);

  try {
    let plan;
    if (hasApiKey) {
      plan = await generateAdStudioPlan(state.apiKey.trim(), payload);
    } else {
      await new Promise((r) => setTimeout(r, 1850));
      plan = buildLocalStudioPlan(payload);
    }

    clearInterval(tickInterval);
    el.progressFill.style.width = '100%';
    el.progressTimer.textContent = '10.0s / 10.0s ✓';
    el.progressStage.textContent = hasApiKey
      ? `สร้างพรอมสำเร็จด้วย ${plan.modelLabel}`
      : 'สร้างพรอมโหมด Demo สำเร็จ! (ใส่ Gemini API Key เพื่อใช้ AI จริง)';

    state.plan = plan;
    state.currentSlide = 0;
    renderAllOutputs();

    showToast(
      hasApiKey
        ? 'สร้างชุดพรอม Google Flow & Imagen 10 วิ เรียบร้อยแล้ว!'
        : 'สร้างพรอมโหมด Demo (10 วิ) เรียบร้อยแล้ว! พร้อมใช้งานทุกแท็บ',
      'success'
    );
  } catch (err) {
    clearInterval(tickInterval);
    if (err?.status === 429) {
      const fallbackPlan = buildLocalStudioPlan(payload);
      fallbackPlan.modelLabel = 'Smart Fallback (API Key ติดโควตา 429)';
      state.plan = fallbackPlan;
      state.currentSlide = 0;
      renderAllOutputs();
      el.progressFill.style.width = '100%';
      el.progressTimer.textContent = '10.0s / 10.0s (Fallback)';
      el.progressStage.textContent =
        'API Key ติดโควตา 429 ทุกโมเดล — ระบบสลับสร้างพรอมด้วย Smart Fallback ให้ใช้งานต่อได้ทันที';
      showToast(err.message, 'warn');
    } else {
      el.progressStage.textContent = `เกิดข้อผิดพลาด: ${err.message}`;
      showToast(`สร้างพรอมไม่สำเร็จ: ${err.message}`, 'error');
    }
  } finally {
    state.isGenerating = false;
    el.generateBtn.disabled = false;
    el.generateBtnText.textContent = 'สร้างพรอม Google Flow & Imagen (10 วิ)';
  }
}

/* ==========================================================================
   Right Panel Rendering (4 Tabs)
   ========================================================================== */

function renderAllOutputs() {
  if (!state.plan) return;
  renderOutputMeta();
  renderSlidesTab();
  renderImagenTab();
  renderCaptionsTab();
  renderTimelineTab();

  const outputShell = document.querySelector('.output-shell');
  if (outputShell) {
    outputShell.classList.remove('just-generated');
    void outputShell.offsetWidth;
    outputShell.classList.add('just-generated');
  }
}

function renderOutputMeta() {
  const p = state.plan;
  el.outputMetaChips.innerHTML = `
    <span class="meta-chip ${p.source === 'gemini' ? 'live-ai' : ''}">
      ${p.source === 'gemini' ? '⚡ ' : '✦ '}${escapeHtml(p.modelLabel)}
    </span>
    <span class="meta-chip">${escapeHtml(p.flowModeName)}</span>
    <span class="meta-chip">${escapeHtml(p.clipStyleName)}</span>
    <span class="meta-chip">${escapeHtml(p.aspectRatio)}</span>
    <span class="meta-chip ${p.lockCharacter ? 'lock-on' : ''}">
      ${p.lockCharacter ? '🔒 ล็อกตัวละคร ON' : '🔓 ล็อกตัวละคร OFF'}
    </span>
  `;
}

/* Tab 1: 0–15s Slides Carousel */
function renderSlidesTab() {
  const slides = state.plan.slides || [];

  // Timecode pills
  el.timecodePills.innerHTML = slides
    .map(
      (s, i) => `
      <button
        type="button"
        class="timecode-pill ${i === state.currentSlide ? 'active' : ''}"
        data-slide-idx="${i}"
      >
        #${i + 1} (${escapeHtml(s.shortTime)})
      </button>
    `
    )
    .join('');

  el.timecodePills.querySelectorAll('.timecode-pill').forEach((btn) => {
    btn.addEventListener('click', () => goToSlide(Number(btn.dataset.slideIdx)));
  });

  // Carousel slides
  el.carouselTrack.innerHTML = slides
    .map(
      (s, i) => `
      <div class="slide-item" data-slide-index="${i}">
        <article class="slide-card">
          <div class="slide-head">
            <div class="slide-title-wrap">
              <div class="slide-badges">
                <span class="time-badge">${escapeHtml(s.timecode)}</span>
                <span class="flow-action-badge">${escapeHtml(s.flowAction)}</span>
                ${
                  state.plan.lockCharacter
                    ? '<span class="lock-mini-badge">🔒 Subject Lock</span>'
                    : ''
                }
              </div>
              <h3 class="slide-title">Shot ${i + 1}: ${escapeHtml(s.title)}</h3>
            </div>
            <span class="step-badge">${escapeHtml(s.role)}</span>
          </div>

          <div class="prompt-box">
            <div class="prompt-box-header">
              <span class="prompt-box-label">
                <span class="g-dots"><span></span><span></span><span></span><span></span></span>
                Google Flow Prompt (${escapeHtml(state.plan.flowMode.toUpperCase())})
              </span>
              <button type="button" class="btn-copy-sm" data-copy-slide="${i}">
                คัดลอกพรอมช็อตนี้
              </button>
            </div>
            <div class="prompt-box-content">${escapeHtml(s.prompt)}</div>
          </div>

          <div class="slide-details-grid">
            <div class="detail-tile full">
              <div class="detail-label">บทพูด / Voiceover (ภาษาไทย)</div>
              <div class="detail-text vo">“${escapeHtml(s.voiceover)}”</div>
            </div>
            <div class="detail-tile">
              <div class="detail-label">มุมกล้อง & การเคลื่อนไหว</div>
              <div class="detail-text">${escapeHtml(s.camera)}</div>
            </div>
            <div class="detail-tile">
              <div class="detail-label">ข้อความขึ้นจอ (On-Screen Text)</div>
              <div class="detail-text">${escapeHtml(s.onScreenText)}</div>
            </div>
            <div class="detail-tile">
              <div class="detail-label">Audio / SFX / BGM</div>
              <div class="detail-text">${escapeHtml(s.audioCue)}</div>
            </div>
            <div class="detail-tile">
              <div class="detail-label">ทิปส์ต่อช็อต (Google Flow / Scenebuilder)</div>
              <div class="detail-text">${escapeHtml(s.continuityNote)}</div>
            </div>
          </div>
        </article>
      </div>
    `
    )
    .join('');

  el.carouselTrack.querySelectorAll('[data-copy-slide]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.copySlide);
      const slide = state.plan.slides[idx];
      if (slide) {
        copyText(slide.prompt, btn, `คัดลอกพรอม Shot ${idx + 1} (${slide.timecode}) แล้ว`);
      }
    });
  });

  // Footer dots
  el.carouselDots.innerHTML = slides
    .map(
      (_, i) => `
      <button
        type="button"
        class="carousel-dot ${i === state.currentSlide ? 'active' : ''}"
        aria-label="ไปสไลด์ที่ ${i + 1}"
        data-dot-idx="${i}"
      ></button>
    `
    )
    .join('');

  el.carouselDots.querySelectorAll('.carousel-dot').forEach((dot) => {
    dot.addEventListener('click', () => goToSlide(Number(dot.dataset.dotIdx)));
  });

  updateCarouselPosition();
}

function goToSlide(index) {
  const total = state.plan?.slides?.length || 0;
  if (!total) return;
  state.currentSlide = Math.max(0, Math.min(total - 1, index));
  updateCarouselPosition();
}

function updateCarouselPosition() {
  const total = state.plan?.slides?.length || 0;
  el.carouselTrack.style.transform = `translateX(-${state.currentSlide * 100}%)`;
  el.prevSlideBtn.disabled = state.currentSlide <= 0;
  el.nextSlideBtn.disabled = state.currentSlide >= total - 1;

  el.carouselTrack.querySelectorAll('.slide-card').forEach((card, idx) => {
    card.classList.remove('slide-pulse');
    if (idx === state.currentSlide) {
      void card.offsetWidth;
      card.classList.add('slide-pulse');
    }
  });

  el.timecodePills.querySelectorAll('.timecode-pill').forEach((pill, idx) => {
    pill.classList.toggle('active', idx === state.currentSlide);
  });
  el.carouselDots.querySelectorAll('.carousel-dot').forEach((dot, idx) => {
    dot.classList.toggle('active', idx === state.currentSlide);
  });
}

/* Tab 2: 3 Imagen Still Prompts */
function renderImagenTab() {
  const prompts = state.plan.imagenPrompts || [];
  el.imagenContainer.innerHTML =
    prompts
      .map(
        (im, idx) => `
      <article class="imagen-card">
        <div class="imagen-card-top">
          <div class="imagen-title">
            <span class="imagen-num">0${idx + 1}</span>
            <span>${escapeHtml(im.title)}</span>
          </div>
          <span class="tech-pill">${escapeHtml(im.ratio)}</span>
        </div>
        <p class="imagen-note">${escapeHtml(im.purpose)}</p>
        <div class="prompt-box">
          <div class="prompt-box-header">
            <span class="prompt-box-label">
              <span class="g-dots"><span></span><span></span><span></span><span></span></span>
              Imagen 3 / 4 Prompt
            </span>
            <button type="button" class="btn-copy-sm" data-copy-imagen="${idx}">
              คัดลอกพรอมภาพนี้
            </button>
          </div>
          <div class="prompt-box-content">${escapeHtml(im.prompt)}</div>
        </div>
      </article>
    `
      )
      .join('') +
    `
      <div style="display:flex; justify-content:flex-end;">
        <button type="button" class="btn-secondary-sm" id="copyAllImagenBtn">
          คัดลอกพรอมภาพนิ่ง Imagen ทั้ง 3 ช็อต
        </button>
      </div>
    `;

  el.imagenContainer.querySelectorAll('[data-copy-imagen]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.copyImagen);
      const item = state.plan.imagenPrompts[idx];
      if (item) copyText(item.prompt, btn, `คัดลอกพรอม Imagen #${idx + 1} แล้ว`);
    });
  });

  const copyAllImBtn = document.getElementById('copyAllImagenBtn');
  if (copyAllImBtn) {
    copyAllImBtn.addEventListener('click', () => {
      const joined = prompts
        .map((im, i) => `[Imagen #${i + 1}: ${im.title} (${im.ratio})]\n${im.prompt}`)
        .join('\n\n');
      copyText(joined, copyAllImBtn, 'คัดลอกพรอม Imagen ทั้ง 3 ช็อตแล้ว');
    });
  }
}

/* Tab 3: Captions & Hashtags */
function renderCaptionsTab() {
  const captions = state.plan.captions || [];
  const hashtags = state.plan.hashtags || [];

  const captionsHtml = captions
    .map(
      (cap, idx) => `
      <article class="caption-card">
        <div class="caption-top">
          <div class="platform-badge">
            <span>${escapeHtml(cap.platform)}</span>
            <span class="tech-pill yellow">${escapeHtml(cap.badge)}</span>
          </div>
          <button type="button" class="btn-copy-sm" data-copy-caption="${idx}">
            คัดลอกแคปชั่น
          </button>
        </div>
        <div class="caption-body">${escapeHtml(cap.text)}</div>
      </article>
    `
    )
    .join('');

  const hashtagsHtml = `
    <section class="hashtag-box">
      <div class="caption-top">
        <div class="platform-badge">
          <span>ชุดแฮชแท็กขายดี (${hashtags.length} แท็ก)</span>
        </div>
        <button type="button" class="btn-copy-sm" id="copyAllHashtagsBtn">
          คัดลอกแฮชแท็กทั้งหมด
        </button>
      </div>
      <div class="hashtag-cloud">
        ${hashtags
          .map(
            (tag) =>
              `<button type="button" class="hashtag-pill" data-copy-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`
          )
          .join('')}
      </div>
    </section>
  `;

  el.captionsContainer.innerHTML = captionsHtml + hashtagsHtml;

  el.captionsContainer.querySelectorAll('[data-copy-caption]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.copyCaption);
      const cap = state.plan.captions[idx];
      if (cap) copyText(cap.text, btn, `คัดลอกแคปชั่น ${cap.platform} แล้ว`);
    });
  });

  el.captionsContainer.querySelectorAll('[data-copy-tag]').forEach((chip) => {
    chip.addEventListener('click', () => {
      copyText(chip.dataset.copyTag, null, `คัดลอก ${chip.dataset.copyTag} แล้ว`);
    });
  });

  const copyTagsBtn = document.getElementById('copyAllHashtagsBtn');
  if (copyTagsBtn) {
    copyTagsBtn.addEventListener('click', () => {
      copyText(hashtags.join(' '), copyTagsBtn, 'คัดลอกแฮชแท็กทั้งหมดแล้ว');
    });
  }
}

/* Tab 4: Full 0–15s Master Timeline */
function renderTimelineTab() {
  const slides = state.plan.slides || [];

  el.timelineVisualBar.innerHTML = slides
    .map(
      (s, idx) => `
      <div class="timeline-seg" data-jump-slide="${idx}" title="คลิกเพื่อเปิดสไลด์ที่ ${idx + 1}">
        <div class="timeline-seg-time">${escapeHtml(s.shortTime)}</div>
        <div class="timeline-seg-name">Shot ${idx + 1}: ${escapeHtml(s.role)}</div>
      </div>
    `
    )
    .join('');

  el.timelineVisualBar.querySelectorAll('[data-jump-slide]').forEach((seg) => {
    seg.addEventListener('click', () => {
      const idx = Number(seg.dataset.jumpSlide);
      switchTab('slides');
      goToSlide(idx);
    });
  });

  el.timelineList.innerHTML = slides
    .map(
      (s, idx) => `
      <article class="timeline-node">
        <div class="timeline-node-top">
          <div class="timeline-node-title">
            <span class="time-badge">${escapeHtml(s.timecode)}</span>
            <span>Shot ${idx + 1}: ${escapeHtml(s.title)}</span>
          </div>
          <button type="button" class="btn-copy-sm" data-copy-tl="${idx}">
            คัดลอกพรอม
          </button>
        </div>
        <div class="timeline-vo-quote">🎙️ “${escapeHtml(s.voiceover)}”</div>
        <div class="timeline-prompt-mini">${escapeHtml(s.prompt)}</div>
      </article>
    `
    )
    .join('');

  el.timelineList.querySelectorAll('[data-copy-tl]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.copyTl);
      const slide = state.plan.slides[idx];
      if (slide) copyText(slide.prompt, btn, `คัดลอกพรอม Shot ${idx + 1} แล้ว`);
    });
  });
}

/* ==========================================================================
   Copy All Master Production Package & Export .TXT
   ========================================================================== */

function buildMasterCopyText() {
  const p = state.plan;
  if (!p) return '';

  const lines = [
    '================================================================',
    'AI AD STUDIO TH — GOOGLE FLOW EDITION (0–10s PRODUCTION PACKAGE)',
    '================================================================',
    `สินค้า: ${p.productName}`,
    `โหมด Google Flow: ${p.flowModeName}`,
    `แนวทางคลิป 10 วิ: ${p.clipStyleName}`,
    `อัตราส่วนภาพ: ${p.aspectRatio}`,
    `ล็อกตัวละครทุกช็อต: ${p.lockCharacter ? 'ON' : 'OFF'}`,
    p.characterAnchor ? `Character/Hands Anchor: ${p.characterAnchor}` : '',
    `หมายเหตุโหมดเสียง/ซีน: ${p.audioModeNote}`,
    '',
    '----------------------------------------------------------------',
    '1. สไลด์คลิป 0–10 วินาที (GOOGLE FLOW PROMPTS & SCRIPT)',
    '----------------------------------------------------------------'
  ];

  (p.slides || []).forEach((s, idx) => {
    lines.push(
      `\n[Shot ${idx + 1} | ${s.timecode} | ${s.role}] ${s.title}`,
      `Flow Action: ${s.flowAction}`,
      `Prompt (EN):\n${s.prompt}`,
      `บทพูด/VO (TH): "${s.voiceover}"`,
      `On-Screen Text: ${s.onScreenText}`,
      `Camera: ${s.camera}`,
      `Audio/SFX: ${s.audioCue}`,
      `Continuity Note: ${s.continuityNote}`
    );
  });

  lines.push(
    '',
    '----------------------------------------------------------------',
    '2. พรอมภาพนิ่ง IMAGEN (3 SHOTS)',
    '----------------------------------------------------------------'
  );

  (p.imagenPrompts || []).forEach((im, idx) => {
    lines.push(
      `\n[Imagen #${idx + 1} | ${im.ratio}] ${im.title}`,
      `การใช้งาน: ${im.purpose}`,
      `Prompt (EN):\n${im.prompt}`
    );
  });

  lines.push(
    '',
    '----------------------------------------------------------------',
    '3. แคปชั่นขายของ & แฮชแท็ก',
    '----------------------------------------------------------------'
  );

  (p.captions || []).forEach((cap) => {
    lines.push(`\n[${cap.platform}]`, cap.text);
  });

  lines.push('\n[Hashtags]', (p.hashtags || []).join(' '));

  return lines.filter((l) => l !== undefined).join('\n');
}

/* ==========================================================================
   Tabs, Keyboard Navigation & Touch/Pointer Swipe Binding
   ========================================================================== */

function switchTab(tabId) {
  state.activeTab = tabId;
  el.tabsNav.querySelectorAll('.tab-btn').forEach((btn) => {
    const isActive = btn.dataset.tab === tabId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  const panelMap = {
    slides: el.tabSlides,
    imagen: el.tabImagen,
    captions: el.tabCaptions,
    timeline: el.tabTimeline,
    'ugc-grid': el.tabUgcGrid
  };

  Object.entries(panelMap).forEach(([key, panel]) => {
    if (panel) panel.classList.toggle('active', key === tabId);
  });
}

function setupSwipeAndKeyboard() {
  // Arrow buttons
  el.prevSlideBtn.addEventListener('click', () => goToSlide(state.currentSlide - 1));
  el.nextSlideBtn.addEventListener('click', () => goToSlide(state.currentSlide + 1));

  // Keyboard Left/Right arrows (only when Slides tab active & not typing in inputs)
  document.addEventListener('keydown', (e) => {
    if (state.activeTab !== 'slides') return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToSlide(state.currentSlide - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToSlide(state.currentSlide + 1);
    }
  });

  // Touch Swipe + Pointer Drag on Carousel Viewport
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let isSwiping = false;

  const onStart = (clientX, clientY) => {
    startX = clientX;
    startY = clientY;
    deltaX = 0;
    isSwiping = true;
  };

  const onEnd = () => {
    if (!isSwiping) return;
    isSwiping = false;
    const threshold = 48;
    if (deltaX <= -threshold) {
      goToSlide(state.currentSlide + 1);
    } else if (deltaX >= threshold) {
      goToSlide(state.currentSlide - 1);
    }
    deltaX = 0;
  };

  el.carouselViewport.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: true }
  );

  el.carouselViewport.addEventListener(
    'touchmove',
    (e) => {
      if (!isSwiping || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy)) {
        deltaX = dx;
      }
    },
    { passive: true }
  );

  el.carouselViewport.addEventListener('touchend', onEnd);

  // Mouse drag swipe (ignore if user is selecting text inside prompt box)
  el.carouselViewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.prompt-box-content, .detail-text, button')) return;
    onStart(e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isSwiping) return;
    deltaX = e.clientX - startX;
  });

  window.addEventListener('mouseup', onEnd);
}

/* ==========================================================================
   Tab 5: UGC 4-Panel 1:1 Image Generator & Google Drive Integration
   ========================================================================== */

function getUgcLabels() {
  return [
    { thaiText: el.ugcLabel1.value.trim() || 'ของมันต้องมี ✨ ใช้จริงทุกวัน!' },
    { thaiText: el.ugcLabel2.value.trim() || 'ดีเทลจึ้ง เนื้อสัมผัสละมุน 👍' },
    { thaiText: el.ugcLabel3.value.trim() || 'วางใช้จริงที่บ้าน ไม่จกตา ♡' },
    { thaiText: el.ugcLabel4.value.trim() || 'คุ้มเกินราคา กดซ้ำเลย!' }
  ];
}

function rebuildUgcPromptFromInputs() {
  const payload = collectInputPayload();
  const built = buildUgc4GridLocalPrompt(payload);
  const customLabels = getUgcLabels();

  // Replace the 4 panel Thai handwritten text lines with user's edited labels
  let prompt = built.prompt;
  built.panels.forEach((p, i) => {
    prompt = prompt.replace(p.thaiText, customLabels[i].thaiText);
  });

  el.ugcPromptTextarea.value = prompt;
}

function setUgcImagePreview(imgObj) {
  state.ugcImage = imgObj;
  el.ugcPreviewImg.src = imgObj.dataUrl;
  el.ugcPreviewImg.classList.remove('hidden');
  el.ugcEmptyState.classList.add('hidden');
  if (el.ugcImageStage) el.ugcImageStage.classList.add('has-image');
  if (el.ugcStageFooter) el.ugcStageFooter.classList.remove('hidden');
  if (el.ugcStageMeta) {
    const dimText =
      imgObj.width && imgObj.height ? `${imgObj.width}×${imgObj.height}px` : '1:1';
    const labelText = imgObj.modelId || 'Gemini Image';
    el.ugcStageMeta.textContent = `${labelText} • ${dimText}`;
  }
  el.ugcSaveDriveBtn.disabled = false;
  el.ugcDownloadPngBtn.disabled = false;
}

function loadImportedUgcImageFile(file, sourceLabel = 'Gemini Web (นำเข้า)') {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, WebP)'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const base64 = dataUrl.split(',')[1] || '';
      const img = new Image();
      img.onerror = () => reject(new Error('ไฟล์รูปภาพเสียหายหรือไม่รองรับ'));
      img.onload = () => {
        const result = {
          dataUrl,
          base64,
          mimeType: file.type || 'image/png',
          width: img.width,
          height: img.height,
          modelId: sourceLabel,
          rawFile: file
        };
        setUgcImagePreview(result);
        el.ugcImageStatus.textContent = `✓ นำรูปภาพจาก ${sourceLabel} เข้ามาใช้งานแล้ว (${img.width}×${img.height}px) — พร้อมบันทึกลง Google Drive, ดาวน์โหลด หรือส่งใช้เป็น Ingredient 1`;
        showToast(
          `นำรูปภาพกลับมาใช้งานแล้ว (${img.width}×${img.height}px) — พร้อมบันทึกเข้า Google Drive!`,
          'success'
        );
        resolve(result);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function renderDriveHistory() {
  if (!el.driveHistoryList) return;
  if (!state.driveHistory.length) {
    el.driveHistoryList.innerHTML = '';
    return;
  }
  el.driveHistoryList.innerHTML =
    '<div class="field-hint" style="margin-top:4px;">บันทึกล่าสุดเข้า Google Drive:</div>' +
    state.driveHistory
      .slice(0, 4)
      .map(
        (item) => `
      <div class="drive-history-item">
        <span>${escapeHtml(item.fileName)}</span>
        <a href="${escapeHtml(item.webViewLink)}" target="_blank" rel="noopener noreferrer">เปิดใน Drive ↗</a>
      </div>
    `
      )
      .join('');
}

function initUgcGridStudio() {
  // Populate Apps Script template
  if (el.appsScriptCodePreview) {
    el.appsScriptCodePreview.textContent = APPS_SCRIPT_TEMPLATE;
  }

  // Restore saved Drive settings & history
  const savedWebhook = localStorage.getItem(STORAGE_DRIVE_WEBHOOK) || '';
  const savedClientId = localStorage.getItem(STORAGE_DRIVE_CLIENT_ID) || '';
  const savedFolder = localStorage.getItem(STORAGE_DRIVE_FOLDER) || 'AI Ad Studio TH - UGC Images';
  try {
    state.driveHistory = JSON.parse(localStorage.getItem(STORAGE_DRIVE_HISTORY) || '[]');
  } catch {
    state.driveHistory = [];
  }

  el.driveWebhookInput.value = savedWebhook;
  el.driveClientIdInput.value = savedClientId;
  el.driveFolderInput.value = savedFolder;
  renderDriveHistory();

  el.driveWebhookInput.addEventListener('input', () => {
    localStorage.setItem(STORAGE_DRIVE_WEBHOOK, el.driveWebhookInput.value.trim());
  });
  el.driveClientIdInput.addEventListener('input', () => {
    localStorage.setItem(STORAGE_DRIVE_CLIENT_ID, el.driveClientIdInput.value.trim());
  });
  el.driveFolderInput.addEventListener('input', () => {
    localStorage.setItem(STORAGE_DRIVE_FOLDER, el.driveFolderInput.value.trim());
  });

  // Switch Drive method UI
  el.driveMethodSelect.addEventListener('change', () => {
    const isOAuth = el.driveMethodSelect.value === 'oauth';
    el.driveAppsScriptBox.classList.toggle('hidden', isOAuth);
    el.driveOAuthBox.classList.toggle('hidden', !isOAuth);
    if (isOAuth) {
      el.appsScriptGuideDrawer.classList.add('hidden');
    }
  });

  el.toggleAppsScriptGuideBtn.addEventListener('click', () => {
    el.appsScriptGuideDrawer.classList.toggle('hidden');
  });

  el.copyAppsScriptBtn.addEventListener('click', () => {
    copyText(APPS_SCRIPT_TEMPLATE, el.copyAppsScriptBtn, 'คัดลอกโค้ด Google Apps Script แล้ว!');
  });

  el.ugcCopyPromptBtn.addEventListener('click', () => {
    copyText(el.ugcPromptTextarea.value, el.ugcCopyPromptBtn, 'คัดลอก Prompt ภาพ 4 ช่องแล้ว!');
  });

  el.ugcRebuildPromptBtn.addEventListener('click', () => {
    rebuildUgcPromptFromInputs();
    showToast('อัปเดต Prompt ตามข้อความลายมือ 4 ช่องแล้ว', 'info');
  });

  // Step A: Analyze product URL + build UGC 4-panel prompt
  el.ugcOneClickBtn.addEventListener('click', async () => {
    const orig = el.ugcOneClickBtn.innerHTML;
    el.ugcOneClickBtn.disabled = true;
    el.ugcOneClickBtn.textContent = 'กำลังวิเคราะห์ & สร้าง Prompt...';
    el.ugcImageStatus.textContent = 'กำลังวิเคราะห์ลิงก์สินค้าและสร้าง Prompt 1:1 ตาราง 4 ช่องไม่มีเส้นคั่น...';

    try {
      const payload = collectInputPayload();
      const res = await analyzeProductAndBuildUgcPrompt(state.apiKey.trim(), {
        url: payload.productUrl,
        productName: payload.productName,
        benefits: payload.benefits,
        pricePromo: payload.pricePromo,
        audience: payload.audience,
        visualDetails: payload.visualDetails,
        ingredient1: state.ingredient1,
        preferredModel: state.preferredModel
      });

      if (res.productName) el.productNameInput.value = res.productName;
      if (res.benefits) el.productBenefitsInput.value = res.benefits;
      if (res.pricePromo) el.productPromoInput.value = res.pricePromo;
      if (res.audience) el.productAudienceInput.value = res.audience;
      if (res.visualDetails) el.productVisualInput.value = res.visualDetails;
      if (res.characterAnchor) el.characterAnchorInput.value = res.characterAnchor;

      if (Array.isArray(res.panels) && res.panels.length >= 4) {
        el.ugcLabel1.value = res.panels[0].thaiText || el.ugcLabel1.value;
        el.ugcLabel2.value = res.panels[1].thaiText || el.ugcLabel2.value;
        el.ugcLabel3.value = res.panels[2].thaiText || el.ugcLabel3.value;
        el.ugcLabel4.value = res.panels[3].thaiText || el.ugcLabel4.value;
      }

      el.ugcPromptTextarea.value = res.prompt;
      el.ugcImageStatus.textContent =
        res.source === 'gemini'
          ? `สร้าง Prompt สำเร็จด้วย ${res.promptModelId || res.analyzedBy} — กด "สร้างรูปจริงด้วย Gemini ↗" เพื่อเปิดเว็บ Gemini พร้อมคัดลอก Prompt ได้เลย`
          : 'สร้าง Prompt 4 ช่องเรียบร้อยแล้ว! กด "สร้างรูปจริงด้วย Gemini ↗" เพื่อคัดลอก Prompt + เปิดเว็บ Gemini ทันที';
      showToast('วิเคราะห์สินค้าและสร้าง Prompt 4 ช่อง 1:1 เรียบร้อยแล้ว!', 'success');
    } catch (err) {
      rebuildUgcPromptFromInputs();
      el.ugcImageStatus.textContent = `ใช้เทมเพลต Prompt อัตโนมัติแทน (${err.message})`;
      showToast(`วิเคราะห์ลิงก์ไม่สำเร็จ: ${err.message}`, 'warn');
    } finally {
      el.ugcOneClickBtn.disabled = false;
      el.ugcOneClickBtn.innerHTML = orig;
    }
  });

  // Step B-Primary: Copy 1:1 UGC Prompt + Open Gemini Web Ready-to-Use
  el.ugcOpenGeminiWebBtn?.addEventListener('click', () => {
    let prompt = el.ugcPromptTextarea.value.trim();
    if (!prompt) {
      rebuildUgcPromptFromInputs();
      prompt = el.ugcPromptTextarea.value.trim();
    }

    // Synchronous clipboard fallback first so focus & gesture stay intact before opening new tab
    let copied = false;
    try {
      el.ugcPromptTextarea.select();
      copied = document.execCommand('copy');
      window.getSelection()?.removeAllRanges();
    } catch {
      copied = false;
    }

    // Open Gemini Web synchronously within the click gesture so popup blockers do not block it
    const geminiUrl = 'https://gemini.google.com/app';
    const openedWin = window.open(geminiUrl, '_blank', 'noopener,noreferrer');

    if (el.ugcGeminiWorkflowBanner) {
      el.ugcGeminiWorkflowBanner.classList.remove('hidden');
    }

    // Also invoke modern async Clipboard API if available
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(prompt).catch(() => {});
      copied = true;
    }

    el.ugcImageStatus.textContent = copied
      ? '✓ คัดลอก Prompt 1:1 และเปิดหน้าเว็บ Gemini แล้ว → กด Ctrl+V วางใน Gemini เพื่อสร้างรูป แล้วนำรูปมาวาง/อัปโหลดในกรอบด้านล่างได้เลย!'
      : '✓ เปิดหน้าเว็บ Gemini แล้ว (หากคัดลอกอัตโนมัติไม่สำเร็จ กดปุ่ม "คัดลอก Prompt" ด้านบนก่อนวางใน Gemini)';

    showToast(
      openedWin
        ? 'คัดลอก Prompt แล้ว & เปิดเว็บ Gemini ↗ เรียบร้อย! (กด Ctrl+V วางสร้างรูปได้เลย)'
        : 'คัดลอก Prompt แล้ว! กรุณาอนุญาต Pop-up เพื่อเปิด gemini.google.com/app',
      openedWin ? 'success' : 'warn'
    );
  });

  // Step B-Import: Upload / Drag-Drop / Clipboard Paste image generated from Gemini Web
  const openFilePicker = () => el.ugcUploadImgInput?.click();
  el.ugcImportImageBtn?.addEventListener('click', openFilePicker);
  el.ugcChangeImgBtn?.addEventListener('click', openFilePicker);
  el.ugcImageStage?.addEventListener('click', openFilePicker);
  el.ugcImageStage?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openFilePicker();
    }
  });

  el.ugcUploadImgInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await loadImportedUgcImageFile(file, 'Gemini Web (อัปโหลด)');
      } catch (err) {
        showToast(err.message, 'error');
      }
      e.target.value = '';
    }
  });

  if (el.ugcImageStage) {
    el.ugcImageStage.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.ugcImageStage.classList.add('dragover');
    });
    el.ugcImageStage.addEventListener('dragleave', () => {
      el.ugcImageStage.classList.remove('dragover');
    });
    el.ugcImageStage.addEventListener('drop', async (e) => {
      e.preventDefault();
      el.ugcImageStage.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        try {
          await loadImportedUgcImageFile(file, 'Gemini Web (ลากวาง)');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    });
  }

  // Allow Ctrl+V / Cmd+V pasting an image directly when Tab 5 is active
  document.addEventListener('paste', async (e) => {
    if (state.activeTab !== 'ugc-grid') return;
    const items = Array.from(e.clipboardData?.items || []);
    const imgItem = items.find((it) => it.type && it.type.startsWith('image/'));
    if (!imgItem) return;
    const file = imgItem.getAsFile();
    if (!file) return;
    e.preventDefault();
    try {
      await loadImportedUgcImageFile(file, 'Gemini Web (Ctrl+V)');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Step B-Reuse: Send the loaded 1:1 image into Ingredient 1 slot for Google Flow video prompts
  el.ugcUseAsIng1Btn?.addEventListener('click', async () => {
    if (!state.ugcImage?.dataUrl) return;
    try {
      let fileToCompress = state.ugcImage.rawFile;
      if (!fileToCompress) {
        const res = await fetch(state.ugcImage.dataUrl);
        const blob = await res.blob();
        fileToCompress = new File([blob], 'gemini-ugc-1x1.png', {
          type: blob.type || 'image/png'
        });
      }
      const compressed = await compressImageTo640(fileToCompress);
      state.ingredient1 = compressed;
      el.ingredient1Img.src = compressed.dataUrl;
      el.ingredient1Badge.textContent = `${compressed.width}×${compressed.height}px • ${compressed.sizeKB} KB`;
      el.ingredient1Slot.classList.add('has-image');
      showToast('ส่งรูปจาก Gemini ไปใช้งานเป็น Ingredient 1 (สินค้า) เรียบร้อยแล้ว!', 'success');
    } catch (err) {
      showToast(`ส่งรูปไป Ingredient 1 ไม่สำเร็จ: ${err.message}`, 'error');
    }
  });

  // Step B1: Direct Gemini API Image Generation (for users with billing/image quota API key)
  el.ugcGenGeminiImgBtn.addEventListener('click', async () => {
    const prompt = el.ugcPromptTextarea.value.trim();
    if (!prompt) {
      rebuildUgcPromptFromInputs();
    }

    const orig = el.ugcGenGeminiImgBtn.innerHTML;
    el.ugcGenGeminiImgBtn.disabled = true;
    el.ugcGenGeminiImgBtn.textContent = 'กำลังเจนผ่าน API...';
    el.ugcImageStatus.textContent = 'กำลังส่ง Prompt เข้าโมเดลสร้างภาพ Gemini API (อัตราส่วน 1:1)...';

    try {
      const imgResult = await generateUgcImageWithGemini(state.apiKey.trim(), {
        prompt: el.ugcPromptTextarea.value.trim(),
        preferredImageModel: el.ugcImageModelSelect.value,
        ingredient1: state.ingredient1,
        aspectRatio: '1:1'
      });

      setUgcImagePreview(imgResult);
      el.ugcImageStatus.textContent = `✓ สร้างรูปภาพสำเร็จด้วย ${imgResult.modelId} (1:1) — พร้อมบันทึกลง Google Drive`;
      showToast(`สร้างภาพ UGC 4 ช่องด้วย ${imgResult.modelId} สำเร็จ!`, 'success');
    } catch (err) {
      el.ugcImageStatus.textContent = `⚠️ ${err.message}`;
      showToast(err.message, err?.status === 429 ? 'warn' : 'error');
    } finally {
      el.ugcGenGeminiImgBtn.disabled = false;
      el.ugcGenGeminiImgBtn.innerHTML = orig;
    }
  });

  // Step B2: Local 1080x1080 Canvas 2x2 Seamless Composer (works anytime, 0 quota)
  el.ugcGenCanvasBtn.addEventListener('click', async () => {
    el.ugcGenCanvasBtn.disabled = true;
    el.ugcImageStatus.textContent = 'กำลังประกอบภาพตาราง 4 ช่อง 1:1 (1080×1080) แบบไม่มีเส้นคั่น...';
    try {
      const composed = await renderUgc4GridCanvas({
        productName: el.productNameInput.value.trim() || 'สินค้าแนะนำ',
        panels: getUgcLabels(),
        ingredient1: state.ingredient1
      });
      setUgcImagePreview(composed);
      el.ugcImageStatus.textContent =
        '✓ สร้างพรีวิว 1080×1080 สำเร็จ (ไม่มีเส้นคั่น + ฟอนต์ไทยลายมือ Mali) — พร้อมบันทึกเข้า Google Drive หรือดาวน์โหลด PNG';
      showToast('สร้างภาพพรีวิว 1:1 (1080×1080) เรียบร้อยแล้ว!', 'success');
    } catch (err) {
      showToast(`สร้างพรีวิว Canvas ไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
      el.ugcGenCanvasBtn.disabled = false;
    }
  });

  // Download PNG locally
  el.ugcDownloadPngBtn.addEventListener('click', () => {
    if (!state.ugcImage?.dataUrl) return;
    const safeName = (el.productNameInput.value.trim() || 'ugc-product')
      .replace(/[^a-zA-Z0-9ก-๙_-]+/g, '-')
      .slice(0, 32);
    const a = document.createElement('a');
    a.href = state.ugcImage.dataUrl;
    a.download = `${safeName}-ugc-4grid-1x1.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('ดาวน์โหลดรูปภาพ 1:1 (.png) แล้ว', 'success');
  });

  // Step C: Upload generated image to Google Drive
  el.ugcSaveDriveBtn.addEventListener('click', async () => {
    if (!state.ugcImage?.base64) {
      showToast('กรุณาสร้างรูปภาพ 1:1 ก่อนบันทึกเข้า Google Drive', 'warn');
      return;
    }

    const method = el.driveMethodSelect.value;
    const folderName = el.driveFolderInput.value.trim() || 'AI Ad Studio TH - UGC Images';
    const safeName = (el.productNameInput.value.trim() || 'ugc-product')
      .replace(/[^a-zA-Z0-9ก-๙_-]+/g, '-')
      .slice(0, 32);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${safeName}-ugc-4grid-${stamp}.png`;

    const orig = el.ugcSaveDriveBtn.innerHTML;
    el.ugcSaveDriveBtn.disabled = true;
    el.ugcSaveDriveBtn.textContent = 'กำลังอัปโหลดเข้า Google Drive...';
    el.driveUploadResult.innerHTML = '';

    try {
      const uploaded =
        method === 'oauth'
          ? await uploadViaOAuthDrive({
              clientId: el.driveClientIdInput.value.trim(),
              base64: state.ugcImage.base64,
              mimeType: state.ugcImage.mimeType || 'image/png',
              filename,
              folderName
            })
          : await uploadViaAppsScript({
              webhookUrl: el.driveWebhookInput.value.trim(),
              base64: state.ugcImage.base64,
              mimeType: state.ugcImage.mimeType || 'image/png',
              filename,
              folderName
            });

      el.driveUploadResult.innerHTML = `
        <div><strong>✓ บันทึกเข้า Google Drive สำเร็จ!</strong> (${escapeHtml(uploaded.method)})</div>
        <div>ไฟล์: <code>${escapeHtml(uploaded.fileName)}</code></div>
        <div><a href="${escapeHtml(uploaded.webViewLink)}" target="_blank" rel="noopener noreferrer">เปิดดูรูปใน Google Drive ↗</a>${
          uploaded.folderUrl
            ? ` • <a href="${escapeHtml(uploaded.folderUrl)}" target="_blank" rel="noopener noreferrer">เปิดโฟลเดอร์ ↗</a>`
            : ''
        }</div>
      `;

      state.driveHistory.unshift({
        fileName: uploaded.fileName,
        webViewLink: uploaded.webViewLink,
        savedAt: new Date().toISOString()
      });
      state.driveHistory = state.driveHistory.slice(0, 10);
      localStorage.setItem(STORAGE_DRIVE_HISTORY, JSON.stringify(state.driveHistory));
      renderDriveHistory();

      showToast('บันทึกรูปภาพเข้า Google Drive เรียบร้อยแล้ว!', 'success');
    } catch (err) {
      el.driveUploadResult.innerHTML = `<div style="color:#fca5a5;">⚠️ ${escapeHtml(err.message)}</div>`;
      showToast(`บันทึก Google Drive ไม่สำเร็จ: ${err.message}`, 'error');
    } finally {
      el.ugcSaveDriveBtn.disabled = false;
      el.ugcSaveDriveBtn.innerHTML = orig;
    }
  });

  // Pre-build initial prompt from default product so Tab 5 looks ready immediately
  rebuildUgcPromptFromInputs();
}

/* ==========================================================================
   Initialization
   ========================================================================== */

function initApiKey() {
  const saved = localStorage.getItem(STORAGE_API_KEY) || '';
  state.apiKey = saved;
  el.apiKeyInput.value = saved;
  updateApiStatusDot();

  const savedModel = localStorage.getItem('ai_ad_studio_th_gemini_model') || 'auto';
  state.preferredModel = savedModel;
  if (el.modelSelect) {
    el.modelSelect.value = savedModel;
    el.modelSelect.addEventListener('change', () => {
      state.preferredModel = el.modelSelect.value;
      localStorage.setItem('ai_ad_studio_th_gemini_model', state.preferredModel);
    });
  }

  el.apiKeyInput.addEventListener('input', () => {
    state.apiKey = el.apiKeyInput.value.trim();
    if (state.apiKey) {
      localStorage.setItem(STORAGE_API_KEY, state.apiKey);
    } else {
      localStorage.removeItem(STORAGE_API_KEY);
    }
    updateApiStatusDot();
  });

  el.toggleApiKeyBtn.addEventListener('click', () => {
    const isPassword = el.apiKeyInput.type === 'password';
    el.apiKeyInput.type = isPassword ? 'text' : 'password';
    el.toggleApiKeyBtn.title = isPassword ? 'ซ่อน API Key' : 'แสดง API Key';
  });
}

function updateApiStatusDot() {
  const connected = Boolean(state.apiKey.trim());
  el.apiStatusDot.classList.toggle('connected', connected);
  el.apiStatusDot.title = connected
    ? 'เชื่อมต่อ Gemini 3.5 Flash-Lite / 3.8 Flash API Key แล้ว'
    : 'ยังไม่ได้ใส่ API Key (ใช้งานโหมด Demo ได้ทันที)';
}

function init() {
  cacheDom();
  initApiKey();
  renderFlowModes();
  renderClipStyles();
  setupIngredientSlot(1);
  setupIngredientSlot(2);
  setupSwipeAndKeyboard();

  // Character Lock toggle
  el.lockCharacterToggle.checked = state.lockCharacter;
  el.lockCharacterCard.classList.toggle('active', state.lockCharacter);
  el.lockCharacterToggle.addEventListener('change', () => {
    state.lockCharacter = el.lockCharacterToggle.checked;
    el.lockCharacterCard.classList.toggle('active', state.lockCharacter);
    el.characterAnchorWrap.classList.toggle('hidden', !state.lockCharacter);
  });

  // Sample presets
  document.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', () => {
      loadSampleProduct(btn.dataset.sample);
      rebuildUgcPromptFromInputs();
    });
  });

  // Auto-Fill & Generate
  el.autoFillBtn.addEventListener('click', handleAutoFill);
  el.generateBtn.addEventListener('click', handleGenerate);

  // Tabs
  el.tabsNav.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Copy All & Export .txt
  el.copyAllBtn.addEventListener('click', () => {
    const master = buildMasterCopyText();
    copyText(master, el.copyAllBtn, 'คัดลอกชุดพรอมทั้งหมด (Copy All) เรียบร้อยแล้ว!');
  });

  el.exportTxtBtn.addEventListener('click', () => {
    const master = buildMasterCopyText();
    const blob = new Blob([master], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (state.plan?.productName || 'ai-ad-studio-th')
      .replace(/[^a-zA-Z0-9ก-๙_-]+/g, '-')
      .slice(0, 40);
    a.href = url;
    a.download = `${safeName}-google-flow-10s.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('ดาวน์โหลดไฟล์ .txt เรียบร้อยแล้ว', 'success');
  });

  // Auto-prefetch product image + metadata when pasting a link into URL box
  el.productUrlInput.addEventListener('paste', () => {
    setTimeout(() => {
      const pastedUrl = el.productUrlInput.value.trim();
      if (pastedUrl) {
        prefetchProductFromUrlOnPaste(pastedUrl);
      }
    }, 50);
  });

  el.productUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAutoFill();
    }
  });

  el.productNameInput.addEventListener('input', () => {
    state.isSamplePreload = false;
  });
  el.productBenefitsInput.addEventListener('input', () => {
    state.isSamplePreload = false;
  });

  // Pre-load rich default sample so workspace looks immediately alive & testable
  loadSampleProduct('serum', true);
  state.plan = buildLocalStudioPlan(collectInputPayload());
  renderAllOutputs();
  initUgcGridStudio();
}

document.addEventListener('DOMContentLoaded', init);
