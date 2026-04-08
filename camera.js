/* ===========================
   CAMERA FUNCTIONALITY
   ============================ */

let currentStream = null; 
let facingMode = 'environment'; 
let currentRotation = 0;

function stopCamera() { 
  if (currentStream) { 
    currentStream.getTracks().forEach(t => t.stop()); 
    currentStream = null; 
  }
}

function updateVideoStyle(cameraVideo) {
  let t = `rotate(${currentRotation}deg)`; 
  if (facingMode === 'user') t += ` scaleX(-1)`;
  cameraVideo.style.transform = t; 
  cameraVideo.style.objectFit = (currentRotation % 180 !== 0) ? "contain" : "cover";
}

async function startCamera(cameraVideo, cameraModal) {
  if (currentStream) stopCamera(); 
  updateVideoStyle(cameraVideo);
  
  try {
    currentStream = await navigator.mediaDevices.getUserMedia({
      video: { 
        facingMode: facingMode, 
        width: { ideal: 4096 }, 
        height: { ideal: 2160 } 
      }
    });
    cameraVideo.srcObject = currentStream; 
    cameraModal.style.display = 'flex';
  } catch (err) { 
    alert("Gagal akses kamera."); 
    cameraModal.style.display = 'none'; 
  }
}

function setupCameraEvents(openCameraBtn, closeCamBtn, shutterBtn, switchCamBtn, rotateCamBtn, cameraVideo, cameraModal, onPhotoTaken) {
  openCameraBtn.addEventListener('click', async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { 
      alert("Browser error."); 
      return; 
    }
    await startCamera(cameraVideo, cameraModal);
  });

  closeCamBtn.addEventListener('click', () => { 
    stopCamera(); 
    cameraModal.style.display = 'none'; 
  });

  switchCamBtn.addEventListener('click', () => { 
    facingMode = (facingMode === 'environment') ? 'user' : 'environment'; 
    startCamera(cameraVideo, cameraModal); 
  });

  rotateCamBtn.addEventListener('click', () => { 
    currentRotation = (currentRotation + 90) % 360; 
    updateVideoStyle(cameraVideo); 
  });

  shutterBtn.addEventListener('click', () => {
    if (!currentStream) return;
    
    const vW = cameraVideo.videoWidth; 
    const vH = cameraVideo.videoHeight;
    const tC = document.createElement('canvas'); 
    const ctxT = tC.getContext('2d');
    
    if (currentRotation % 180 !== 0) { 
      tC.width = vH; 
      tC.height = vW; 
    } else { 
      tC.width = vW; 
      tC.height = vH; 
    }
    
    ctxT.translate(tC.width / 2, tC.height / 2); 
    ctxT.rotate(currentRotation * Math.PI / 180);
    
    if (facingMode === 'user') ctxT.scale(-1, 1);
    
    ctxT.drawImage(cameraVideo, -vW / 2, -vH / 2, vW, vH);
    
    stopCamera(); 
    cameraModal.style.display = 'none'; 
    
    onPhotoTaken(tC);
  });
}
