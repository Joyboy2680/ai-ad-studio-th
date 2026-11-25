/* ==========================================================================
   AI Ad Studio TH (Google Flow Edition) — Resilient Gemini API Client
   - Multi-Model Fallback on 404 & 429 (Free Tier Quota Protection):
     gemini-3.5-flash-lite -> gemini-3.8-flash -> gemini-3.6-flash -> gemini-3.1-flash-lite
   - Auto-Fill Fallback Chain:
     1) url_context + google_search
     2) url_context only (avoids paid Search Grounding quota on Free Tier)
     3) Multimodal Vision / URL analysis (uses Ingredient 1 image + URL slug, 0 tool quota)
   ========================================================================== */

import { FLOW_MODES, CLIP_STYLES } from './presets.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const MODEL_CANDIDATES = [
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite (500/วัน • ไวสุด)',
    fastLabel: 'thinkingLevel: MINIMAL',
    thinkingConfig: { thinkingLevel: 'MINIMAL' },
    supportsTemperature: false
  },
  {
    id: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash-Lite (500/วัน • สำรองหลัก)',
    fastLabel: 'thinkingLevel: MINIMAL',
    thinkingConfig: { thinkingLevel: 'MINIMAL' },
    supportsTemperature: false
  },
  {
    id: 'gemini-3.8-flash',
    label: 'Gemini 3.8 Flash',
    fastLabel: 'thinkingLevel: LOW',
    thinkingConfig: { thinkingLevel: 'LOW' },
    supportsTemperature: false
  },
  {
    id: 'gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    fastLabel: 'thinkingLevel: MINIMAL',
    thinkingConfig: { thinkingLevel: 'MINIMAL' },
    supportsTemperature: false
  },
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen',
    fastLabel: 'thinkingLevel: LOW',
    thinkingConfig: { thinkingLevel: 'LOW' },
    supportsTemperature: false
  }
];

function getOrderedModels(preferredModelId) {
  if (!preferredModelId || preferredModelId === 'auto') {
    return MODEL_CANDIDATES;
  }
  const primary = MODEL_CANDIDATES.find((m) => m.id === preferredModelId);
  if (!primary) return MODEL_CANDIDATES;
  return [primary, ...MODEL_CANDIDATES.filter((m) => m.id !== preferredModelId)];
}

/**
 * Robustly extracts JSON object from raw model text (handles markdown code fences).
 */
function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('ไม่ได้รับข้อความตอบกลับจาก Gemini API');
  }
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('ไม่สามารถแปลงผลลัพธ์ JSON จาก Gemini ได้ กรุณาลองอีกครั้ง');
  }
}

/**
 * Determines whether an API error warrants trying the next fallback model.
 * Includes 404 (unavailable/retired) AND 429 (Free Tier quota exceeded on one model bucket).
 */
function shouldTryNextModel(status, message) {
  if (status === 404 || status === 429 || status === 503) return true;
  const lower = (message || '').toLowerCase();
  return (
    lower.includes('no longer available') ||
    lower.includes('not found') ||
    lower.includes('not supported') ||
    lower.includes('deprecated') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('resource_exhausted') ||
    lower.includes('overloaded')
  );
}

/**
 * Formats user-friendly Thai error hints when all models fail (especially HTTP 429).
 */
function formatFriendlyError(error, status) {
  const msg = error?.message || '';
  const lower = msg.toLowerCase();
  if (status === 429 || lower.includes('quota') || lower.includes('resource_exhausted')) {
    return 'API Key นี้โควตา Free Tier เต็มหรือถูกจำกัด (HTTP 429) ทุกโมเดลแล้ว — กรุณาเช็กโควตาที่ ai.dev/rate-limit, ผูก Billing หรือสร้าง Key ใหม่ (หรือลบ API Key ออกชั่วคราวเพื่อใช้โหมด Demo ได้ทันที)';
  }
  if (status === 401 || status === 403 || lower.includes('api key not valid')) {
    return 'Gemini API Key ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบ Key จาก aistudio.google.com/apikey';
  }
  return msg || 'ไม่สามารถเชื่อมต่อ Gemini API ได้';
}

/**
 * Calls Gemini generateContent endpoint with automatic model fallback on 404/429/503.
 */
async function callGeminiWithFallback(
  apiKey,
  buildBodyFn,
  preferredModelId = 'auto',
  signal,
  maxModels = null
) {
  const ordered = getOrderedModels(preferredModelId);
  const models = maxModels ? ordered.slice(0, maxModels) : ordered;
  let lastError = null;
  let lastStatus = 0;

  for (const model of models) {
    const body = buildBodyFn(model);
    const url = `${API_BASE}/${model.id}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg =
        data?.error?.message || `Gemini API Error (HTTP ${response.status})`;
      lastStatus = response.status;
      lastError = new Error(msg);
      lastError.status = response.status;

      if (shouldTryNextModel(response.status, msg)) {
        continue;
      }
      throw lastError;
    }

    const candidate = data?.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Exclude thought summary parts so only the final answer text is parsed
    const answerParts = parts.filter((p) => !p.thought && typeof p.text === 'string');
    const text = (answerParts.length ? answerParts : parts)
      .map((p) => (typeof p.text === 'string' ? p.text : ''))
      .join('\n')
      .trim();

    const groundingChunks =
      candidate?.groundingMetadata?.groundingChunks || [];
    const urlMeta =
      candidate?.urlContextMetadata?.urlMetadata || [];

    const sources = [
      ...groundingChunks.map((chunk) => ({
        title: chunk?.web?.title || '',
        uri: chunk?.web?.uri || ''
      })),
      ...urlMeta.map((u) => ({
        title:
          u?.urlRetrievalStatus === 'URL_RETRIEVAL_STATUS_SUCCESS'
            ? 'URL Context'
            : 'URL Checked',
        uri: u?.retrievedUrl || ''
      }))
    ].filter((s) => s.uri);

    const uniqueSources = [];
    const seen = new Set();
    for (const s of sources) {
      if (!seen.has(s.uri)) {
        seen.add(s.uri);
        uniqueSources.push(s);
      }
    }

    return { text, sources: uniqueSources, model, raw: data };
  }

  const wrapped = new Error(formatFriendlyError(lastError, lastStatus));
  wrapped.status = lastStatus;
  wrapped.rawMessage = lastError?.message || '';
  throw wrapped;
}

/**
 * AI Auto-Fill from Product URL (and optional Ingredient 1 image).
 * Uses progressive tool fallback so Free Tier keys without Search Grounding quota still succeed!
 */
export async function autoFillFromUrl(apiKey, url, options = {}) {
  const { preferredModel = 'auto', ingredient1 = null } = options;
  const hasImage = Boolean(ingredient1?.base64);

  const buildPrompt = (modeHint) => `คุณคือผู้เชี่ยวชาญการตลาดอีคอมเมิร์ซและโปรดิวเซอร์โฆษณาไทย
เป้าหมาย: ดึงข้อมูลสินค้าจริงเพื่อนำไปทำคลิปขายของ 15 วิ และภาพนิ่ง Imagen
${url ? `ลิงก์สินค้า: ${url}` : 'ไม่ได้วางลิงก์ (ให้วิเคราะห์จากรูปสินค้าที่แนบเป็นหลัก)'}
${hasImage ? 'แนบรูปสินค้า Ingredient 1 มาด้วย ให้ใช้รายละเอียดจากภาพสินค้าเป็นข้อมูลยืนยันหลัก' : ''}
โหมดการค้นหา: ${modeHint}

ตอบกลับเป็น JSON object เท่านั้น (ห้ามใส่คำอธิบายอื่นนอก JSON) ตามโครงสร้างนี้:
{
  "productName": "ชื่อสินค้าและแบรนด์ (ภาษาไทย/อังกฤษตามจริง)",
  "benefits": "จุดเด่น สรรพคุณ และเหตุผลที่คนควรซื้อ 2-4 ข้อ แบบกระชับภาษาไทย",
  "pricePromo": "ราคาและโปรโมชันที่พบ (หากไม่พบให้แนะนำข้อความโปรขายดีสั้นๆ)",
  "audience": "กลุ่มเป้าหมายหลักในไทย",
  "visualDetails": "รายละเอียดลักษณะสินค้า สี บรรจุภัณฑ์ และพร็อพที่เหมาะถ่ายทำ (ภาษาไทยหรืออังกฤษ)",
  "characterAnchor": "คำบรรยายพรีเซนเตอร์/มือผู้สาธิตที่เหมาะกับสินค้านี้เป็นภาษาอังกฤษสั้นๆ สำหรับล็อกตัวละครใน Google Flow",
  "note": "หมายเหตุสั้นๆ หากเป็นลิงก์ย่อที่ติดหน้าล็อกอินหรือไม่ได้ใช้ Search Grounding"
}`;

  const makeParts = (modeHint) => {
    const parts = [{ text: buildPrompt(modeHint) }];
    if (hasImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: ingredient1.base64
        }
      });
    }
    return parts;
  };

  // Tool strategies from richest -> most Free-Tier-friendly
  const toolStrategies = url
    ? [
        {
          name: 'URL Context + Google Search',
          tools: [{ url_context: {} }, { google_search: {} }],
          hint: 'ใช้ url_context ติดตามลิงก์ปลายทางและใช้ google_search ค้นหาข้อมูลสินค้าจริง'
        },
        {
          name: 'URL Context (Free-Tier Friendly)',
          tools: [{ url_context: {} }],
          hint: 'ใช้ url_context อ่านหน้าเว็บจากลิงก์ที่ให้มาโดยตรง'
        },
        {
          name: hasImage ? 'AI Vision + URL Analysis' : 'URL Analysis (No Grounding Quota)',
          tools: null,
          hint: hasImage
            ? 'วิเคราะห์สินค้าจากภาพ Ingredient 1 ที่แนบและชื่อในลิงก์ (โควตา Search Grounding ไม่พอ)'
            : 'วิเคราะห์ข้อมูลเบื้องต้นจากชื่อ/slug ในลิงก์ (หากเป็นลิงก์ย่อให้แจ้งผู้ใช้ว่าควรแนบรูป Ingredient 1 หรือวาง URL เต็ม)'
        }
      ]
    : [
        {
          name: 'AI Vision Auto-Fill',
          tools: null,
          hint: 'วิเคราะห์ชื่อสินค้า จุดเด่น กลุ่มเป้าหมาย และพร็อพถ่ายทำจากภาพ Ingredient 1 ที่แนบ'
        }
      ];

  let lastErr = null;
  for (const strategy of toolStrategies) {
    try {
      const result = await callGeminiWithFallback(
        apiKey,
        (m) => {
          const generationConfig = {
            thinkingConfig: m.thinkingConfig
          };
          if (!strategy.tools) {
            generationConfig.responseMimeType = 'application/json';
          }
          if (m.supportsTemperature) {
            generationConfig.temperature = 0.35;
          }
          const reqBody = {
            contents: [{ role: 'user', parts: makeParts(strategy.hint) }],
            generationConfig
          };
          if (strategy.tools) {
            reqBody.tools = strategy.tools;
          }
          return reqBody;
        },
        preferredModel,
        undefined,
        2
      );

      const parsed = extractJsonObject(result.text);
      return {
        productName: parsed.productName || '',
        benefits: parsed.benefits || '',
        pricePromo: parsed.pricePromo || '',
        audience: parsed.audience || '',
        visualDetails: parsed.visualDetails || '',
        characterAnchor: parsed.characterAnchor || '',
        note: parsed.note || '',
        sources: result.sources,
        modelId: result.model.id,
        strategyName: strategy.name
      };
    } catch (err) {
      lastErr = err;
      // If API key itself is invalid (401/403), stop immediately
      if (err.status === 401 || err.status === 403) {
        throw err;
      }
      // Otherwise try the next lighter tool strategy (e.g., drop google_search on 429/400)
      continue;
    }
  }

  throw lastErr || new Error('Auto-Fill ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
}

/**
 * Generates the complete 0–15s Google Flow video slides, 3 Imagen prompts,
 * Thai sales captions & hashtags with automatic model fallback on 404/429.
 */
export async function generateAdStudioPlan(apiKey, input) {
  const mode = FLOW_MODES[input.flowMode] || FLOW_MODES.veo3;
  const style =
    CLIP_STYLES.find((s) => s.id === input.clipStyle) || CLIP_STYLES[0];

  const hasIng1 = Boolean(input.ingredient1?.base64);
  const hasIng2 = Boolean(input.ingredient2?.base64);

  const systemInstruction = `You are "AI Ad Studio TH (Google Flow Edition)", an elite Thai e-commerce ad director and Google Flow (Veo 3 / Veo 2 / Scenebuilder) + Imagen prompt architect.
Rules:
1. All Google Flow video prompts and Imagen still-image prompts MUST be written in ultra-clear, film-grade English optimized for Google Flow & Imagen 3/4.
2. All Thai voiceovers, on-screen text overlays, continuity tips, captions, and hashtags MUST be natural, persuasive, high-converting modern Thai (ภาษาไทยธรรมชาติ ปิดการขายเก่ง ไม่แข็ง).
3. Produce EXACTLY 4 video slides totaling 15 seconds:
   - Slide 1: "00:00 - 00:03" (shortTime: "0–3s")
   - Slide 2: "00:03 - 00:07" (shortTime: "3–7s")
   - Slide 3: "00:07 - 00:11" (shortTime: "7–11s")
   - Slide 4: "00:11 - 00:15" (shortTime: "11–15s")
4. Produce EXACTLY 3 Imagen still-image prompts (Hero Thumbnail, Lifestyle Hands-On, Studio Flat-Lay).
5. Produce EXACTLY 3 Thai platform captions (TikTok/Reels, Facebook/IG, Shopee Video/Line OA) and 10-14 high-reach hashtags.
6. If Character Lock is ON, embed an identical visual subject/character & product consistency anchor across ALL 4 video prompts so Google Flow preserves the exact same presenter, clothing, lighting, and product in every cut.
7. If Ingredient images are attached, accurately reflect the real product packaging, colors, materials, and presenter appearance seen in the uploaded images, and reference @Ingredient1 / @Ingredient2 naturally for Google Flow Ingredients-to-Video.`;

  const userPrompt = `สร้างชุดพรอมโฆษณาครบวงจรจากข้อมูลสินค้านี้:
- ชื่อสินค้า: ${input.productName}
- จุดเด่น/สรรพคุณ: ${input.benefits}
- ราคา/โปรโมชัน/CTA: ${input.pricePromo}
- กลุ่มเป้าหมาย: ${input.audience || 'ผู้บริโภคออนไลน์ในไทย'}
- รายละเอียดภาพ/บรรจุภัณฑ์: ${input.visualDetails || 'ตามภาพ Ingredient ที่แนบหรือดีไซน์พรีเมียมทันสมัย'}
- อัตราส่วนภาพ (Aspect Ratio): ${input.aspectRatio || '9:16'}
- โหมด Google Flow: ${mode.name} (${mode.tag}) — ${mode.promptDirective}
- แนวทางคลิป 15 วิ: ${style.name} — ${style.englishVibe}
- ล็อกตัวละครทุกช็อต (Character Lock): ${input.lockCharacter ? 'ON (บังคับล็อกตัวละครและสินค้าเหมือนกันเป๊ะทั้ง 4 ช็อต)' : 'OFF'}
- รายละเอียดตัวละครหลัก (Character Anchor): ${input.characterAnchor || 'Auto-design natural Thai presenter matching the product / Ingredient 2'}
- ไฟล์แนบ: Ingredient 1 (สินค้า) = ${hasIng1 ? 'แนบรูปแล้ว (ดูจากรูปที่ 1)' : 'ไม่ได้แนบ'}, Ingredient 2 (พรีเซนเตอร์/ฉาก) = ${hasIng2 ? 'แนบรูปแล้ว (ดูจากรูปที่ 2)' : 'ไม่ได้แนบ'}

ตอบกลับเป็น JSON ที่มีโครงสร้างดังนี้เท่านั้น:
{
  "characterAnchor": "English visual anchor summarizing locked presenter + product + lighting",
  "audioModeNote": "คำแนะนำการตั้งค่าเสียง/ซีนสำหรับโหมด Google Flow ที่เลือก (ภาษาไทย)",
  "slides": [
    {
      "index": 1,
      "timecode": "00:00 - 00:03",
      "shortTime": "0–3s",
      "role": "HOOK / หยุดนิ้ว",
      "title": "ชื่อช็อตภาษาไทยกระชับ",
      "flowAction": "คำสั่งโหมด Google Flow เช่น Veo 3 • Ingredients to Video หรือ Scenebuilder • Jump To",
      "prompt": "Detailed English Google Flow prompt ready to paste directly",
      "voiceover": "บทพูดพากย์ภาษาไทย 3-4 วินาที",
      "audioCue": "คำแนะนำ SFX / BGM / โทนเสียง",
      "camera": "มุมกล้องและการเคลื่อนไหว",
      "onScreenText": "ข้อความขึ้นจอสั้นๆ กระแทกตา",
      "continuityNote": "ทิปส์การต่อช็อตใน Google Flow / Scenebuilder (ภาษาไทย)"
    }
  ],
  "imagenPrompts": [
    {
      "id": 1,
      "title": "ชื่อภาพนิ่งภาษาไทย",
      "ratio": "9:16",
      "purpose": "จุดประสงค์การใช้งานภาษาไทย",
      "prompt": "Detailed English Imagen 3/4 commercial photography prompt"
    }
  ],
  "captions": [
    {
      "platform": "TikTok / Reels (สั้น กระชับ ปิดไว)",
      "badge": "Conversion Hook",
      "text": "แคปชั่นภาษาไทยพร้อมอีโมจิและ CTA"
    }
  ],
  "hashtags": ["#แฮชแท็ก1", "#แฮชแท็ก2"]
}`;

  const parts = [{ text: userPrompt }];

  if (hasIng1) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: input.ingredient1.base64
      }
    });
  }
  if (hasIng2) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: input.ingredient2.base64
      }
    });
  }

  const startedAt = performance.now();
  const { text, model } = await callGeminiWithFallback(
    apiKey,
    (m) => {
      const generationConfig = {
        thinkingConfig: m.thinkingConfig,
        responseMimeType: 'application/json'
      };
      if (m.supportsTemperature) {
        generationConfig.temperature = 0.72;
      }
      return {
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [{ role: 'user', parts }],
        generationConfig
      };
    },
    input.preferredModel || 'auto'
  );

  const elapsedSec = ((performance.now() - startedAt) / 1000).toFixed(1);
  const parsed = extractJsonObject(text);

  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error('Gemini ส่งข้อมูลสไลด์ไม่ครบถ้วน กรุณาลองสร้างใหม่อีกครั้ง');
  }

  return {
    source: 'gemini',
    modelLabel: `${model.id} • ${model.fastLabel} (${elapsedSec} วิ)`,
    productName: input.productName,
    flowMode: mode.id,
    flowModeName: `${mode.name} (${mode.tag})`,
    clipStyleId: style.id,
    clipStyleName: style.name,
    aspectRatio: input.aspectRatio || '9:16',
    lockCharacter: Boolean(input.lockCharacter),
    characterAnchor: parsed.characterAnchor || input.characterAnchor || '',
    audioModeNote: parsed.audioModeNote || mode.shortDesc,
    slides: parsed.slides.slice(0, 4).map((s, idx) => ({
      index: idx + 1,
      timecode:
        s.timecode ||
        ['00:00 - 00:03', '00:03 - 00:07', '00:07 - 00:11', '00:11 - 00:15'][idx] ||
        '00:00 - 00:04',
      shortTime: s.shortTime || ['0–3s', '3–7s', '7–11s', '11–15s'][idx] || `Shot ${idx + 1}`,
      role: s.role || `SHOT ${idx + 1}`,
      title: s.title || `ช็อตที่ ${idx + 1}`,
      flowAction: s.flowAction || mode.actionLabels[idx] || mode.name,
      prompt: s.prompt || '',
      voiceover: s.voiceover || '',
      audioCue: s.audioCue || '',
      camera: s.camera || '',
      onScreenText: s.onScreenText || '',
      continuityNote: s.continuityNote || ''
    })),
    imagenPrompts: (parsed.imagenPrompts || []).slice(0, 3).map((im, idx) => ({
      id: idx + 1,
      title: im.title || `Imagen Shot ${idx + 1}`,
      ratio: im.ratio || input.aspectRatio || '9:16',
      purpose: im.purpose || '',
      prompt: im.prompt || ''
    })),
    captions: (parsed.captions || []).slice(0, 3).map((cap) => ({
      platform: cap.platform || 'Social Caption',
      badge: cap.badge || 'Ad Copy',
      text: cap.text || ''
    })),
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : []
  };
}

/* ==========================================================================
   UGC 4-Panel Seamless 1:1 Image Prompt & Gemini Image Generation
   ========================================================================== */

export const IMAGE_MODEL_CANDIDATES = [
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Nano Banana 2 (gemini-3.1-flash-image-preview)'
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Nano Banana Pro (gemini-3-pro-image-preview • ฟอนต์ไทยคม)'
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    label: 'Nano Banana 2 Lite (gemini-3.1-flash-lite-image)'
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana (gemini-2.5-flash-image)'
  }
];

/**
 * Builds a deterministic, high-craft UGC 4-panel seamless 1:1 prompt locally
 * (used immediately in Demo mode or as fallback if text quota is exhausted).
 */
export function buildUgc4GridLocalPrompt(input = {}) {
  const name = (input.productName || 'สินค้ายอดฮิต').trim();
  const benefits = (
    input.benefits || 'ใช้งานง่าย เห็นผลจริง พกพาสะดวก คุ้มราคา'
  ).trim();
  const visual = (
    input.visualDetails ||
    'real product packaging resting naturally in a cozy everyday Thai home setting'
  ).trim();
  const pricePromo = (input.pricePromo || '').trim();

  const shortHighlight = benefits
    .split(/[.,\n•]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const shortPromo = pricePromo
    ? pricePromo.split(/[()]/)[0].trim().slice(0, 22).trim()
    : '';

  const panels = [
    {
      label: 'ช่อง 1 (บนซ้าย) • แกะใช้จริงบนโต๊ะ',
      thaiText: 'ของมันต้องมี ✨ ใช้จริงทุกวัน!',
      scene: `Top-left quadrant: Candid everyday unboxing / first-use close-up of ${name} resting naturally on a warm lived-in wooden table next to everyday personal items (${visual}), soft natural window daylight.`
    },
    {
      label: 'ช่อง 2 (บนขวา) • ซูมเนื้อสัมผัส/ดีเทล',
      thaiText: shortHighlight[0]
        ? `${shortHighlight[0].slice(0, 22)} 👍`
        : 'ดีเทลจึ้งมาก!',
      scene: `Top-right quadrant: Tight smartphone macro shot focusing on the real texture, material finish, and functional detail of ${name} in active everyday use, authentic shallow depth of field.`
    },
    {
      label: 'ช่อง 3 (ล่างซ้าย) • มุมใช้งานจริงไม่จัดฉาก',
      thaiText: shortHighlight[1]
        ? `${shortHighlight[1].slice(0, 22)} ♡`
        : 'พกง่าย ใช้คล่องสุดๆ',
      scene: `Bottom-left quadrant: Real-life casual placement of ${name} inside an everyday bag, kitchen counter, or cozy bedside setup — unpolished authentic lifestyle moment, warm ambient indoor lighting.`
    },
    {
      label: 'ช่อง 4 (ล่างขวา) • ป้ายยาคุ้มราคา',
      thaiText: shortPromo ? `คุ้ม! ${shortPromo}` : 'ลองแล้วเลิฟ กดซ้ำเลย!',
      scene: `Bottom-right quadrant: Satisfied after-use / flat-lay snapshot of ${name} looking neat and ready to recommend, soft afternoon sunlight shadows across natural surfaces.`
    }
  ];

  const prompt = [
    `Create a 1:1 square aesthetic 2x2 four-panel seamless photo grid collage reviewing "${name}" in authentic Thai UGC real-user style.`,
    `STRICT LAYOUT: Exactly 4 square quadrants arranged edge-to-edge with ZERO borders, ZERO divider lines, ZERO gaps, and ZERO white frames separating the 4 panels — images touch seamlessly.`,
    `STRICT NO-CHARACTER RULE: NO people, NO faces, NO characters, NO human models, and NO full hands/bodies anywhere in the frame — product-only real-life POV environment.`,
    `AUTHENTIC UGC REALISM: Candid smartphone camera aesthetic (iPhone natural color science), cozy lived-in Thai home / cafe / work desk atmosphere, not overly staged commercial studio, realistic ambient window light and subtle organic shadows, cohesive warm aesthetic color grading, crisp product details (${visual}).`,
    `PANELS CONTENT:`,
    `1) ${panels[0].scene} Decorated with cute neat Thai handwritten marker font text "${panels[0].thaiText}" and a tiny hand-drawn arrow.`,
    `2) ${panels[1].scene} Decorated with cute neat Thai handwritten brush font text "${panels[1].thaiText}" and small doodle stars.`,
    `3) ${panels[2].scene} Decorated with cute neat Thai handwritten pen font text "${panels[2].thaiText}" and a small hand-drawn heart.`,
    `4) ${panels[3].scene} Decorated with cute neat Thai handwritten highlighter callout "${panels[3].thaiText}" pointing toward the product.`,
    `TYPOGRAPHY & FINISH: Cute, clean, legible Thai handwritten marker/pen font annotations naturally layered in corners without blocking the product, aesthetically pleasing cozy lifestyle review look, high detail.`
  ].join('\n');

  return {
    productName: name,
    benefits,
    pricePromo,
    visualDetails: visual,
    panels,
    prompt,
    source: 'local'
  };
}

/**
 * Analyzes product URL (and optional Ingredient 1 image) via Gemini, then builds
 * a tailored 1:1 seamless 4-panel character-free UGC review image prompt with Thai handwritten text.
 */
export async function analyzeProductAndBuildUgcPrompt(apiKey, input = {}) {
  const url = (input.url || '').trim();
  const hasIng1 = Boolean(input.ingredient1?.base64);

  // First ensure we have analyzed product metadata if URL or image was given without productName
  let productData = {
    productName: (input.productName || '').trim(),
    benefits: (input.benefits || '').trim(),
    pricePromo: (input.pricePromo || '').trim(),
    audience: (input.audience || '').trim(),
    visualDetails: (input.visualDetails || '').trim(),
    sources: [],
    note: ''
  };

  if (apiKey && (url || hasIng1)) {
    try {
      const analyzed = await autoFillFromUrl(apiKey, url, {
        preferredModel: input.preferredModel || 'auto',
        ingredient1: input.ingredient1
      });
      productData = {
        productName: analyzed.productName || productData.productName,
        benefits: analyzed.benefits || productData.benefits,
        pricePromo: analyzed.pricePromo || productData.pricePromo,
        audience: analyzed.audience || productData.audience,
        visualDetails: analyzed.visualDetails || productData.visualDetails,
        characterAnchor: analyzed.characterAnchor || '',
        sources: analyzed.sources || [],
        note: analyzed.note || '',
        analyzedBy: analyzed.modelId
      };
    } catch (err) {
      // If productName already exists, continue gracefully; otherwise propagate
      if (!productData.productName) {
        throw err;
      }
      productData.note = err.message;
    }
  }

  // Ask Gemini to craft the ultra-tailored 4-panel prompt + 4 Thai handwritten labels
  if (apiKey && productData.productName) {
    const promptRequest = `คุณคือ Creative Director เชี่ยวชาญการทำภาพขายของ UGC ไทยบน TikTok/IG/Shopee
วิเคราะห์สินค้าต่อไปนี้แล้วสร้าง "Prompt สำหรับเจนภาพ 1:1 แบบตาราง 4 ช่อง ไม่มีเส้นคั่น" ตามเงื่อนไขเป๊ะๆ:
- ชื่อสินค้า: ${productData.productName}
- จุดเด่น: ${productData.benefits}
- ราคา/โปร: ${productData.pricePromo}
- ลักษณะสินค้า: ${productData.visualDetails}

เงื่อนไขบังคับของภาพ:
1. อัตราส่วน 1:1 แบบตาราง 2x2 (4 ช่อง) **ไม่มีเส้นคั่นระหว่างช่อง ไม่มีขอบขาว ภาพชนกันเนียนๆ (seamless edge-to-edge grid, zero dividers, zero borders)**
2. สไตล์ UGC เหมือนคนซื้อมาใช้จริงรีวิวเอง **ไม่มีตัวละคร ไม่มีหน้าคน ไม่มีนางแบบ/นายแบบ**
3. **ไม่จัดฉากสตูดิโอจนเกินไป** เน้นวางใช้งานจริงในบ้าน โต๊ะทำงาน เคาน์เตอร์ หรือพกพาจริง แสงธรรมชาติสวยๆ ดูน่าเชื่อถือและสวยงาม
4. ตกแต่งด้วย **Text font ภาษาไทยลายมือ** น่ารัก อ่านง่าย (เช่น ข้อความสั้นๆ 3-5 คำต่อช่อง + ลูกศร/ดาววาดมือเล็กๆ) ไม่บังตัวสินค้า

ตอบกลับเป็น JSON เท่านั้น:
{
  "panels": [
    { "label": "ช่อง 1 (บนซ้าย)", "thaiText": "ข้อความลายมือไทยสั้นๆ ช่อง 1", "scene": "English scene description for top-left quadrant" },
    { "label": "ช่อง 2 (บนขวา)", "thaiText": "ข้อความลายมือไทยสั้นๆ ช่อง 2", "scene": "English scene description for top-right quadrant" },
    { "label": "ช่อง 3 (ล่างซ้าย)", "thaiText": "ข้อความลายมือไทยสั้นๆ ช่อง 3", "scene": "English scene description for bottom-left quadrant" },
    { "label": "ช่อง 4 (ล่างขวา)", "thaiText": "ข้อความลายมือไทยสั้นๆ ช่อง 4", "scene": "English scene description for bottom-right quadrant" }
  ],
  "prompt": "Full cohesive English image generation prompt incorporating all 4 seamless quadrants, zero dividers, no characters, realistic everyday Thai UGC usage, and the exact 4 Thai handwritten text annotations."
}`;

    try {
      const { text, model } = await callGeminiWithFallback(
        apiKey,
        (m) => {
          const parts = [{ text: promptRequest }];
          if (hasIng1) {
            parts.push({
              inlineData: { mimeType: 'image/jpeg', data: input.ingredient1.base64 }
            });
          }
          const generationConfig = {
            thinkingConfig: m.thinkingConfig,
            responseMimeType: 'application/json'
          };
          if (m.supportsTemperature) generationConfig.temperature = 0.65;
          return {
            contents: [{ role: 'user', parts }],
            generationConfig
          };
        },
        input.preferredModel || 'auto',
        undefined,
        2
      );
      const parsed = extractJsonObject(text);
      if (parsed?.prompt && Array.isArray(parsed.panels)) {
        return {
          ...productData,
          panels: parsed.panels.slice(0, 4),
          prompt: parsed.prompt,
          promptModelId: model.id,
          source: 'gemini'
        };
      }
    } catch {
      // Fall back cleanly to deterministic builder if text generation hits 429
    }
  }

  const localBuilt = buildUgc4GridLocalPrompt(productData);
  return {
    ...productData,
    ...localBuilt
  };
}

/**
 * Generates an actual 1:1 image using Gemini native image generation models
 * (Nano Banana 2 / Nano Banana Pro / Nano Banana 2 Lite / Nano Banana).
 */
export async function generateUgcImageWithGemini(apiKey, options = {}) {
  const {
    prompt,
    preferredImageModel = 'auto',
    ingredient1 = null,
    aspectRatio = '1:1'
  } = options;

  if (!apiKey) {
    throw new Error('กรุณาใส่ Gemini API Key ก่อนสร้างรูปภาพด้วย Gemini');
  }
  if (!prompt || !prompt.trim()) {
    throw new Error('กรุณาสร้างหรือกรอก Prompt สำหรับภาพ 4 ช่องก่อน');
  }

  const ordered =
    preferredImageModel && preferredImageModel !== 'auto'
      ? [
          ...IMAGE_MODEL_CANDIDATES.filter((m) => m.id === preferredImageModel),
          ...IMAGE_MODEL_CANDIDATES.filter((m) => m.id !== preferredImageModel)
        ]
      : IMAGE_MODEL_CANDIDATES;

  const parts = [{ text: prompt.trim() }];
  if (ingredient1?.base64) {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: ingredient1.base64
      }
    });
  }

  let lastError = null;
  let lastStatus = 0;

  for (const model of ordered) {
    const url = `${API_BASE}/${model.id}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { aspectRatio }
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data?.error?.message || `Image API Error (HTTP ${res.status})`;
      lastStatus = res.status;
      lastError = new Error(msg);
      if (shouldTryNextModel(res.status, msg) || res.status === 400) {
        continue;
      }
      throw lastError;
    }

    const candParts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = candParts.find((p) => p?.inlineData?.data);
    if (!imgPart) {
      lastError = new Error(`โมเดล ${model.id} ไม่ได้ส่งข้อมูลรูปภาพกลับมา`);
      continue;
    }

    const mimeType = imgPart.inlineData.mimeType || 'image/png';
    const base64 = imgPart.inlineData.data;
    return {
      modelId: model.id,
      mimeType,
      base64,
      dataUrl: `data:${mimeType};base64,${base64}`,
      captionText: candParts
        .filter((p) => typeof p.text === 'string' && !p.thought)
        .map((p) => p.text)
        .join('\n')
        .trim()
    };
  }

  const err = new Error(
    lastStatus === 429
      ? 'โมเดลสร้างภาพ Gemini ติดโควตา 429 (โมเดล Nano Banana Image มักต้องเปิด Billing หรือมีโควตา Free Tier จำกัด) — คุณสามารถกด "สร้างภาพพรีวิว 4 ช่อง (Canvas)" เพื่อดูตัวอย่างและทดสอบบันทึกเข้า Google Drive ได้ทันที'
      : lastError?.message || 'ไม่สามารถสร้างรูปภาพด้วย Gemini ได้'
  );
  err.status = lastStatus;
  throw err;
}

