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
let stamps = [];
let selectedStampId = null;
let stampCounter = 1;
let activeDragStampId = null;

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
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

const fileInput = document.getElementById('fileInput');
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

function updateCollageInfo() {
  if (collageInfo) {
    collageInfo.textContent = `Kolase: ${collageImages.length}/${COLLAGE_LIMIT} foto`;
  }
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
    fontFamily: fontSelect.value || 'Roboto',
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

  if (!selectedStampId && stamps.length) {
    selectedStampId = stamps[0].id;
  }

  if (selectedStampId) {
    stampSelect.value = selectedStampId;
  }

  deleteStampBtn.disabled = stamps.length <= 1;
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
  fontSelect.value = stamp.fontFamily || 'Roboto';
}

function selectStamp(stampId, syncControls = true) {
  selectedStampId = stampId;
  renderStampOptions();

  const stamp = getSelectedStamp();
  if (stamp && syncControls) {
    syncControlsFromStamp(stamp);
  }

  requestRender();
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
  stamp.fontFamily = fontSelect.value || 'Roboto';

  sizeValDisplay.textContent = `${stamp.size}px`;
  opacityValDisplay.textContent = `${stamp.opacity}%`;
  requestRender();
}

function scaleStampPositions(previousWidth, previousHeight, nextWidth, nextHeight) {
  if (!previousWidth || !previousHeight || !nextWidth || !nextHeight) {
    stamps.forEach((stamp, index) => Object.assign(stamp, getDefaultStampPosition(index)));
    return;
  }

  const ratioX = nextWidth / previousWidth;
  const ratioY = nextHeight / previousHeight;

  stamps.forEach((stamp) => {
    stamp.x *= ratioX;
    stamp.y *= ratioY;
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

function rebuildCollageSource() {
  if (!collageImages.length) {
    sourceImage = null;
    isUsingCanvasSource = false;
    imgLoaded = false;
    requestRender();
    return;
  }

  const composedSource = collageImages.length === 1
    ? collageImages[0]
    : composeCollageCanvas(collageImages, COLLAGE_MAX_DIMENSION);

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
    fontFamily: baseStamp ? baseStamp.fontFamily : (fontSelect.value || 'Roboto')
  });

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

function draw() {
  if (!imgLoaded || !sourceImage) {
    canvas.width = 300;
    canvas.height = 300;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 300, 300);
    ctx.fillStyle = '#64748b';
    ctx.font = '16px Roboto';
    ctx.textAlign = 'center';
    ctx.fillText('Pilih Foto Dulu', 150, 150);
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);

  stamps.forEach((stamp) => {
    const text = buildStampText(stamp);
    if (!text.trim()) return;

    ctx.save();
    ctx.globalAlpha = stamp.opacity / 100;
    ctx.font = getStampFont(stamp);
    ctx.fillStyle = stamp.color || '#ffffff';
    ctx.textAlign = 'left';

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
      Math.max(40, canvas.width - (stamp.x + 20)),
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

function handleStart(clientX, clientY) {
  const pos = getPos(clientX, clientY, canvas);
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

  const targetStamp = getTopStampAtPosition(pos.x, pos.y, ctx, stamps);
  if (targetStamp) {
    activeDragStampId = targetStamp.id;
    selectStamp(targetStamp.id, true);
    const bbox = getTextBoundingBox(ctx, targetStamp);
    if (bbox) {
      dragStartPos.offsetX = pos.x - targetStamp.x;
      dragStartPos.offsetY = pos.y - (targetStamp.y - targetStamp.size);
    }
    return;
  }

  setPanningState(true);
  panStartX = clientX;
  panStartY = clientY;
}

function handleMove(clientX, clientY) {
  const pos = getPos(clientX, clientY, canvas);

  if (cropMode && cropAction) {
    if (cropAction === 'move') {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;
      cropRect.x = initialCropRect.x + dx;
      cropRect.y = initialCropRect.y + dy;
    } else {
      const dx = pos.x - dragStartPos.x;
      const dy = pos.y - dragStartPos.y;
      const original = initialCropRect;

      if (cropAction.includes('n')) {
        cropRect.y = original.y + dy;
        cropRect.h = original.h - dy;
      }
      if (cropAction.includes('s')) {
        cropRect.h = original.h + dy;
      }
      if (cropAction.includes('w')) {
        cropRect.x = original.x + dx;
        cropRect.w = original.w - dx;
      }
      if (cropAction.includes('e')) {
        cropRect.w = original.w + dx;
      }
    }

    requestRender();
    return;
  }

  if (activeDragStampId) {
    const stamp = stamps.find((item) => item.id === activeDragStampId);
    if (!stamp) return;

    if (dragStartPos.offsetX !== undefined) {
      stamp.x = pos.x - dragStartPos.offsetX;
      stamp.y = pos.y - dragStartPos.offsetY + stamp.size;
    } else {
      stamp.x = pos.x;
      stamp.y = pos.y;
    }

    requestRender();
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

function handleEnd() {
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

  cropAction = null;
  initialCropRect = null;
  activeDragStampId = null;
  setPanningState(false);
  delete dragStartPos.offsetX;
  delete dragStartPos.offsetY;
}

function cancelCrop() {
  if (!cropMode) return;

  cropMode = false;
  cropRect = null;
  cropAction = null;
  toggleCropBtn.textContent = 'âœ‚ Potong';
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

async function replaceCollageWithFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
  if (!files.length) return;

  const limitedFiles = files.slice(0, COLLAGE_LIMIT);
  if (files.length > COLLAGE_LIMIT) {
    alert(`Maksimal ${COLLAGE_LIMIT} foto untuk kolase. Foto selebihnya diabaikan.`);
  }

  const images = await Promise.all(limitedFiles.map(loadImageFromFile));
  collageImages = images;
  rebuildCollageSource();
}

function appendCapturedImage(imageSource) {
  if (collageImages.length >= COLLAGE_LIMIT) {
    alert(`Kolase maksimal ${COLLAGE_LIMIT} foto. Hapus foto lama dulu jika ingin menambah lagi.`);
    return;
  }

  collageImages = [...collageImages, imageSource];
  rebuildCollageSource();
}

canvasContainer.addEventListener('touchstart', (e) => {
  if (!imgLoaded) return;

  if (e.touches.length === 2) {
    e.preventDefault();
    initialPinchDist = getDist(e.touches);
    initialScale = viewScale;
  } else if (e.touches.length === 1) {
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: false });

canvasContainer.addEventListener('touchmove', (e) => {
  if (!imgLoaded) return;
  e.preventDefault();

  if (e.touches.length === 2) {
    const currentDist = getDist(e.touches);
    const midpointX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const midpointY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const newScale = initialScale * (currentDist / initialPinchDist);
    applyZoom(newScale, midpointX, midpointY);
    return;
  }

  if (e.touches.length === 1) {
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: false });

canvasContainer.addEventListener('touchend', handleEnd);

canvasContainer.addEventListener('mousedown', (e) => {
  if (!imgLoaded || e.button !== 0) return;
  handleStart(e.clientX, e.clientY);
});

window.addEventListener('mousemove', (e) => {
  if (!imgLoaded) return;
  if (e.buttons === 1) {
    handleMove(e.clientX, e.clientY);
  }
});

window.addEventListener('mouseup', handleEnd);

canvasContainer.addEventListener('wheel', (e) => {
  if (!imgLoaded) return;

  e.preventDefault();
  const zoomStep = e.deltaY < 0 ? 1.12 : 0.9;
  applyZoom(viewScale * zoomStep, e.clientX, e.clientY);
}, { passive: false });

canvasContainer.addEventListener('mousedown', (e) => {
  if (e.target === canvasContainer && cropMode) {
    cancelCrop();
  }
});

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
    applySourceImage(tempCanvas, true);

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
        applySourceImage(croppedCanvas, true);
      }
    }

    cropMode = false;
    toggleCropBtn.textContent = 'âœ‚ Potong';
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
    toggleCropBtn.textContent = 'âœ… Terapkan';
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
  requestRender();
});

document.addEventListener('reko:location-updated', (event) => {
  const stamp = getSelectedStamp();
  if (!stamp) return;
  stamp.location = (event.detail && event.detail.value ? event.detail.value : '').trim();
  requestRender();
});

stampSelect.addEventListener('change', (e) => {
  selectStamp(e.target.value, true);
});

addStampBtn.addEventListener('click', addStamp);
deleteStampBtn.addEventListener('click', deleteSelectedStamp);

resetViewBtn.addEventListener('click', () => {
  resetViewport();
  stamps.forEach((stamp, index) => Object.assign(stamp, getDefaultStampPosition(index)));
  requestRender();
});

clearBtn.addEventListener('click', () => {
  if (!confirm('Hapus foto ini?')) return;

  collageImages = [];
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
    await savePhoto(canvas, filePrefixInput, fileCounterInput, dirHandle, filenamePreview);
  });
}

setupLocationInput(locInput, suggestionsBox, gpsFollowBtn);
setupGPSButton(gpsBtn, gpsFollowBtn);
setupMapButton(mapBtn, mapModal, closeMapBtn, gpsFollowBtn);

setupStorageModal(
  storageBtn,
  storageModal,
  document.getElementById('pickDirBtn'),
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
    await restoreStorageSettings(filePrefixInput, fileCounterInput, dirStatus, storageInfo, activeFolderLabel);
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
