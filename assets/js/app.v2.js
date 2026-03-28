// ===================================================================
// SARKIN WANKA — app.js (Version Firebase Sécurisée)
// ===================================================================

// ===================================================================
// FIREBASE CONFIG — Sarkin Wanka Project Keys
// ===================================================================
const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyCsZjFDDLZ5_T72hLjULbiedB30yxjLxcI",
    authDomain:        "sarkin-wanka.firebaseapp.com",
    projectId:         "sarkin-wanka",
    storageBucket:     "sarkin-wanka.firebasestorage.app",
    messagingSenderId: "646391372587",
    appId:             "1:646391372587:web:78db1a4e92178e7adfc36e"
};

// ===================================================================
// INIT FIREBASE (chargement dynamique des SDK)
// ===================================================================
let db, storage, auth;
let _tasksCache = null;
let _unsubscribeTasks = null;

async function initFirebase() {
    try {
        if (typeof firebase === 'undefined') {
            console.error("SDK Firebase non chargé. Vérifiez les scripts dans le HTML.");
            return false;
        }
        if (!firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
        }
        db      = firebase.firestore();
        storage = firebase.storage();
        auth    = firebase.auth();

        // Cache local pour performance offline
        db.enablePersistence({ synchronizeTabs: true }).catch(err => {
            console.warn("Persistence Firebase non disponible:", err.code);
        });

        return true;
    } catch (e) {
        console.error("Erreur init Firebase:", e);
        return false;
    }
}

// ===================================================================
// GESTION DES TÂCHES (Firestore)
// ===================================================================

async function getTasks() {
    if (!db) return _getLocalTasks();
    try {
        const snap = await db.collection('tasks').orderBy('createdAt', 'desc').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn("Firestore offline, utilisation du cache local:", e);
        return _getLocalTasks();
    }
}

function _getLocalTasks() {
    return JSON.parse(localStorage.getItem('sw_tasks_cache') || '[]');
}

async function saveTask(task) {
    if (!db) {
        _saveLocalTask(task);
        return task;
    }
    try {
        const taskData = { ...task };
        delete taskData.id;
        taskData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

        // Écriture Asynchrone Instantanée (Offline-first / Rapide)
        if (task.id && typeof task.id === 'string') {
            db.collection('tasks').doc(task.id).set(taskData, { merge: true }).catch(e => console.error(e));
        } else {
            taskData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const ref = db.collection('tasks').doc(); // Création d'ID synchronisée localement
            task.id = ref.id;
            ref.set(taskData).catch(e => console.error(e));
        }
        
        // Rafraîchissement direct de l'UI sans attendre la synchronisation réseau complète
        _saveLocalTask(task);
        return task;
    } catch (e) {
        console.error("Erreur sauvegarde locale:", e);
        _saveLocalTask(task);
        return task;
    }
}

async function deleteTask(id) {
    const confirmed = await promptSecureAction("Entrez le mot de passe pour supprimer définitivement cette commande :");
    if (!confirmed) return;

    if (db) {
        try {
            await db.collection('tasks').doc(id).delete();
        } catch (e) {
            console.error("Erreur suppression:", e);
        }
    }

    // Suppression du cache local aussi
    const local = _getLocalTasks().filter(t => t.id !== id);
    localStorage.setItem('sw_tasks_cache', JSON.stringify(local));

    renderAgenda(); renderAtelier(); renderBoutique(); renderBibliotheque();
    updateStats(); renderRevenueBanner();
}

async function updateTaskStep(id, newStep) {
    if (db) {
        try {
            await db.collection('tasks').doc(id).update({
                step: newStep,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (e) {
            console.error("Erreur update step:", e);
        }
    }
    // Mise à jour cache local
    const local = _getLocalTasks();
    const t = local.find(t => t.id === id);
    if (t) { t.step = newStep; localStorage.setItem('sw_tasks_cache', JSON.stringify(local)); }
}

async function _updateLocalCache() {
    if (!db) return;
    try {
        const snap = await db.collection('tasks').get();
        const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        localStorage.setItem('sw_tasks_cache', JSON.stringify(tasks));
    } catch(e) {}
}

function _saveLocalTask(task) {
    const tasks = _getLocalTasks();
    const idx = tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) tasks[idx] = task;
    else tasks.push(task);
    localStorage.setItem('sw_tasks_cache', JSON.stringify(tasks));
}

// ===================================================================
// UPLOAD PHOTO (Firebase Storage — pas de base64 massif)
// ===================================================================
async function uploadPhoto(file) {
    if (!file) return null;
    if (!storage) {
        return await resizeImageToBase64(file, 600, 600);
    }
    try {
        showToast("Envoi de la photo en cours (6s max)…", "info");
        const ext  = file.name.split('.').pop();
        const path = `photos/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const ref  = storage.ref(path);
        
        // Timeout de sécurité pour ne pas bloquer l'application
        const uploadTask = ref.put(file);
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("Connexion trop lente")), 6000));
        
        await Promise.race([uploadTask, timeout]);
        const url = await ref.getDownloadURL();
        showToast("Photo sauvegardée avec succès !", "success");
        return url;
    } catch (e) {
        console.warn("Échec/Lenteur réseau pour la photo, utilisation du mode hors-ligne:", e.message);
        showToast("Connexion lente : la photo est enregistrée localement !", "warning");
        return await resizeImageToBase64(file, 600, 600);
    }
}

function resizeImageToBase64(file, maxW, maxH) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxW) { h = h * maxW / w; w = maxW; }
                if (h > maxH) { w = w * maxH / h; h = maxH; }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.75));
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ===================================================================
// GESTION TAILLEURS (Firestore, mots de passe hachés)
// ===================================================================

// Hash simple côté client (pour MVP — en production utiliser Cloud Functions + bcrypt)
async function hashPassword(pwd) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd + 'SW_SALT_2024'));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function getTailors() {
    if (!db) return JSON.parse(localStorage.getItem('sw_tailors') || '[]');
    try {
        const snap = await db.collection('tailors').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        return JSON.parse(localStorage.getItem('sw_tailors') || '[]');
    }
}

async function addTailor(username, password) {
    const hash = await hashPassword(password);
    const tailor = { username, passwordHash: hash, createdAt: new Date().toISOString() };

    if (db) {
        try {
            await db.collection('tailors').add(tailor);
        } catch (e) { console.error(e); }
    }
    // Cache local (sans le mot de passe clair)
    const local = JSON.parse(localStorage.getItem('sw_tailors') || '[]');
    local.push(tailor);
    localStorage.setItem('sw_tailors', JSON.stringify(local));
}

async function verifyTailorPassword(username, password) {
    const hash = await hashPassword(password);
    const tailors = await getTailors();
    return tailors.find(t =>
        t.username.toLowerCase() === username.toLowerCase() &&
        (t.passwordHash === hash || t.password === password) // compat anciens comptes
    );
}

async function deleteTailor(username) {
    if (db) {
        try {
            const snap = await db.collection('tailors').where('username', '==', username).get();
            snap.forEach(d => d.ref.delete());
        } catch(e) {}
    }
    let local = JSON.parse(localStorage.getItem('sw_tailors') || '[]');
    local = local.filter(t => t.username !== username);
    localStorage.setItem('sw_tailors', JSON.stringify(local));
}

// ===================================================================
// PARAMÈTRES (Firestore)
// ===================================================================
async function getSettings() {
    if (!db) return JSON.parse(localStorage.getItem('sw_settings') || '{}');
    try {
        const doc = await db.collection('settings').doc('main').get();
        return doc.exists ? doc.data() : JSON.parse(localStorage.getItem('sw_settings') || '{}');
    } catch(e) {
        return JSON.parse(localStorage.getItem('sw_settings') || '{}');
    }
}

async function saveSettings(settings) {
    localStorage.setItem('sw_settings', JSON.stringify(settings));
    if (!db) return;
    try {
        db.collection('settings').doc('main').set(settings, { merge: true }).catch(e => console.error(e));
    } catch(e) { console.error("Erreur save settings:", e); }
}

// ===================================================================
// THÈME
// ===================================================================
function initTheme() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const saved = localStorage.getItem('sw_theme');
    if (saved === 'dark') {
        document.body.classList.replace('light-theme', 'dark-theme');
        btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
    btn.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        document.body.classList.replace(isDark ? 'dark-theme' : 'light-theme', isDark ? 'light-theme' : 'dark-theme');
        localStorage.setItem('sw_theme', isDark ? 'light' : 'dark');
        btn.innerHTML = isDark ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
    });
}

function updateDateDisplay() {
    const el = document.getElementById('current-date');
    if (!el) return;
    const str = new Date().toLocaleDateString('fr-FR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    el.innerText = str.charAt(0).toUpperCase() + str.slice(1);
}

// ===================================================================
// STATS
// ===================================================================
async function updateStats() {
    const tasks = await getTasks();
    const setEl = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
    setEl('stat-agenda',   tasks.filter(t => t.step === 'agenda').length);
    setEl('stat-atelier',  tasks.filter(t => t.step === 'atelier').length);
    setEl('stat-boutique', tasks.filter(t => t.step === 'boutique').length);

    const today = new Date(); today.setHours(0,0,0,0);
    const urgentCount = tasks.filter(t => ['agenda','atelier'].includes(t.step) && new Date(t.dueDate) < today).length;
    setEl('stat-urgent', urgentCount);
}

async function renderRevenueBanner() {
    const banner = document.getElementById('revenue-banner');
    if (!banner) return;
    const tasks = await getTasks();
    const settings = await getSettings();
    const cur = settings.currency || 'FCFA';
    const total = tasks.reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);
    const now = new Date();
    const monthTotal = tasks.filter(t => {
        const d = new Date(t.dueDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);

    const _revVis = localStorage.getItem('sw_rev_vis') === 'true';
    const totalStr = _revVis ? formatMoney(total) + ' ' + cur : '******';
    const monthStr = _revVis ? formatMoney(monthTotal) + ' ' + cur : '******';
    const eyeIcon  = _revVis ? 'fa-eye-slash' : 'fa-eye';

    banner.innerHTML = `
        <div style="flex:1;">
            <div class="rev-label">Chiffre d'affaires total</div>
            <div class="rev-amount">${totalStr}</div>
            <div style="font-size:0.78rem; opacity:0.75; margin-top:3px;">Ce mois : ${monthStr}</div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end;">
            <i class="fa-solid fa-coins rev-icon"></i>
            <button onclick="toggleRevenueVisibility(event)" class="btn-icon" style="color:white; margin-top:5px; opacity:0.8;" title="Masquer/Afficher les soldes">
                <i class="fa-solid ${eyeIcon}"></i>
            </button>
        </div>
    `;
}

function toggleRevenueVisibility(e) {
    if (e) e.stopPropagation();
    const isVis = localStorage.getItem('sw_rev_vis') === 'true';
    localStorage.setItem('sw_rev_vis', !isVis);
    renderRevenueBanner();
    if (document.getElementById('finance-modal')?.classList.contains('active')) {
        calculateFinances();
    }
}

function formatMoney(n) {
    return Math.round(n).toLocaleString('fr-FR');
}

// ===================================================================
// UTILS DATE
// ===================================================================
function getDateClass(dueDateStr) {
    const today = new Date(); today.setHours(0,0,0,0);
    const due   = new Date(dueDateStr);
    const diff  = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    if (diff < 0)  return 'date-overdue';
    if (diff <= 3) return 'date-soon';
    return 'date-ok';
}

function getDateLabel(dueDateStr) {
    const today = new Date(); today.setHours(0,0,0,0);
    const due   = new Date(dueDateStr);
    const diff  = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    const formatted = due.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
    if (diff < 0)   return `⚠ ${formatted} (${Math.abs(diff)}j de retard)`;
    if (diff === 0) return `Aujourd'hui !`;
    if (diff === 1) return `Demain`;
    return formatted;
}

// ===================================================================
// TOAST (remplace alert())
// ===================================================================
function showToast(message, type = 'success') {
    const existing = document.getElementById('sw-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'sw-toast';
    toast.style.cssText = `
        position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
        background:${type === 'error' ? 'var(--danger-color)' : type === 'info' ? 'var(--warning-color)' : 'var(--success-color)'};
        color:white;padding:12px 22px;border-radius:30px;font-size:0.9rem;font-weight:500;
        z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.2);
        animation:slideUp 0.25s ease;pointer-events:none;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ===================================================================
// MODAL DE CONFIRMATION (remplace confirm())
// ===================================================================
function showConfirmModal(message) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(4px);`;

        const box = document.createElement('div');
        box.style.cssText = `background:var(--surface-color);border-radius:16px;padding:1.8rem;max-width:360px;width:100%;border:var(--border-subtle);box-shadow:0 20px 60px rgba(0,0,0,0.2);text-align:center;`;
        box.innerHTML = `
            <div style="font-size:2rem;margin-bottom:.8rem;">⚠️</div>
            <p style="margin-bottom:1.5rem;font-size:0.95rem;color:var(--text-main);line-height:1.5;">${message}</p>
            <div style="display:flex;gap:10px;justify-content:center;">
                <button id="confirm-cancel" class="btn btn-secondary" style="flex:1">Annuler</button>
                <button id="confirm-ok" class="btn btn-primary" style="flex:1;background:var(--danger-color)">Confirmer</button>
            </div>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        box.querySelector('#confirm-ok').onclick     = () => { overlay.remove(); resolve(true); };
        box.querySelector('#confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
        overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
}

// ===================================================================
// AGENDA
// ===================================================================
async function renderAgenda() {
    const list = document.getElementById('agenda-list');
    if (!list) return;

    list.innerHTML = `<div class="loading-state"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</div>`;

    const tasks = (await getTasks())
        .filter(t => t.step === 'agenda')
        .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

    list.innerHTML = '';

    if (tasks.length === 0) {
        list.innerHTML = `
            <div class="empty-state glass-panel">
                <i class="fa-regular fa-calendar-check"></i>
                <p>Aucun rendez-vous planifié</p>
                <small>Cliquez sur "Nouvelle Commande" pour commencer</small>
            </div>`;
        return;
    }

    tasks.forEach((task, i) => {
        const dateClass = getDateClass(task.dueDate);
        const dateLabel = getDateLabel(task.dueDate);
        const isUrgent  = dateClass === 'date-overdue';
        const photoHtml = task.photo
            ? `<img src="${task.photo}" class="cloth-thumb" alt="Tissu">`
            : '';

        const el = document.createElement('div');
        el.className = `agenda-item${isUrgent ? ' urgent' : ''}`;
        el.style.animationDelay = `${i * 0.05}s`;
        el.innerHTML = `
            <div style="display:flex;align-items:center;flex:1;gap:12px;">
                ${photoHtml}
                <div class="item-info" style="flex:1;">
                    <h4>${task.client} — <span style="font-weight:400;color:var(--text-muted)">${task.type}</span>
                        ${task.price ? `<span style="color:var(--primary-color);font-size:0.9rem;"> · ${formatMoney(task.price)} FCFA</span>` : ''}
                    </h4>
                    <p>
                        <span class="${dateClass}"><i class="fa-regular fa-calendar"></i> ${dateLabel}</span>
                        ${task.phone ? `<span><i class="fa-brands fa-whatsapp" style="color:#25D366"></i> ${task.phone}</span>` : ''}
                    </p>
                    ${task.notes ? `<p class="notes-text">${task.notes}</p>` : ''}
                </div>
            </div>
            <div class="item-actions">
                ${isUrgent ? `<span class="badge badge-urgent">Retard</span>` : `<span class="badge badge-agenda">RDV</span>`}
                <button class="btn btn-primary" style="padding:8px 14px;font-size:0.84rem" onclick="moveToAtelier('${task.id}')">
                    <i class="fa-solid fa-arrow-right"></i> Atelier
                </button>
                <button class="btn btn-secondary" style="padding:8px;color:gray;" onclick="editTask('${task.id}')" title="Modifier">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-secondary" style="padding:8px;color:var(--danger-color)" onclick="deleteTask('${task.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>`;
        list.appendChild(el);
    });
}

// ===================================================================
// ATELIER
// ===================================================================
async function renderAtelier() {
    const grid = document.getElementById('atelier-list');
    if (!grid) return;

    grid.innerHTML = `<div class="loading-state" style="grid-column:1/-1"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</div>`;

    const tasks = (await getTasks())
        .filter(t => t.step === 'atelier')
        .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

    grid.innerHTML = '';

    if (tasks.length === 0) {
        grid.innerHTML = `
            <div class="empty-state glass-panel" style="grid-column:1/-1">
                <i class="fa-solid fa-tape"></i>
                <p>Aucune pièce en atelier</p>
                <small>Les commandes de l'agenda apparaîtront ici</small>
            </div>`;
        return;
    }

    tasks.forEach((task, i) => {
        const dateClass = getDateClass(task.dueDate);
        const dateLabel = getDateLabel(task.dueDate);
        const photoHtml = task.photo
            ? `<div class="atelier-thumb-wrap"><img src="${task.photo}" class="atelier-thumb" alt="Tissu"></div>`
            : '';

        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.style.animationDelay = `${i * 0.06}s`;
        card.innerHTML = `
            <div class="kanban-card-header">
                <span class="badge badge-atelier"><i class="fa-solid fa-tape"></i> Atelier</span>
                <span class="${dateClass}" style="font-size:0.85rem;"><i class="fa-regular fa-clock"></i> ${dateLabel}</span>
            </div>
            ${photoHtml}
            <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:4px;">
                <h3>${task.client}</h3>
                ${task.phone ? `<span class="phone-tag"><i class="fa-brands fa-whatsapp" style="color:#25D366"></i> ${task.phone}</span>` : ''}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <p style="color:var(--text-muted);font-size:0.9rem;">${task.type}</p>
                ${task.price ? `<span class="price-tag">${formatMoney(task.price)} FCFA</span>` : ''}
            </div>
            ${task.notes ? `<div class="notes-box"><i class="fa-solid fa-ruler" style="color:var(--primary-color);margin-right:5px;"></i>${task.notes}</div>` : ''}
            <div class="card-actions">
                <button class="btn btn-secondary" style="padding:8px;font-size:0.84rem" title="Retour agenda" onclick="moveBackToAgenda('${task.id}')">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <button class="btn btn-primary" style="flex:1;justify-content:center;background:var(--success-color)" onclick="moveToBoutique('${task.id}')">
                    <i class="fa-solid fa-check"></i> Terminé → Boutique
                </button>
                <button class="btn btn-secondary" style="padding:8px;color:gray;" onclick="editTask('${task.id}')" title="Modifier">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-secondary" style="padding:8px;color:var(--danger-color)" onclick="deleteTask('${task.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>`;
        grid.appendChild(card);
    });
}

// ===================================================================
// BOUTIQUE
// ===================================================================
async function renderBoutique(searchTerm = '') {
    const grid = document.getElementById('boutique-list');
    if (!grid) return;

    grid.innerHTML = `<div class="loading-state" style="grid-column:1/-1"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</div>`;

    let tasks = (await getTasks()).filter(t => t.step === 'boutique');

    if (searchTerm) {
        const s = searchTerm.toLowerCase();
        tasks = tasks.filter(t =>
            t.client.toLowerCase().includes(s) ||
            (t.phone && t.phone.includes(s))
        );
    }

    grid.innerHTML = '';

    if (tasks.length === 0) {
        grid.innerHTML = `
            <div class="empty-state glass-panel" style="grid-column:1/-1">
                <i class="fa-solid fa-store"></i>
                <p>${searchTerm ? 'Aucun résultat' : 'Aucun article en boutique'}</p>
                <small>Les vêtements terminés apparaîtront ici</small>
            </div>`;
        return;
    }

    tasks.forEach((task, i) => {
        const photoHtml = task.photo
            ? `<div class="atelier-thumb-wrap"><img src="${task.photo}" class="atelier-thumb" alt="Tissu"></div>`
            : '';

        let whatsappBtn = '';
        if (task.phone) {
            const cleanPhone = task.phone.replace(/[^0-9]/g, '');
            const msg = encodeURIComponent(`Bonjour ${task.client}, votre création "${task.type}" est prête chez Sarkin Wanka ! Vous pouvez passer la récupérer. Merci.`);
            whatsappBtn = `
                <a href="https://wa.me/${cleanPhone}?text=${msg}" target="_blank" class="btn btn-secondary" style="flex:1;justify-content:center;color:#25D366;border-color:rgba(37,211,102,0.3);">
                    <i class="fa-brands fa-whatsapp"></i> Notifier
                </a>`;
        }

        const card = document.createElement('div');
        card.className = 'kanban-card boutique-card';
        card.style.animationDelay = `${i * 0.06}s`;
        card.innerHTML = `
            <div class="kanban-card-header">
                <span class="badge badge-boutique"><i class="fa-solid fa-store"></i> Prêt</span>
            </div>
            ${photoHtml}
            <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:4px;">
                <h3>${task.client}</h3>
                ${task.phone ? `<span class="phone-tag"><i class="fa-brands fa-whatsapp" style="color:#25D366"></i> ${task.phone}</span>` : ''}
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <p style="color:var(--text-muted);font-size:0.9rem;">${task.type}</p>
                ${task.price ? `<span class="price-tag">${formatMoney(task.price)} FCFA</span>` : ''}
            </div>
            <div class="card-actions" style="flex-wrap:wrap;">
                <button class="btn btn-secondary" style="padding:8px;" title="Retour atelier" onclick="moveBackToAtelier('${task.id}')">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                ${whatsappBtn}
                <button class="btn btn-primary" style="flex:1;justify-content:center;min-width:130px;" onclick="markAsDelivered('${task.id}')">
                    <i class="fa-solid fa-hand-holding-hand"></i> Livrer
                </button>
                <button class="btn btn-secondary" style="padding:8px;color:gray;" onclick="editTask('${task.id}')" title="Modifier">
                    <i class="fa-solid fa-pen"></i>
                </button>
            </div>`;
        grid.appendChild(card);
    });
}

// ===================================================================
// BIBLIOTHÈQUE
// ===================================================================
async function renderBibliotheque(searchTerm = '') {
    const tbody = document.getElementById('biblio-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" style="padding:20px;text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</td></tr>`;

    let tasks = await getTasks();
    if (searchTerm) {
        const s = searchTerm.toLowerCase();
        tasks = tasks.filter(t =>
            t.client.toLowerCase().includes(s) ||
            t.type.toLowerCase().includes(s) ||
            (t.phone && t.phone.includes(s))
        );
    }

    tasks.sort((a,b) => {
        const da = a.createdAt?.seconds ? a.createdAt.seconds : (new Date(a.dueDate).getTime() / 1000);
        const db2 = b.createdAt?.seconds ? b.createdAt.seconds : (new Date(b.dueDate).getTime() / 1000);
        return db2 - da;
    });

    const settings = await getSettings();
    const cur = settings.currency || 'FCFA';
    tbody.innerHTML = '';

    if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:30px;text-align:center;color:var(--text-muted)">Aucun résultat.</td></tr>`;
        return;
    }

    tasks.forEach(task => {
        const ref = 'SW-' + (task.id || '').toString().slice(-6).toUpperCase();
        const dateStr = new Date(task.dueDate).toLocaleDateString('fr-FR');
        const dateClass = getDateClass(task.dueDate);
        const stepLabels = { agenda:'AGENDA', atelier:'ATELIER', boutique:'BOUTIQUE', livre:'LIVRÉ' };
        const stepBadge  = `badge-${task.step === 'livre' ? 'livre' : task.step}`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color:var(--primary-color);font-size:0.85rem;">${ref}</strong></td>
            <td>
                <div class="${dateClass}" style="font-size:0.88rem;">${dateStr}</div>
                <span class="badge ${stepBadge}" style="margin-top:4px;display:inline-block;">${stepLabels[task.step] || task.step?.toUpperCase()}</span>
            </td>
            <td>
                <div style="font-weight:600;">${task.client}</div>
                ${task.phone ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;"><i class="fa-brands fa-whatsapp" style="color:#25D366"></i> ${task.phone}</div>` : ''}
            </td>
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    ${task.photo ? `<img src="${task.photo}" style="width:36px;height:36px;object-fit:cover;border-radius:6px;border:var(--border-subtle)">` : '<div style="width:36px;height:36px;background:var(--bg-color);border-radius:6px;border:var(--border-subtle);"></div>'}
                    <span style="font-size:0.9rem;">${task.type}</span>
                </div>
            </td>
            <td><strong style="color:var(--primary-color);font-family:'Cormorant Garamond',serif;font-size:1rem;">${task.price ? formatMoney(task.price) + ' ' + cur : '—'}</strong></td>
            <td>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-secondary" onclick="printReceipt(${JSON.stringify(JSON.stringify(task))})" style="padding:6px 10px;font-size:0.8rem;" title="Imprimer">
                        <i class="fa-solid fa-print"></i>
                    </button>
                    <button class="btn btn-secondary" style="padding:6px 10px;font-size:0.8rem;color:gray" onclick="editTask('${task.id}')" title="Modifier">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-secondary" onclick="deleteTask('${task.id}')" style="padding:6px 10px;font-size:0.8rem;color:var(--danger-color)" title="Supprimer">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
}

// ===================================================================
// ACTIONS DE DÉPLACEMENT
// ===================================================================
async function moveToAtelier(id) {
    await updateTaskStep(id, 'atelier');
    notifyTailorsIfNeeded(id);
    renderAgenda(); renderAtelier();
    updateStats();
    showToast("Commande envoyée à l'atelier !");
}

async function moveToBoutique(id) {
    await updateTaskStep(id, 'boutique');
    renderAtelier();
    updateStats();
    showToast("Pièce prête en boutique !");
}

async function moveBackToAgenda(id) {
    const ok = await showConfirmModal("Renvoyer cette commande vers l'Agenda ?");
    if (!ok) return;
    await updateTaskStep(id, 'agenda');
    renderAtelier(); renderAgenda();
    updateStats();
}

async function moveBackToAtelier(id) {
    const ok = await showConfirmModal("Renvoyer ce vêtement vers l'Atelier ?");
    if (!ok) return;
    await updateTaskStep(id, 'atelier');
    renderBoutique();
    updateStats();
}

async function markAsDelivered(id) {
    const ok = await promptSecureAction("Mot de passe requis pour livrer cette commande :");
    if (!ok) return;
    await updateTaskStep(id, 'livre');
    renderBoutique(); renderBibliotheque();
    updateStats(); renderRevenueBanner();
    showToast("Livraison confirmée !");
}

// ===================================================================
// MODAL NOUVELLE COMMANDE
// ===================================================================
let currentPhotoFile = null;
let currentEditingTaskId = null;

function openNewTaskModal() {
    document.getElementById('task-modal').classList.add('active');
    const sel = document.getElementById('task-assignee');
    if (sel) {
        getTailors().then(tailors => {
            sel.innerHTML = '<option value="">— Atelier Général —</option>' +
                tailors.map(t => `<option value="${t.username}">${t.username}</option>`).join('');
        });
    }
}

function closeNewTaskModal() {
    document.getElementById('task-modal').classList.remove('active');
    document.getElementById('new-task-form').reset();
    currentPhotoFile = null;
    currentEditingTaskId = null;
    const hd = document.querySelector('#task-modal h2');
    if(hd) hd.innerHTML = '<i class="fa-solid fa-plus" style="color:var(--primary-color);"></i> Nouvelle Commande';
    
    const preview   = document.getElementById('photo-preview');
    const uploadBox = document.getElementById('file-upload-box');
    if (preview)   preview.style.display = 'none';
    if (uploadBox) uploadBox.style.display = 'flex';
}

const clothPhotoInput = document.getElementById('cloth-photo');
if (clothPhotoInput) {
    clothPhotoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        currentPhotoFile = file;
        const reader = new FileReader();
        reader.onload = ev => {
            const preview   = document.getElementById('photo-preview');
            const uploadBox = document.getElementById('file-upload-box');
            if (preview)   { preview.src = ev.target.result; preview.style.display = 'block'; }
            if (uploadBox) uploadBox.style.display = 'none';
        };
        reader.readAsDataURL(file);
    });
}

const form = document.getElementById('new-task-form');
if (form) {
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = form.querySelector('[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement…';

        try {
            // Upload photo si présente
            let photoUrl = null;
            if (currentPhotoFile) {
                photoUrl = await uploadPhoto(currentPhotoFile);
            }

            const newTask = {
                client:   document.getElementById('client-name').value.trim(),
                phone:    document.getElementById('client-phone')?.value.trim() || '',
                type:     document.getElementById('cloth-type').value.trim(),
                price:    parseFloat(document.getElementById('task-price')?.value) || 0,
                dueDate:  document.getElementById('due-date').value,
                step:     document.getElementById('initial-step').value,
                assignee: document.getElementById('task-assignee')?.value || '',
                notes:    document.getElementById('task-notes').value.trim()
            };
            if (photoUrl) newTask.photo = photoUrl;
            if (currentEditingTaskId) {
                newTask.id = currentEditingTaskId;
                // Preserve photo if no new one
                if (!photoUrl) {
                    const allT = await getTasks();
                    const oldT = allT.find(x => x.id === currentEditingTaskId);
                    if (oldT && oldT.photo) newTask.photo = oldT.photo;
                }
            }

            const saved = await saveTask(newTask);
            printReceipt(saved);
            closeNewTaskModal();
            renderAgenda(); renderAtelier(); renderBibliotheque();
            updateStats(); renderRevenueBanner();
            showToast("Commande enregistrée !");
        } catch(err) {
            console.error(err);
            showToast("Erreur lors de l'enregistrement.", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Enregistrer';
        }
    });
}

// Search listeners
const searchBiblio = document.getElementById('search-biblio');
if (searchBiblio) searchBiblio.addEventListener('input', e => renderBibliotheque(e.target.value));

const searchBoutique = document.getElementById('search-boutique');
if (searchBoutique) searchBoutique.addEventListener('input', e => renderBoutique(e.target.value));

// ===================================================================
// ESPACE TAILLEUR
// ===================================================================
async function renderTailleur() {
    const grid = document.getElementById('tailleur-list');
    if (!grid) return;

    grid.innerHTML = `<div class="loading-state" style="grid-column:1/-1"><i class="fa-solid fa-spinner fa-spin"></i> Chargement…</div>`;

    let tasks = (await getTasks())
        .filter(t => t.step === 'atelier')
        .sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));

    if (typeof currentTailorUser !== 'undefined' && currentTailorUser) {
        tasks = tasks.filter(t => !t.assignee || t.assignee.toLowerCase() === currentTailorUser.toLowerCase());
    }

    grid.innerHTML = '';

    if (tasks.length === 0) {
        grid.innerHTML = `
            <div class="empty-state glass-panel" style="grid-column:1/-1">
                <i class="fa-solid fa-scissors"></i>
                <p>Aucun travail assigné</p>
                <small>Bon repos !</small>
            </div>`;
        return;
    }

    tasks.forEach((task, i) => {
        const dateClass = getDateClass(task.dueDate);
        const dateLabel = getDateLabel(task.dueDate);
        const photoHtml = task.photo
            ? `<div class="atelier-thumb-wrap"><img src="${task.photo}" class="atelier-thumb" alt="Tissu"></div>`
            : '';

        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.style.animationDelay = `${i * 0.06}s`;
        card.innerHTML = `
            <div class="kanban-card-header">
                <span class="badge badge-atelier"><i class="fa-solid fa-tape"></i> À Coudre</span>
                <span class="${dateClass}" style="font-size:0.85rem;"><i class="fa-regular fa-clock"></i> ${dateLabel}</span>
            </div>
            ${photoHtml}
            <h3 style="margin-top:6px;">Modèle : ${task.type}</h3>
            <p style="color:var(--text-muted);font-size:0.9rem;">Client : ${task.client}</p>
            ${task.notes ? `<div class="notes-box"><i class="fa-solid fa-ruler" style="color:var(--primary-color);margin-right:5px;"></i>${task.notes}</div>` : ''}
            <div class="card-actions">
                <button class="btn btn-primary" style="flex:1;justify-content:center;background:var(--success-color);" onclick="finishTailleurTask('${task.id}')">
                    <i class="fa-solid fa-check"></i> Terminé !
                </button>
            </div>`;
        grid.appendChild(card);
    });
}

async function finishTailleurTask(id) {
    const ok = await showConfirmModal("Le vêtement est-il terminé et prêt pour la boutique ?");
    if (!ok) return;
    await updateTaskStep(id, 'boutique');
    renderTailleur();
    showToast("Pièce envoyée en boutique !");
}

// ===================================================================
// NOTIFICATIONS TAILLEUR — FIX SON INTEMPESTIF
// ===================================================================
// On n'écoute plus storage event (source du son bizarre au chargement).
// À la place, polling Firestore toutes les 30s si connecté.

let _lastKnownTasksForNotif = null;
let _tailorPollingInterval = null;

function startTailorPolling(username) {
    if (_tailorPollingInterval) clearInterval(_tailorPollingInterval);
    _tailorPollingInterval = setInterval(async () => {
        const tasks = await getTasks();
        const myTasks = tasks.filter(t => t.step === 'atelier' &&
            (!t.assignee || t.assignee.toLowerCase() === username.toLowerCase()));

        if (_lastKnownTasksForNotif !== null) {
            const prevIds = new Set(_lastKnownTasksForNotif.map(t => t.id));
            const newOnes = myTasks.filter(t => !prevIds.has(t.id));
            if (newOnes.length > 0) {
                // ✅ Son joué UNIQUEMENT sur nouvelles assignations réelles
                playTailorNotification(username);
                renderTailleur();
                showToast(`${newOnes.length} nouveau(x) travail(x) assigné(s) !`, 'info');
            }
        }
        _lastKnownTasksForNotif = myTasks;
    }, 30000); // Toutes les 30 secondes
}

function stopTailorPolling() {
    if (_tailorPollingInterval) {
        clearInterval(_tailorPollingInterval);
        _tailorPollingInterval = null;
    }
    _lastKnownTasksForNotif = null;
}

function notifyTailorsIfNeeded(taskId) {
    // Déclenché uniquement sur action admin volontaire
    // Le son se joue côté tailleur via polling, pas ici
}

function playTailorNotification(username) {
    const src = localStorage.getItem('sw_audio_' + username);
    if (!src) return; // Pas de son si aucun fichier configuré
    try { new Audio(src).play().catch(() => {}); } catch(e) {}
}

// ===================================================================
// IMPRESSION DU REÇU
// ===================================================================
function printReceipt(taskOrJson) {
    const task = typeof taskOrJson === 'string' ? JSON.parse(taskOrJson) : taskOrJson;
    const win = window.open('', '_blank');
    if (!win) { showToast("Autorisez les pop-ups pour imprimer.", "error"); return; }

    getSettings().then(settings => {
        const shopName  = settings.name  || "SARKIN WANKA Fashion Design";
        const shopPhone = settings.phone || "+227 92 62 27 64";
        const shopAddr  = settings.address || "Niamey, Niger";
        const cur       = settings.currency || "FCFA";
        const shopLogo  = settings.photo || '';

        const dateStr   = new Date(task.dueDate).toLocaleDateString('fr-FR');
        const dateToday = new Date().toLocaleDateString('fr-FR');
        const ref       = 'SW-' + (task.id || '').toString().slice(-6).toUpperCase();

        let whatsappLink = '';
        if (task.phone) {
            const cp  = task.phone.replace(/[^0-9]/g, '');
            const msg = encodeURIComponent(`Bonjour, voici le reçu de votre commande chez ${shopName}.\nRéf: ${ref}\nMontant: ${task.price ? formatMoney(task.price) + ' ' + cur : 'N/A'}`);
            whatsappLink = `<a href="https://wa.me/${cp}?text=${msg}" target="_blank" style="display:inline-block;margin-top:15px;background:#25D366;color:white;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">Envoyer via WhatsApp</a>`;
        }

        win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Reçu ${ref}</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Outfit',sans-serif;}
  body{color:#1A1A1A;margin:40px;background:#FBF9F4;}
  .box{border:2px solid #A67C00;padding:30px;border-radius:12px;max-width:580px;margin:0 auto;background:#fff;}
  .hdr{text-align:center;margin-bottom:24px;border-bottom:1px solid #eee;padding-bottom:18px;}
  .hdr img{width:90px;height:90px;object-fit:cover;border-radius:50%;border:3px solid #A67C00;}
  .hdr h1{margin:10px 0 4px;color:#A67C00;font-size:22px;letter-spacing:0.05em;}
  .hdr p{color:#888;font-size:13px;}
  .ref{background:#FDF9EE;color:#A67C00;padding:5px 12px;border-radius:20px;font-weight:700;font-size:13px;display:inline-block;margin:10px 0;}
  .row{display:flex;justify-content:space-between;border-bottom:1px dashed #eee;padding:10px 0;font-size:14px;}
  .row strong{color:#555;}
  .amount{font-size:20px;font-weight:700;color:#A67C00;}
  .footer{text-align:center;color:#aaa;font-size:12px;margin-top:20px;padding-top:14px;border-top:1px solid #eee;}
  .actions{margin-top:20px;text-align:center;}
  @media print{.actions{display:none;}body{margin:20px;background:white;}}
</style></head>
<body onload="setTimeout(()=>window.print(),800)">
<div class="box">
  <div class="hdr">
    ${shopLogo ? `<img src="${shopLogo}" onerror="this.style.display='none'">` : ''}
    <h1>${shopName.toUpperCase()}</h1>
    <p>${shopAddr} — Tél: ${shopPhone}</p>
    <p style="margin-top:8px;font-size:15px;font-weight:600;">REÇU DE COMMANDE</p>
    <span class="ref">${ref}</span>
  </div>
  <div class="row"><strong>Date d'enregistrement</strong><span>${dateToday}</span></div>
  <div class="row"><strong>Client</strong><span>${task.client}</span></div>
  <div class="row"><strong>Contact</strong><span>${task.phone || 'N/A'}</span></div>
  <div class="row"><strong>Type d'article</strong><span>${task.type}</span></div>
  <div class="row"><strong>Date de livraison</strong><span>${dateStr}</span></div>
  ${task.assignee ? `<div class="row"><strong>Tailleur assigné</strong><span>${task.assignee}</span></div>` : ''}
  <div class="row"><strong>Montant</strong><span class="amount">${task.price ? formatMoney(task.price) + ' ' + cur : '—'}</span></div>
  <div class="footer">Merci pour votre confiance — ${shopName}</div>
</div>
<div class="actions">
  <button onclick="window.print()" style="padding:10px 22px;background:#A67C00;color:white;border:none;border-radius:6px;cursor:pointer;font-size:14px;">🖨 Enregistrer en PDF</button>
  <br>${whatsappLink}
</div>
</body></html>`);
        win.document.close();
    });
}

// ===================================================================
// SECURITÉ & AUTHENTIFICATION ADMIN & STATS & AUTOCOMPLETE
// ===================================================================
const RESET_CODE = "92622764";

async function hashAdminPassword(pwd) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pwd + 'ADMIN_SALT'));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function getAdminPasswordHash() {
    const s = await getSettings();
    if (s.adminPasswordHash) return s.adminPasswordHash;
    return await hashAdminPassword("admin"); // Mot de passe par défaut
}

function injectAdminModals() {
    if (window.location.pathname.includes('tailleur.html')) return;
    
    const html = `
    <!-- Global Admin Login Overlay -->
    <div id="admin-login-overlay" style="display:none; position:fixed; inset:0; background:var(--bg-color); z-index:9999; flex-direction:column; align-items:center; justify-content:center; padding:2rem;">
        <div class="glass-panel" style="padding:2.5rem; max-width:400px; width:100%; text-align:center;">
            <img src="https://ui-avatars.com/api/?name=Sarkin+Wanka&background=A67C00&color=fff&size=256" style="width:100px; height:100px; border-radius:50%; margin-bottom:1.5rem; box-shadow:var(--shadow-gold);">
            <h2 style="font-family:'Cormorant Garamond',serif; margin-bottom:1.5rem; font-size:1.8rem;">Sarkin Wanka - Accès Admin</h2>
            <input type="password" id="admin-pwd-input" placeholder="Mot de passe ou Code" style="width:100%; padding:14px; margin-bottom:1rem; border:var(--border-subtle); border-radius:var(--border-radius-sm); font-size:1.1rem; text-align:center; font-family:'Outfit';">
            <button class="btn btn-primary" style="width:100%; justify-content:center; padding:14px; font-size:1.1rem; margin-bottom:1rem;" onclick="tryAdminLogin()">
                <i class="fa-solid fa-lock-open"></i> Déverrouiller
            </button>
            <p style="font-size:0.85rem; color:var(--text-muted); cursor:pointer; text-decoration:underline;" onclick="resetAdminPassword()">Mot de passe oublié ?</p>
        </div>
    </div>

    <!-- Password Prompt Modal for Secure Actions -->
    <div id="admin-prompt-modal" class="modal">
        <div class="modal-content" style="max-width:380px; text-align:center;">
            <span class="close-modal" onclick="closeAdminPrompt()">&times;</span>
            <h3 style="margin-bottom:1rem; font-family:'Cormorant Garamond',serif; font-size:1.6rem;">
                <i class="fa-solid fa-shield-halved" style="color:var(--primary-color);"></i> Action Sécurisée
            </h3>
            <p id="admin-prompt-text" style="font-size:0.95rem; color:var(--text-muted); margin-bottom:1.5rem; line-height:1.4;"></p>
            <input type="password" id="admin-prompt-input" autocomplete="new-password" placeholder="Votre mot de passe" style="width:100%; padding:12px; margin-bottom:1.2rem; text-align:center; font-size:1.1rem; border:var(--border-subtle); border-radius:var(--border-radius-sm);">
            <button class="btn btn-primary" style="width:100%; justify-content:center;" onclick="submitAdminPrompt()"><i class="fa-solid fa-check"></i> Confirmer</button>
        </div>
    </div>
    
    <!-- Modal Finances / Solde -->
    <div id="finance-modal" class="modal">
        <div class="modal-content" style="max-width:500px;">
            <span class="close-modal" onclick="document.getElementById('finance-modal').classList.remove('active')">&times;</span>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:var(--border-subtle); padding-bottom:1rem;">
                <h2 style="font-family:'Cormorant Garamond',serif; font-size:1.8rem; margin:0; border:none; padding:0;">
                    <i class="fa-solid fa-chart-line" style="color:var(--primary-color);"></i> Solde & Chiffre d'Affaires
                </h2>
                <button onclick="toggleRevenueVisibility(event)" class="btn btn-secondary" style="padding:8px 12px; font-size:1rem;" title="Masquer/Afficher les soldes"><i class="fa-solid fa-eye" id="fin-eye-icon"></i></button>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                <div class="glass-panel" style="padding:15px; text-align:center;">
                    <h3 style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Aujourd'hui</h3>
                    <p id="fin-jour" style="font-family:'Cormorant Garamond',serif; font-size:1.6rem; font-weight:700; color:var(--text-main); margin-top:5px;">0</p>
                </div>
                <div class="glass-panel" style="padding:15px; text-align:center;">
                    <h3 style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Cette Semaine</h3>
                    <p id="fin-semaine" style="font-family:'Cormorant Garamond',serif; font-size:1.6rem; font-weight:700; color:var(--text-main); margin-top:5px;">0</p>
                </div>
                <div class="glass-panel" style="padding:15px; text-align:center; grid-column:1/-1;">
                    <h3 style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Ce Mois</h3>
                    <p id="fin-mois" style="font-family:'Cormorant Garamond',serif; font-size:2rem; font-weight:700; color:var(--primary-color); margin-top:5px;">0</p>
                </div>
                <div class="glass-panel" style="padding:15px; text-align:center; grid-column:1/-1; border-top:2px solid var(--border-subtle);">
                    <h3 style="font-size:0.85rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">Cette Année</h3>
                    <p id="fin-annee" style="font-family:'Cormorant Garamond',serif; font-size:1.8rem; font-weight:700; color:var(--success-color); margin-top:5px;">0</p>
                </div>
            </div>
        </div>
    </div>
    `;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div);
}

async function checkAdminAuth() {
    if (window.location.pathname.includes('tailleur.html')) return;
    if (sessionStorage.getItem('adminAuthed') === 'true') {
        document.getElementById('admin-login-overlay').style.display = 'none';
        return;
    }
    document.getElementById('admin-login-overlay').style.display = 'flex';
}

async function tryAdminLogin() {
    const input = document.getElementById('admin-pwd-input').value;
    if (input === RESET_CODE) return resetAdminPassword(true);
    
    const hash = await hashAdminPassword(input);
    const stored = await getAdminPasswordHash();
    if (hash === stored || (input === 'admin' && stored === await hashAdminPassword('admin'))) {
        sessionStorage.setItem('adminAuthed', 'true');
        document.getElementById('admin-login-overlay').style.display = 'none';
        showToast("Session déverrouillée !");
    } else {
        showToast("Mot de passe incorrect.", "error");
    }
}

async function resetAdminPassword(fromInput = false) {
    let code = fromInput ? RESET_CODE : prompt("Entrez le code de réinitialisation de sécurité :");
    if (code !== RESET_CODE) {
        if (!fromInput) showToast("Code incorect.", "error");
        return;
    }
    const newPwd = prompt("Créez le NOUVEAU mot de passe administrateur :");
    if (!newPwd) return;
    const hash = await hashAdminPassword(newPwd);
    const s = await getSettings();
    s.adminPasswordHash = hash;
    await saveSettings(s);
    showToast("Mot de passe mis à jour avec succès ! Vous pouvez maintenant vous connecter.");
    document.getElementById('admin-pwd-input').value = '';
}

let _adminPromptResolve = null;
function promptSecureAction(message) {
    if (window.location.pathname.includes('tailleur.html')) {
        return showConfirmModal(message);
    }
    return new Promise(resolve => {
        _adminPromptResolve = resolve;
        const modal = document.getElementById('admin-prompt-modal');
        document.getElementById('admin-prompt-text').innerText = message;
        document.getElementById('admin-prompt-input').value = '';
        modal.classList.add('active');
        document.getElementById('admin-prompt-input').focus();
    });
}
function closeAdminPrompt() {
    document.getElementById('admin-prompt-modal').classList.remove('active');
    if (_adminPromptResolve) _adminPromptResolve(false);
}
async function submitAdminPrompt() {
    const pwd = document.getElementById('admin-prompt-input').value;
    const hash = await hashAdminPassword(pwd);
    const stored = await getAdminPasswordHash();
    if (hash === stored || pwd === RESET_CODE || (pwd === 'admin' && stored === await hashAdminPassword('admin'))) {
        closeAdminPrompt();
        if (_adminPromptResolve) _adminPromptResolve(true);
    } else {
        showToast("Accès refusé. Mot de passe incorrect !", "error");
    }
}

async function editTask(id) {
    const ok = await promptSecureAction("Mot de passe requis pour modifier une commande existante :");
    if (!ok) return;
    
    const tasks = await getTasks();
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    currentEditingTaskId = id;
    document.getElementById('client-name').value = task.client || '';
    document.getElementById('client-phone').value = task.phone || '';
    document.getElementById('cloth-type').value = task.type || '';
    document.getElementById('task-price').value = task.price || '';
    document.getElementById('due-date').value = task.dueDate || '';
    document.getElementById('initial-step').value = task.step || '';
    document.getElementById('task-assignee').value = task.assignee || '';
    document.getElementById('task-notes').value = task.notes || '';
    
    openNewTaskModal();
    const hd = document.querySelector('#task-modal h2');
    if(hd) hd.innerHTML = '<i class="fa-solid fa-pen" style="color:var(--primary-color);"></i> Modifier Commande';
}

function openFinanceModal() {
    document.getElementById('finance-modal').classList.add('active');
    calculateFinances();
}

async function calculateFinances() {
    const tasks = await getTasks();
    const settings = await getSettings();
    const cur = settings.currency || 'FCFA';
    
    const now = new Date();
    const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const dWeek = new Date(d0);
    const day = dWeek.getDay() || 7; 
    dWeek.setDate(dWeek.getDate() - day + 1);
    
    const dMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const dYear = new Date(now.getFullYear(), 0, 1);
    
    let sumDay=0, sumWeek=0, sumMonth=0, sumYear=0;
    
    tasks.forEach(t => {
        // Only count delivered? No, we count total CA. Let's base on dueDate or createdAt
        const dateRaw = t.createdAt?.seconds ? t.createdAt.seconds * 1000 : new Date(t.dueDate).getTime();
        const tDate = new Date(dateRaw);
        const price = parseFloat(t.price) || 0;
        
        if (tDate >= d0) sumDay += price;
        if (tDate >= dWeek) sumWeek += price;
        if (tDate >= dMonth) sumMonth += price;
        if (tDate >= dYear) sumYear += price;
    });

    const _revVis = localStorage.getItem('sw_rev_vis') === 'true';
    const getFinStr = val => _revVis ? formatMoney(val) + ' ' + cur : '******';
    const icon = document.getElementById('fin-eye-icon');
    if (icon) icon.className = _revVis ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    
    document.getElementById('fin-jour').innerText = getFinStr(sumDay);
    document.getElementById('fin-semaine').innerText = getFinStr(sumWeek);
    document.getElementById('fin-mois').innerText = getFinStr(sumMonth);
    document.getElementById('fin-annee').innerText = getFinStr(sumYear);
}

function setupPhoneAutocomplete() {
    const phoneInput = document.getElementById('client-phone');
    if (!phoneInput) return;
    
    let dd = document.createElement('div');
    dd.style.cssText = 'position:absolute; background:var(--surface-color); border:var(--border-subtle); width:100%; max-height:160px; overflow-y:auto; z-index:100; border-radius:var(--border-radius-sm); box-shadow:var(--shadow-md); display:none; margin-top:2px; padding:5px;';
    phoneInput.parentNode.style.position = 'relative';
    phoneInput.parentNode.appendChild(dd);
    
    phoneInput.addEventListener('input', async (e) => {
        const val = e.target.value.trim();
        if (val.length < 4) { dd.style.display = 'none'; return; }
        
        const tasks = await getTasks();
        const matches = {};
        tasks.forEach(t => {
            if (t.phone && t.phone.includes(val) && t.client) {
                if (!matches[t.phone] || tasks.filter(x=>x.phone===t.phone).length > tasks.filter(x=>x.phone===matches[t.phone].phone).length) {
                    matches[t.phone] = t;
                }
            }
        });
        
        const arr = Object.values(matches).slice(0, 5); // top 5
        if (arr.length === 0) { dd.style.display = 'none'; return; }
        
        dd.innerHTML = '<div style="font-size:0.75rem; color:var(--text-hint); margin-bottom:4px; padding:0 5px;">Clients existants trouvés :</div>';
        arr.forEach(m => {
            let item = document.createElement('div');
            item.style.cssText = 'padding:10px 12px; cursor:pointer; font-size:0.9rem; border-bottom:1px dashed var(--border-subtle); border-radius:4px; transition:background 0.2s;';
            item.innerHTML = `<i class="fa-solid fa-user-check" style="color:var(--primary-color)"></i> <strong style="color:var(--text-main);">${m.client}</strong> <span style="font-size:0.8rem;color:var(--text-muted)">(${m.phone})</span>`;
            item.onmouseover = () => item.style.background = 'var(--primary-light)';
            item.onmouseout = () => item.style.background = 'transparent';
            item.onclick = () => {
                document.getElementById('client-name').value = m.client;
                phoneInput.value = m.phone;
                dd.style.display = 'none';
                showToast(`Infos de ${m.client} sélectionnées !`, "info");
            };
            dd.appendChild(item);
        });
        dd.style.display = 'block';
    });
    
    document.addEventListener('click', e => {
        if (e.target !== phoneInput && e.target.parentNode !== dd) dd.style.display = 'none';
    });
}

// ===================================================================
// INIT GLOBAL UPDATED
// ===================================================================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    updateDateDisplay();
    
    injectAdminModals();

    const ok = await initFirebase();
    if (!ok) {
        console.warn("Firebase non disponible, mode local activé.");
    }
    
    await checkAdminAuth();
    setupPhoneAutocomplete();

    await renderAgenda();
    await updateStats();
    await renderRevenueBanner();
});

