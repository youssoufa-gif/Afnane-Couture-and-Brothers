// ===================================================================
// SERVICE WORKER — Sarkin Wanka v1.0
// ===================================================================
const CACHE_NAME = 'sw-cache-v4';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/atelier.html',
    '/boutique.html',
    '/bibliotheque.html',
    '/parametre.html',
    '/tailleur.html',
    '/assets/css/style.v2.css',
    '/assets/js/app.v2.js',
    'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE.filter(url => !url.startsWith('http')));
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Ne pas intercepter les requêtes Firebase
    if (event.request.url.includes('firestore') ||
        event.request.url.includes('firebase') ||
        event.request.url.includes('googleapis.com/identitytoolkit')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    return response;
                }
                const cloned = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
                return response;
            }).catch(() => {
                // Retourner la page principale en cas d'erreur réseau
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});
