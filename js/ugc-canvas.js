/* ==========================================================================
   AI Ad Studio TH — 1:1 Seamless 2x2 UGC Canvas Preview Composer
   Generates a 1080x1080 edge-to-edge 4-panel UGC review PNG with zero
   dividers, warm lifestyle tone, and Thai handwritten typography (Mali/Sriracha).
   ========================================================================== */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawRoundedSticker(ctx, x, y, text, angleDeg, bg, fg) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);

  ctx.font = '600 32px "Mali", "Sriracha", "Prompt", sans-serif';
  const metrics = ctx.measureText(text);
  const padX = 22;
  const padY = 14;
  const w = Math.min(460, metrics.width + padX * 2);
  const h = 58;

  // Soft realistic paper shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 18);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 2, w - padX);
  ctx.restore();
}

function drawHandDrawnDoodle(ctx, x, y, type, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(-24, -12);
    ctx.quadraticCurveTo(0, -18, 22, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 12);
    ctx.lineTo(23, 11);
    ctx.lineTo(20, -2);
    ctx.stroke();
  } else if (type === 'sparkle') {
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.quadraticCurveTo(2, -2, 16, 0);
    ctx.quadraticCurveTo(2, 2, 0, 16);
    ctx.quadraticCurveTo(-2, 2, -16, 0);
    ctx.quadraticCurveTo(-2, -2, 0, -16);
    ctx.fill();
  } else if (type === 'heart') {
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.bezierCurveTo(-18, -4, -14, -20, 0, -8);
    ctx.bezierCurveTo(14, -20, 18, -4, 0, 10);
    ctx.stroke();
  } else {
    // 5-point tiny hand-drawn star
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a1 = ((i * 72 - 90) * Math.PI) / 180;
      const a2 = (((i * 72 + 36) - 90) * Math.PI) / 180;
      if (i === 0) ctx.moveTo(Math.cos(a1) * 14, Math.sin(a1) * 14);
      else ctx.lineTo(Math.cos(a1) * 14, Math.sin(a1) * 14);
      ctx.lineTo(Math.cos(a2) * 6, Math.sin(a2) * 6);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Renders a 1080x1080 seamless 2x2 UGC grid PNG (zero divider lines between panels).
 */
export async function renderUgc4GridCanvas({
  productName = 'สินค้าแนะนำ',
  panels = [],
  ingredient1 = null,
  extraImages = []
}) {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const size = 1080;
  const half = size / 2; // 540px each — zero divider lines
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const candidateDataUrls = [];
  if (ingredient1?.dataUrl) candidateDataUrls.push(ingredient1.dataUrl);
  for (const extra of extraImages || []) {
    if (extra?.dataUrl && !candidateDataUrls.includes(extra.dataUrl)) {
      candidateDataUrls.push(extra.dataUrl);
    }
    if (candidateDataUrls.length >= 4) break;
  }

  const loadedImgs = [];
  for (const src of candidateDataUrls) {
    try {
      loadedImgs.push(await loadImage(src));
    } catch {
      // skip failed image
    }
  }
  const refImg = loadedImgs[0] || null;

  // Warm candid UGC room palettes (no studio harshness, seamless transitions)
  const quadrantThemes = [
    {
      bg1: '#e8dccb',
      bg2: '#cbb79f',
      zoom: 1.06,
      offsetX: -0.04,
      offsetY: 0.02,
      stickerBg: 'rgba(255, 252, 245, 0.92)',
      stickerFg: '#292524',
      angle: -2.2,
      doodle: 'arrow',
      doodleColor: '#ea580c'
    },
    {
      bg1: '#dfe6dc',
      bg2: '#b9c6b4',
      zoom: 1.45,
      offsetX: 0.06,
      offsetY: -0.05,
      stickerBg: 'rgba(254, 249, 195, 0.94)',
      stickerFg: '#3f2e18',
      angle: 1.8,
      doodle: 'sparkle',
      doodleColor: '#eab308'
    },
    {
      bg1: '#ede2d8',
      bg2: '#d5c1b0',
      zoom: 1.22,
      offsetX: -0.06,
      offsetY: 0.06,
      stickerBg: 'rgba(255, 255, 255, 0.92)',
      stickerFg: '#1c1917',
      angle: 1.4,
      doodle: 'heart',
      doodleColor: '#e11d48'
    },
    {
      bg1: '#e6dfd7',
      bg2: '#c5b8aa',
      zoom: 1.12,
      offsetX: 0.03,
      offsetY: -0.02,
      stickerBg: 'rgba(220, 252, 231, 0.94)',
      stickerFg: '#14532d',
      angle: -1.6,
      doodle: 'star',
      doodleColor: '#f59e0b'
    }
  ];

  const coords = [
    { x: 0, y: 0 },
    { x: half, y: 0 },
    { x: 0, y: half },
    { x: half, y: half }
  ];

  for (let i = 0; i < 4; i += 1) {
    const { x, y } = coords[i];
    const theme = quadrantThemes[i];
    const panelInfo = panels[i] || {};
    const thaiText = panelInfo.thaiText || `รีวิวจริง ช่อง ${i + 1} ✨`;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, half, half);
    ctx.clip();

    // Cozy ambient daylight background
    const grad = ctx.createLinearGradient(x, y, x + half, y + half);
    grad.addColorStop(0, theme.bg1);
    grad.addColorStop(1, theme.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, half, half);

    // Subtle organic window sunlight ray
    const sun = ctx.createRadialGradient(
      x + half * 0.25,
      y + half * 0.2,
      20,
      x + half * 0.3,
      y + half * 0.3,
      half * 0.95
    );
    sun.addColorStop(0, 'rgba(255, 250, 235, 0.42)');
    sun.addColorStop(1, 'rgba(255, 250, 235, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(x, y, half, half);

    const panelImg = loadedImgs[i] || refImg;
    if (panelImg) {
      // Draw real uploaded/fetched product image per quadrant
      const scale = Math.max(half / panelImg.width, half / panelImg.height) * theme.zoom;
      const drawW = panelImg.width * scale;
      const drawH = panelImg.height * scale;
      const drawX = x + (half - drawW) / 2 + half * theme.offsetX;
      const drawY = y + (half - drawH) / 2 + half * theme.offsetY;
      ctx.drawImage(panelImg, drawX, drawY, drawW, drawH);

      // Gentle warm UGC film tint
      ctx.fillStyle = 'rgba(255, 245, 225, 0.08)';
      ctx.fillRect(x, y, half, half);
    } else {
      // Clean everyday tabletop silhouette card if no product image uploaded yet
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.beginPath();
      ctx.roundRect(x + 95, y + 115, half - 190, half - 235, 32);
      ctx.fill();

      ctx.fillStyle = '#44403c';
      ctx.font = '600 26px "Prompt", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(productName.slice(0, 22), x + half / 2, y + half / 2 - 12);
      ctx.font = '400 18px "Prompt", sans-serif';
      ctx.fillStyle = '#78716c';
      ctx.fillText(`POV Shot #${i + 1}`, x + half / 2, y + half / 2 + 24);
    }

    // Subtle bottom readability vignette
    const vig = ctx.createLinearGradient(x, y + half * 0.65, x, y + half);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(20,16,12,0.22)');
    ctx.fillStyle = vig;
    ctx.fillRect(x, y, half, half);

    // Cute Thai handwritten sticker & doodle (strictly inside quadrant, zero dividers)
    const stickerY = i < 2 ? y + half - 66 : y + half - 62;
    drawRoundedSticker(
      ctx,
      x + half / 2,
      stickerY,
      thaiText,
      theme.angle,
      theme.stickerBg,
      theme.stickerFg
    );
    drawHandDrawnDoodle(ctx, x + half - 66, y + 62, theme.doodle, theme.doodleColor);

    ctx.restore();
  }

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  return {
    modelId: 'UGC Canvas Composer (1080×1080)',
    mimeType: 'image/png',
    base64,
    dataUrl
  };
}
