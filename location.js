/* ===========================
   LOCATION, GPS & MAP FUNCTIONALITY
   ============================ */

const LOCATIONIQ_KEY = 'pk.9415d0e1f42e8b4c9b6d9be7be2f5108';

let mapInstance = null;
let mapMarker = null;
let currentLat = -7.605;
let currentLon = 111.905;
let gpsWatchId = null;
let followGPS = false;
let debounceTimer = null;

function emitLocationValueChanged(value) {
  document.dispatchEvent(new CustomEvent('reko:location-updated', {
    detail: { value }
  }));
}

function debounceReverseGeocode(lat, lon, delay = 700) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { 
    reverseGeocode(lat, lon); 
  }, delay);
}

async function searchLocation(query, suggestionsBox, locInput, gpsFollowBtn, mapInstance) {
  try {
    const url = `https://us1.locationiq.com/v1/search.php?key=${LOCATIONIQ_KEY}&q=${encodeURIComponent(query)}&format=json&limit=5`;
    const response = await fetch(url);
    const results = await response.json();
    
    if (!Array.isArray(results)) { 
      suggestionsBox.style.display = "none"; 
      return; 
    }
    
    suggestionsBox.innerHTML = "";
    results.forEach(item => {
      const div = document.createElement("div");
      div.className = "suggestion-item";
      div.textContent = item.display_name;
      div.onclick = () => {
        followGPS = false; 
        stopFollowGPS(); 
        gpsFollowBtn.textContent = "🧭 Ikuti GPS: OFF";
        
        locInput.value = `${item.display_name}\n(${parseFloat(item.lat).toFixed(5)}, ${parseFloat(item.lon).toFixed(5)})`;
        emitLocationValueChanged(locInput.value);
        suggestionsBox.style.display = "none";
        
        currentLat = parseFloat(item.lat); 
        currentLon = parseFloat(item.lon);
        
        if (mapInstance) { 
          mapInstance.setView([currentLat, currentLon], 16); 
          if (mapMarker) mapMarker.setLatLng([currentLat, currentLon]); 
        }
      };
      suggestionsBox.appendChild(div);
    });
    suggestionsBox.style.display = "block";
  } catch (err) { 
    console.error("Autocomplete error:", err); 
    suggestionsBox.style.display = "none"; 
  }
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://us1.locationiq.com/v1/reverse.php?key=${LOCATIONIQ_KEY}&lat=${lat}&lon=${lon}&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!data.display_name) throw "No address";
    
    const parts = data.display_name.split(',');
    const cleanAddress = parts.slice(0, 4).join(',').trim();
    
    const locValue = `${cleanAddress}\n(${lat.toFixed(5)}, ${lon.toFixed(5)})`;
    document.getElementById('locInput').value = locValue;
    emitLocationValueChanged(locValue);
  } catch { 
    const locValue = `(${lat.toFixed(5)}, ${lon.toFixed(5)})`;
    document.getElementById('locInput').value = locValue;
    emitLocationValueChanged(locValue);
  }
}

function startFollowGPS() {
  if (!navigator.geolocation) { 
    alert("GPS tidak didukung"); 
    return; 
  }
  
  gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      currentLat = pos.coords.latitude; 
      currentLon = pos.coords.longitude;
      
      if (mapInstance) { 
        mapInstance.setView([currentLat, currentLon], 17); 
        if (mapMarker) mapMarker.setLatLng([currentLat, currentLon]); 
      }
      
      debounceReverseGeocode(currentLat, currentLon);
    },
    () => alert("Gagal akses GPS"), 
    { enableHighAccuracy: true }
  );
}

function stopFollowGPS() { 
  if (gpsWatchId) { 
    navigator.geolocation.clearWatch(gpsWatchId); 
    gpsWatchId = null; 
  } 
}

function setupGPSButton(gpsBtn, gpsFollowBtn) {
  gpsBtn.addEventListener('click', () => {
    followGPS = false; 
    stopFollowGPS(); 
    gpsFollowBtn.textContent = "🧭 Ikuti GPS: OFF";
    
    if (!navigator.geolocation) return alert("GPS tidak didukung");
    
    gpsBtn.innerHTML = "⏳ Mencari...";
    navigator.geolocation.getCurrentPosition(async (p) => {
      currentLat = p.coords.latitude; 
      currentLon = p.coords.longitude;
      
      await debounceReverseGeocode(currentLat, currentLon);
      gpsBtn.innerHTML = "📍 Cek GPS";
      
      if (mapInstance) { 
        mapInstance.setView([currentLat, currentLon], 16); 
        if (mapMarker) mapMarker.setLatLng([currentLat, currentLon]); 
      }
    }, (err) => { 
      alert("Gagal akses GPS."); 
      gpsBtn.innerHTML = "📍 Cek GPS"; 
    }, { enableHighAccuracy: true });
  });

  gpsFollowBtn.addEventListener('click', () => {
    followGPS = !followGPS;
    gpsFollowBtn.textContent = followGPS ? "🧭 Ikuti GPS: ON" : "🧭 Ikuti GPS: OFF";
    if (followGPS) startFollowGPS(); 
    else stopFollowGPS();
  });
}

function initLeafletMap() {
  if (mapInstance) return;
  
  mapInstance = L.map('mapContainer').setView([currentLat, currentLon], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
  
  const geocoder = L.Control.geocoder({ defaultMarkGeocode: false })
    .on('markgeocode', function(e) {
      const bbox = e.geocode.center; 
      mapInstance.setView([bbox.lat, bbox.lng], 16); 
      updateMarkerPosition(bbox.lat, bbox.lng);
    })
    .addTo(mapInstance);
  
  mapInstance.on('click', (e) => { 
    updateMarkerPosition(e.latlng.lat, e.latlng.lng); 
  });
}

function updateMarkerPosition(lat, lon) {
  currentLat = lat; 
  currentLon = lon;
  followGPS = false; 
  stopFollowGPS();
  
  const gpsFollowBtn = document.getElementById('gpsFollowBtn');
  if (gpsFollowBtn) gpsFollowBtn.textContent = "🧭 Ikuti GPS: OFF";

  if (mapMarker) { 
    mapMarker.setLatLng([lat, lon]); 
  } else {
    mapMarker = L.marker([lat, lon], { draggable: true }).addTo(mapInstance);
    mapMarker.on('dragend', (e) => {
      const pos = e.target.getLatLng(); 
      currentLat = pos.lat; 
      currentLon = pos.lng;
      
      followGPS = false; 
      stopFollowGPS();
      
      if (gpsFollowBtn) gpsFollowBtn.textContent = "🧭 Ikuti GPS: OFF";
      debounceReverseGeocode(currentLat, currentLon);
    });
  }
  
  debounceReverseGeocode(lat, lon);
}

function setupMapButton(mapBtn, mapModal, closeMapBtn, gpsFollowBtn) {
  mapBtn.addEventListener('click', () => {
    mapModal.style.display = 'flex';
    setTimeout(() => {
      initLeafletMap(); 
      mapInstance.invalidateSize(); 
      mapInstance.setView([currentLat, currentLon], 15);
      
      if (mapMarker) { 
        mapMarker.setLatLng([currentLat, currentLon]); 
      } else {
        mapMarker = L.marker([currentLat, currentLon], { draggable: true }).addTo(mapInstance);
        mapMarker.on('dragend', (e) => {
          const pos = e.target.getLatLng(); 
          currentLat = pos.lat; 
          currentLon = pos.lng;
          
          followGPS = false; 
          stopFollowGPS();
          
          if (gpsFollowBtn) gpsFollowBtn.textContent = "🧭 Ikuti GPS: OFF";
          debounceReverseGeocode(currentLat, currentLon);
        });
      }
    }, 200);
  });

  closeMapBtn.addEventListener('click', () => {
    followGPS = false; 
    stopFollowGPS(); 
    gpsFollowBtn.textContent = "🧭 Ikuti GPS: OFF";
    mapModal.style.display = 'none';
  });
}

function setupLocationInput(locInput, suggestionsBox, gpsFollowBtn) {
  let searchDebounce = null;
  
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".location-wrapper")) {
      suggestionsBox.style.display = "none";
    }
  });

  locInput.addEventListener("input", () => {
    followGPS = false; 
    stopFollowGPS(); 
    gpsFollowBtn.textContent = "🧭 Ikuti GPS: OFF";
    
    const query = locInput.value.split('\n')[0].replace(/[^\w\s.,-]/gi, '').trim();
    
    if (query.length < 3) { 
      suggestionsBox.style.display = "none"; 
      return; 
    }
    
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => { 
      searchLocation(query, suggestionsBox, locInput, gpsFollowBtn, mapInstance); 
    }, 500);
  });

  locInput.addEventListener("scroll", () => { 
    suggestionsBox.style.display = "none"; 
  });
}
