const CACHE_NAME = 'kas-warga-firebase-v1.0'; // Ganti versi jika ada update file
const urlsToCache = [
    './', 
    './index.html',
    './app.js',
    './manifest.json',
    // Cache Firebase CDN dan Tailwind CDN
    'https://cdn.tailwindcss.com', 
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js',
    './icon-192.png', 
    './icon-512.png'
];

// Event: INSTALL - Service Worker menginstal dan menyimpan aset ke cache
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching App Shell');
                // Tambahkan semua URL ke cache
                return cache.addAll(urlsToCache);
            })
    );
});

// Event: FETCH - Strategi Cache-First (untuk aset statis)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Jika ada di cache, kembalikan dari cache
                if (response) {
                    return response;
                }
                
                // Jika tidak ada di cache, lakukan permintaan jaringan (online)
                return fetch(event.request);
            })
    );
});

// Event: ACTIVATE - Service Worker menghapus cache lama
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        // Hapus cache yang tidak termasuk dalam whitelist
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});