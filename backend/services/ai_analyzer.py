from __future__ import annotations

import hashlib
import logging
from typing import Sequence

from backend.config import Settings, get_settings
from backend.models import ContentAngle, Product
from backend.schemas import AIAnalysisResult

logger = logging.getLogger(__name__)

ALL_ANGLES: tuple[ContentAngle, ...] = (
    ContentAngle.PAIN_POINT,
    ContentAngle.HONEST_REVIEW,
    ContentAngle.COMPARISON,
    ContentAngle.PROBLEM_SOLVER,
)

SYSTEM_INSTRUCTION = """You are a senior Thai TikTok & Shopee Affiliate conversion strategist and short-form video director.
Evaluate the given product with brutal honesty (never blindly flatter weak products) and generate ready-to-shoot short-form affiliate creative assets.

Rules:
1. demand_score (0-100): Score realistically using trend relevance, Thai impulse-buy price-to-value ratio, commission attractiveness, and customer review pain-point urgency.
2. buy_probability_reasoning: Write concise, brutally honest Thai analysis (2-4 sentences). Explicitly call out dealbreakers (e.g., high price barrier, weak reviews, low commission, saturated commodity) if present.
3. content_angle: Strictly choose one of PAIN_POINT, HONEST_REVIEW, COMPARISON, PROBLEM_SOLVER. Prefer an angle NOT used in recent products to avoid repetitive AI slop.
4. hook_text: Punchy 3-second Thai scroll-stopper, MAXIMUM 12 Thai words/phrases, natural spoken Thai.
5. i2v_video_prompt: English cinematic 9:16 vertical product showcase prompt tailored for Image-to-Video models (Veo / Kling / Runway). Explicitly preserve exact product geometry, labels, and color from the reference image while describing lighting, background setting, and smooth camera motion.
6. caption_th: Natural conversational Thai TikTok/Shopee affiliate caption (avoid robotic clichés), include clear CTA pointing to the basket/link.
7. hashtags: 5 to 8 targeted Thai & English hashtags starting with #.
"""


class AIAnalyzerService:
    """Analyzes affiliate products via Gemini structured output (or deterministic MOCK_MODE)."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def analyze_product(
        self,
        product: Product,
        recent_angles: Sequence[str] | None = None,
    ) -> AIAnalysisResult:
        """Return a strictly validated AIAnalysisResult for the given product."""
        if self.settings.mock_mode:
            return self._mock_analyze(product, recent_angles or [])
        return self._gemini_analyze(product, recent_angles or [])

    def _gemini_analyze(
        self,
        product: Product,
        recent_angles: Sequence[str],
    ) -> AIAnalysisResult:
        if not self.settings.gemini_api_key.strip():
            raise RuntimeError("GEMINI_API_KEY is missing while MOCK_MODE=false.")

        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self.settings.gemini_api_key)

        recent_angles_str = ", ".join(recent_angles) if recent_angles else "None yet"
        prompt = (
            f"Analyze this TikTok/Shopee affiliate product:\n"
            f"- Product Name: {product.name}\n"
            f"- Product URL: {product.product_url}\n"
            f"- Price (THB): {product.price:,.2f}\n"
            f"- Affiliate Commission (%): {product.commission_pct:.2f}%\n"
            f"- Trend Keyword: {product.trend_keyword or 'N/A'}\n"
            f"- Product Image URL: {product.image_url}\n"
            f"- Raw Customer Reviews:\n{product.raw_reviews or 'No customer reviews provided'}\n\n"
            f"Recently used content angles (rotate away from these if possible): {recent_angles_str}\n"
            f"Return strictly structured JSON matching the schema."
        )

        response = client.models.generate_content(
            model=self.settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=AIAnalysisResult,
                temperature=0.4,
            ),
        )

        # Prefer SDK-parsed Pydantic object; fallback to strict Pydantic JSON validation (never regex)
        if getattr(response, "parsed", None) is not None:
            parsed = response.parsed
            if isinstance(parsed, AIAnalysisResult):
                return parsed
            return AIAnalysisResult.model_validate(parsed)

        if not response.text:
            raise RuntimeError("Gemini API returned an empty response body.")

        return AIAnalysisResult.model_validate_json(response.text)

    def _mock_analyze(
        self,
        product: Product,
        recent_angles: Sequence[str],
    ) -> AIAnalysisResult:
        """
        Deterministic, realistic Thai mock analyzer for MOCK_MODE=true testing.
        Rotates content_angle and reflects real product price, commission, reviews, and trend.
        """
        # Compute realistic demand score based on price sweet spot, commission, reviews, and trend
        score = 58
        dealbreakers: list[str] = []
        strengths: list[str] = []

        if 79 <= product.price <= 590:
            score += 16
            strengths.append(f"ราคา {product.price:,.0f} บาท อยู่ในช่วงตัดสินใจซื้อง่ายบน TikTok")
        elif product.price <= 1290:
            score += 8
            strengths.append(f"ราคา {product.price:,.0f} บาท ยังพอปิดการขายได้ถ้าคลิปขยี้จุดคุ้มค่า")
        else:
            score -= 8
            dealbreakers.append(
                f"ราคา {product.price:,.0f} บาท ค่อนข้างสูงสำหรับสายไถฟีด ต้องมีรีวิวความน่าเชื่อถือแน่น"
            )

        if product.commission_pct >= 10:
            score += 12
            strengths.append(f"ค่าคอม {product.commission_pct:.1f}% คุ้มค่าทำคอนเทนต์ยิงซ้ำ")
        elif product.commission_pct >= 5:
            score += 6
        else:
            score -= 5
            dealbreakers.append(
                f"ค่าคอม {product.commission_pct:.1f}% ค่อนข้างบาง ต้องเน้นยอดวิวสูงถึงจะคุ้มเวลา"
            )

        if product.trend_keyword.strip():
            score += 8
            strengths.append(f"เกาะกระแสคำค้น '{product.trend_keyword.strip()}' ได้ตรงกลุ่ม")
        else:
            dealbreakers.append("ยังไม่มีคีย์เวิร์ดเทรนด์ชัดเจน อาจต้องสร้างฮุคดึงความสนใจเอง")

        if len((product.raw_reviews or "").strip()) >= 20:
            score += 6
            strengths.append("มีรีวิวลูกค้าจริงให้หยิบ Pain Point มาเล่นได้")
        else:
            score -= 4
            dealbreakers.append("ข้อมูลรีวิวลูกค้ายังน้อย เสี่ยงเขียนสคริปต์กว้างเกินไป")

        # Small deterministic variance from url_hash
        seed_int = int(hashlib.sha256((product.url_hash or product.name).encode()).hexdigest()[:6], 16)
        score = max(25, min(97, score + (seed_int % 7) - 3))

        # Rotate content angle away from recent angles
        chosen_angle: ContentAngle | None = None
        recent_set = set(recent_angles[:3])
        start_idx = seed_int % len(ALL_ANGLES)
        for offset in range(len(ALL_ANGLES)):
            candidate = ALL_ANGLES[(start_idx + offset) % len(ALL_ANGLES)]
            if candidate.value not in recent_set:
                chosen_angle = candidate
                break
        if chosen_angle is None:
            chosen_angle = ALL_ANGLES[start_idx]

        short_name = product.name.strip()[:42]
        trend_clean = (product.trend_keyword or "ของใช้ตัวดัง").strip()

        angle_templates = {
            ContentAngle.PAIN_POINT: (
                f"เบื่อปัญหาเดิมๆ ไหม? ตัวนี้จบใน {product.price:,.0f} บาท!",
                (
                    f"ใครเจอปัญหาเดิมๆ ซ้ำๆ บอกเลยว่าต้องลอง {short_name} ตัวนี้เลย "
                    f"ตอนแรกก็ลังเลแต่พอลองใช้จริงคือประหยัดเวลาขึ้นเยอะมาก "
                    f"ค่าตัวแค่ {product.price:,.0f} บาท คุ้มเกินราคา กดดูรายละเอียดที่ตะกร้าเหลืองได้เลย 👇"
                ),
            ),
            ContentAngle.HONEST_REVIEW: (
                f"รีวิวตรงๆ {short_name} คุ้มจริงหรือจกตา?",
                (
                    f"รีวิวแบบไม่อวย {short_name} หลังลองใช้จริง ข้อดีคือใช้งานง่ายและตรงปก "
                    f"ติดนิดเดียวตรงที่ของหมดไวมากรอบโปร ใครกำลังเล็งอยู่ราคา {product.price:,.0f} บาท "
                    f"ถือว่าน่าจัด จิ้มพิกัดตะกร้าด้านล่างได้เลย ✨"
                ),
            ),
            ContentAngle.COMPARISON: (
                f"จ่าย {product.price:,.0f} ได้เท่านี้ เทียบกับรุ่นแพงแล้วอึ้ง!",
                (
                    f"เทียบให้เห็นชัดๆ เลยว่า {short_name} ราคาหลักร้อยแต่ฟีลการใช้งานสู้ตัวแพงได้สบาย "
                    f"เหมาะมากสำหรับสายคุ้มที่ไม่อยากจ่ายเกินจำเป็น ใครอยากลองกดเช็กโปรในตะกร้าเลยครับ 🛒"
                ),
            ),
            ContentAngle.PROBLEM_SOLVER: (
                f"ไอเทมแก้ปัญหาสาย {trend_clean} ที่เพิ่งรู้ว่ามี!",
                (
                    f"เพิ่งรู้ว่ามีตัวช่วยแบบนี้ด้วย! {short_name} ช่วยแก้ปัญหาจุกจิกให้จบแบบไม่ต้องเหนื่อย "
                    f"ราคา {product.price:,.0f} บาท ใช้งานได้ทุกวัน แปะพิกัดร้านแท้ไว้ให้ในตะกร้าแล้วนะ 🔥"
                ),
            ),
        }

        hook_text, caption_th = angle_templates[chosen_angle]

        reasoning_parts = []
        if strengths:
            reasoning_parts.append("จุดแข็ง: " + " / ".join(strengths[:2]))
        if dealbreakers:
            reasoning_parts.append("จุดที่ต้องระวัง: " + " / ".join(dealbreakers[:2]))
        else:
            reasoning_parts.append("ภาพรวมพร้อมดันคลิปสั้นทดสอบตลาดได้ทันที ไม่มีจุดเสี่ยงใหญ่")
        reasoning = " | ".join(reasoning_parts)

        i2v_prompt = (
            f"Vertical 9:16 commercial product showcase of {product.name}. "
            f"Preserve exact product shape, colors, textures, and label details from the reference image without distortion. "
            f"Placed on a clean modern minimalist tabletop with warm natural morning sunlight, soft rim highlights, and shallow depth of field. "
            f"Smooth slow cinematic dolly-in with gentle parallax push-in, crisp 4K commercial studio clarity, realistic shadows, no extra text or watermark."
        )

        trend_tag = "#" + "".join(trend_clean.split())[:24] if trend_clean else "#ของดีบอกต่อ"
        hashtags = [
            trend_tag,
            "#ป้ายยาTikTok",
            "#รีวิวของดี",
            "#ของมันต้องมี",
            "#ShopeeTH",
            "#TikTokShopTH",
        ]

        return AIAnalysisResult(
            demand_score=score,
            buy_probability_reasoning=reasoning,
            content_angle=chosen_angle,
            hook_text=hook_text,
            i2v_video_prompt=i2v_prompt,
            caption_th=caption_th,
            hashtags=hashtags,
        )
