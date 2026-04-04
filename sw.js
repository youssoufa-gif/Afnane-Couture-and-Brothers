// ===================================================================
// SERVICE WORKER — AFNANE COUTURE & BROTHERS v4.0 (Mode Hors-Ligne)
// ===================================================================
const CACHE_NAME = 'afnane-v4.0';

const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/atelier.html',
    '/boutique.html',
    '/bibliotheque.html',
    '/parametre.html',
    '/tailleur.html',
    '/manifest.json',
    '/assets/css/style.v2.css',
    '/assets/js/app.v2.js',
    '/assets/img/logo.png'
];

// Page hors-ligne avec le nouveau branding AFNANE COUTURE
const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Afnane Couture & Brothers — Hors-ligne</title>
  <style>
    body{font-family:sans-serif;background:#f4f7fa;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;}
    .card{background:white;padding:2rem;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.1);text-align:center;}
    h1{color:#0056b3;}
    .btn{background:#0056b3;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:1rem;}
  </style>
</head>
<body>
  <div class="card">
    <h1>Mode Hors-ligne</h1>
    <p>Afnane Couture & Brothers<br>Vérifiez votre connexion internet.</p>
    <a href="javascript:location.reload()" class="btn">Réessayer</a>
  </div>
</body>
</html>`;

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(OFFLINE_PAGE))
        );
        return;
    }
    event.respondWith(
        caches.match(event.request).then(response => response || fetch(event.request))
    );
});
