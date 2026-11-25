# AI Ad Studio TH (Google Flow Edition)

เว็บแอปสำหรับสร้างพรอมภาพนิ่ง **Imagen** และสคริปต์/พรอมคลิปขายของ **15 วินาที** สำหรับ **Google Flow (Veo 3 / Veo 2 / Scenebuilder)**

🌐 **Live Demo:** https://joyboy2680.github.io/ai-ad-studio-th/

## ฟีเจอร์ครบชุด

- **Dark Mode Glassmorphism Studio:** พื้นหลัง `#09090b`, การ์ด Glassmorphism `#18181f` พร้อมขอบไล่สี Google 4 สี (`#4285F4`, `#EA4335`, `#FBBC05`, `#34A853`), ฟอนต์ `Prompt` + `JetBrains Mono` และเลย์เอาต์ 12-column สัดส่วน `5:7`
- **AI Auto-Fill จากลิงก์สินค้า:** เชื่อมต่อ `gemini-3.8-flash` (รองรับ Auto-Fallback `gemini-3.5-flash-lite` / `gemini-3.6-flash`) พร้อม **Google Search Grounding** (`google_search`) ดึงข้อมูลสินค้า จุดเด่น ราคา และรายละเอียดภาพอัตโนมัติ
- **Ingredient 1 + Ingredient 2 (บีบอัดอัตโนมัติ ≤ 640px):** อัปโหลดรูปสินค้าและพรีเซนเตอร์/ฉาก รองรับลากวาง (Drag & Drop) ย่อขนาดฝั่งเบราว์เซอร์ไม่เกิน `640px` เพื่อส่งเข้า Gemini Vision ได้รวดเร็ว
- **ล็อกตัวละครทุกช็อต (Character & Subject Lock):** ฝัง Visual Anchor และแท็ก `@Ingredient1` / `@Ingredient2` ให้คงความต่อเนื่องตลอด 0–15 วิ
- **3 โหมด Google Flow:** `Veo 3 (Audio+Video)`, `Veo 2 (Visual B-Roll)`, `Scenebuilder (Jump / Extend)`
- **5 แนวทางคลิป 15 วิ:** ค่าเริ่มต้น `Fast Hands-On Demo & Flat-Lay`, `UGC รีวิวจริงใจ`, `ขยี้ปัญหา-ปิดการขาย`, `ASMR แกะกล่อง & Aesthetic`, `Luxury Cinematic Ad`
- **ประมวลผลไว `thinkingLevel: LOW` + Progress Bar 15 วิ:** แสดงสถานะการทำงานตามช่วงเวลา 0–15 วินาทีแบบเรียลไทม์
- **ฝั่งขวา 4 แท็บ + Copy All:**
  1. **สไลด์คลิป 0-15 วิ** (รองรับปุ่มลูกศร, คีย์บอร์ด `←`/`→`, และการปัด Swipe)
  2. **พรอมภาพนิ่ง 3** (Imagen 3 / 4: Hero, Lifestyle, Flat-Lay)
  3. **แคปชั่น & #** (TikTok/Reels, Facebook/IG, Shopee/Line OA + แฮชแท็ก)
  4. **ดูไทม์ไลน์ทั้งหมด** (มุมมองไทม์ไลน์ 0–15 วิครบทุกช็อต + ปุ่ม **Copy All** และ Export `.TXT`)
  5. **ภาพ UGC 4 ช่อง (1:1 → Google Drive)** วิเคราะห์ลิงก์สินค้า → สร้าง Prompt ตาราง 4 ช่องไม่มีเส้นคั่น สไตล์ UGC ไม่มีตัวละคร เน้นใช้งานจริง + Text ภาษาไทยลายมือ → สร้างภาพใน Gemini (Nano Banana 2 / Pro / Lite) หรือพรีวิว Canvas 1080×1080 → บันทึกเข้า Google Drive อัตโนมัติ (Apps Script Web App / Drive OAuth API)

## วิธีใช้งาน

1. เปิดใช้งานได้ทันทีที่ https://joyboy2680.github.io/ai-ad-studio-th/
2. สามารถทดลองใช้งานได้ทันทีในโหมด Demo หรือใส่ **Gemini API Key** (จาก [Google AI Studio](https://aistudio.google.com/apikey)) ที่แถบด้านบนเพื่อใช้ `gemini-3.8-flash` + Google Search Grounding + Vision แบบเรียลไทม์ (API Key ถูกเก็บไว้เฉพาะใน `localStorage` ของเบราว์เซอร์คุณ)
