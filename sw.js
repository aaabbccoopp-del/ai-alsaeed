const CACHE_NAME = 'saeed-ai-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './avatar.png'
];

// تثبيت التطبيق وحفظ الملفات في الكاش
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// جلب الملفات بسرعة من الكاش عند فتح التطبيق
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});

