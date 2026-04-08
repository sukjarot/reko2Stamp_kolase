/* ===========================
   FILE STORAGE FUNCTIONALITY
   ============================ */

let dirHandle = null;

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

function setupStorageModal(storageBtn, storageModal, pickDirBtn, saveSettingsBtn, cancelSettingsBtn, filePrefixInput, fileCounterInput, filenamePreview, dirStatus, storageInfo, activeFolderLabel) {
  const closeSettings = () => { 
    storageModal.style.display = 'none'; 
  };

  storageBtn.addEventListener('click', () => {
    storageModal.style.display = 'flex';
    updateStoragePreview(filePrefixInput, fileCounterInput, filenamePreview);
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
      dirStatus.textContent = `✅ Folder Terpilih: ${dirHandle.name}`;
      dirStatus.style.color = '#10b981';
      storageInfo.style.display = 'block';
      activeFolderLabel.textContent = dirHandle.name;
      
      alert("Folder berhasil diset! Foto akan disimpan otomatis ke folder ini.");
    } catch (err) {
      console.warn(err);
      alert("Gagal memilih folder atau dibatalkan.");
    }
  });

  saveSettingsBtn.addEventListener('click', async () => {
    await saveSetting('prefix', filePrefixInput.value);
    await saveSetting('counter', fileCounterInput.value);
    if (dirHandle) await saveSetting('dirHandle', dirHandle);
    closeSettings();
  });

  cancelSettingsBtn.addEventListener('click', closeSettings);
}

async function savePhoto(canvas, filePrefixInput, fileCounterInput, dirHandle, filenamePreview) {
  const newBtn = document.getElementById('downloadFinal');
  
  if (!newBtn) return alert("Tombol Simpan tidak ditemukan!");

  newBtn.textContent = "⏳ Memproses...";
  newBtn.disabled = true;

  try {
    // A. KOMPRESI
    let quality = 0.92;
    let dataURL = canvas.toDataURL('image/jpeg', quality);
    const getFileSize = (base64String) => (base64String.length - "data:image/jpeg;base64,".length) * (3 / 4);
    
    while (getFileSize(dataURL) > 4 * 1024 * 1024 && quality > 0.1) {
      quality -= 0.05;
      dataURL = canvas.toDataURL('image/jpeg', quality);
    }

    // B. PENYIMPANAN
    const prefix = filePrefixInput ? filePrefixInput.value.replace(/[^a-zA-Z0-9_-]/g, "") : "RekoStamp_";
    const count = fileCounterInput ? String(fileCounterInput.value).padStart(3, '0') : "001";
    const finalName = `${prefix}${count}.jpg`;

    if (dirHandle) {
      try {
        const opts = { mode: 'readwrite' };
        if ((await dirHandle.queryPermission(opts)) !== 'granted') {
          const perm = await dirHandle.requestPermission(opts);
          if (perm !== 'granted') throw new Error("Akses folder ditolak user");
        }

        const fileHandle = await dirHandle.getFileHandle(finalName, { create: true });
        const writable = await fileHandle.createWritable();
        
        const blob = dataURLToBlob(dataURL);
        await writable.write(blob);
        await writable.close();
        
        let nextCount = parseInt(fileCounterInput.value) + 1;
        fileCounterInput.value = nextCount;
        await saveSetting('counter', nextCount);
        updateStoragePreview(filePrefixInput, fileCounterInput, filenamePreview);

        alert(`✅ Foto tersimpan: ${finalName} di folder ${dirHandle.name}`);
      } catch (err) {
        console.error("Gagal simpan folder:", err);
        alert("Gagal simpan ke folder (Izin ditolak atau Error). Mengunduh manual...");
        fallbackDownload(dataURL, finalName);
      }
    } else {
      fallbackDownload(dataURL, finalName);
    }
  } finally {
    newBtn.textContent = "💾 Simpan Foto";
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

async function restoreStorageSettings(filePrefixInput, fileCounterInput, dirStatus, storageInfo, activeFolderLabel) {
  try {
    const savedPrefix = await loadSetting('prefix');
    const savedCounter = await loadSetting('counter');
    const savedDir = await loadSetting('dirHandle'); 

    if (savedPrefix) filePrefixInput.value = savedPrefix;
    if (savedCounter) fileCounterInput.value = savedCounter;

    if (savedDir) {
      dirHandle = savedDir;
      dirStatus.textContent = `✅ Folder Terhubung: ${dirHandle.name}`;
      dirStatus.style.color = '#10b981';
      if (storageInfo) storageInfo.style.display = 'block';
      if (activeFolderLabel) activeFolderLabel.textContent = dirHandle.name;
    }
  } catch (err) {
    console.error("Gagal memuat pengaturan:", err);
  }
}
