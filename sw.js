const CACHE_NAME = 'iraqi-exam-builder-offline-v1';

const LOCAL_ASSETS = [
    './',
    './index.html',
    './manifest.json'
];

const CDN_ASSETS = [
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap'
];

// التثبيت: حفظ الملفات الأساسية ومكتبات التصميم والمعادلات
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            await cache.addAll(LOCAL_ASSETS);
            // حفظ المكتبات الخارجية بشكل مستقل حتى لا يفشل التثبيت إذا تعذر أحدها
            await Promise.allSettled(
                CDN_ASSETS.map(async (url) => {
                    try {
                        const res = await fetch(url, { mode: 'cors' });
                        if (res && res.ok) {
                            await cache.put(url, res.clone());
                        }
                    } catch (e) {
                        try {
                            const noCorsRes = await fetch(url, { mode: 'no-cors' });
                            if (noCorsRes) {
                                await cache.put(url, noCorsRes.clone());
                            }
                        } catch (_) {}
                    }
                })
            );
        }).then(() => self.skipWaiting())
    );
});

// التفعيل: حذف أي نسخ كاش قديمة
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// الاستجابة للطلبات:
// - صفحة HTML: الإنترنت أولاً (لجلب التحديثات فوراً) ثم الأوفلاين
// - المكتبات والخطوط: الكاش أولاً ثم الإنترنت مع الحفظ التلقائي
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const isHtmlNav =
        event.request.mode === 'navigate' ||
        (event.request.headers.get('accept') || '').includes('text/html') ||
        url.pathname.endsWith('/index.html');

    if (isHtmlNav) {
        event.respondWith(
            fetch(event.request)
                .then((networkRes) => {
                    if (networkRes && networkRes.ok) {
                        const copy = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return networkRes;
                })
                .catch(async () => {
                    const cached = await caches.match(event.request);
                    return cached || caches.match('./index.html');
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedRes) => {
            if (cachedRes) return cachedRes;

            return fetch(event.request)
                .then((networkRes) => {
                    if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
                        const copy = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                    }
                    return networkRes;
                })
                .catch(() => cachedRes);
        })
    );
});
