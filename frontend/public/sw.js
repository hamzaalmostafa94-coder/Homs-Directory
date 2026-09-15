/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'homs-dir-v2'; // تغيير الإصدار لفرض التحديث

// تفعيل العامل السري الجديد فوراً
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// تنظيف الذاكرة القديمة المزعجة بمجرد التحديث
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
          return Promise.resolve(); // لإرضاء الفاحص التلقائي فقط
        })
      );
    })
  );
});

// استراتيجية (الإنترنت أولاً): تجلب أحدث الملفات دائماً
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
