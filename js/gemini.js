/* ==========================================================================
   AI Ad Studio TH (Google Flow Edition) — Gemini 2.5 Flash API Client
   - AI Auto-Fill from URL with Google Search Grounding (google_search tool)
   - Full 15s Flow & Imagen Generation with thinkingBudget: 0 & Multimodal Vision
   ========================================================================== */

import { FLOW_MODES, CLIP_STYLES } from './presets.js';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
 * Calls Gemini 2.5 Flash REST endpoint and handles error responses gracefully.
 */
async function callGemini(apiKey, body, signal) {
  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg =
      data?.error?.message ||
      `Gemini API Error (HTTP ${response.status})`;
    throw new Error(msg);
  }

  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text = parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('\n')
    .trim();

  const groundingChunks =
    candidate?.groundingMetadata?.groundingChunks || [];
  const sources = groundingChunks
    .map((chunk) => ({
      title: chunk?.web?.title || '',
      uri: chunk?.web?.uri || ''
    }))
    .filter((s) => s.uri);

  return { text, sources, raw: data };
}

/**
 * AI Auto-Fill from Product URL using gemini-2.5-flash + Google Search Grounding.
 */
export async function autoFillFromUrl(apiKey, url) {
  const prompt = `คุณคือผู้เชี่ยวชาญการตลาดอีคอมเมิร์ซและโปรดิวเซอร์โฆษณาไทย
ใช้ Google Search Grounding ค้นหาข้อมูลสินค้าจากลิงก์นี้:
${url}

สรุปข้อมูลสินค้าให้แม่นยำ กระชับ พร้อมนำไปสร้างคลิปขายของ 15 วินาที และพรอมภาพนิ่ง Imagen
ตอบกลับเป็น JSON object เท่านั้น (ห้ามใส่คำอธิบายอื่นนอก JSON) ตามโครงสร้างนี้:
{
  "productName": "ชื่อสินค้าและแบรนด์ (ภาษาไทย/อังกฤษตามจริง)",
  "benefits": "จุดเด่น สรรพคุณ และเหตุผลที่คนควรซื้อ 2-4 ข้อ แบบกระชับภาษาไทย",
  "pricePromo": "ราคาและโปรโมชันที่พบ (หากไม่พบให้แนะนำข้อความโปรขายดีสั้นๆ)",
  "audience": "กลุ่มเป้าหมายหลักในไทย",
  "visualDetails": "รายละเอียดลักษณะสินค้า สี บรรจุภัณฑ์ และพร็อพที่เหมาะถ่ายทำ (ภาษาไทยหรืออังกฤษ)",
  "characterAnchor": "คำบรรยายพรีเซนเตอร์/มือผู้สาธิตที่เหมาะกับสินค้านี้เป็นภาษาอังกฤษสั้นๆ สำหรับล็อกตัวละครใน Google Flow"
}`;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 },
      temperature: 0.35
    }
  };

  const { text, sources } = await callGemini(apiKey, body);
  const parsed = extractJsonObject(text);

  return {
    productName: parsed.productName || '',
    benefits: parsed.benefits || '',
    pricePromo: parsed.pricePromo || '',
    audience: parsed.audience || '',
    visualDetails: parsed.visualDetails || '',
    characterAnchor: parsed.characterAnchor || '',
    sources
  };
}

/**
 * Generates the complete 0–15s Google Flow video slides, 3 Imagen prompts,
 * Thai sales captions & hashtags using gemini-2.5-flash with thinkingBudget: 0.
 * Supports compressed Ingredient 1 & Ingredient 2 multimodal images (<=640px).
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

  const body = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [{ role: 'user', parts }],
    generationConfig: {
      thinkingConfig: { thinkingBudget: 0 },
      temperature: 0.72,
      responseMimeType: 'application/json'
    }
  };

  const startedAt = performance.now();
  const { text } = await callGemini(apiKey, body);
  const elapsedSec = ((performance.now() - startedAt) / 1000).toFixed(1);
  const parsed = extractJsonObject(text);

  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error('Gemini ส่งข้อมูลสไลด์ไม่ครบถ้วน กรุณาลองสร้างใหม่อีกครั้ง');
  }

  return {
    source: 'gemini',
    modelLabel: `gemini-2.5-flash • thinkingBudget: 0 (${elapsedSec} วิ)`,
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
