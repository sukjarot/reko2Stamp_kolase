/* ===========================
   REKO2STAMP - MAIN APPLICATION
   ============================ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker terdaftar!', reg.scope))
      .catch((err) => console.log('Gagal daftar Service Worker:', err));
  });
}

let sourceImage = null;
let isUsingCanvasSource = false;
let imgLoaded = false;

let collageImages = [];
let collageFrameTransforms = [];
let originalCollageImages = [];
let originalSelectedLayoutKey = 'auto';
// [ADDED]
let selectedLayoutKey = 'auto';
let stamps = [];
let selectedStampId = null;
let stampCounter = 1;
let activeDragStampId = null;
let activeFrameIndex = null;
let initialFrameTransform = null;
let pinchFrameIndex = null;
let initialFrameScale = 1;

let viewScale = 1;
let viewX = 0;
let viewY = 0;

let cropMode = false;
let cropRect = null;
let cropAction = null;
let dragStartPos = { x: 0, y: 0 };
let initialCropRect = null;

let initialPinchDist = 0;
let initialScale = 1;
let isDrawing = false;
let isCollageRenderQueued = false;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

const fileInput = document.getElementById('fileInput');
const addPhotoInput = document.getElementById('addPhotoInput');
const layoutSelect = document.getElementById('layoutSelect');
const dtInput = document.getElementById('dtInput');
const showDateToggle = document.getElementById('showDateToggle');
const locInput = document.getElementById('locInput');
const gpsBtn = document.getElementById('gpsBtn');
const gpsFollowBtn = document.getElementById('gpsFollowBtn');
const suggestionsBox = document.getElementById('suggestions');
const collageInfo = document.getElementById('collageInfo');

const sizeSlider = document.getElementById('sizeSlider');
const sizeValDisplay = document.getElementById('sizeVal');
const opacitySlider = document.getElementById('opacitySlider');
const opacityValDisplay = document.getElementById('opacityVal');
const fontColor = document.getElementById('fontColor');
const fontSelect = document.getElementById('fontSelect');

const stampSelect = document.getElementById('stampSelect');
const addStampBtn = document.getElementById('addStampBtn');
const deleteStampBtn = document.getElementById('deleteStampBtn');
const alignButtons = Array.from(document.querySelectorAll('.stamp-align-btn'));

const resetViewBtn = document.getElementById('resetView');
const toggleCropBtn = document.getElementById('toggleCrop');
const clearBtn = document.getElementById('clearBtn');
const rotateBtn = document.getElementById('rotateBtn');
const canvasContainer = document.getElementById('canvasContainer');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const storageBtn = document.getElementById('storageBtn');
const storageModal = document.getElementById('storageModal');
const filePrefixInput = document.getElementById('filePrefix');
const fileCounterInput = document.getElementById('fileCounter');
const filenamePreview = document.getElementById('filenamePreview');
const dirStatus = document.getElementById('dirStatus');
const storageInfo = document.getElementById('storageInfo');
const activeFolderLabel = document.getElementById('activeFolderLabel');
const clearDirBtn = document.getElementById('clearDirBtn');
const installBtn = document.getElementById('installBtn');

let deferredPrompt = null;

const cameraModal = document.getElementById('cameraModal');
const cameraVideo = document.getElementById('cameraVideo');
const openCameraBtn = document.getElementById('openCameraBtn');
const closeCamBtn = document.getElementById('closeCamBtn');
const shutterBtn = document.getElementById('shutterBtn');
const switchCamBtn = document.getElementById('switchCamBtn');
const rotateCamBtn = document.getElementById('rotateCamBtn');

const mapModal = document.getElementById('mapModal');
const mapBtn = document.getElementById('mapBtn');
const closeMapBtn = document.getElementById('closeMapBtn');

const now = new Date();
const localIso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
dtInput.value = localIso;
if (layoutSelect) {
  selectedLayoutKey = layoutSelect.value || 'auto';
}

function requestRender() {
  if (!isDrawing) {
    isDrawing = true;
    requestAnimationFrame(() => {
      draw();
      isDrawing = false;
    });
  }
}

function updateTransform() {
  canvas.style.transform = `translate(${viewX}px, ${viewY}px) scale(${viewScale})`;
}

function clampScale(nextScale) {
  return Math.min(Math.max(0.2, nextScale), 10);
}

function setPanningState(isActive) {
  isPanning = isActive;
  canvasContainer.classList.toggle('is-panning', isActive);
}

function applyZoom(nextScale, clientX, clientY) {
  if (!imgLoaded) return;

  const clampedScale = clampScale(nextScale);
  const rect = canvas.getBoundingClientRect();
  const baseLeft = rect.left - viewX;
  const baseTop = rect.top - viewY;
  const localX = (clientX - rect.left) / viewScale;
  const localY = (clientY - rect.top) / viewScale;

  viewScale = clampedScale;
  viewX = clientX - baseLeft - (localX * clampedScale);
  viewY = clientY - baseTop - (localY * clampedScale);
  updateTransform();
}

// [UPDATED] Show current layout capacity without changing the existing info element.
function updateCollageInfo() {
  if (collageInfo) {
    const capacity = getCollageFrameCapacity(selectedLayoutKey);
    collageInfo.textContent = `Kolase: ${collageImages.length}/${capacity} foto`;
  }
}

// [ADDED]
function ensureCollageFrameTransforms() {
  collageFrameTransforms = collageImages.map((_, index) => (
    normalizeFrameTransform(collageFrameTransforms[index] || getDefaultFrameTransform())
  ));
}

// [ADDED]
function resetCollageFrameTransforms() {
  collageFrameTransforms = collageImages.map(() => getDefaultFrameTransform());
}

function saveOriginalCollageState(images = collageImages) {
  originalCollageImages = [...images];
  originalSelectedLayoutKey = selectedLayoutKey;
}

function resetImageAdjustments() {
  if (!imgLoaded && !originalCollageImages.length) return;

  if (cropMode) {
    cancelCrop();
  } else {
    cropRect = null;
    cropAction = null;
    toggleCropBtn.textContent = 'Potong';
    toggleCropBtn.classList.remove('btn-danger');
    toggleCropBtn.classList.add('btn-secondary');
  }

  activeFrameIndex = null;
  initialFrameTransform = null;
  pinchFrameIndex = null;
  setPanningState(false);

  if (originalCollageImages.length) {
    selectedLayoutKey = originalSelectedLayoutKey || 'auto';
    if (layoutSelect) {
      layoutSelect.value = selectedLayoutKey;
    }
    collageImages = [...originalCollageImages];
    resetCollageFrameTransforms();
    rebuildCollageSource();
    return;
  }

  resetCollageFrameTransforms();
  rebuildCollageSource();
}

// [ADDED]
function getActiveFrameCapacity() {
  return getCollageFrameCapacity(selectedLayoutKey);
}

// [ADDED]
function getVisibleCollageCount() {
  return Math.min(collageImages.length, getActiveFrameCapacity());
}

// [ADDED]
function validateLayoutKey() {
  if (selectedLayoutKey === 'auto') return;

  const presets = COLLAGE_LAYOUT_PRESETS[collageImages.length];
  if (!presets || !presets[selectedLayoutKey]) {
    selectedLayoutKey = 'auto';
    if (layoutSelect) {
      layoutSelect.value = 'auto';
    }
  }
}

// [ADDED]
function getFrameHitAtCanvasPoint(pos) {
  if (!pos || !collageImages.length) return null;

  return getCollageFrameAtPoint(
    pos.x,
    pos.y,
    canvas.width,
    canvas.height,
    getVisibleCollageCount(),
    selectedLayoutKey
  );
}

// [ADDED]
function applyFrameTransform(frameIndex, nextTransform) {
  if (frameIndex === null || frameIndex < 0 || frameIndex >= collageImages.length) return;

  const layout = getCollageLayout(getVisibleCollageCount(), selectedLayoutKey);
  const gap = getVisibleCollageCount() > 1 ? Math.max(8, Math.round(Math.min(canvas.width, canvas.height) * 0.008)) : 0;
  const slot = layout[frameIndex];
  if (!slot) return;

  const slotRect = getCollageSlotRect(slot, canvas.width, canvas.height, gap);
  const previousTransform = normalizeFrameTransform(collageFrameTransforms[frameIndex]);
  const clampedTransform = clampFrameTransformToSlot(
    collageImages[frameIndex],
    slotRect,
    nextTransform
  );

  if (
    previousTransform.scale === clampedTransform.scale &&
    previousTransform.offsetX === clampedTransform.offsetX &&
    previousTransform.offsetY === clampedTransform.offsetY
  ) {
    return;
  }

  collageFrameTransforms[frameIndex] = clampedTransform;
  requestCollageTransformRender();
}

// [ADDED]
function zoomFrameAtPoint(frameIndex, scaleFactor, pos) {
  if (frameIndex === null || frameIndex < 0 || !pos) return false;

  ensureCollageFrameTransforms();
  const currentTransform = normalizeFrameTransform(collageFrameTransforms[frameIndex]);
  const nextScale = Math.min(Math.max(currentTransform.scale * scaleFactor, 1), 5);
  const ratio = nextScale / currentTransform.scale;
  const hit = getFrameHitAtCanvasPoint(pos);
  if (!hit || hit.index !== frameIndex) return false;

  const centerX = hit.rect.x + (hit.rect.w / 2);
  const centerY = hit.rect.y + (hit.rect.h / 2);
  const localX = pos.x - centerX;
  const localY = pos.y - centerY;

  applyFrameTransform(frameIndex, {
    scale: nextScale,
    offsetX: localX - ((localX - currentTransform.offsetX) * ratio),
    offsetY: localY - ((localY - currentTransform.offsetY) * ratio)
  });

  return true;
}

function getDefaultStampPosition(index = 0) {
  const width = canvas.width || 1200;
  const height = canvas.height || 1200;
  const offset = index * 34;
  return {
    x: width * 0.05,
    y: height - (height * 0.1) - offset
  };
}

function getStampAnchorFromLeft(left, width, textAlign) {
  if (textAlign === 'right') return left + width;
  if (textAlign === 'center') return left + (width / 2);
  return left;
}

function placeStampToRightOfActiveStamp(newStamp, activeStamp) {
  if (!newStamp || !activeStamp || !canvas.width) return false;

  const padding = 20;
  const gap = Math.max(24, newStamp.size * 0.8);
  const activeBox = getTextBoundingBox(ctx, activeStamp);
  const newBox = getTextBoundingBox(ctx, newStamp);
  if (!activeBox || !newBox) return false;

  const availableWidth = Math.max(0, canvas.width - (padding * 2));
  const combinedWidth = activeBox.w + gap + newBox.w;

  if (combinedWidth <= availableWidth) {
    let activeLeft = activeBox.x;
    const overflow = (activeLeft + combinedWidth) - (canvas.width - padding);

    if (overflow > 0) activeLeft -= overflow;
    if (activeLeft < padding) activeLeft = padding;

    const newLeft = activeLeft + activeBox.w + gap;
    activeStamp.x = getStampAnchorFromLeft(activeLeft, activeBox.w, getStampTextAlign(activeStamp));
    newStamp.x = getStampAnchorFromLeft(newLeft, newBox.w, getStampTextAlign(newStamp));
    newStamp.y = activeBox.y + newStamp.size;
    return true;
  }

  const newLeft = Math.max(padding, canvas.width - padding - newBox.w);
  const belowTop = activeBox.y + activeBox.h + gap;
  const aboveTop = activeBox.y - newBox.h - gap;
  const hasRoomBelow = canvas.height && belowTop + newBox.h <= canvas.height - padding;
  const nextTop = hasRoomBelow ? belowTop : Math.max(padding, aboveTop);

  newStamp.x = getStampAnchorFromLeft(newLeft, newBox.w, getStampTextAlign(newStamp));
  newStamp.y = nextTop + newStamp.size;
  return true;
}

function createStamp(overrides = {}) {
  const position = getDefaultStampPosition(stamps.length);
  const id = `stamp-${stampCounter++}`;
  return {
    id,
    label: `Stamp ${stampCounter - 1}`,
    x: position.x,
    y: position.y,
    showDate: showDateToggle.checked,
    dateTime: dtInput.value || localIso,
    location: locInput.value.trim(),
    size: parseInt(sizeSlider.value, 10),
    opacity: parseInt(opacitySlider.value, 10),
    color: fontColor.value || '#ffffff',
    fontFamily: fontSelect.value || 'Arial',
    textAlign: 'left',
    ...overrides
  };
}

function getSelectedStamp() {
  return stamps.find((stamp) => stamp.id === selectedStampId) || null;
}

function refreshStampLabels() {
  stamps.forEach((stamp, index) => {
    stamp.label = `Stamp ${index + 1}`;
  });
}

function renderStampOptions() {
  refreshStampLabels();
  stampSelect.innerHTML = stamps
    .map((stamp) => `<option value="${stamp.id}">${stamp.label}</option>`)
    .join('');

  if (selectedStampId !== null && !stamps.some((stamp) => stamp.id === selectedStampId) && stamps.length) {
    selectedStampId = stamps[0].id;
  }

  if (selectedStampId) {
    stampSelect.value = selectedStampId;
  } else {
    stampSelect.selectedIndex = -1;
  }

  deleteStampBtn.disabled = stamps.length <= 1 || selectedStampId === null;
}

function syncAlignButtons(stamp) {
  const activeAlign = stamp ? getStampTextAlign(stamp) : null;
  alignButtons.forEach((button) => {
    const isActive = button.dataset.align === activeAlign;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function syncControlsFromStamp(stamp) {
  if (!stamp) return;

  showDateToggle.checked = !!stamp.showDate;
  dtInput.value = stamp.dateTime || localIso;
  locInput.value = stamp.location || '';
  sizeSlider.value = stamp.size;
  sizeValDisplay.textContent = `${stamp.size}px`;
  opacitySlider.value = stamp.opacity;
  opacityValDisplay.textContent = `${stamp.opacity}%`;
  fontColor.value = stamp.color || '#ffffff';
  fontSelect.value = stamp.fontFamily || 'Arial';
  syncAlignButtons(stamp);
}

function selectStamp(stampId, syncControls = true) {
  selectedStampId = stampId;
  renderStampOptions();

  const stamp = getSelectedStamp();
  if (stamp && syncControls) {
    syncControlsFromStamp(stamp);
  } else {
    syncAlignButtons(stamp);
  }

  requestRender();
}

function clearStampSelection() {
  if (selectedStampId === null) return;
  selectedStampId = null;
  renderStampOptions();
  syncAlignButtons(null);
  requestRender();
}

function waitForNextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function ensureStampState() {
  if (!stamps.length) {
    stamps = [createStamp()];
    selectedStampId = stamps[0].id;
  }
  renderStampOptions();
}

function syncSelectedStampFromControls() {
  const stamp = getSelectedStamp();
  if (!stamp) return;

  stamp.showDate = showDateToggle.checked;
  stamp.dateTime = dtInput.value || localIso;
  stamp.location = locInput.value.trim();
  stamp.size = parseInt(sizeSlider.value, 10);
  stamp.opacity = parseInt(opacitySlider.value, 10);
  stamp.color = fontColor.value || '#ffffff';
  stamp.fontFamily = fontSelect.value || 'Arial';
  constrainStampTextPosition(ctx, stamp, canvas.width, canvas.height);

  sizeValDisplay.textContent = `${stamp.size}px`;
  opacityValDisplay.textContent = `${stamp.opacity}%`;
  requestRender();
}

function scaleStampPositions(previousWidth, previousHeight, nextWidth, nextHeight) {
  if (!previousWidth || !previousHeight || !nextWidth || !nextHeight) {
    stamps.forEach((stamp, index) => {
      Object.assign(stamp, getDefaultStampPosition(index));
      constrainStampTextPosition(ctx, stamp, nextWidth || canvas.width, nextHeight || canvas.height);
    });
    return;
  }

  const ratioX = nextWidth / previousWidth;
  const ratioY = nextHeight / previousHeight;

  stamps.forEach((stamp) => {
    stamp.x *= ratioX;
    stamp.y *= ratioY;
    constrainStampTextPosition(ctx, stamp, nextWidth, nextHeight);
  });
}

function resetViewport() {
  viewScale = 1;
  viewX = 0;
  viewY = 0;
  updateTransform();
}

function applySourceImage(nextSource, usingCanvas) {
  const previousWidth = canvas.width;
  const previousHeight = canvas.height;

  sourceImage = nextSource;
  isUsingCanvasSource = usingCanvas;
  imgLoaded = !!nextSource;

  if (!imgLoaded) {
    requestRender();
    return;
  }

  setupHighResCanvas(canvas, ctx, sourceImage, isUsingCanvasSource, MAX_DIMENSION);
  ensureStampState();
  scaleStampPositions(previousWidth, previousHeight, canvas.width, canvas.height);
  resetViewport();
  updateCollageInfo();
  requestRender();
}

// [ADDED]
function composeCurrentCollageSource() {
  if (!collageImages.length) return null;

  ensureCollageFrameTransforms();

  if (collageImages.length === 1 && selectedLayoutKey === 'auto') {
    return collageImages[0];
  }

  return composeCollageCanvas(
    collageImages,
    COLLAGE_MAX_DIMENSION,
    selectedLayoutKey,
    collageFrameTransforms
  );
}

// [ADDED]
function requestCollageTransformRender() {
  if (isCollageRenderQueued) return;

  isCollageRenderQueued = true;
  requestAnimationFrame(() => {
    isCollageRenderQueued = false;

    if (collageImages.length > 1 || selectedLayoutKey !== 'auto') {
      const composedSource = composeCurrentCollageSource();
      if (composedSource) {
        sourceImage = composedSource;
        isUsingCanvasSource = true;
      }
    }

    requestRender();
  });
}

// [UPDATED]
function rebuildCollageSource() {
  if (!collageImages.length) {
    sourceImage = null;
    isUsingCanvasSource = false;
    imgLoaded = false;
    updateCollageInfo();
    requestRender();
    return;
  }

  validateLayoutKey();
  const composedSource = composeCurrentCollageSource();

  applySourceImage(composedSource, !(composedSource instanceof HTMLImageElement));
  updateCollageInfo();
}

function addStamp() {
  ensureStampState();
  const baseStamp = getSelectedStamp();
  const position = getDefaultStampPosition(stamps.length);
  const newStamp = createStamp({
    x: position.x,
    y: position.y,
    showDate: baseStamp ? baseStamp.showDate : showDateToggle.checked,
    dateTime: baseStamp ? baseStamp.dateTime : (dtInput.value || localIso),
    location: baseStamp ? baseStamp.location : locInput.value.trim(),
    size: baseStamp ? baseStamp.size : parseInt(sizeSlider.value, 10),
    opacity: baseStamp ? baseStamp.opacity : parseInt(opacitySlider.value, 10),
    color: baseStamp ? baseStamp.color : (fontColor.value || '#ffffff'),
    fontFamily: baseStamp ? baseStamp.fontFamily : (fontSelect.value || 'Arial'),
    textAlign: baseStamp ? getStampTextAlign(baseStamp) : 'left'
  });

  if (baseStamp) {
    placeStampToRightOfActiveStamp(newStamp, baseStamp);
    constrainStampTextPosition(ctx, baseStamp, canvas.width, canvas.height);
  }
  constrainStampTextPosition(ctx, newStamp, canvas.width, canvas.height);
  stamps.push(newStamp);
  selectStamp(newStamp.id, true);
}

function deleteSelectedStamp() {
  if (stamps.length <= 1) return;

  const currentIndex = stamps.findIndex((stamp) => stamp.id === selectedStampId);
  if (currentIndex === -1) return;

  stamps.splice(currentIndex, 1);
  const nextStamp = stamps[Math.max(0, currentIndex - 1)] || stamps[0];
  selectStamp(nextStamp.id, true);
}

// [UPDATED] Existing render pipeline preserved; source photo draw supports one-frame transforms.
function draw() {
  if (!imgLoaded || !sourceImage) {
    canvas.width = 300;
    canvas.height = 300;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 300, 300);
    ctx.fillStyle = '#64748b';
    ctx.font = '16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Pilih Foto Dulu', 150, 150);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (collageImages.length === 1 && selectedLayoutKey === 'auto') {
    ensureCollageFrameTransforms();
    const slotRect = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    const frameTransform = clampFrameTransformToSlot(collageImages[0], slotRect, collageFrameTransforms[0]);
    collageFrameTransforms[0] = frameTransform;
    drawImageCover(ctx, sourceImage, 0, 0, canvas.width, canvas.height, frameTransform);
  } else {
    ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
  }

  stamps.forEach((stamp) => {
    const text = buildStampText(stamp);
    if (!text.trim()) return;

    ctx.save();
    ctx.globalAlpha = stamp.opacity / 100;
    ctx.font = getStampFont(stamp);
    ctx.fillStyle = stamp.color || '#ffffff';
    ctx.textAlign = getStampTextAlign(stamp);

    const shadowSize = Math.max(2, stamp.size / 15);
    ctx.shadowColor = `rgba(0,0,0,${stamp.opacity / 100})`;
    ctx.shadowBlur = shadowSize;
    ctx.shadowOffsetX = shadowSize / 2;
    ctx.shadowOffsetY = shadowSize / 2;

    wrapText(
      ctx,
      text,
      stamp.x,
      stamp.y,
      getStampMaxWidth(stamp, canvas.width),
      stamp.size * 1.25
    );
    ctx.restore();
  });

  const selectedStamp = getSelectedStamp();
  if (selectedStamp && !cropMode) {
    drawSelectedStampOutline(ctx, selectedStamp);
  }

  if (cropMode) {
    drawCropUI(ctx, canvas, cropRect, viewScale);
  }
}

// [UPDATED] Pointer down can select stamps, crop handles, or a collage frame.
function handlePointerDown(clientX, clientY) {
  const pos = getCanvasPointFromClient(clientX, clientY, canvas, viewScale, viewX, viewY);
  dragStartPos = pos;

  if (cropMode) {
    const hit = getHitRegion(pos.x, pos.y, cropRect, viewScale);
    if (hit) {
      cropAction = hit;
      initialCropRect = { ...cropRect };
    } else {
      cancelCrop();
    }
    return;
  }

  let targetStamp = null;
  for (let i = stamps.length - 1; i >= 0; i--) {
    const bbox = getTextBoundingBox(ctx, stamps[i]);
    if (isPointInTextBoundingBox(pos.x, pos.y, bbox)) {
      targetStamp = stamps[i];
      break;
    }
  }

  if (targetStamp) {
    activeDragStampId = targetStamp.id;
    selectStamp(targetStamp.id, true);
    dragStartPos.offsetX = pos.x - targetStamp.x;
    dragStartPos.offsetY = pos.y - targetStamp.y;
    return;
  }

  clearStampSelection();

  const frameHit = getFrameHitAtCanvasPoint(pos);
  if (frameHit) {
    ensureCollageFrameTransforms();
    activeFrameIndex = frameHit.index;
    initialFrameTransform = normalizeFrameTransform(collageFrameTransforms[activeFrameIndex]);
    setPanningState(true);
    return;
  }

  setPanningState(true);
  panStartX = clientX;
  panStartY = clientY;
}

// [UPDATED] Dragging an active frame pans that frame's image.
function handlePointerMove(clientX, clientY) {
  const pos = getCanvasPointFromClient(clientX, clientY, canvas, viewScale, viewX, viewY);

  if (cropMode && cropAction) {
    if (cropAction === 'move') {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;
      cropRect.x = Math.max(0, Math.min(canvas.width - cropRect.w, initialCropRect.x + dx));
      cropRect.y = Math.max(0, Math.min(canvas.height - cropRect.h, initialCropRect.y + dy));
    } else {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;
      const original = initialCropRect;

      if (cropAction.includes('n')) {
        cropRect.y = Math.max(0, original.y + dy);
        cropRect.h = Math.max(10, original.h - dy);
      }
      if (cropAction.includes('s')) {
        cropRect.h = Math.max(10, Math.min(canvas.height - cropRect.y, original.h + dy));
      }
      if (cropAction.includes('w')) {
        cropRect.x = Math.max(0, original.x + dx);
        cropRect.w = Math.max(10, original.w - dx);
      }
      if (cropAction.includes('e')) {
        cropRect.w = Math.max(10, Math.min(canvas.width - cropRect.x, original.w + dx));
      }
    }

    requestRender();
    return;
  }

  if (activeDragStampId) {
    const stamp = stamps.find((item) => item.id === activeDragStampId);
    if (!stamp) return;

    stamp.x = pos.x - (dragStartPos.offsetX || 0);
    stamp.y = pos.y - (dragStartPos.offsetY || 0);
    constrainStampTextPosition(ctx, stamp, canvas.width, canvas.height);

    requestRender();
    return;
  }

  if (activeFrameIndex !== null && initialFrameTransform) {
    const dx = pos.x - dragStartPos.x;
    const dy = pos.y - dragStartPos.y;
    applyFrameTransform(activeFrameIndex, {
      scale: initialFrameTransform.scale,
      offsetX: initialFrameTransform.offsetX + dx,
      offsetY: initialFrameTransform.offsetY + dy
    });
    return;
  }

  if (isPanning) {
    const dx = clientX - panStartX;
    const dy = clientY - panStartY;
    viewX += dx;
    viewY += dy;
    panStartX = clientX;
    panStartY = clientY;
    updateTransform();
  }
}

// [UPDATED]
function handlePointerUp() {
  if (cropMode && cropRect) {
    if (cropRect.w < 0) {
      cropRect.x += cropRect.w;
      cropRect.w = Math.abs(cropRect.w);
    }
    if (cropRect.h < 0) {
      cropRect.y += cropRect.h;
      cropRect.h = Math.abs(cropRect.h);
    }
  }

  if (activeDragStampId) {
    const stamp = stamps.find((item) => item.id === activeDragStampId);
    if (stamp) {
      constrainStampTextPosition(ctx, stamp, canvas.width, canvas.height);
      requestRender();
    }
  }

  cropAction = null;
  initialCropRect = null;
  activeDragStampId = null;
  activeFrameIndex = null;
  initialFrameTransform = null;
  pinchFrameIndex = null;
  setPanningState(false);
  delete dragStartPos.offsetX;
  delete dragStartPos.offsetY;
}

function cancelCrop() {
  if (!cropMode) return;

  cropMode = false;
  cropRect = null;
  cropAction = null;
  toggleCropBtn.textContent = 'Potong';
  toggleCropBtn.classList.remove('btn-danger');
  toggleCropBtn.classList.add('btn-secondary');
  requestRender();
}

function getCurrentIsoDateTime() {
  const date = new Date();
  return new Date(date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const tempImg = new Image();
      tempImg.onload = () => resolve(tempImg);
      tempImg.onerror = reject;
      tempImg.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// [UPDATED] Original gallery upload still replaces the collage.
async function replaceCollageWithFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
  if (!files.length) return;

  const limitedFiles = files.slice(0, COLLAGE_LIMIT);
  if (files.length > COLLAGE_LIMIT) {
    alert(`Maksimal ${COLLAGE_LIMIT} foto untuk kolase. Foto selebihnya diabaikan.`);
  }

  const images = await Promise.all(limitedFiles.map(loadImageFromFile));
  collageImages = images;
  resetCollageFrameTransforms();
  saveOriginalCollageState(collageImages);
  rebuildCollageSource();
}

// [ADDED]
async function appendCollageWithFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
  if (!files.length) return;

  const capacity = getActiveFrameCapacity();
  const remainingSlots = Math.max(0, capacity - collageImages.length);
  if (!remainingSlots) {
    alert(`Layout ini sudah penuh (${capacity} foto). Pilih layout lain atau hapus foto lama dulu.`);
    return;
  }

  const limitedFiles = files.slice(0, remainingSlots);
  if (files.length > remainingSlots) {
    alert(`Sisa frame hanya ${remainingSlots}. Foto selebihnya diabaikan.`);
  }

  const images = await Promise.all(limitedFiles.map(loadImageFromFile));
  collageImages = [...collageImages, ...images];
  collageFrameTransforms = [
    ...collageFrameTransforms,
    ...images.map(() => getDefaultFrameTransform())
  ];
  saveOriginalCollageState(originalCollageImages.length
    ? [...originalCollageImages, ...images]
    : collageImages
  );
  rebuildCollageSource();
}

// [UPDATED] Camera photos append into the next available frame.
function appendCapturedImage(imageSource) {
  const capacity = getActiveFrameCapacity();
  if (collageImages.length >= capacity) {
    alert(`Kolase maksimal ${capacity} foto untuk layout ini. Hapus foto lama dulu jika ingin menambah lagi.`);
    return;
  }

  collageImages = [...collageImages, imageSource];
  collageFrameTransforms = [...collageFrameTransforms, getDefaultFrameTransform()];
  saveOriginalCollageState(originalCollageImages.length
    ? [...originalCollageImages, imageSource]
    : collageImages
  );
  rebuildCollageSource();
}

canvasContainer.addEventListener('touchstart', (e) => {
  if (!imgLoaded) return;

  if (e.touches.length === 2) {
    e.preventDefault();
    initialPinchDist = getDist(e.touches);
    initialScale = viewScale;
    const midpointX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midpointY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const midpoint = getCanvasPointFromClient(midpointX, midpointY, canvas, viewScale, viewX, viewY);
    const frameHit = getFrameHitAtCanvasPoint(midpoint);
    pinchFrameIndex = frameHit ? frameHit.index : null;
    initialFrameScale = pinchFrameIndex !== null
      ? normalizeFrameTransform(collageFrameTransforms[pinchFrameIndex]).scale
      : 1;
  } else if (e.touches.length === 1) {
    handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: false });

canvasContainer.addEventListener('touchmove', (e) => {
  if (!imgLoaded) return;
  e.preventDefault();

  if (e.touches.length === 2) {
    const currentDist = getDist(e.touches);
    const midpointX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midpointY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const midpoint = getCanvasPointFromClient(midpointX, midpointY, canvas, viewScale, viewX, viewY);

    if (pinchFrameIndex !== null) {
      const scaleFactor = (initialFrameScale * (currentDist / initialPinchDist)) /
        normalizeFrameTransform(collageFrameTransforms[pinchFrameIndex]).scale;
      zoomFrameAtPoint(pinchFrameIndex, scaleFactor, midpoint);
      return;
    }

    const newScale = initialScale * (currentDist / initialPinchDist);
    applyZoom(newScale, midpointX, midpointY);
    return;
  }

  if (e.touches.length === 1) {
    handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: false });

canvasContainer.addEventListener('touchend', handlePointerUp);

canvasContainer.addEventListener('mousedown', (e) => {
  if (!imgLoaded || e.button !== 0) return;
  handlePointerDown(e.clientX, e.clientY);
});

window.addEventListener('mousemove', (e) => {
  if (!imgLoaded) return;
  if (e.buttons === 1) {
    handlePointerMove(e.clientX, e.clientY);
  }
});

window.addEventListener('mouseup', handlePointerUp);

canvasContainer.addEventListener('wheel', (e) => {
  if (!imgLoaded) return;

  e.preventDefault();
  const zoomStep = e.deltaY < 0 ? 1.12 : 0.9;
  const pos = getCanvasPointFromClient(e.clientX, e.clientY, canvas, viewScale, viewX, viewY);
  const frameHit = getFrameHitAtCanvasPoint(pos);
  if (frameHit && zoomFrameAtPoint(frameHit.index, zoomStep, pos)) {
    return;
  }

  applyZoom(viewScale * zoomStep, e.clientX, e.clientY);
}, { passive: false });

fileInput.addEventListener('change', async (e) => {
  try {
    await replaceCollageWithFiles(e.target.files);
  } catch (err) {
    console.error('Gagal memuat foto:', err);
    alert('Foto gagal dimuat. Coba pilih file lain.');
  } finally {
    fileInput.value = '';
  }
});

// [ADDED] Append-only upload path for the Add Photo button.
if (addPhotoInput) {
  addPhotoInput.addEventListener('change', async (e) => {
    try {
      await appendCollageWithFiles(e.target.files);
    } catch (err) {
      console.error('Gagal menambah foto:', err);
      alert('Foto gagal dimuat. Coba pilih file lain.');
    } finally {
      addPhotoInput.value = '';
    }
  });
}

// [ADDED] Layout changes reuse the same collage source rebuild path.
if (layoutSelect) {
  layoutSelect.addEventListener('change', () => {
    selectedLayoutKey = layoutSelect.value || 'auto';
    ensureCollageFrameTransforms();

    if (collageImages.length > getActiveFrameCapacity()) {
      alert('Sebagian foto tersimpan di state, tapi tidak tampil karena layout ini punya frame lebih sedikit.');
    }

    rebuildCollageSource();
  });
}

// [ADDED]
document.querySelectorAll('[data-layout]').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedLayoutKey = btn.dataset.layout || 'auto';
    if (layoutSelect) {
      layoutSelect.value = selectedLayoutKey;
    }
    rebuildCollageSource();
  });
});

setupCameraEvents(
  openCameraBtn,
  closeCamBtn,
  shutterBtn,
  switchCamBtn,
  rotateCamBtn,
  cameraVideo,
  cameraModal,
  (canvasSource) => {
    appendCapturedImage(canvasSource);
    dtInput.value = getCurrentIsoDateTime();
    syncSelectedStampFromControls();
  }
);

rotateBtn.addEventListener('click', () => {
  if (!imgLoaded || !sourceImage) return;
  const originalText = rotateBtn.textContent;
  rotateBtn.textContent = 'â³';

  requestAnimationFrame(() => {
    const w = getSourceWidth(sourceImage, isUsingCanvasSource);
    const h = getSourceHeight(sourceImage, isUsingCanvasSource);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = h;
    tempCanvas.height = w;

    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempCtx.rotate(90 * Math.PI / 180);
    tempCtx.drawImage(sourceImage, -w / 2, -h / 2);

    collageImages = [tempCanvas];
    resetCollageFrameTransforms();
    rebuildCollageSource();

    if (cropMode) {
      cancelCrop();
    }

    rotateBtn.textContent = originalText;
  });
});

toggleCropBtn.addEventListener('click', () => {
  if (!imgLoaded || !sourceImage) return;
  if (cropMode) {
    if (cropRect && cropRect.w > 10 && cropRect.h > 10) {
      const croppedCanvas = applyCrop(sourceImage, isUsingCanvasSource, cropRect);
      if (croppedCanvas) {
        collageImages = [croppedCanvas];
        resetCollageFrameTransforms();
        rebuildCollageSource();
      }
    }

    cropMode = false;
    toggleCropBtn.textContent = 'Potong';
    toggleCropBtn.classList.remove('btn-danger');
    toggleCropBtn.classList.add('btn-secondary');
  } else {
    cropMode = true;
    cropRect = {
      x: canvas.width * 0.1,
      y: canvas.height * 0.1,
      w: canvas.width * 0.8,
      h: canvas.height * 0.8
    };
    toggleCropBtn.textContent = 'Terapkan';
    toggleCropBtn.classList.remove('btn-secondary');
    toggleCropBtn.classList.add('btn-danger');
  }

  requestRender();
});

function adjustSize(val) {
  let current = parseInt(sizeSlider.value, 10);
  let nextValue = current + val;
  if (nextValue < 20) nextValue = 20;
  if (nextValue > 300) nextValue = 300;

  sizeSlider.value = nextValue;
  sizeValDisplay.textContent = `${nextValue}px`;
  syncSelectedStampFromControls();
}

window.adjustSize = adjustSize;

sizeSlider.addEventListener('input', syncSelectedStampFromControls);
opacitySlider.addEventListener('input', syncSelectedStampFromControls);
showDateToggle.addEventListener('change', syncSelectedStampFromControls);
dtInput.addEventListener('input', syncSelectedStampFromControls);
fontSelect.addEventListener('change', syncSelectedStampFromControls);
fontColor.addEventListener('input', syncSelectedStampFromControls);

locInput.addEventListener('input', () => {
  const stamp = getSelectedStamp();
  if (!stamp) return;
  stamp.location = locInput.value.trim();
  constrainStampTextPosition(ctx, stamp, canvas.width, canvas.height);
  requestRender();
});

document.addEventListener('reko:location-updated', (event) => {
  const stamp = getSelectedStamp();
  if (!stamp) return;
  stamp.location = (event.detail && event.detail.value ? event.detail.value : '').trim();
  constrainStampTextPosition(ctx, stamp, canvas.width, canvas.height);
  requestRender();
});

stampSelect.addEventListener('change', (e) => {
  selectStamp(e.target.value, true);
});

alignButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const stamp = getSelectedStamp();
    if (!stamp) return;

    stamp.textAlign = button.dataset.align || 'left';
    constrainStampTextPosition(ctx, stamp, canvas.width, canvas.height);
    syncAlignButtons(stamp);
    requestRender();
  });
});

addStampBtn.addEventListener('click', addStamp);
deleteStampBtn.addEventListener('click', deleteSelectedStamp);

resetViewBtn.addEventListener('click', () => {
  resetImageAdjustments();
});

clearBtn.addEventListener('click', () => {
  if (!confirm('Hapus foto ini?')) return;

  collageImages = [];
  collageFrameTransforms = [];
  originalCollageImages = [];
  originalSelectedLayoutKey = selectedLayoutKey;
  sourceImage = null;
  isUsingCanvasSource = false;
  imgLoaded = false;
  cropMode = false;
  cropRect = null;
  resetViewport();

  stamps = [createStamp({ location: '', dateTime: getCurrentIsoDateTime() })];
  selectedStampId = stamps[0].id;
  renderStampOptions();
  syncControlsFromStamp(stamps[0]);
  updateCollageInfo();
  requestRender();
});

const oldDownloadBtn = document.getElementById('downloadFinal');
if (oldDownloadBtn) {
  const newDownloadBtn = oldDownloadBtn.cloneNode(true);
  oldDownloadBtn.parentNode.replaceChild(newDownloadBtn, oldDownloadBtn);

  newDownloadBtn.addEventListener('click', async () => {
    if (!imgLoaded) return alert('Belum ada foto untuk disimpan!');
    clearStampSelection();
    await waitForNextFrame();
    await savePhoto(canvas, filePrefixInput, fileCounterInput, dirHandle, filenamePreview);
  });
}

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = 'none';
    if (choiceResult.outcome === 'accepted') {
      console.log('Pengguna menerima pemasangan aplikasi.');
    } else {
      console.log('Pengguna menolak pemasangan aplikasi.');
    }
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  if (installBtn) {
    installBtn.style.display = 'block';
  }
});

window.addEventListener('appinstalled', () => {
  console.log('Aplikasi berhasil dipasang.');
  if (installBtn) {
    installBtn.style.display = 'none';
  }
});

setupLocationInput(locInput, suggestionsBox, gpsFollowBtn);
setupGPSButton(gpsBtn, gpsFollowBtn);
setupMapButton(mapBtn, mapModal, closeMapBtn, gpsFollowBtn);

setupStorageModal(
  storageBtn,
  storageModal,
  document.getElementById('pickDirBtn'),
  clearDirBtn,
  document.getElementById('saveSettingsBtn'),
  document.getElementById('cancelSettingsBtn'),
  filePrefixInput,
  fileCounterInput,
  filenamePreview,
  dirStatus,
  storageInfo,
  activeFolderLabel
);

(async function restoreSettings() {
  try {
    await restoreStorageSettings(filePrefixInput, fileCounterInput, dirStatus, storageInfo, activeFolderLabel, clearDirBtn);
  } catch (err) {
    console.error('Gagal memuat pengaturan storage:', err);
  }
})();

window.addEventListener('resize', () => {
  if (!imgLoaded || !sourceImage) return;
  setupHighResCanvas(canvas, ctx, sourceImage, isUsingCanvasSource, MAX_DIMENSION);
  resetViewport();
  requestRender();
});

ensureStampState();
syncControlsFromStamp(stamps[0]);
updateCollageInfo();
requestRender();
