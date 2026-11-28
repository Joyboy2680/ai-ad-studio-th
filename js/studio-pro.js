/* ==========================================================================
   AI Ad Studio TH — Studio Pro Suite (10/10 Upgrades)
   1. Project History / Drafts (localStorage, up to 20 campaigns, 1-click restore)
   2. Per-Shot Variation Regenerator (swap Hook / Demo / Proof / CTA angle)
   3. Thai Voiceover TTS Preview (Web Speech API th-TH) + Speaking Time Meter
   4. 1-Page Print-Ready Storyboard Brief / PDF Exporter
   ========================================================================== */

export const STORAGE_PROJECT_HISTORY = 'ai_ad_studio_th_project_history_v1';
export const STORAGE_CUSTOM_PROXY_URL = 'ai_ad_studio_th_custom_proxy_url';
const MAX_HISTORY_ITEMS = 20;

/* --------------------------------------------------------------------------
   1. Project History / Drafts
   -------------------------------------------------------------------------- */
export function loadProjectHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECT_HISTORY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistProjectHistory(items) {
  try {
    localStorage.setItem(STORAGE_PROJECT_HISTORY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
  } catch {
    // If quota exceeded (e.g., due to thumbnails), strip thumbnails from older entries and retry
    try {
      const slim = items.slice(0, 12).map((item, idx) => (idx > 2 ? { ...item, thumbDataUrl: '' } : item));
      localStorage.setItem(STORAGE_PROJECT_HISTORY, JSON.stringify(slim));
    } catch {
      /* ignore */
    }
  }
}

export function saveProjectToHistory(entry) {
  if (!entry || !entry.productName) return loadProjectHistory();
  const list = loadProjectHistory();
  const id = `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const normalizedName = entry.productName.trim().toLowerCase();

  // Replace existing entry with same productName + flowMode + clipStyle to keep history clean
  const filtered = list.filter(
    (item) =>
      !(
        (item.productName || '').trim().toLowerCase() === normalizedName &&
        item.flowMode === entry.flowMode &&
        item.clipStyle === entry.clipStyle
      )
  );

  const next = [
    {
      id,
      savedAt: new Date().toISOString(),
      ...entry
    },
    ...filtered
  ].slice(0, MAX_HISTORY_ITEMS);

  persistProjectHistory(next);
  return next;
}

export function deleteProjectFromHistory(id) {
  const next = loadProjectHistory().filter((item) => item.id !== id);
  persistProjectHistory(next);
  return next;
}

export function formatShortThaiDate(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('th-TH', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

/* --------------------------------------------------------------------------
   2. Thai Voiceover Timing Estimator & Web Speech TTS
   -------------------------------------------------------------------------- */
export function estimateThaiSpeechSeconds(text) {
  const clean = String(text || '')
    .replace(/[“”"'\(\)\[\]!?.,…]/g, '')
    .trim();
  if (!clean) return 0;
  // Thai commercial ad narration averages ~11.5–12.5 Thai chars/sec (fast upbeat TikTok pacing)
  const seconds = clean.length / 12;
  return Math.max(0.8, Math.round(seconds * 10) / 10);
}

export function getSpeechPacingBadge(text, shotIndex) {
  const sec = estimateThaiSpeechSeconds(text);
  // Shot 0 (0-2s) target <= 2.3s; Shots 1-3 (2-3s) target <= 3.3s
  const limit = shotIndex === 0 ? 2.4 : 3.4;
  if (sec <= limit) {
    return { sec, ok: true, label: `~${sec.toFixed(1)} วิ ✓ พอดีช็อต` };
  }
  return { sec, ok: false, label: `~${sec.toFixed(1)} วิ ⚠️ ยาวไปนิด` };
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

export function speakThaiText(text, { rate = 1.08, onStart, onEnd, onError } = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.('เบราว์เซอร์นี้ไม่รองรับการอ่านออกเสียง (Web Speech API)');
    return false;
  }
  const clean = String(text || '').trim();
  if (!clean) return false;

  stopSpeaking();
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = 'th-TH';
  utter.rate = rate;
  utter.pitch = 1.02;

  const voices = window.speechSynthesis.getVoices?.() || [];
  const thaiVoice = voices.find((v) => /th[-_]?TH/i.test(v.lang));
  if (thaiVoice) utter.voice = thaiVoice;

  utter.onstart = () => onStart?.();
  utter.onend = () => onEnd?.();
  utter.onerror = () => onEnd?.();

  window.speechSynthesis.speak(utter);
  return true;
}

export function speakAllSlides(slides, { onShotStart, onDone, onError } = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.('เบราว์เซอร์นี้ไม่รองรับการอ่านออกเสียง (Web Speech API)');
    return false;
  }
  if (!Array.isArray(slides) || !slides.length) return false;

  stopSpeaking();
  const voices = window.speechSynthesis.getVoices?.() || [];
  const thaiVoice = voices.find((v) => /th[-_]?TH/i.test(v.lang));

  let idx = 0;
  const speakNext = () => {
    if (idx >= slides.length) {
      onDone?.();
      return;
    }
    const currentIdx = idx;
    const text = String(slides[currentIdx]?.voiceover || '').trim();
    idx += 1;
    if (!text) {
      speakNext();
      return;
    }
    onShotStart?.(currentIdx);
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'th-TH';
    utter.rate = 1.1;
    if (thaiVoice) utter.voice = thaiVoice;
    utter.onend = speakNext;
    utter.onerror = () => onDone?.();
    window.speechSynthesis.speak(utter);
  };

  speakNext();
  return true;
}

/* --------------------------------------------------------------------------
   3. Per-Shot Variation Regenerator (Zero-API Instant Creative Variations)
   -------------------------------------------------------------------------- */
const SHOT_VARIATIONS = [
  // Shot 0: HOOK (0-2s)
  [
    {
      title: 'Hook หยุดนิ้ว: เปิดปัญหาตรงจุด + ยกสินค้าโชว์',
      vo: (name) => `หยุดเลื่อนก่อน! ใครเจอปัญหานี้ทุกวัน ลอง ${name} ตัวนี้จบจริง!`,
      onScreen: (name) => `หยุดเลื่อน! ตัวนี้จบจริง ⚡`,
      camera: 'Whip-in handheld macro to crisp center hero reveal, 24fps punchy commercial cut'
    },
    {
      title: 'Hook รีวิว POV: หยิบใช้จริงใน 2 วินาที',
      vo: (name) => `ใช้ ${name} มาครบอาทิตย์ บอกเลยจึ้งเกินราคาไปมาก!`,
      onScreen: () => `รีวิวใช้จริง 7 วัน จึ้งมาก! ✨`,
      camera: 'First-person POV unboxing tilt-down with natural window light rim glow'
    },
    {
      title: 'Hook จับเทียบชัดๆ: ทำไมคนแห่ซื้อซ้ำ',
      vo: (name) => `รู้แล้วทำไม ${name} ถึงขายดีจนของขาด ดูความต่างตรงนี้!`,
      onScreen: () => `ทำไมคนแห่ซื้อซ้ำ?! 🔥`,
      camera: 'Fast push-in close-up with crisp rack focus onto product texture and packaging'
    }
  ],
  // Shot 1: DEMO (2-5s)
  [
    {
      title: 'Demo ซูมเนื้อสัมผัส & วิธีใช้งานจริง',
      vo: (name) => `ดูเนื้อสัมผัสชัดๆ ซึมไว ใช้งานง่ายมาก แค่หยิบ ${name} ขึ้นมาใช้ทุกวัน`,
      onScreen: () => `ซึมไว ใช้ง่าย เห็นความต่างทันที`,
      camera: 'Smooth macro tracking shot gliding across product application in bright studio light'
    },
    {
      title: 'Demo เปรียบเทียบก่อน-หลังใช้งานแบบเห็นชัด',
      vo: () => `เทียบให้ดูกันชัดๆ ข้างที่ใช้กับไม่ได้ใช้ ต่างกันตั้งแต่ครั้งแรกเลย!`,
      onScreen: () => `Before / After ต่างกันชัดมาก!`,
      camera: 'Split-angle close-up panning smoothly from side comparison to glowing result'
    },
    {
      title: 'Demo โชว์จุดเด่นพรีเมียมระยะใกล้ (ASMR Tactile)',
      vo: () => `ฟังเสียงตอนเปิดใช้งานคือฟินมาก งานดีเกินราคาไปไกลเลย`,
      onScreen: () => `งานดี พรีเมียมเกินราคา 💎`,
      camera: 'Ultra-crisp 60fps tactile macro shot with specular highlights on packaging'
    }
  ],
  // Shot 2: PROOF / BENEFIT (5-8s)
  [
    {
      title: 'Proof ผลลัพธ์จริง & รีแอ็กชันมั่นใจ',
      vo: () => `ผลลัพธ์คือละมุนมาก ใช้ได้ทุกวันแบบสบายใจ คุ้มสุดๆ`,
      onScreen: () => `ใช้จริง รีวิวจริง คุ้มเกินต้าน ⭐`,
      camera: 'Medium portrait push-in capturing genuine satisfied smile while holding product near face'
    },
    {
      title: 'Proof พกพาง่าย ตอบโจทย์ไลฟ์สไตล์ทุกวัน',
      vo: () => `พกติดกระเป๋าไปได้ทุกที่ หยิบมาใช้เมื่อไหร่ก็เป๊ะตลอดวัน`,
      onScreen: () => `พกง่าย ใช้ได้ทุกวัน 👜`,
      camera: 'Lifestyle golden-hour handheld pan in modern Bangkok cafe setting'
    },
    {
      title: 'Proof ย้ำจุดขายหลักที่คนซื้อตัดสินใจทันที',
      vo: (name) => `ใครยังลังเล บอกเลย ${name} ตัวนี้ซื้อแล้วไม่ผิดหวังแน่นอน`,
      onScreen: () => `ของมันต้องมี ซื้อซ้ำแน่นอน 💯`,
      camera: 'Clean orbit shot around presenter demonstrating confident real-world result'
    }
  ],
  // Shot 3: CTA (8-10s)
  [
    {
      title: 'CTA ปิดตะกร้าด่วน + ย้ำโปรโมชั่น',
      vo: (name, price) => `โปรรอบนี้แรงมาก ${price ? price : 'ลดพิเศษวันนี้'} กดตะกร้าซ้ายล่างก่อนของหมด!`,
      onScreen: (name, price) => `กดตะกร้าซ้ายล่างเลย! ${price ? price : 'โปรมีจำนวนจำกัด'} 🛒`,
      camera: 'Dynamic hero packshot lock-on with crisp depth-of-field bokeh and hand pointing toward CTA'
    },
    {
      title: 'CTA ส่งฟรี / ของแถมจำกัดจำนวน',
      vo: () => `กดดูโปรในตะกร้าตอนนี้เลย ของล็อตนี้ใกล้หมดแล้วนะ!`,
      onScreen: () => `ของใกล้หมด! รีบกดตะกร้าด่วน 🔥`,
      camera: 'Energetic zoom-out packshot reveal with bright sunlit commercial backdrop'
    },
    {
      title: 'CTA ชวนลองแบบเป็นกันเอง (UGC Trust)',
      vo: (name) => `แปะพิกัด ${name} ไว้ให้ที่ตะกร้าซ้ายล่างแล้ว ไปตำตามกันได้เลย!`,
      onScreen: () => `พิกัดตะกร้าซ้ายล่าง 👇✨`,
      camera: 'Friendly eye-level UGC close-up holding product beside smiling presenter'
    }
  ]
];

export function regenerateSingleShotVariation(slide, shotIdx, productName, price) {
  const pool = SHOT_VARIATIONS[Math.min(shotIdx, SHOT_VARIATIONS.length - 1)] || SHOT_VARIATIONS[0];
  const prevIdx = Number.isInteger(slide._varIdx) ? slide._varIdx : -1;
  const nextIdx = (prevIdx + 1) % pool.length;
  const picked = pool[nextIdx];

  const newVo = picked.vo(productName || 'สินค้าตัวนี้', price || '');
  const newOnScreen = picked.onScreen(productName || 'สินค้าตัวนี้', price || '');

  // Swap the quoted voiceover & camera segment inside the English prompt cleanly
  let updatedPrompt = String(slide.prompt || '');
  if (/Camera:\s*[^.]+\./i.test(updatedPrompt)) {
    updatedPrompt = updatedPrompt.replace(/Camera:\s*[^.]+\./i, `Camera: ${picked.camera}.`);
  }
  if (/saying\s+"[^"]+"/i.test(updatedPrompt)) {
    updatedPrompt = updatedPrompt.replace(/saying\s+"[^"]+"/, `saying "${newVo}"`);
  } else {
    updatedPrompt = `${updatedPrompt} Audio: Thai narrator saying "${newVo}"`;
  }

  return {
    ...slide,
    _varIdx: nextIdx,
    title: picked.title,
    voiceover: newVo,
    onScreenText: newOnScreen,
    camera: picked.camera,
    prompt: updatedPrompt
  };
}

/* --------------------------------------------------------------------------
   4. 1-Page Print-Ready Storyboard Brief / PDF Exporter
   -------------------------------------------------------------------------- */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportStoryboardBriefPdf({ plan, productName, price, thumbDataUrl }) {
  if (!plan) return false;
  const win = window.open('', '_blank', 'width=980,height=820');
  if (!win) return false;

  const slidesHtml = (plan.slides || [])
    .map(
      (s, i) => `
      <tr>
        <td class="col-shot">
          <strong>Shot ${i + 1}</strong><br/>
          <span class="badge">${esc(s.timecode)}</span><br/>
          <small>${esc(s.role)}</small>
        </td>
        <td>
          <strong>${esc(s.title)}</strong>
          <div class="vo">🎙️ “${esc(s.voiceover)}”</div>
          <div class="meta"><b>ข้อความขึ้นจอ:</b> ${esc(s.onScreenText)}</div>
          <div class="meta"><b>มุมกล้อง:</b> ${esc(s.camera)}</div>
        </td>
        <td class="col-prompt">
          <code>${esc(s.prompt)}</code>
        </td>
      </tr>
    `
    )
    .join('');

  const captionsHtml = (plan.captions || [])
    .slice(0, 3)
    .map(
      (c) => `
      <div class="cap-box">
        <strong>${esc(c.platform || c.title || 'Caption')}</strong>
        <p>${esc(c.text || c.caption || '')}</p>
        ${c.hashtags ? `<div class="tags">${esc(Array.isArray(c.hashtags) ? c.hashtags.join(' ') : c.hashtags)}</div>` : ''}
      </div>
    `
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>Storyboard Brief — ${esc(productName)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Prompt', sans-serif; color: #0f172a; background: #ffffff; padding: 28px; line-height: 1.5; }
    .topbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 18px; }
    .hero { display: flex; align-items: center; gap: 14px; }
    .thumb { width: 64px; height: 64px; border-radius: 12px; object-fit: cover; border: 1px solid #cbd5e1; }
    h1 { font-size: 1.25rem; font-weight: 700; }
    .sub { font-size: 0.82rem; color: #475569; margin-top: 2px; }
    .pills { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    .badge { display: inline-block; font-size: 0.72rem; padding: 2px 8px; border-radius: 99px; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-weight: 600; }
    .print-btn { padding: 9px 16px; border-radius: 99px; border: none; background: #0f172a; color: #fff; font-family: inherit; font-weight: 600; cursor: pointer; }
    h2 { font-size: 0.98rem; margin: 18px 0 10px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    th, td { border: 1px solid #e2e8f0; padding: 10px; vertical-align: top; text-align: left; }
    th { background: #f8fafc; font-weight: 600; }
    .col-shot { width: 115px; }
    .col-prompt { width: 42%; }
    .vo { margin: 6px 0; padding: 6px 9px; border-radius: 8px; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-weight: 500; }
    .meta { font-size: 0.75rem; color: #475569; margin-top: 3px; }
    code { font-family: 'JetBrains Mono', monospace; font-size: 0.69rem; color: #1e293b; white-space: pre-wrap; display: block; }
    .caps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .cap-box { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; font-size: 0.76rem; background: #f8fafc; }
    .cap-box p { margin-top: 4px; color: #334155; }
    .tags { margin-top: 5px; color: #2563eb; font-size: 0.72rem; }
    @media print {
      body { padding: 10px; }
      .print-btn { display: none; }
      .caps { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="hero">
      ${thumbDataUrl ? `<img class="thumb" src="${thumbDataUrl}" alt="" />` : ''}
      <div>
        <h1>${esc(productName)}</h1>
        <div class="sub">AI Ad Studio TH — Creative Storyboard Brief (0–10s) • ${new Date().toLocaleDateString('th-TH')}</div>
        <div class="pills">
          <span class="badge">${esc(plan.flowModeName || 'Veo 3')}</span>
          <span class="badge">${esc(plan.aspectRatio || '9:16')}</span>
          ${price ? `<span class="badge">${esc(price)}</span>` : ''}
        </div>
      </div>
    </div>
    <button class="print-btn" onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button>
  </div>

  <h2>🎬 สตอรี่บอร์ดคลิปขายของ 0–10 วินาที (4 ช็อต)</h2>
  <table>
    <thead>
      <tr>
        <th>ช็อต / เวลา</th>
        <th>บทพูด &amp; รายละเอียดช็อต</th>
        <th>Google Flow / Gemini Prompt</th>
      </tr>
    </thead>
    <tbody>${slidesHtml}</tbody>
  </table>

  <h2>💬 แคปชั่น &amp; แฮชแท็กพร้อมโพสต์</h2>
  <div class="caps">${captionsHtml}</div>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
