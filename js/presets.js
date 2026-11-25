/* ==========================================================================
   AI Ad Studio TH (Google Flow Edition) — Flow Modes, 5 Styles & Smart Engine
   ========================================================================== */

export const FLOW_MODES = {
  veo3: {
    id: 'veo3',
    name: 'Veo 3',
    tag: 'Audio+Video',
    shortDesc: 'สร้างภาพ + เสียงพูด/SFX/BGM ในตัว ระดับโฆษณา',
    promptDirective:
      'Google Flow Veo 3 (Native Audio + Cinema): include explicit Audio/SFX/Thai Voiceover dialogue cues, crisp foley sounds, natural lip-sync or clear studio narrator cadence, and cinematic micro-motion.',
    actionLabels: [
      'Veo 3 • Ingredients to Video + Native Audio',
      'Veo 3 • Macro Demo + Foley SFX',
      'Veo 3 • Flat-Lay Showcase + Music Swell',
      'Veo 3 • Hero CTA End-Frame + Sound Sting'
    ]
  },
  veo2: {
    id: 'veo2',
    name: 'Veo 2',
    tag: 'Visual B-Roll',
    shortDesc: 'งานภาพคมชัด สโลว์โมชันสมูท เหมาะพากย์เสียงแยก',
    promptDirective:
      'Google Flow Veo 2 (High-Fidelity Visual B-Roll): emphasize silky camera physics, tactile lighting, specular highlights, clean product geometry, and zero text artifacts (voiceover layered separately in post).',
    actionLabels: [
      'Veo 2 • Frames to Video (Fast Hook)',
      'Veo 2 • Smooth Macro Motion',
      'Veo 2 • Overhead Flat-Lay Glide',
      'Veo 2 • Slow-Mo Product Hero Packshot'
    ]
  },
  scenebuilder: {
    id: 'scenebuilder',
    name: 'Scenebuilder',
    tag: 'Jump / Extend',
    shortDesc: 'ตัดต่อต่อเนื่องหลายช็อต ล็อกซีนด้วย Jump To / Extend',
    promptDirective:
      'Google Flow Scenebuilder (Multi-Shot Continuity): design Shot 1 with Ingredients to Video, then chain Shots 2-4 using explicit "Jump To" and "Extend" instructions that preserve exact lighting, wardrobe, table surface, and product orientation.',
    actionLabels: [
      'Scenebuilder • Base Clip (Ingredients to Video)',
      'Scenebuilder • Jump To (Close-Up Hands-On)',
      'Scenebuilder • Jump To (Top-Down Flat-Lay)',
      'Scenebuilder • Extend (Hero Packshot & CTA)'
    ]
  }
};

export const CLIP_STYLES = [
  {
    id: 'fast-hands-on',
    name: 'Fast Hands-On Demo & Flat-Lay',
    isDefault: true,
    shortDesc: 'จังหวะไว โชว์มือจับ-ใช้งานจริง สลับ Flat-Lay จัดวางสินค้าคมชัด ปิดโปรไว',
    englishVibe:
      'Fast-paced hands-on product demonstration alternating with crisp overhead flat-lay composition, energetic commercial cuts, bright tactile studio light, modern Bangkok e-commerce aesthetic'
  },
  {
    id: 'ugc-talking',
    name: 'UGC รีวิวจริงใจ (Talking Head)',
    isDefault: false,
    shortDesc: 'คนใช้จริงเล่าให้เพื่อนฟัง กล้องมือถือธรรมชาติ แสงหน้าต่าง เพิ่มความน่าเชื่อถือ',
    englishVibe:
      'Authentic Thai UGC creator talking-head review filmed on smartphone with natural soft window light, cozy modern Bangkok condo background, candid eye contact, relatable energy'
  },
  {
    id: 'problem-solution',
    name: 'ขยี้ปัญหา-ปิดการขาย (Problem → Solution)',
    isDefault: false,
    shortDesc: 'เปิด 3 วิแรกด้วย Pain Point ตรงจุด ตามด้วยสินค้าแก้ปัญหาเห็นผลชัดทันที',
    englishVibe:
      'High-converting Problem-to-Solution direct response ad: snappy relatable pain-point visual hook in first 3 seconds, dramatic relief transition, clear before/after proof and urgent offer close'
  },
  {
    id: 'asmr-unboxing',
    name: 'ASMR แกะกล่อง & Aesthetic',
    isDefault: false,
    shortDesc: 'เสียงแกะกล่อง-เทเนื้อสินค้าคมชัด ช็อตมาโครละมุนตา ยกระดับพรีเมียม',
    englishVibe:
      'Ultra-tactile ASMR unboxing and sensory macro aesthetic: crisp box seal sound, gentle liquid/texture pour, warm golden sunlight shadows, calm hypnotic luxury pacing'
  },
  {
    id: 'luxury-cinematic',
    name: 'Luxury Cinematic Ad',
    isDefault: false,
    shortDesc: 'โฆษณาแบรนด์พรีเมียม แสง Rim Light กล้องดอลลี่สโลว์โมชัน หรูหราดูแพง',
    englishVibe:
      'High-end luxury commercial cinematography: sculpted rim lighting, moody architectural stone backdrop, precision robotic camera dolly, ultra-crisp 4K macro reflections and effortless elegance'
  }
];

export const SAMPLE_PRODUCTS = {
  serum: {
    url: 'https://example-shop.th/auraglow-vitc-serum',
    name: 'AuraGlow Vit-C 15% Glass Skin Serum',
    benefits:
      'วิตามินซีบริสุทธิ์ 15% + ไนอะซินาไมด์ ผิวฉ่ำโกลว์กระจกใน 7 วัน ซึมไวไม่เหนอะ ลดรอยสิวและจุดด่างดำ สูตรอ่อนโยนไม่มีแอลกอฮอล์',
    pricePromo: 'โปรเปิดตัว 390.- (ปกติ 790.-) ส่งฟรี + แถมขนาดพกพา 1 ขวด',
    audience: 'สาววัยทำงานและนักศึกษาอายุ 20-35 ปี ที่อยากกู้ผิวโทรมให้ไบรท์ฉ่ำ',
    visualDetails:
      'ขวดแก้วสีอำพันหัวดรอปเปอร์สีทอง เนื้อเซรั่มใสสีทองอ่อน หยดฉ่ำเล่นแสง วางคู่ส้มยูซุหั่นซีกและหยดน้ำบนหินอ่อนสีครีม',
    characterAnchor:
      'Young Thai woman in her mid-20s with glowing dewy skin, sleek dark brown shoulder-length hair, wearing a minimalist cream ribbed top, manicured nude nails'
  },
  earbuds: {
    url: 'https://example-shop.th/sonicpulse-anc-pro',
    name: 'SonicPulse Air Pro ANC 48dB',
    benefits:
      'ตัดเสียงรบกวนลึกสุด 48dB คุยชัดไมค์ 6 ตัว แบตอึด 42 ชั่วโมง กันน้ำ IPX5 น้ำหนักเบาใส่สบายทั้งวัน เชื่อมต่อ 2 อุปกรณ์พร้อมกัน',
    pricePromo: 'แฟลชเซล 990.- (จาก 1,890.-) ประกันศูนย์ไทย 1 ปีเต็ม',
    audience: 'คนทำงานออฟฟิศ นักเดินทาง สายคาเฟ่ และคนออกกำลังกายที่ต้องการโฟกัสเงียบสงบ',
    visualDetails:
      'เคสชาร์จสีดำด้านเมทัลลิกขอบไฟ LED สีฟ้า-เขียว หูฟังอินเอียร์ดีไซน์มินิมอล วางบนโต๊ะไม้สีเข้มคู่สมาร์ทโฟนและแก้วกาแฟเย็น',
    characterAnchor:
      'Stylish Thai office creative in late 20s, neat black hair, wearing charcoal smart-casual overshirt and minimalist silver watch'
  },
  coffee: {
    url: 'https://example-shop.th/doi-chang-drip-box',
    name: 'DoiFlow Specialty Drip Coffee (คั่วกลาง-หอมนัตตี้)',
    benefits:
      'เมล็ดอาราบิก้าดอยช้าง Single Origin 100% คั่วสดใหม่ทุกสัปดาห์ หอมกลิ่นคาราเมลและดาร์กช็อกโกแลต ชงง่ายใน 60 วิ ไม่ต้องใช้เครื่อง',
    pricePromo: 'กล่อง 10 ซอง 259.- ซื้อ 2 กล่องลดเหลือ 490.- ส่งฟรีทั่วไทย',
    audience: 'คอกาแฟทำงาน WFH และสายแคมป์ปิ้งที่อยากดื่มกาแฟดริปหอมเหมือนคาเฟ่ทุกเช้า',
    visualDetails:
      'ซองกาแฟดริปสีดำ-ทองคราฟต์มินิมอล แก้วเซรามิกใสเห็นน้ำกาแฟสีอำพันไหลผ่านดริปเปอร์ ควันหอมลอยบางๆ แสงเช้าอุ่นๆ บนโต๊ะไม้โอ๊ค',
    characterAnchor:
      'Warm-toned Thai barista-style lifestyle creator in late 20s wearing an olive linen shirt, clean hands pouring gooseneck kettle'
  }
};

/**
 * Generates a realistic, tailored 0–15s Google Flow + 3 Imagen + Captions plan
 * locally when Demo Mode is used (or when user tests without a Gemini API key).
 */
export function buildLocalStudioPlan(input) {
  const mode = FLOW_MODES[input.flowMode] || FLOW_MODES.veo3;
  const style = CLIP_STYLES.find((s) => s.id === input.clipStyle) || CLIP_STYLES[0];
  const productName = (input.productName || 'AuraGlow Vit-C 15% Glass Skin Serum').trim();
  const benefits = (
    input.benefits ||
    'ใช้งานง่าย เห็นผลไว ดีไซน์พรีเมียม ตอบโจทย์ไลฟ์สไตล์ยุคใหม่'
  ).trim();
  const pricePromo = (input.pricePromo || 'โปรพิเศษวันนี้ ลด 50% ส่งฟรีทันที').trim();
  const visualDetails = (
    input.visualDetails ||
    'Clean modern packaging with crisp specular highlights, aesthetic studio tabletop setup'
  ).trim();
  const aspectRatio = input.aspectRatio || '9:16';

  const hasIng1 = Boolean(input.ingredient1);
  const hasIng2 = Boolean(input.ingredient2);
  const ingRef1 = hasIng1 ? '[@Ingredient1: Uploaded Product Reference]' : `[Product: ${productName}]`;
  const ingRef2 = hasIng2
    ? '[@Ingredient2: Uploaded Presenter/Scene Reference]'
    : `[Presenter: ${input.characterAnchor || 'Young Thai lifestyle presenter, natural warm lighting'}]`;

  const lockAnchorText = input.lockCharacter
    ? `[CHARACTER & SUBJECT LOCK — IDENTICAL ACROSS ALL 4 SHOTS: ${
        input.characterAnchor ||
        'Young Thai creator mid-20s, natural friendly expression, consistent minimalist cream wardrobe, same warm studio daylight, exact product branding from @Ingredient1'
      }]`
    : '[Flexible casting — prioritize product clarity and clean transitions]';

  const lockPrefix = input.lockCharacter
    ? `Keep exact visual continuity of ${ingRef1} and ${ingRef2}. ${lockAnchorText} `
    : `Showcase ${ingRef1} clearly with vibrant commercial polish. `;

  const audioModeNote =
    mode.id === 'veo3'
      ? 'Native Audio ON: Crisp close-mic foley + natural energetic Thai voiceover + subtle modern upbeat lo-fi pop beat.'
      : mode.id === 'veo2'
      ? 'Visual-only B-Roll output (layer Thai voiceover & trending TikTok audio in post-production).'
      : 'Scenebuilder Continuity ON: Maintain identical color grade, tabletop texture, and subject identity between Jump To / Extend cuts.';

  // Tailor narrative beats slightly per clip style
  const styleBeats = {
    'fast-hands-on': {
      s1Title: 'Hook หยุดนิ้ว: หยิบโชว์ระยะใกล้ + จังหวะไว',
      s1Vo: `หยุดเลื่อนก่อน! ใครกำลังมองหา ${productName} ตัวนี้คือจบจริง ไม่จกตา!`,
      s1Text: `ของมันต้องมี! ${productName}`,
      s1Cam: 'Quick whip-in handheld macro to crisp center framing, 24fps snappy commercial cut',
      s1Scene: `Fast energetic hands-on reveal: clean manicured hands pick up ${ingRef1} into center frame with an immediate crisp focus pull. Bright modern Bangkok desk backdrop, sunlit rim highlight.`,
      s2Title: 'Hands-On Demo: สาธิตใช้งานจริงแบบจับต้องได้',
      s2Vo: `ดูความปังของตัวนี้! ${benefits.slice(0, 72)}${benefits.length > 72 ? '...' : ''}`,
      s2Text: 'ใช้งานจริง เห็นผลชัดทันที',
      s2Cam: 'Tight 45-degree close-up tracking hands demonstrating texture/function smoothly',
      s2Scene: `Seamless hands-on demonstration of ${ingRef1} in real action — tactile close-up showing texture, ergonomic grip, and instant satisfying result. Natural daylight bounce, ultra-sharp micro detail.`,
      s3Title: 'Flat-Lay Studio: จัดวางองค์ประกอบสวยคม + โชว์จุดเด่น',
      s3Vo: 'ดีไซน์สวย พกพาง่าย คุ้มค่าเกินราคา ใครได้ลองก็ต้องติดใจ!',
      s3Text: 'ครบจบในชิ้นเดียว • รีวิวแน่น',
      s3Cam: '90-degree overhead Top-Down Flat-Lay slow micro-glide with subtle shadow play',
      s3Scene: `Crisp overhead 90-degree flat-lay composition featuring ${ingRef1} centered neatly among curated minimalist lifestyle props (${visualDetails}). Subtle diagonal sunlight rays across clean matte stone surface.`,
      s4Title: 'Offer & CTA: ปิดการขายด่วน พร้อมพื้นที่วางโปร',
      s4Vo: `รีบกดตะกร้าเลย! ${pricePromo} ของมีจำนวนจำกัด กดสั่งตอนนี้เลย!`,
      s4Text: `${pricePromo} • กดตะกร้าเลย!`,
      s4Cam: 'Hero push-in packshot with clean upper/lower negative space for promo overlay',
      s4Scene: `Hero packshot close-up of ${ingRef1} rotating subtly on a sunlit pedestal with confident presenter hand gesturing subtly near frame edge. Leave clean negative space at top and bottom for Thai promo typography.`
    },
    'ugc-talking': {
      s1Title: 'UGC Hook: ทักเพื่อนแบบคนใช้จริง',
      s1Vo: `แก~ วันนี้มารีวิว ${productName} ที่ใช้จริงแล้วชอบมากจนต้องบอกต่อ!`,
      s1Text: `รีวิวใช้จริง: ${productName}`,
      s1Cam: 'Vertical eye-level smartphone selfie angle, natural window lighting',
      s1Scene: `Relatable Thai UGC creator holds ${ingRef1} casually near cheek while smiling warmly at camera in a sunlit Bangkok condo living room, authentic handheld micro-movement.`,
      s2Title: 'UGC Demo: ลองใช้ให้ดูสดๆ หน้ากล้อง',
      s2Vo: `ที่เลิฟสุดคือ ${benefits.slice(0, 70)} ใช้ง่ายมากทุกวันเลย`,
      s2Text: 'ลองใช้จริงให้ดูชัดๆ',
      s2Cam: 'Medium close-up cut-in showing natural hands-on application/use',
      s2Scene: `Creator naturally demonstrates ${ingRef1} up close toward the lens, genuine impressed expression, soft diffused daylight illuminating realistic texture and packaging.`,
      s3Title: 'UGC Proof: โชว์ผลลัพธ์ + รายละเอียดใกล้ๆ',
      s3Vo: 'ดูใกล้ๆ คือดีงามมาก คุ้มสุดๆ ไม่แปลกใจทำไมคนรีวิวเยอะ!',
      s3Text: 'ของดีบอกต่อ 10/10',
      s3Cam: 'Quick candid macro tilt down to product details & result',
      s3Scene: `Quick candid close-up panning across ${ingRef1} held in creator's palm with soft bokeh background (${visualDetails}), authentic smartphone color science.`,
      s4Title: 'UGC CTA: ป้ายยาปิดจบ กดตะกร้า',
      s4Vo: `แปะพิกัดไว้ให้แล้วนะ ${pricePromo} รีบไปตำก่อนหมด!`,
      s4Text: `พิกัดตะกร้าเหลือง • ${pricePromo}`,
      s4Cam: 'Friendly wave + product held clearly in lower-center frame',
      s4Scene: `Creator smiles warmly pointing gently toward lower frame while holding ${ingRef1} steady in sharp focus, cozy sunlit room, clean headroom for promo badge.`
    },
    'problem-solution': {
      s1Title: 'Pain Point Hook: ขยี้ปัญหาใน 3 วิแรก',
      s1Vo: 'เบื่อไหมกับปัญหาเดิมๆ ที่แก้เท่าไหร่ก็ไม่จบสักที? ลองดูนี่!',
      s1Text: 'เจอปัญหานี้อยู่ใช่ไหม?',
      s1Cam: 'Dynamic push-in medium shot, slightly desaturated cool mood shifting bright',
      s1Scene: `Relatable Thai presenter looks mildly frustrated with everyday hassle in dim cool light, then bright warm light snaps in as ${ingRef1} enters frame dramatically.`,
      s2Title: 'Solution Reveal: เปิดตัวพระเอกแก้ปัญหา',
      s2Vo: `นี่เลย ${productName}! ${benefits.slice(0, 72)}`,
      s2Text: `จบทุกปัญหาด้วย ${productName}`,
      s2Cam: 'Crisp high-energy hero orbit & macro highlight',
      s2Scene: `Dynamic commercial reveal of ${ingRef1} with clean crisp lighting shift to vibrant warm daylight, hands demonstrating key feature smoothly and effortlessly.`,
      s3Title: 'Proof & Comparison: เห็นความต่างชัดเจน',
      s3Vo: 'ใช้งานจริงแค่ไม่กี่วิ เห็นความต่างแบบชัดเจน มั่นใจได้ทุกวัน!',
      s3Text: 'เห็นผลต่างชัดเจนตั้งแต่ครั้งแรก',
      s3Cam: 'Smooth split-feel pan from usage action to clean flat-lay proof',
      s3Scene: `Confident result showcase alongside crisp studio arrangement of ${ingRef1} (${visualDetails}), glowing highlights reinforcing immediate visible satisfaction.`,
      s4Title: 'Urgent CTA: ปิดการขายด้วยโปรแรง',
      s4Vo: `อย่ารอช้า! ${pricePromo} กดสั่งซื้อที่ตะกร้าตอนนี้เลย!`,
      s4Text: `${pricePromo} (ด่วน!)`,
      s4Cam: 'Confident slow push-in hero packshot with sharp contrast',
      s4Scene: `Bold high-contrast commercial end-frame of ${ingRef1} gleaming under studio rim light with clean composition tailored for bold CTA sticker.`
    },
    'asmr-unboxing': {
      s1Title: 'ASMR Hook: แกะซีล & เปิดกล่องฟินๆ',
      s1Vo: '(เสียงแกะกล่องคมชัด) เปิดกล่องความละมุนไปกับ ' + productName,
      s1Text: `ASMR Unboxing • ${productName}`,
      s1Cam: 'Ultra-close macro top-angle, shallow depth of field f/2.0',
      s1Scene: `Intimate macro shot of delicate hands peeling seal and sliding open box to reveal ${ingRef1} nestled in sleek packaging, warm golden window rays, crisp dust motes.`,
      s2Title: 'Sensory Texture: สัมผัสเนื้อ/ดีเทลแบบมาโคร',
      s2Vo: `สัมผัสพรีเมียมทุกดีเทล ${benefits.slice(0, 66)}`,
      s2Text: 'ดีเทลพรีเมียม สัมผัสละมุน',
      s2Cam: 'Slow hypnotic 60fps-feel macro glide across texture and surfaces',
      s2Scene: `Extreme close-up tactile sensory showcase of ${ingRef1} — gentle tap, smooth glide, subtle shimmer of textures (${visualDetails}) with dreamy bokeh.`,
      s3Title: 'Aesthetic Flat-Lay: จัดโต๊ะสไตล์มินิมอล',
      s3Vo: 'วางตรงไหนก็ดูดี ใช้งานฟินทุกวันเหมือนอยู่คาเฟ่หรู',
      s3Text: 'Aesthetic 100% ทุกมุมมอง',
      s3Cam: 'Slow overhead float with gentle dappled leaf shadows',
      s3Scene: `Serene aesthetic flat-lay of ${ingRef1} on warm travertine stone with soft moving botanical shadow patterns and subtle golden light reflection.`,
      s4Title: 'Calm Luxury CTA: ปิดจบละมุน ชวนกด',
      s4Vo: `ให้รางวัลตัวเองวันนี้ ${pricePromo} กดตะกร้าด้านล่างได้เลย`,
      s4Text: `${pricePromo} • กดสั่งเลย`,
      s4Cam: 'Gentle slow push-in hero still-life with warm glow',
      s4Scene: `Minimalist gallery-like hero frame of ${ingRef1} bathed in golden-hour light, peaceful refined negative space ready for clean Thai price callout.`
    },
    'luxury-cinematic': {
      s1Title: 'Cinematic Open: เปิดซีนแสง Rim Light ระดับแบรนด์ดัง',
      s1Vo: `ยกระดับมาตรฐานใหม่แห่งความเหนือระดับกับ ${productName}`,
      s1Text: `NEW STANDARD • ${productName}`,
      s1Cam: 'Low-angle precision cinema dolly reveal, anamorphic lens flare hint',
      s1Scene: `Dramatic luxury commercial reveal of ${ingRef1} emerging from sculpted dark architectural shadows into crisp golden-white rim light, subtle atmospheric sheen.`,
      s2Title: 'Precision Craft: โชว์งานดีไซน์และประสิทธิภาพ',
      s2Vo: `${benefits.slice(0, 76)} ออกแบบมาเพื่อคุณโดยเฉพาะ`,
      s2Text: 'CRAFTED FOR EXCELLENCE',
      s2Cam: 'Robotic smooth macro arc tracking glistening edges and presenter interaction',
      s2Scene: `Ultra-crisp luxury macro motion as poised hands glide ${ingRef1} across polished dark marble, studio specular reflections dancing across packaging (${visualDetails}).`,
      s3Title: 'Editorial Lifestyle: ภาพลักษณ์พรีเมียมน่าเชื่อถือ',
      s3Vo: 'มั่นใจทุกช่วงเวลา สัมผัสความแตกต่างที่เหนือกว่าอย่างแท้จริง',
      s3Text: 'PREMIUM QUALITY GUARANTEED',
      s3Cam: 'Cinematic 50mm shallow DOF slow-motion editorial portrait + product',
      s3Scene: `Editorial high-fashion lifestyle shot featuring presenter with ${ingRef1} in sleek modern penthouse lighting, refined color grading, rich filmic contrast.`,
      s4Title: 'Prestige CTA: ปิดท้ายหรูหราพร้อมข้อเสนอพิเศษ',
      s4Vo: `เป็นเจ้าของได้แล้ววันนี้ ${pricePromo} สั่งซื้อเลย`,
      s4Text: `${pricePromo} • SHOP NOW`,
      s4Cam: 'Locked symmetrical luxury packshot push-in, subtle light sweep',
      s4Scene: `Iconic symmetrical luxury hero packshot of ${ingRef1} centered on sleek dark monolith with soft light sweep across logo, generous clean framing for luxury CTA.`
    }
  };

  const b = styleBeats[style.id] || styleBeats['fast-hands-on'];

  const slides = [
    {
      index: 1,
      timecode: '00:00 - 00:03',
      shortTime: '0–3s',
      role: 'HOOK / หยุดนิ้ว',
      title: b.s1Title,
      flowAction: mode.actionLabels[0],
      prompt: `${lockPrefix}${b.s1Scene} Style: ${style.englishVibe}. Camera: ${b.s1Cam}. Aspect ratio ${aspectRatio}, photorealistic 4K commercial quality, zero distorted text or garbled logos. ${
        mode.id === 'veo3'
          ? `Audio: Crisp tactile pickup sound + upbeat Thai narrator saying "${b.s1Vo}"`
          : ''
      }`.trim(),
      voiceover: b.s1Vo,
      audioCue:
        mode.id === 'veo3'
          ? 'SFX: Crisp whoosh + tactile tap • BGM: Modern Thai pop-beat intro (118 BPM) • VO ชัดใส'
          : 'แนะนำใส่เสียง SFX "Pop/Whoosh" เปิดคลิป + พากย์เสียงจังหวะกระชับ',
      camera: b.s1Cam,
      onScreenText: b.s1Text,
      continuityNote:
        mode.id === 'scenebuilder'
          ? 'เริ่มจากอัปโหลด Ingredient 1+2 ในโหมด Ingredients to Video เพื่อตั้งค่าแสงและตัวละครฐาน (Base Clip)'
          : 'ตั้งค่าแสงและมุมมองสินค้าให้ชัดตั้งแต่เฟรมแรก เพื่อดึงความสนใจใน 1.5 วินาทีแรก'
    },
    {
      index: 2,
      timecode: '00:03 - 00:07',
      shortTime: '3–7s',
      role: 'DEMO / โชว์จุดเด่น',
      title: b.s2Title,
      flowAction: mode.actionLabels[1],
      prompt: `${lockPrefix}${
        mode.id === 'scenebuilder'
          ? 'Jump To tight hands-on demonstration preserving identical lighting, skin tone, wardrobe, and product appearance from previous clip. '
          : ''
      }${b.s2Scene} Highlight key benefit visually: ${benefits.slice(0, 90)}. Camera: ${b.s2Cam}. Aspect ratio ${aspectRatio}, crisp macro detail, natural skin and material physics. ${
        mode.id === 'veo3'
          ? `Audio: Subtle realistic usage foley + enthusiastic Thai voiceover "${b.s2Vo}"`
          : ''
      }`.trim(),
      voiceover: b.s2Vo,
      audioCue:
        mode.id === 'veo3'
          ? 'SFX: Real texture/usage foley • BGM: Steady groove • VO เน้นคำจุดขาย'
          : 'ตัดจังหวะภาพตรงบีทเพลง พร้อมใส่ Pop-up ไอคอนสรุปสรรพคุณ 2-3 ข้อ',
      camera: b.s2Cam,
      onScreenText: b.s2Text,
      continuityNote:
        mode.id === 'scenebuilder'
          ? 'กด "Jump To" จากคลิป Shot 1 ใน Scenebuilder แล้ววางพรอมนี้เพื่อสลับมุมโคลสอัปโดยไม่หลุดโทนสี'
          : 'รักษาโทนสีแสงธรรมชาติให้ต่อเนื่องจากช็อต 1 เพื่อให้จังหวะตัดต่อลื่นไหล'
    },
    {
      index: 3,
      timecode: '00:07 - 00:11',
      shortTime: '7–11s',
      role: 'FLAT-LAY & PROOF',
      title: b.s3Title,
      flowAction: mode.actionLabels[2],
      prompt: `${lockPrefix}${
        mode.id === 'scenebuilder'
          ? 'Jump To aesthetic showcase / overhead flat-lay retaining identical color palette, surface props, and exact @Ingredient1 design. '
          : ''
      }${b.s3Scene} Camera: ${b.s3Cam}. Aspect ratio ${aspectRatio}, studio-grade sharpness, clean depth and natural reflections. ${
        mode.id === 'veo3'
          ? `Audio: Gentle shimmer transition + warm confident Thai voiceover "${b.s3Vo}"`
          : ''
      }`.trim(),
      voiceover: b.s3Vo,
      audioCue:
        mode.id === 'veo3'
          ? 'SFX: Soft aesthetic chime • BGM: Uplifting chorus swell • VO มั่นใจน่าเชื่อถือ'
          : 'จังหวะโชว์ภาพสวยนิ่งคม เหมาะวางดาวรีวิว 4.9★ หรือคำรับรองสั้นๆ',
      camera: b.s3Cam,
      onScreenText: b.s3Text,
      continuityNote:
        mode.id === 'scenebuilder'
          ? 'ใช้ "Jump To" เปลี่ยนมุมเป็น Flat-Lay / Lifestyle เพื่อเพิ่มความน่าเชื่อถือและมิติภาพ'
          : 'คุมฉากหลังให้สะอาดตา เพื่อให้ข้อความรีวิวหรือจุดเด่นอ่านง่ายบนจอมือถือ'
    },
    {
      index: 4,
      timecode: '00:11 - 00:15',
      shortTime: '11–15s',
      role: 'OFFER & CTA / ปิดการขาย',
      title: b.s4Title,
      flowAction: mode.actionLabels[3],
      prompt: `${lockPrefix}${
        mode.id === 'scenebuilder'
          ? 'Extend seamlessly into locked hero packshot end-frame with consistent warm studio glow. '
          : ''
      }${b.s4Scene} Camera: ${b.s4Cam}. Aspect ratio ${aspectRatio}, ultra-clean commercial packshot finish, plenty of uncluttered space for price sticker. ${
        mode.id === 'veo3'
          ? `Audio: Bright checkout bell sting + upbeat closing Thai CTA "${b.s4Vo}"`
          : ''
      }`.trim(),
      voiceover: b.s4Vo,
      audioCue:
        mode.id === 'veo3'
          ? 'SFX: Bright notification/checkout chime • BGM: Crisp resolve ending • VO เร่งตัดสินใจ'
          : 'ใส่สติกเกอร์ราคาโปร + ลูกศรชี้ตะกร้า/ลิงก์ใน 2 วินาทีสุดท้าย',
      camera: b.s4Cam,
      onScreenText: b.s4Text,
      continuityNote:
        mode.id === 'scenebuilder'
          ? 'กด "Extend" จากช็อตก่อนหน้าให้จบนิ่งที่ตัวสินค้า 2 วิสุดท้าย เพื่อให้คนดูอ่านโปรทัน'
          : 'เผื่อพื้นที่ด้านล่าง 25% สำหรับ UI ปุ่มตะกร้า TikTok / Reels ไม่ให้บังตัวสินค้า'
    }
  ];

  const imagenPrompts = [
    {
      id: 1,
      title: 'Imagen Shot 1: Hero Commercial & ปกคลิปหยุดนิ้ว (Thumbnail)',
      ratio: aspectRatio,
      purpose: 'ใช้ทำหน้าปกคลิป (Cover) หรือภาพยิงแอดหลัก หยุดนิ้วตั้งแต่แรกเห็น',
      prompt: `Commercial advertising hero photography of ${productName}, ${visualDetails}. ${
        input.lockCharacter
          ? `Consistent subject reference: ${
              input.characterAnchor || 'modern Thai lifestyle aesthetic'
            }.`
          : ''
      } Dramatic crisp studio rim lighting, subtle floating micro highlights, clean minimalist stone surface, shallow depth of field 85mm f/1.8 lens, photorealistic editorial campaign quality, razor-sharp product focus, clean upper negative space for Thai headline typography, aspect ratio ${aspectRatio}, no garbled text, no watermark.`
    },
    {
      id: 2,
      title: 'Imagen Shot 2: Lifestyle Hands-On / ใช้งานจริงน่าเชื่อถือ',
      ratio: '4:5',
      purpose: 'ใช้เป็น Ingredient Reference หรือโพสต์รีวิว/คาร์รูเซลให้ดูสมจริงเข้าถึงง่าย',
      prompt: `Authentic high-end Thai lifestyle hands-on photography showing ${
        input.characterAnchor || 'a young Thai creator with warm natural skin tone'
      } holding and using ${productName} in a sunlit modern Bangkok studio apartment. Soft natural window light, candid genuine smile, tactile focus on product texture and ergonomic design, Kodak Portra 400 clean commercial color grading, 50mm lens f/2.0, realistic skin texture, crisp product label integrity, aspect ratio 4:5, no distorted fingers, no watermark.`
    },
    {
      id: 3,
      title: 'Imagen Shot 3: Aesthetic Studio Flat-Lay / พร้อมพื้นที่วางโปร',
      ratio: '1:1',
      purpose: 'ใช้ลง Shopee / Lazada / IG Feed / Line OA Broadcast พร้อมวางป้ายราคาโปรโมชัน',
      prompt: `Ultra-clean 90-degree top-down overhead studio flat-lay photography of ${productName} arranged symmetrically with tasteful complementary props (${visualDetails}) on a matte warm beige travertine surface. Crisp diagonal morning sunlight casting soft architectural shadows, high-craft e-commerce composition with intentional clean margin space on right and bottom for promotional badge, 100MP medium-format sharpness, true-to-life color accuracy, aspect ratio 1:1, zero artifacts.`
    }
  ];

  const firstToken = productName.split(/\s+/)[0] || '';
  const cleanTag = firstToken.replace(/[^a-zA-Z0-9ก-๙]/g, '').slice(0, 20);

  const captions = [
    {
      platform: 'TikTok / Reels (สั้น กระชับ ปิดไว)',
      badge: 'Conversion Hook',
      text: `ของมันต้องมีจริงๆ ตัวนี้! 🔥 ${productName}\n✨ ${benefits.slice(0, 95)}\n💥 ${pricePromo}\n👇 กดตะกร้าด้านล่างได้เลย ของหมดไวมาก!`
    },
    {
      platform: 'Facebook / Instagram (เล่าเรื่อง ขยี้จุดเด่น)',
      badge: 'Storytelling Ad',
      text: `ใครกำลังมองหาตัวช่วยดีๆ ที่ใช้แล้วเห็นผลจริง ต้องลอง ${productName} เลยครับ/ค่ะ ✨\n\n✅ จุดเด่นที่หลายคนติดใจ:\n• ${benefits}\n• ดีไซน์สวย ใช้งานง่าย ตอบโจทย์ทุกวัน\n\n🎁 โปรพิเศษตอนนี้: ${pricePromo}\nทักแชทหรือกดลิงก์สั่งซื้อได้เลยวันนี้ ก่อนปรับราคาปกติ!`
    },
    {
      platform: 'Shopee Video / Line OA (เน้นโปร & รีบกด)',
      badge: 'Flash Promo',
      text: `⚡ FLASH DEAL พิเศษสำหรับวันนี้เท่านั้น!\n${productName} — ${pricePromo}\n\nคัดมาแล้วว่าคุ้มจริง ใช้งานดี รีวิวแน่น 💯\n👉 กดเก็บโค้ดและสั่งซื้อทันทีจากตะกร้าในคลิปได้เลย!`
    }
  ];

  const hashtags = [
    `#${cleanTag || 'สินค้าขายดี'}`,
    '#รีวิวของดี',
    '#ป้ายยาTikTok',
    '#ของมันต้องมี',
    '#รีวิวบิวตี้ไลฟ์สไตล์',
    '#ใช้ดีบอกต่อ',
    '#โปรโมชั่นพิเศษ',
    '#TikTokShopTH',
    '#GoogleFlow',
    '#Veo3',
    '#AIAdStudioTH',
    '#คลิปขายของ15วิ'
  ];

  return {
    source: 'demo',
    modelLabel: 'Demo Engine (พร้อมเชื่อมต่อ gemini-3.8-flash)',
    productName,
    flowMode: mode.id,
    flowModeName: `${mode.name} (${mode.tag})`,
    clipStyleId: style.id,
    clipStyleName: style.name,
    aspectRatio,
    lockCharacter: Boolean(input.lockCharacter),
    characterAnchor: lockAnchorText,
    audioModeNote,
    slides,
    imagenPrompts,
    captions,
    hashtags
  };
}
