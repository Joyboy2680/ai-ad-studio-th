/* ==========================================================================
   AI Ad Studio TH (Google Flow Edition) — Main Interactive Controller
   ========================================================================== */

import {
  FLOW_MODES,
  CLIP_STYLES,
  SAMPLE_PRODUCTS,
  buildLocalStudioPlan
} from './presets.js';
import { autoFillFromUrl, generateAdStudioPlan } from './gemini.js';

const STORAGE_API_KEY = 'ai_ad_studio_th_gemini_api_key';
const MAX_IMAGE_DIM = 640;

const PROGRESS_STAGES = [
  { maxSec: 3, label: '0–3 วิ • วิเคราะห์สินค้า & องค์ประกอบ Ingredient 1+2...' },
  { maxSec: 6, label: '3–6 วิ • ล็อกตัวละคร & ตั้งค่าโหมด Google Flow...' },
  { maxSec: 10, label: '6–10 วิ • เขียนสคริปต์ & พรอมคลิป 0–15 วิ (Fast Mode)...' },
  { maxSec: 13, label: '10–13 วิ • สร้างพรอมภาพนิ่ง Imagen 3 ช็อตหลัก...' },
  { maxSec: 15, label: '13–15 วิ • เรียบเรียงแคปชั่น แฮชแท็ก & ตรวจสอบความต่อเนื่อง...' }
];

// Application State
const state = {
  apiKey: '',
  flowMode: 'veo3',
  clipStyle: 'fast-hands-on',
  lockCharacter: true,
  ingredient1: null, // { dataUrl, base64, width, height, sizeKB, name }
  ingredient2: null,
  activeTab: 'slides',
  currentSlide: 0,
  isGenerating: false,
  plan: null
};

// DOM References
const el = {};

function cacheDom() {
  const ids = [
    'apiKeyInput',
    'toggleApiKeyBtn',
    'apiStatusDot',
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

  if (!silent) {
    showToast(`โหลดข้อมูลตัวอย่าง "${sample.name}" แล้ว`, 'info');
  }
}

async function handleAutoFill() {
  const url = el.productUrlInput.value.trim();
  if (!url) {
    showToast('กรุณาวางลิงก์สินค้าก่อนกด AI Auto-Fill', 'warn');
    el.productUrlInput.focus();
    return;
  }

  const apiKey = state.apiKey.trim();
  if (!apiKey) {
    // Helpful smart fallback for users testing without an API key
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
    showToast(
      'ใส่ Gemini API Key ด้านบนเพื่อเปิดใช้งาน AI Auto-Fill + Google Search Grounding แบบเรียลไทม์ (หรือกดเลือกสินค้าตัวอย่างด้านล่าง)',
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
    const result = await autoFillFromUrl(apiKey, url);
    if (result.productName) el.productNameInput.value = result.productName;
    if (result.benefits) el.productBenefitsInput.value = result.benefits;
    if (result.pricePromo) el.productPromoInput.value = result.pricePromo;
    if (result.audience) el.productAudienceInput.value = result.audience;
    if (result.visualDetails) el.productVisualInput.value = result.visualDetails;
    if (result.characterAnchor) el.characterAnchorInput.value = result.characterAnchor;

    if (result.sources?.length) {
      el.groundingSources.innerHTML =
        '<span class="sample-label">Google Search Grounding:</span>' +
        result.sources
          .slice(0, 3)
          .map(
            (s) =>
              `<a class="grounding-chip" href="${escapeHtml(s.uri)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title || s.uri)}</a>`
          )
          .join('');
    }

    showToast(
      `AI Auto-Fill สำเร็จด้วย ${result.modelId} + Google Search Grounding!`,
      'success'
    );
  } catch (err) {
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
    ingredient2: state.ingredient2
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
  el.generateBtnText.textContent = 'กำลังประมวลผลด้วย Gemini 3.8 Flash...';
  el.progressPanel.classList.add('visible');

  const TOTAL_SECONDS = 15;
  let displaySec = 0;
  el.progressFill.style.width = '0%';
  el.progressTimer.textContent = '0.0s / 15.0s';
  el.progressStage.textContent = getStageText(0);

  const startedAt = performance.now();
  const hasApiKey = Boolean(state.apiKey.trim());

  // Tick progress bar along the 15-second studio scale
  const tickInterval = setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    if (hasApiKey) {
      // Smoothly pace up to 14.2s while waiting for live Gemini API
      displaySec = Math.min(14.2, elapsed * 1.15);
    } else {
      // In Demo Mode, map 2.2s smooth animation across 0 -> 14.5s
      displaySec = Math.min(14.5, (elapsed / 2.2) * 14.5);
    }
    const pct = Math.min(96, (displaySec / TOTAL_SECONDS) * 100);
    el.progressFill.style.width = `${pct.toFixed(1)}%`;
    el.progressTimer.textContent = `${displaySec.toFixed(1)}s / 15.0s`;
    el.progressStage.textContent = getStageText(displaySec);
  }, 80);

  try {
    let plan;
    if (hasApiKey) {
      plan = await generateAdStudioPlan(state.apiKey.trim(), payload);
    } else {
      await new Promise((r) => setTimeout(r, 2250));
      plan = buildLocalStudioPlan(payload);
    }

    clearInterval(tickInterval);
    el.progressFill.style.width = '100%';
    el.progressTimer.textContent = '15.0s / 15.0s ✓';
    el.progressStage.textContent = hasApiKey
      ? `สร้างพรอมสำเร็จด้วย ${plan.modelLabel}`
      : 'สร้างพรอมโหมด Demo สำเร็จ! (ใส่ Gemini API Key เพื่อใช้ AI จริง)';

    state.plan = plan;
    state.currentSlide = 0;
    renderAllOutputs();

    showToast(
      hasApiKey
        ? 'สร้างชุดพรอม Google Flow & Imagen 15 วิ เรียบร้อยแล้ว!'
        : 'สร้างพรอมโหมด Demo เรียบร้อยแล้ว! พร้อมใช้งานทุกแท็บ',
      'success'
    );
  } catch (err) {
    clearInterval(tickInterval);
    el.progressStage.textContent = `เกิดข้อผิดพลาด: ${err.message}`;
    showToast(`สร้างพรอมไม่สำเร็จ: ${err.message}`, 'error');
  } finally {
    state.isGenerating = false;
    el.generateBtn.disabled = false;
    el.generateBtnText.textContent = 'สร้างพรอม Google Flow & Imagen (15 วิ)';
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
    'AI AD STUDIO TH — GOOGLE FLOW EDITION (0–15s PRODUCTION PACKAGE)',
    '================================================================',
    `สินค้า: ${p.productName}`,
    `โหมด Google Flow: ${p.flowModeName}`,
    `แนวทางคลิป 15 วิ: ${p.clipStyleName}`,
    `อัตราส่วนภาพ: ${p.aspectRatio}`,
    `ล็อกตัวละครทุกช็อต: ${p.lockCharacter ? 'ON' : 'OFF'}`,
    p.characterAnchor ? `Character Anchor: ${p.characterAnchor}` : '',
    `หมายเหตุโหมดเสียง/ซีน: ${p.audioModeNote}`,
    '',
    '----------------------------------------------------------------',
    '1. สไลด์คลิป 0–15 วินาที (GOOGLE FLOW PROMPTS & SCRIPT)',
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
    timeline: el.tabTimeline
  };

  Object.entries(panelMap).forEach(([key, panel]) => {
    panel.classList.toggle('active', key === tabId);
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
   Initialization
   ========================================================================== */

function initApiKey() {
  const saved = localStorage.getItem(STORAGE_API_KEY) || '';
  state.apiKey = saved;
  el.apiKeyInput.value = saved;
  updateApiStatusDot();

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
    ? 'เชื่อมต่อ Gemini 3.8 Flash API Key แล้ว'
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
    a.download = `${safeName}-google-flow-15s.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('ดาวน์โหลดไฟล์ .txt เรียบร้อยแล้ว', 'success');
  });

  // Pre-load rich default sample so workspace looks immediately alive & testable
  loadSampleProduct('serum', true);
  state.plan = buildLocalStudioPlan(collectInputPayload());
  renderAllOutputs();
}

document.addEventListener('DOMContentLoaded', init);
