/* ===========================
   CANVAS UTILITIES & DRAWING FUNCTIONS
   ============================ */

const VISUAL_HANDLE_SIZE = 30;
const TOUCH_HANDLE_SIZE = 80;
const MAX_DIMENSION = 4096;
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const COLLAGE_LIMIT = 5;
const COLLAGE_MAX_DIMENSION = 3072;

function getSourceWidth(sourceImage, isUsingCanvasSource) {
  if (!sourceImage) return 0;
  return isUsingCanvasSource ? sourceImage.width : sourceImage.naturalWidth;
}

function getSourceHeight(sourceImage, isUsingCanvasSource) {
  if (!sourceImage) return 0;
  return isUsingCanvasSource ? sourceImage.height : sourceImage.naturalHeight;
}

function buildStampText(stamp) {
  if (!stamp) return '';

  let text = '';
  if (stamp.showDate) {
    const dt = new Date(stamp.dateTime);
    if (!isNaN(dt)) {
      const pad = (n) => n.toString().padStart(2, '0');
      text += `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    }
  }

  const loc = (stamp.location || '').trim();
  if (loc) {
    if (text) text += '\n';
    text += loc;
  }

  return text;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + (i * lineHeight), maxWidth);
  }
}

function getStampFont(stamp) {
  return `bold ${stamp.size}px "${stamp.fontFamily}"`;
}

function getTextBoundingBox(ctx, stamp) {
  if (!ctx || !stamp) return null;

  const text = buildStampText(stamp);
  if (!text.trim()) return null;

  const lines = text.split('\n');
  const lineHeight = stamp.size * 1.25;

  ctx.save();
  ctx.font = getStampFont(stamp);

  let maxWidth = 0;
  lines.forEach((line) => {
    const metrics = ctx.measureText(line);
    if (metrics.width > maxWidth) maxWidth = metrics.width;
  });

  ctx.restore();

  return {
    x: stamp.x,
    y: stamp.y - stamp.size,
    w: maxWidth,
    h: lines.length * lineHeight
  };
}

function isPointInTextArea(posX, posY, ctx, stamp) {
  const bbox = getTextBoundingBox(ctx, stamp);
  if (!bbox) return false;

  const padding = 40;
  return (
    posX >= bbox.x - padding &&
    posX <= bbox.x + bbox.w + padding &&
    posY >= bbox.y - padding &&
    posY <= bbox.y + bbox.h + padding
  );
}

function getTopStampAtPosition(posX, posY, ctx, stamps) {
  for (let i = stamps.length - 1; i >= 0; i--) {
    if (isPointInTextArea(posX, posY, ctx, stamps[i])) {
      return stamps[i];
    }
  }
  return null;
}

function drawSelectedStampOutline(ctx, stamp) {
  const bbox = getTextBoundingBox(ctx, stamp);
  if (!bbox) return;

  ctx.save();
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.95)';
  ctx.lineWidth = Math.max(2, stamp.size * 0.05);
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(bbox.x - 10, bbox.y - 10, bbox.w + 20, bbox.h + 20);
  ctx.restore();
}

function getHitRegion(x, y, cropRect, viewScale) {
  if (!cropRect) return null;

  const hitSize = TOUCH_HANDLE_SIZE / viewScale;
  const halfHit = hitSize / 2;

  const l = cropRect.x;
  const cX = cropRect.x + cropRect.w / 2;
  const r = cropRect.x + cropRect.w;
  const t = cropRect.y;
  const cY = cropRect.y + cropRect.h / 2;
  const b = cropRect.y + cropRect.h;

  const check = (tx, ty) => (
    x >= tx - halfHit && x <= tx + halfHit &&
    y >= ty - halfHit && y <= ty + halfHit
  );

  if (check(l, t)) return 'nw';
  if (check(cX, t)) return 'n';
  if (check(r, t)) return 'ne';
  if (check(r, cY)) return 'e';
  if (check(r, b)) return 'se';
  if (check(cX, b)) return 's';
  if (check(l, b)) return 'sw';
  if (check(l, cY)) return 'w';
  if (x > l && x < r && y > t && y < b) return 'move';

  return null;
}

function getDist(touches) {
  return Math.hypot(
    touches[0].clientX - touches[1].clientX,
    touches[0].clientY - touches[1].clientY
  );
}

function getPos(clientX, clientY, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function drawCropUI(ctx, canvas, cropRect, viewScale) {
  if (!cropRect) return;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.rect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
  ctx.clip('evenodd');
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 4 / viewScale;
  ctx.setLineDash([]);
  ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 / viewScale;
  ctx.setLineDash([12, 6]);
  ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);

  ctx.setLineDash([]);
  const vHandle = VISUAL_HANDLE_SIZE / viewScale;
  const halfH = vHandle / 2;

  ctx.fillStyle = '#3b82f6';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2 / viewScale;

  const drawH = (cx, cy) => {
    ctx.beginPath();
    ctx.rect(cx - halfH, cy - halfH, vHandle, vHandle);
    ctx.fill();
    ctx.stroke();
  };

  const l = cropRect.x;
  const cX = cropRect.x + cropRect.w / 2;
  const r = cropRect.x + cropRect.w;
  const t = cropRect.y;
  const cY = cropRect.y + cropRect.h / 2;
  const b = cropRect.y + cropRect.h;

  drawH(l, t);
  drawH(cX, t);
  drawH(r, t);
  drawH(r, cY);
  drawH(r, b);
  drawH(cX, b);
  drawH(l, b);
  drawH(l, cY);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1 / viewScale;
  ctx.beginPath();
  ctx.moveTo(cropRect.x + cropRect.w / 3, cropRect.y);
  ctx.lineTo(cropRect.x + cropRect.w / 3, cropRect.y + cropRect.h);
  ctx.moveTo(cropRect.x + 2 * cropRect.w / 3, cropRect.y);
  ctx.lineTo(cropRect.x + 2 * cropRect.w / 3, cropRect.y + cropRect.h);
  ctx.moveTo(cropRect.x, cropRect.y + cropRect.h / 3);
  ctx.lineTo(cropRect.x + cropRect.w, cropRect.y + cropRect.h / 3);
  ctx.moveTo(cropRect.x, cropRect.y + 2 * cropRect.h / 3);
  ctx.lineTo(cropRect.x + cropRect.w, cropRect.y + 2 * cropRect.h / 3);
  ctx.stroke();

  ctx.restore();
}

function setupHighResCanvas(canvas, ctx, sourceImage, isUsingCanvasSource, maxDimension) {
  if (!sourceImage) return;

  let w = getSourceWidth(sourceImage, isUsingCanvasSource);
  let h = getSourceHeight(sourceImage, isUsingCanvasSource);

  if (w > maxDimension || h > maxDimension) {
    const ratio = w / h;
    if (w > h) {
      w = maxDimension;
      h = Math.round(w / ratio);
    } else {
      h = maxDimension;
      w = Math.round(h * ratio);
    }
  }

  canvas.width = w;
  canvas.height = h;

  const padding = 20;
  const isMobile = window.innerWidth < 768;
  const screenW = isMobile ? (window.innerWidth - padding) : (window.innerWidth - 380);
  const screenH = isMobile ? (window.innerHeight * 0.40) : (window.innerHeight - 80);
  const ratio = w / h;

  let cssW = screenW;
  let cssH = cssW / ratio;

  if (cssH > screenH) {
    cssH = screenH;
    cssW = cssH * ratio;
  }

  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  ctx.imageSmoothingQuality = 'high';

  return { w, h };
}

function applyCrop(sourceImage, isUsingCanvasSource, cropRect) {
  if (!sourceImage || !cropRect) return null;

  const x = cropRect.w < 0 ? cropRect.x + cropRect.w : cropRect.x;
  const y = cropRect.h < 0 ? cropRect.y + cropRect.h : cropRect.y;
  const w = Math.abs(cropRect.w);
  const h = Math.abs(cropRect.h);

  const tC = document.createElement('canvas');
  tC.width = w;
  tC.height = h;

  const tX = tC.getContext('2d');
  tX.drawImage(sourceImage, x, y, w, h, 0, 0, w, h);

  return tC;
}

function drawImageCover(ctx, image, dx, dy, dw, dh) {
  const sw = image.width || image.naturalWidth;
  const sh = image.height || image.naturalHeight;
  const scale = Math.max(dw / sw, dh / sh);
  const drawW = sw * scale;
  const drawH = sh * scale;
  const offsetX = dx + (dw - drawW) / 2;
  const offsetY = dy + (dh - drawH) / 2;

  ctx.drawImage(image, offsetX, offsetY, drawW, drawH);
}

function buildRoundedRectPath(ctx, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function getCollageLayout(count) {
  const layouts = {
    2: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 }
    ],
    3: [
      { x: 0, y: 0, w: 1, h: 0.56 },
      { x: 0, y: 0.56, w: 0.5, h: 0.44 },
      { x: 0.5, y: 0.56, w: 0.5, h: 0.44 }
    ],
    4: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
    ],
    5: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 1 / 3, h: 0.5 },
      { x: 1 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
      { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.5 }
    ]
  };

  return layouts[count] || [{ x: 0, y: 0, w: 1, h: 1 }];
}

function composeCollageCanvas(images, maxDimension = COLLAGE_MAX_DIMENSION) {
  if (!images || !images.length) return null;
  if (images.length === 1) return images[0];

  const canvas = document.createElement('canvas');
  canvas.width = maxDimension;
  canvas.height = maxDimension;

  const ctx = canvas.getContext('2d');
  const layout = getCollageLayout(images.length);
  const gap = Math.max(8, Math.round(maxDimension * 0.008));

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  layout.forEach((slot, index) => {
    const img = images[index];
    if (!img) return;

    const slotX = Math.round(slot.x * canvas.width);
    const slotY = Math.round(slot.y * canvas.height);
    const slotW = Math.round(slot.w * canvas.width);
    const slotH = Math.round(slot.h * canvas.height);

    const dx = slotX + gap;
    const dy = slotY + gap;
    const dw = Math.max(1, slotW - (gap * 2));
    const dh = Math.max(1, slotH - (gap * 2));

    ctx.save();
    buildRoundedRectPath(ctx, dx, dy, dw, dh, Math.max(18, gap));
    ctx.clip();
    drawImageCover(ctx, img, dx, dy, dw, dh);
    ctx.restore();
  });

  return canvas;
}
