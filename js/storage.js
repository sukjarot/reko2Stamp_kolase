/* ===========================
   FILE STORAGE FUNCTIONALITY
   ============================ */

let dirHandle = null;
const DEFAULT_DIR_STATUS = "Belum ada folder dipilih. File akan diunduh ke folder Download default browser/sistem.";

function dataURLToBlob(dataURL) {
  const parts = dataURL.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
}

function updateStoragePreview(filePrefixInput, fileCounterInput, filenamePreview) {
  const prefix = filePrefixInput.value.replace(/[^a-zA-Z0-9_-]/g, "");
  const count = String(fileCounterInput.value).padStart(3, '0');
  filenamePreview.textContent = `${prefix}${count}.jpg`;
}

function syncStorageUI(dirStatus, storageInfo, activeFolderLabel, clearDirBtn) {
  const hasCustomDirectory = !!dirHandle;

  if (dirStatus) {
    dirStatus.textContent = hasCustomDirectory
      ? `\u2705 Folder Terhubung: ${dirHandle.name}`
      : DEFAULT_DIR_STATUS;
    dirStatus.style.color = hasCustomDirectory ? '#10b981' : '#cbd5e1';
  }

  if (storageInfo) {
    storageInfo.style.display = hasCustomDirectory ? 'block' : 'none';
  }

  if (activeFolderLabel) {
    activeFolderLabel.textContent = hasCustomDirectory ? dirHandle.name : 'Download default';
  }

  if (clearDirBtn) {
    clearDirBtn.disabled = !hasCustomDirectory;
  }
}

async function clearSavedDirectory(dirStatus, storageInfo, activeFolderLabel, clearDirBtn) {
  dirHandle = null;
  await deleteSetting('dirHandle');
  syncStorageUI(dirStatus, storageInfo, activeFolderLabel, clearDirBtn);
}

function setupStorageModal(storageBtn, storageModal, pickDirBtn, clearDirBtn, saveSettingsBtn, cancelSettingsBtn, filePrefixInput, fileCounterInput, filenamePreview, dirStatus, storageInfo, activeFolderLabel) {
  const closeSettings = () => {
    storageModal.style.display = 'none';
  };

  storageBtn.addEventListener('click', () => {
    storageModal.style.display = 'flex';
    updateStoragePreview(filePrefixInput, fileCounterInput, filenamePreview);
    syncStorageUI(dirStatus, storageInfo, activeFolderLabel, clearDirBtn);
  });

  filePrefixInput.addEventListener('input', () => {
    updateStoragePreview(filePrefixInput, fileCounterInput, filenamePreview);
  });

  fileCounterInput.addEventListener('input', () => {
    updateStoragePreview(filePrefixInput, fileCounterInput, filenamePreview);
  });

  pickDirBtn.addEventListener('click', async () => {
    try {
      if (!('showDirectoryPicker' in window)) {
        alert("Browser ini tidak mendukung pemilihan folder otomatis. Gunakan Chrome Desktop atau Edge.");
        return;
      }

      dirHandle = await window.showDirectoryPicker();
      syncStorageUI(dirStatus, storageInfo, activeFolderLabel, clearDirBtn);

      alert("Folder berhasil diset! Foto akan disimpan otomatis ke folder ini.");
    } catch (err) {
      console.warn(err);
      alert("Gagal memilih folder atau dibatalkan.");
    }
  });

  if (clearDirBtn) {
    clearDirBtn.addEventListener('click', async () => {
      if (!dirHandle) {
        syncStorageUI(dirStatus, storageInfo, activeFolderLabel, clearDirBtn);
        alert("Penyimpanan sudah memakai folder Download default browser/sistem.");
        return;
      }

      try {
        await clearSavedDirectory(dirStatus, storageInfo, activeFolderLabel, clearDirBtn);
        alert("Folder khusus dihapus. Penyimpanan kembali ke folder Download default browser/sistem.");
      } catch (err) {
        console.error("Gagal mereset folder penyimpanan:", err);
        alert("Gagal mereset folder penyimpanan.");
      }
    });
  }

  saveSettingsBtn.addEventListener('click', async () => {
    await saveSetting('prefix', filePrefixInput.value);
    await saveSetting('counter', fileCounterInput.value);

    if (dirHandle) {
      await saveSetting('dirHandle', dirHandle);
    } else {
      await deleteSetting('dirHandle');
    }

    closeSettings();
  });

  cancelSettingsBtn.addEventListener('click', closeSettings);
  syncStorageUI(dirStatus, storageInfo, activeFolderLabel, clearDirBtn);
}

async function savePhoto(canvas, filePrefixInput, fileCounterInput, currentDirHandle, filenamePreview) {
  const newBtn = document.getElementById('downloadFinal');

  if (!newBtn) {
    return alert("Tombol Simpan tidak ditemukan!");
  }

  newBtn.textContent = "\u23F3 Memproses...";
  newBtn.disabled = true;

  try {
    let quality = 0.92;
    let dataURL = canvas.toDataURL('image/jpeg', quality);
    const getFileSize = (base64String) => (base64String.length - "data:image/jpeg;base64,".length) * (3 / 4);

    while (getFileSize(dataURL) > 4 * 1024 * 1024 && quality > 0.1) {
      quality -= 0.05;
      dataURL = canvas.toDataURL('image/jpeg', quality);
    }

    const prefix = filePrefixInput ? filePrefixInput.value.replace(/[^a-zA-Z0-9_-]/g, "") : "RekoStamp_";
    const count = fileCounterInput ? String(fileCounterInput.value).padStart(3, '0') : "001";
    const finalName = `${prefix}${count}.jpg`;

    if (currentDirHandle) {
      try {
        const opts = { mode: 'readwrite' };
        if ((await currentDirHandle.queryPermission(opts)) !== 'granted') {
          const perm = await currentDirHandle.requestPermission(opts);
          if (perm !== 'granted') {
            throw new Error("Akses folder ditolak user");
          }
        }

        const fileHandle = await currentDirHandle.getFileHandle(finalName, { create: true });
        const writable = await fileHandle.createWritable();

        const blob = dataURLToBlob(dataURL);
        await writable.write(blob);
        await writable.close();

        const currentCount = parseInt(fileCounterInput.value, 10) || 1;
        const nextCount = currentCount + 1;
        fileCounterInput.value = nextCount;
        await saveSetting('counter', nextCount);
        updateStoragePreview(filePrefixInput, fileCounterInput, filenamePreview);

        alert(`\u2705 Foto tersimpan: ${finalName} di folder ${currentDirHandle.name}`);
      } catch (err) {
        console.error("Gagal simpan folder:", err);
        alert("Gagal simpan ke folder khusus. File akan diunduh lewat browser default.");
        fallbackDownload(dataURL, finalName);
      }
    } else {
      fallbackDownload(dataURL, finalName);
    }
  } finally {
    newBtn.textContent = "\uD83D\uDCBE Simpan Foto";
    newBtn.disabled = false;
  }
}

function fallbackDownload(url, name) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function restoreStorageSettings(filePrefixInput, fileCounterInput, dirStatus, storageInfo, activeFolderLabel, clearDirBtn) {
  try {
    const savedPrefix = await loadSetting('prefix');
    const savedCounter = await loadSetting('counter');
    const savedDir = await loadSetting('dirHandle');

    if (savedPrefix !== undefined) {
      filePrefixInput.value = savedPrefix;
    }

    if (savedCounter !== undefined) {
      fileCounterInput.value = savedCounter;
    }

    dirHandle = savedDir || null;
    syncStorageUI(dirStatus, storageInfo, activeFolderLabel, clearDirBtn);
  } catch (err) {
    console.error("Gagal memuat pengaturan:", err);
  }
}
