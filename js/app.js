/* ===========================
   REKO2STAMP - MAIN APPLICATION
   ============================ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('Service Worker terdaftar!', reg.scope);

        // Helper: send message to a service worker
        function sendSkipWaitingMessage(sw) {
          try {
            sw.postMessage({ type: 'SKIP_WAITING' });
          } catch (e) {
            console.warn('Gagal mengirim pesan ke SW', e);
          }
        }

        // If there's an updated worker already waiting, ask it to skip waiting
        if (reg.waiting) {
          sendSkipWaitingMessage(reg.waiting);
        }

        // When a new SW is found (installing), watch its state
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed') {
              // If there's an existing controller, this is an update
              if (navigator.serviceWorker.controller) {
                sendSkipWaitingMessage(newSW);
              }
            }
          });
        });
      })
      .catch((err) => console.log('Gagal daftar Service Worker:', err));

    // When the controlling service worker changes, show update notification
    // then reload to apply the new one.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      try {
        showToast('Aplikasi diperbarui', 'success');
      } catch (e) {
        console.log('Aplikasi diperbarui — memuat ulang.');
      }
      // Allow the toast to be visible briefly before reloading
      setTimeout(() => window.location.reload(), 1400);
    });
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
let selectedCollageImageIndex = null;
let dragSwapTargetIndex = null;
let pendingImportChoiceResolve = null;

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
let selectedStampFlashFrameId = null;
let isExportRender = false;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let canvasDragDepth = 0;
let canvasTapStart = null;
let canvasGestureMoved = false;

const addPhotoInput = document.getElementById('addPhotoInput');
const layoutButtons = Array.from(document.querySelectorAll('[data-layout]'));
const dtInput = document.getElementById('dtInput');
const showDateToggle = document.getElementById('showDateToggle');
const locInput = document.getElementById('locInput');
const gpsBtn = document.getElementById('gpsBtn');
const gpsFollowBtn = document.getElementById('gpsFollowBtn');
const suggestionsBox = document.getElementById('suggestions');
const collageInfo = document.getElementById('collageInfo');
const collageSlotList = document.getElementById('collageSlotList');

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
const imageImportPrompt = document.getElementById('imageImportPrompt');
const imageImportPromptText = document.getElementById('imageImportPromptText');
const replaceImageChoice = document.getElementById('replaceImageChoice');
const appendImageChoice = document.getElementById('appendImageChoice');
const cancelImageChoice = document.getElementById('cancelImageChoice');
const toastNotification = document.getElementById('toastNotification');
let toastTimeout = null;

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

function syncLayoutPicker() {
  layoutButtons.forEach((button) => {
    const isActive = button.dataset.layout === selectedLayoutKey;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function setSelectedLayoutKey(layoutKey) {
  selectedLayoutKey = layoutKey || 'auto';
  syncLayoutPicker();
}

syncLayoutPicker();

function requestRender() {
  if (!isDrawing) {
    isDrawing = true;
    requestAnimationFrame(() => {
      draw();
      isDrawing = false;
      syncSelectedStampFlash();
    });
  }
}

function showToast(message, type = 'info') {
  if (!toastNotification) return;
  toastNotification.textContent = message;
  toastNotification.className = `toast-notification show ${type}`;
  toastNotification.hidden = false;
  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }
  toastTimeout = setTimeout(() => {
    toastNotification.classList.remove('show');
    toastTimeout = null;
  }, 2600);
}

function syncSelectedStampFlash() {
  const shouldFlash = !!(selectedStampId && imgLoaded && !cropMode);

  if (!shouldFlash) {
    if (selectedStampFlashFrameId !== null) {
      cancelAnimationFrame(selectedStampFlashFrameId);
      selectedStampFlashFrameId = null;
    }
    return;
  }

  if (selectedStampFlashFrameId !== null) return;

  selectedStampFlashFrameId = requestAnimationFrame(() => {
    selectedStampFlashFrameId = null;
    requestRender();
  });
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
  renderCollageSlots();
}

function clampSelectedCollageImageIndex() {
  if (!collageImages.length) {
    selectedCollageImageIndex = null;
    return;
  }

  if (
    selectedCollageImageIndex === null ||
    selectedCollageImageIndex < 0 ||
    selectedCollageImageIndex >= collageImages.length
  ) {
    selectedCollageImageIndex = collageImages.length - 1;
  }
}

function renderCollageSlots() {
  if (!collageSlotList) return;

  clampSelectedCollageImageIndex();
  collageSlotList.innerHTML = collageImages.map((_, index) => {
    const isActive = index === selectedCollageImageIndex;
    return `
      <div class="collage-slot-row${isActive ? ' is-active' : ''}" data-index="${index}">
        <button class="collage-slot-select" type="button" data-action="select" data-index="${index}">
          Foto ${index + 1}${isActive ? ' - dipilih' : ''}
        </button>
        <button class="collage-slot-delete" type="button" data-action="delete" data-index="${index}">
          Hapus
        </button>
      </div>
    `;
  }).join('');
}

function selectCollageImage(index) {
  if (index < 0 || index >= collageImages.length) return;

  selectedCollageImageIndex = index;
  renderCollageSlots();
  requestRender();
}

function resolveImageImportChoice(choice) {
  if (!pendingImportChoiceResolve) return;

  const resolve = pendingImportChoiceResolve;
  pendingImportChoiceResolve = null;

  if (imageImportPrompt) {
    imageImportPrompt.hidden = true;
  }

  resolve(choice);
}

function requestImageImportChoice(fileCount) {
  if (!collageImages.length) return Promise.resolve('replace');

  const capacity = getActiveFrameCapacity();
  const remainingSlots = Math.max(0, capacity - collageImages.length);
  const noun = fileCount === 1 ? 'foto' : 'foto';

  if (imageImportPromptText) {
    imageImportPromptText.textContent = remainingSlots
      ? `${fileCount} ${noun} siap dimuat. Ganti semua foto saat ini atau tambahkan ke kolase?`
      : `Kolase sudah penuh (${capacity} foto). Ganti semua foto saat ini atau batal.`;
  }

  if (appendImageChoice) {
    appendImageChoice.disabled = remainingSlots <= 0;
    appendImageChoice.textContent = remainingSlots > 0 ? 'Tambah' : 'Penuh';
  }

  if (!imageImportPrompt) {
    return Promise.resolve(confirm('Ganti foto saat ini?') ? 'replace' : 'cancel');
  }

  if (pendingImportChoiceResolve) {
    resolveImageImportChoice('cancel');
  }

  imageImportPrompt.hidden = false;
  return new Promise((resolve) => {
    pendingImportChoiceResolve = resolve;
  });
}

async function importImageFilesWithChoice(fileList) {
  const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
  if (!files.length) return;

  const choice = await requestImageImportChoice(files.length);
  if (choice === 'replace') {
    await replaceCollageWithFiles(files);
  } else if (choice === 'append') {
    await appendCollageWithFiles(files);
  }
}

function removeCollageImageAt(index) {
  if (index < 0 || index >= collageImages.length) return;

  const removedIndex = index;
  collageImages.splice(index, 1);
  collageFrameTransforms.splice(index, 1);
  originalCollageImages = [...collageImages];
  originalSelectedLayoutKey = selectedLayoutKey;

  if (selectedCollageImageIndex !== null) {
    selectedCollageImageIndex = Math.min(selectedCollageImageIndex, collageImages.length - 1);
    if (selectedCollageImageIndex < 0) selectedCollageImageIndex = null;
  }

  if (cropMode) {
    cancelCrop();
  }

  if (!collageImages.length) {
    sourceImage = null;
    isUsingCanvasSource = false;
    imgLoaded = false;
    resetViewport();
    updateCollageInfo();
    requestRender();
    showToast('Foto dihapus dari kolase.', 'success');
    return;
  }

  rebuildCollageSource();
  showToast(`Foto ${removedIndex + 1} dihapus dari kolase.`, 'success');
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
  dragSwapTargetIndex = null;
  setPanningState(false);

  if (originalCollageImages.length) {
    setSelectedLayoutKey(originalSelectedLayoutKey || 'auto');
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
  if (selectedLayoutKey === 'auto') {
    syncLayoutPicker();
    return;
  }

  const presets = COLLAGE_LAYOUT_PRESETS[collageImages.length];
  if (!presets || !presets[selectedLayoutKey]) {
    setSelectedLayoutKey('auto');
    return;
  }

  syncLayoutPicker();
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
function getCollageFrameSlotRect(frameIndex) {
  if (frameIndex === null || frameIndex < 0 || frameIndex >= getVisibleCollageCount()) {
    return null;
  }

  const layout = getCollageLayout(getVisibleCollageCount(), selectedLayoutKey);
  const slot = layout[frameIndex];
  if (!slot) return null;

  const gap = getVisibleCollageCount() > 1 ? Math.max(8, Math.round(Math.min(canvas.width, canvas.height) * 0.008)) : 0;
  return getCollageSlotRect(slot, canvas.width, canvas.height, gap);
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

  if (selectedStampId !== null && stamps.some((stamp) => stamp.id === selectedStampId)) {
    stampSelect.value = selectedStampId;
  } else {
    stampSelect.selectedIndex = -1;
  }

  deleteStampBtn.disabled = stamps.length <= 1 || selectedStampId === null;
}

function syncAlignButtons(stamp) {
  const activePosition = stamp ? (stamp.positionPreset || 'left') : null;
  alignButtons.forEach((button) => {
    const isActive = button.dataset.position === activePosition;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function moveStampToPreset(stamp, preset) {
  if (!stamp || !preset || !canvas.width || !canvas.height) return;

  const horizontal = preset === 'center' ? 'center' : (preset === 'right' ? 'right' : 'left');
  const padding = Math.max(30, stamp.size * 0.75);
  const lineCount = Math.max(1, buildStampText(stamp).split('\n').length);
  const lineHeight = stamp.size * 1.25;

  stamp.textAlign = horizontal;
  stamp.x = horizontal === 'center'
    ? canvas.width / 2
    : (horizontal === 'right' ? canvas.width - padding : padding);
  stamp.y = canvas.height - padding - ((lineCount - 1) * lineHeight);
  stamp.positionPreset = preset;
  constrainStampTextPosition(ctx, stamp, canvas.width, canvas.height, 30);
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
  const activePosition = (stamp.positionPreset || getStampTextAlign(stamp) || 'left');
  stamp.positionPreset = activePosition;
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

function clearCollageSelection() {
  if (selectedCollageImageIndex === null) return;
  selectedCollageImageIndex = null;
  renderCollageSlots();
  requestRender();
}

function isCollageSelectionControl(target) {
  return !!(collageSlotList && target && collageSlotList.contains(target));
}

function ensureStampState() {
  if (!stamps.length) {
    stamps = [createStamp()];
    selectedStampId = stamps[0].id;
  } else if (selectedStampId !== null && !stamps.some((stamp) => stamp.id === selectedStampId)) {
    // Keep a valid active stamp during image or collage source updates.
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
  if (stamp.positionPreset === 'left' || stamp.positionPreset === 'center' || stamp.positionPreset === 'right') {
    stamp.textAlign = stamp.positionPreset;
  } else {
    stamp.textAlign = getStampTextAlign(stamp);
  }
  constrainStampTextPosition(ctx, stamp, canvas.width, canvas.height, 32);

  sizeValDisplay.textContent = `${stamp.size}px`;
  opacityValDisplay.textContent = `${stamp.opacity}%`;
  requestRender();
}

alignButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const stamp = getSelectedStamp();
    if (!stamp) return;

    const nextPreset = button.dataset.position || 'left';
    stamp.positionPreset = nextPreset;
    stamp.textAlign = nextPreset;
    moveStampToPreset(stamp, nextPreset);
    syncAlignButtons(stamp);
    requestRender();
  });
});

addStampBtn.addEventListener('click', addStamp);
deleteStampBtn.addEventListener('click', deleteSelectedStamp);

if (replaceImageChoice) {
  replaceImageChoice.addEventListener('click', () => resolveImageImportChoice('replace'));
}

if (appendImageChoice) {
  appendImageChoice.addEventListener('click', () => {
    if (appendImageChoice.disabled) return;
    resolveImageImportChoice('append');
  });
}

if (cancelImageChoice) {
  cancelImageChoice.addEventListener('click', () => resolveImageImportChoice('cancel'));
}

if (collageSlotList) {
  collageSlotList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const index = parseInt(button.dataset.index, 10);
    if (Number.isNaN(index)) return;

    if (button.dataset.action === 'select') {
      selectCollageImage(index);
      return;
    }

    if (button.dataset.action === 'delete') {
      if (!confirm(`Hapus Foto ${index + 1} dari kolase?`)) return;
      removeCollageImageAt(index);
    }
  });
}

resetViewBtn.addEventListener('click', () => {
  resetImageAdjustments();
});

clearBtn.addEventListener('click', () => {
  if (!confirm('Hapus foto ini?')) return;

  collageImages = [];
  collageFrameTransforms = [];
  originalCollageImages = [];
  originalSelectedLayoutKey = selectedLayoutKey;
  selectedCollageImageIndex = null;
  sourceImage = null;
  isUsingCanvasSource = false;
  imgLoaded = false;
  cropMode = false;
  cropRect = null;
  activeFrameIndex = null;
  initialFrameTransform = null;
  pinchFrameIndex = null;
  dragSwapTargetIndex = null;
  setPanningState(false);
  resetViewport();

  ensureStampState();
  syncControlsFromStamp(getSelectedStamp());
  updateCollageInfo();
  requestRender();
  showToast('Semua foto dihapus.', 'success');
});

const downloadButtons = Array.from(document.querySelectorAll('[data-save-photo]'));
downloadButtons.forEach((downloadButton) => {
  downloadButton.addEventListener('click', async () => {
    if (!imgLoaded) return alert('Belum ada foto untuk disimpan!');
    clearStampSelection();
    clearCollageSelection();
    renderForExport();
    await savePhoto(canvas, filePrefixInput, fileCounterInput, dirHandle, filenamePreview, downloadButton);
    requestRender();
  });
});

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

// Android browsers and embedded WebViews do not always honor
// `overscroll-behavior` on an internal scrolling panel. Mark Android so its
// mobile rules can turn off scroll snapping, then cancel only pulls made after
// a scroll boundary is reached.
(() => {
  const editorPanel = document.querySelector('.app-layout .controls');
  if (!editorPanel) return;

  const isAndroid = /Android/i.test(navigator.userAgent);
  document.documentElement.classList.toggle('is-android', isAndroid);

  let touchStartX = 0;
  let touchStartY = 0;

  const getScrollableAncestor = (target) => {
    let element = target instanceof Element ? target : null;

    while (element && element !== document.body) {
      const overflowY = window.getComputedStyle(element).overflowY;
      if (/(auto|scroll)/.test(overflowY) && element.scrollHeight > element.clientHeight) {
        return element;
      }
      if (element === editorPanel) break;
      element = element.parentElement;
    }

    return editorPanel.contains(target) ? editorPanel : null;
  };

  document.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!isAndroid) return;
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    // Do not interfere with horizontal gestures or the canvas pinch/pan logic.
    if (Math.abs(deltaX) > Math.abs(deltaY)) return;

    const scrollable = getScrollableAncestor(event.target);
    if (!scrollable) {
      event.preventDefault();
      return;
    }

    const atTop = scrollable.scrollTop <= 0;
    const atBottom = Math.ceil(scrollable.scrollTop + scrollable.clientHeight) >= scrollable.scrollHeight;
    if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
      event.preventDefault();
    }
  }, { passive: false });
})();
