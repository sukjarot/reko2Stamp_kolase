const CACHE_NAME = 'reko-stamp-v2.5.2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './icon ultimate.png',
  './manifest.json'
  // Jika Anda mendownload font secara lokal, masukkan file font di sini (misal: './font/roboto.ttf')
];


// 1. Install Service Worker & Cache File
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Menyimpan aset offline...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. Activate & Hapus Cache Lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('Menghapus cache lama:', key);
          return caches.delete(key);
        }
      }));
    })
  );
});

// 3. Fetch (Cek Cache Dulu, Kalau Gak Ada Baru Online)
self.addEventListener('fetch', (event) => {
  // Abaikan request ke API Peta (karena butuh online)
  if (event.request.url.includes('openstreetmap.org')) {
    return; 
  }

  // Abaikan request Google Fonts (kecuali Anda sudah download lokal)
  if (event.request.url.includes('fonts.googleapis.com') || event.request.url.includes('fonts.gstatic.com')) {
     // Biarkan browser mencoba fetch online, kalau gagal dia pakai font default
     return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cache jika ada, jika tidak, fetch dari jaringan
      return response || fetch(event.request);
    })
  );

});





