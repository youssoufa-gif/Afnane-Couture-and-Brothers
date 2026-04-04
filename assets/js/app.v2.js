/**
 * ===================================================================
 * AFNANE COUTURE & BROTHERS v4.0 — Logicielle de Gestion de Couture
 * ===================================================================
 * Logicielle premium pour la gestion des commandes, mesures et ateliers.
 */

// Configuration Firebase (Injectée par le système ou chargée dynamiquement)
const FIREBASE_CONFIG = {
    apiKey: "AIzaSy...",
    authDomain: "afnane-couture.firebaseapp.com",
    projectId: "afnane-couture",
    storageBucket: "afnane-couture.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

// Variables Globales
let db, storage, auth;
let currentEditingTaskId = null;
let currentPhotoFile = null;

// ===================================================================
// INITIALISATION
// ===================================================================

async function initFirebase() {
    if (typeof firebase === 'undefined') return;
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    storage = firebase.storage();
    auth = firebase.auth();

    // ✅ TEMPS RÉEL (onSnapshot)
    db.collection('tasks').onSnapshot(snapshot => {
        const tasks = [];
        snapshot.forEach(doc => { 
            const data = doc.data(); 
            data.id = doc.id; 
            tasks.push(data); 
        });
        localStorage.setItem('sw_tasks_cache', JSON.stringify(tasks));
        refreshAllUI();
    }, err => console.error("Snapshot error:", err));

    // ✅ INITIALISATION DU CACHE OFFLINE
    db.enablePersistence({ synchronizeTabs: true }).catch(err => console.warn(err.code));
}

function refreshAllUI() {
    if (typeof renderAgenda === 'function') renderAgenda();
    if (typeof renderAtelier === 'function') renderAtelier();
    if (typeof renderBoutique === 'function') renderBoutique();
    if (typeof renderBibliotheque === 'function') renderBibliotheque();
    if (typeof updateStats === 'function') updateStats();
    if (typeof renderRevenueBanner === 'function') renderRevenueBanner();
}

// ===================================================================
// GESTION DES DONNÉES (CRUD)
// ===================================================================

async function getTasks() {
    const cached = localStorage.getItem('sw_tasks_cache');
    if (cached) return JSON.parse(cached);
    if (!db) return [];
    const snap = await db.collection('tasks').get();
    const tasks = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    localStorage.setItem('sw_tasks_cache', JSON.stringify(tasks));
    return tasks;
}

async function saveTask(task) {
    if (!db) return _saveLocalTask(task);
    try {
        const taskData = { ...task };
        if (taskData.photo && taskData.photo.startsWith('data:')) delete taskData.photo; // Ne pas envoyer base64

        taskData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        if (task.id) {
            await db.collection('tasks').doc(task.id).set(taskData, { merge: true });
        } else {
            taskData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const ref = await db.collection('tasks').add(taskData);
            task.id = ref.id;
        }
        return task;
    } catch (e) {
        console.error(e);
        return _saveLocalTask(task);
    }
}

function _saveLocalTask(task) {
    const local = JSON.parse(localStorage.getItem('sw_tasks_cache') || '[]');
    const idx = local.findIndex(t => t.id === task.id);
    if(idx > -1) local[idx] = task; else local.push(task);
    localStorage.setItem('sw_tasks_cache', JSON.stringify(local));
    return task;
}

// ===================================================================
// FORMULAIRE ET MODALE
// ===================================================================

async function openNewTaskModal() {
    currentEditingTaskId = null;
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.add('active');
    
    const form = document.getElementById('new-task-form');
    if (form) form.reset();

    const preview = document.getElementById('photo-preview');
    if (preview) preview.style.display = 'none';

    // ✅ Charger les tailleurs
    await populateAssigneesSelect();
}

function closeNewTaskModal() {
    const modal = document.getElementById('task-modal');
    if (modal) modal.classList.remove('active');
    currentEditingTaskId = null;
}

async function handleTaskForm(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...';
    }

    const task = {
        id: currentEditingTaskId || Date.now().toString(), // ID temporaire si nouveau
        client: document.getElementById('client-name').value,
        phone: document.getElementById('client-phone').value,
        type: document.getElementById('cloth-type').value,
        price: document.getElementById('task-price').value,
        dueDate: document.getElementById('due-date').value,
        step: document.getElementById('initial-step').value || 'agenda',
        assignee: document.getElementById('task-assignee').value,
        notes: document.getElementById('task-notes').value,
        photo: currentPhotoFile ? await _toBase64(currentPhotoFile) : null,
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

    // Si on modifie, on garde l'ancienne photo si pas de nouvelle
    if (currentEditingTaskId) {
        const existing = (await getTasks()).find(t => t.id === currentEditingTaskId);
        if (existing && !task.photo) task.photo = existing.photo;
    }

    await saveTask(task);
    closeNewTaskModal();
    showToast("Commande enregistrée avec succès !", "success");
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'Enregistrer';
    }
}

function _toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// ===================================================================
// RÉCUPÉRATION ET RENDU (AGENDA/ATELIER)
// ===================================================================

async function renderAgenda() {
    const list = document.getElementById('agenda-list');
    if(!list) return;
    const tasks = await getTasks();
    const agendaTasks = tasks.filter(t => t.step === 'agenda' || !t.step);
    
    list.innerHTML = agendaTasks.map(t => _renderTaskCard(t)).join('');
}

async function renderAtelier() {
    const grid = document.getElementById('atelier-list-grid');
    if(!grid) return;
    const tasks = await getTasks();
    const atelierTasks = tasks.filter(t => t.step === 'atelier');
    
    grid.innerHTML = atelierTasks.map(t => _renderTaskCard(t)).join('');
}

function _renderTaskCard(t) {
    return `
        <div class="kanban-card" onclick="editTask('${t.id}')">
            <div class="card-header">
                <div>
                    <h3 class="client-name">${t.client}</h3>
                    <div class="cloth-type">${t.type}</div>
                </div>
                <div class="price-badge">${t.price} FCFA</div>
            </div>
            <div class="card-meta">
                <span><i class="fa-solid fa-calendar-day"></i> ${t.dueDate}</span>
                ${t.assignee ? `<span><i class="fa-solid fa-cut"></i> ${t.assignee}</span>` : ''}
            </div>
        </div>
    `;
}

// ===================================================================
// ACTIONS ADMINISTRATIVES ET SÉCURITÉ
// ===================================================================

async function populateAssigneesSelect() {
    const select = document.getElementById('task-assignee');
    if (!select) return;
    select.innerHTML = '<option value="">— Boutique (Vente Rapide) —</option>';
    
    if (db) {
        const snap = await db.collection('tailors').get();
        snap.forEach(doc => {
            const t = doc.data();
            const userName = t.username || t.name;
            if (userName) {
                const opt = document.createElement('option');
                opt.value = userName;
                opt.textContent = userName;
                select.appendChild(opt);
            }
        });
    }
}

async function editTask(id) {
    const tasks = await getTasks();
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    await openNewTaskModal();
    currentEditingTaskId = id;
    
    document.getElementById('client-name').value = task.client || '';
    document.getElementById('client-phone').value = task.phone || '';
    document.getElementById('cloth-type').value = task.type || '';
    document.getElementById('task-price').value = task.price || '';
    document.getElementById('due-date').value = task.dueDate || '';
    document.getElementById('initial-step').value = task.step || 'agenda';
    document.getElementById('task-notes').value = task.notes || '';
    
    const m = task.measures || {};
    document.getElementById('m-cou').value = m.cou || '';
    document.getElementById('m-epaule').value = m.epaule || '';
    document.getElementById('m-poitrine').value = m.poitrine || '';
    document.getElementById('m-taille').value = m.taille || '';
    document.getElementById('m-bassin').value = m.bassin || '';
    document.getElementById('m-bras').value = m.bras || '';
    document.getElementById('m-poignet').value = m.poignet || '';
    document.getElementById('m-longueur').value = m.longueur || '';
    document.getElementById('m-pantalon').value = m.pantalon || '';
    
    // Attendre que les tailleurs soient chargés pour sélectionner celui assigné
    setTimeout(() => {
        document.getElementById('task-assignee').value = task.assignee || '';
    }, 200);

    const hd = document.querySelector('#task-modal h2');
    if(hd) hd.innerHTML = '<i class="fa-solid fa-pen"></i> Modifier Commande';
}

// ===================================================================
// UTILITAIRES ET TOASTS
// ===================================================================

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('show'), 100);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 500); }, 3000);
}

// ===================================================================
// DÉMARRAGE GLOBAL
// ===================================================================

document.addEventListener('DOMContentLoaded', async () => {
    await initFirebase();
    
    const form = document.getElementById('new-task-form');
    if (form) form.addEventListener('submit', handleTaskForm);
    
    refreshAllUI();
});

function logout() { 
    sessionStorage.removeItem('adminAuthed'); 
    window.location.href = 'index.html'; 
}
