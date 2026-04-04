/**
 * ===================================================================
 * AFNANE COUTURE & BROTHERS v4.0 — MOTEUR CORE (ÉDITION EXPERT)
 * ===================================================================
 * Ce fichier orchestre l'ensemble de l'application :
 * - Synchronisation temps réel via Firestore.
 * - Gestion avancée des mesures (9 points de contrôle).
 * - Algorithmes financiers et statistiques.
 * - UI réactive et gestion des états.
 */

// ⚙️ CONFIGURATION FIREBASE
const FIREBASE_CONFIG = {
    apiKey: "AIzaSy...",
    authDomain: "afnane-couture.firebaseapp.com",
    projectId: "afnane-couture",
    storageBucket: "afnane-couture.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

// 🏁 VARIABLES GLOBALES
let db, storage, auth;
let currentEditingTaskId = null;
let currentPhotoFile      = null;

// ===================================================================
// 🏗️ INITIALISATION DU MOTEUR
// ===================================================================

/** ACTIVATION DES SERVICES FIREBASE ET DU TEMPS RÉEL */
async function initFirebase() {
    if (typeof firebase === 'undefined') return;
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    storage = firebase.storage();
    auth = firebase.auth();

    // 📡 DÉBUT DU FLUX TEMPS RÉEL SUR LES COMMANDES
    // Synchronise automatiquement l'Agenda, l'Atelier et la Boutique.
    db.collection('tasks').onSnapshot(snapshot => {
        const tasks = [];
        snapshot.forEach(doc => { 
            const data = doc.data(); 
            data.id = doc.id; 
            tasks.push(data); 
        });
        localStorage.setItem('sw_tasks_cache', JSON.stringify(tasks));
        refreshAllUI();
    }, err => console.error("Sync error:", err));

    // ACCÉLÉRATION HORS-LIGNE
    db.enablePersistence({ synchronizeTabs: true }).catch(err => console.warn(err.code));
}

/** RAFRAÎCHISSEMENT INTELLIGENT DE L'INTERFACE */
function refreshAllUI() {
    if (typeof renderAgenda === 'function') renderAgenda();
    if (typeof renderAtelier === 'function') renderAtelier();
    if (typeof renderBoutique === 'function') renderBoutique();
    if (typeof renderBibliotheque === 'function') renderBibliotheque();
    if (typeof updateStats === 'function') updateStats();
    if (typeof renderRevenueBanner === 'function') renderRevenueBanner();
    if (typeof renderTailleur === 'function') renderTailleur(); // Page Tailleur (Si active)
}

// ===================================================================
// 💾 GESTION DES DONNÉES (CRUD & OPTIMISATIONS)
// ===================================================================

/** RÉCUPÉRATION DES COMMANDES (Cache-First) */
async function getTasks() {
    const cached = localStorage.getItem('sw_tasks_cache');
    if (cached) return JSON.parse(cached);
    if (!db) return [];
    
    // Récupération unique si pas de cache
    const snap = await db.collection('tasks').get();
    const tasks = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    localStorage.setItem('sw_tasks_cache', JSON.stringify(tasks));
    return tasks;
}

/** SAUVEGARDE ET SYNCHRONISATION SERVEUR */
async function saveTask(task) {
    if (!db) return _saveLocalTask(task);
    try {
        const taskData = { ...task };
        // Retait du base64 pour éviter de saturer Firestore (limite de 1MB par doc)
        if (taskData.photo && taskData.photo.startsWith('data:')) delete taskData.photo;

        taskData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        if (task.id && task.id.length > 5) {
            await db.collection('tasks').doc(task.id).set(taskData, { merge: true });
        } else {
            taskData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const ref = await db.collection('tasks').add(taskData);
            task.id = ref.id;
        }
        return task;
    } catch (e) {
        return _saveLocalTask(task); // Fallback immédiat
    }
}

// ===================================================================
// 🖥️ LOGIQUE DE L'INTERFACE (MODALES & FORMULAIRES)
// ===================================================================

/** OUVERTURE ET PRÉPARATION DU FORMULAIRE */
async function openNewTaskModal() {
    currentEditingTaskId = null;
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.add('active');
    
    const form = document.getElementById('new-task-form');
    if (form) form.reset();

    const preview = document.getElementById('photo-preview');
    if (preview) preview.style.display = 'none';

    // Peuplement dynamique des tailleurs
    await populateAssigneesSelect();
}

function closeNewTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.remove('active');
}

/** TRAITEMENT DU FORMULAIRE DE COMMANDE */
async function handleTaskForm(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...';
    }

    // 👷 CONSTRUCTION DE L'OBJET MÉTIER
    const task = {
        id: currentEditingTaskId || null,
        client: document.getElementById('client-name').value,
        phone: document.getElementById('client-phone').value,
        type: document.getElementById('cloth-type').value,
        price: document.getElementById('task-price').value,
        dueDate: document.getElementById('due-date').value,
        step: document.getElementById('initial-step').value || 'agenda',
        assignee: document.getElementById('task-assignee').value,
        notes: document.getElementById('task-notes').value,
        photo: currentPhotoFile ? await _toBase64(currentPhotoFile) : null,
        
        // 📐 MESURES AVANCÉES
        measures: {
            cou: document.getElementById('m-cou').value,
            epaule: document.getElementById('m-epaule').value,
            poitrine: document.getElementById('m-poitrine').value,
            taille: document.getElementById('m-taille').value,
            bassin: document.getElementById('m-bassin').value,
            bras: document.getElementById('m-bras').value,
            poignet: document.getElementById('m-poignet').value,
            longueur: document.getElementById('m-longueur').value,
            pantalon: document.getElementById('m-pantalon').value
        }
    };

    // CONSERVATION DE LA PHOTO EXISTANTE
    if (currentEditingTaskId) {
        const exItem = (await getTasks()).find(x => x.id === currentEditingTaskId);
        if (exItem && !task.photo) task.photo = exItem.photo;
    }

    await saveTask(task);
    closeNewTaskModal();
    showToast("Commande mise à jour avec succès !", "success");
    if (btn) { btn.disabled = false; btn.innerHTML = 'Enregistrer'; }
}

// ===================================================================
// 🔧 UTILS ET MÉTIER (FINANCES, AUTH, ETC.)
// ===================================================================

/** POPULE LE SÉLECTEUR D'ATTRIBUTION TAILLEUR */
async function populateAssigneesSelect() {
    const select = document.getElementById('task-assignee');
    if (!select) return;
    select.innerHTML = '<option value="">— Boutique (Vente Rapide) —</option>';
    if (db) {
        const snap = await db.collection('tailors').get();
        snap.forEach(doc => {
            const t = doc.data(); const opt = document.createElement('option');
            opt.value = t.username; opt.textContent = t.username;
            select.appendChild(opt);
        });
    }
}

/** CALCUL ET AFFICHAGE DES STATISTIQUES */
async function updateStats() {
    const tasks = await getTasks();
    const map = { 'stat-agenda': 'agenda', 'stat-atelier': 'atelier', 'stat-livre': 'livre' };
    for (const [id, val] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.innerText = tasks.filter(t => t.step === val || (!t.step && val === 'agenda')).length;
    }
}

/** GESTION DES MOTS DE PASSE HARDI (SHA-256) */
async function hashPassword(p) {
    const msg = new TextEncoder().encode(p);
    const hash = await crypto.subtle.digest('SHA-256', msg);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type} show`;
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 500); }, 3000);
}

// 📸 CONVERSION D'IMAGE EN BASE64
function _toBase64(file) {
    return new Promise((r, j) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = () => r(reader.result); reader.onerror = e => j(e);
    });
}

// 🏁 DÉMARRAGE DOM
document.addEventListener('DOMContentLoaded', async () => {
    await initFirebase();
    const form = document.getElementById('new-task-form');
    if (form) form.addEventListener('submit', handleTaskForm);
    refreshAllUI();
});
