// ===================================================================
// SERVICE WORKER — SARKIN WANKA NIGER v3.0 (Mode Hors-Ligne Complet)
// ===================================================================
const CACHE_NAME = 'sarkin-wanka-v2.5';

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

// Page hors-ligne avec logo SARKIN WANKA NIGER
const OFFLINE_PAGE = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SARKIN WANKA NIGER — Hors-ligne</title>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;700&family=Outfit:wght@300;400;600&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Outfit',sans-serif;background:linear-gradient(135deg,#1a1a0e 0%,#2c2a1a 50%,#1a1a0e 100%);min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:2rem;}
    .logo-wrap{border-radius:50%;background:linear-gradient(135deg,#A67C00,#D4A800,#A67C00);padding:5px;box-shadow:0 0 60px rgba(166,124,0,0.6),0 0 120px rgba(166,124,0,0.2);margin-bottom:2rem;animation:pulse 2.5s ease-in-out infinite;}
    .logo-wrap img{width:130px;height:130px;border-radius:50%;object-fit:cover;border:3px solid #1a1a0e;display:block;}
    @keyframes pulse{0%,100%{box-shadow:0 0 40px rgba(166,124,0,0.5),0 0 80px rgba(166,124,0,0.15);}50%{box-shadow:0 0 80px rgba(166,124,0,0.8),0 0 140px rgba(166,124,0,0.3);}}
    h1{font-family:'Cormorant Garamond',serif;font-size:2rem;color:#A67C00;letter-spacing:3px;text-transform:uppercase;margin-bottom:.5rem;}
    .sub{font-size:.85rem;letter-spacing:2px;color:rgba(166,124,0,0.6);text-transform:uppercase;margin-bottom:2.5rem;}
    .card{background:rgba(255,255,255,0.05);backdrop-filter:blur(20px);border:1px solid rgba(166,124,0,0.2);border-radius:20px;padding:2rem 2.5rem;max-width:380px;width:100%;}
    .wifi-icon{font-size:3.5rem;margin-bottom:1rem;opacity:.7;}
    h2{font-family:'Cormorant Garamond',serif;font-size:1.6rem;color:#fff;margin-bottom:.8rem;}
    p{font-size:.9rem;color:rgba(255,255,255,0.6);line-height:1.7;margin-bottom:1.5rem;}
    .btn{display:inline-block;background:linear-gradient(135deg,#A67C00,#D4A800);color:#fff;padding:13px 30px;border-radius:30px;font-weight:700;font-size:.95rem;text-decoration:none;cursor:pointer;border:none;font-family:'Outfit',sans-serif;box-shadow:0 6px 25px rgba(166,124,0,0.4);transition:transform .2s;letter-spacing:.5px;}
    .btn:hover{transform:translateY(-2px);}
    .note{margin-top:1.5rem;font-size:.78rem;color:rgba(166,124,0,0.5);letter-spacing:1px;}
  </style>
</head>
<body>
  <div class="logo-wrap">
    <img src="/assets/img/logo.png" alt="SARKIN WANKA NIGER" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2250%22 fill=%22%23A67C00%22/><text x=%2250%22 y=%2265%22 text-anchor=%22middle%22 font-size=%2240%22 fill=%22white%22>SW</text></svg>'">
  </div>
  <h1>SARKIN WANKA</h1>
  <div class="sub">🇳🇪 NIGER &mdash; Fashion Design</div>
  <div class="card">
    <div class="wifi-icon">📡</div>
    <h2>Pas de connexion</h2>
    <p>Vous êtes actuellement hors-ligne.<br>Vos données locales restent disponibles.<br>Reconnectez-vous pour synchroniser.</p>
    <button class="btn" onclick="window.location.reload()">🔄 Réessayer</button>
    <div class="note">SARKIN WANKA NIGER &mdash; Données sauvegardées localement</div>
  </div>
</body>
</html>`;

// ===== INSTALLATION =====
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            // Mettre en cache les ressources locales une par une (évite l'échec global)
            for (const url of ASSETS_TO_CACHE) {
                try {
                    await cache.add(url);
                } catch(e) {
                    console.warn('[SW] Impossible de mettre en cache :', url);
                }
            }
            // Stocker la page hors-ligne manuellement
            const offlineResponse = new Response(OFFLINE_PAGE, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
            await cache.put('/offline.html', offlineResponse);
        })
    );
    self.skipWaiting();
});

// ===== ACTIVATION =====
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// ===== STRATÉGIE FETCH =====
self.addEventListener('fetch', event => {
    const url = event.request.url;

    // Laisser passer Firebase (Firestore gère son propre offline)
    if (url.includes('firestore.googleapis.com') ||
        url.includes('firebase') ||
        url.includes('identitytoolkit') ||
        url.includes('wa.me') ||
        url.includes('ui-avatars.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;

            return fetch(event.request).then(response => {
                if (!response || response.status !== 200 || response.type === 'opaque') {
                    return response;
                }
                // Mettre en cache dynamiquement les ressources valides
                const cloned = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
                return response;
            }).catch(() => {
                // Hors-ligne : page de navigation → page offline custom
                if (event.request.mode === 'navigate') {
                    return caches.match('/offline.html')
                        .then(r => r || caches.match('/index.html'));
                }
                // Image manquante → rien (évite les erreurs console)
            });
        })
    );
});
