/**
 * ===================================================================
 * AFNANE COUTURE & BROTHERS v5.0 — MOTEUR CORE (MYSQL EDITION)
 * ===================================================================
 * 100% PHP/MySQL via XAMPP — Zéro Firebase
 * ===================================================================
 */

// 🏁 VARIABLES GLOBALES
let currentEditingTaskId = null;
let currentPhotoFile     = null;

// ===================================================================
// 🚀 INITIALISATION & SYNCHRONISATION MYSQL
// ===================================================================

/** Démarrage principal — Moteur MySQL Core */
async function initApp() {
    console.log('🚀 Afnane Couture v5 — Moteur MySQL');
    
    // SÉCURITÉ : Vérifie si l'utilisateur est connecté
    if (!localStorage.getItem('afnane_user') && !window.location.href.includes('connexion.html')) {
        window.location.href = 'connexion.html';
        return;
    }

    _showAllLoaders();
    await syncTasks();
}

/** Charge les tâches depuis l'API PHP et met à jour le cache */
async function syncTasks() {
    try {
        const response = await fetch('api/commandes.php', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const tasks = await response.json();
        if (tasks.error) throw new Error(tasks.error);
        localStorage.setItem('sw_tasks_cache', JSON.stringify(tasks));
    } catch (e) {
        console.warn('API MySQL indisponible, cache utilisé.', e.message);
    } finally {
        refreshAllUI();
    }
}

/** Lit les tâches depuis le cache local (instantané) */
async function getTasks() {
    const c = localStorage.getItem('sw_tasks_cache');
    return c ? JSON.parse(c) : [];
}

/** Rafraîchit toutes les sections présentes sur la page courante */
async function refreshAllUI() {
    _hideAllLoaders();
    if (document.getElementById('agenda-list'))       renderAgenda();
    if (document.getElementById('atelier-list'))      renderAtelier();
    if (document.getElementById('boutique-list'))     renderBoutique();
    if (document.getElementById('biblio-table-body')) renderBibliotheque();
    if (document.getElementById('stat-clients'))      updateStats();
    if (document.getElementById('revenueChart'))      initCharts();
}

// ===================================================================
// 💾 CRUD — COMMANDES
// ===================================================================

async function saveTask(taskData) {
    try {
        const res = await fetch('api/commandes.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(taskData)
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Erreur serveur');
        return result;
    } catch (e) {
        console.error('Erreur saveTask:', e);
        showToast('Erreur sauvegarde : ' + e.message, 'danger');
        return null;
    }
}

async function deleteTask(id) {
    try {
        const res = await fetch(`api/commandes.php?id=${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (!result.success) throw new Error(result.error);
        return true;
    } catch (e) {
        showToast('Erreur suppression', 'danger');
        return false;
    }
}

async function directDeleteTask(id) {
    if (!confirm('Supprimer définitivement cette commande ?')) return;
    const ok = await deleteTask(id);
    if (ok) {
        showToast('Commande supprimée.', 'info');
        await syncTasks();
    }
}

// ===================================================================
// 🖥️ MODALES & FORMULAIRES
// ===================================================================

async function openNewTaskModal() {
    const form = document.getElementById('new-task-form');
    if (form) {
        form.reset();
        // Force clear hidden inputs or specific fields not reset by form.reset()
        currentEditingTaskId = null;
        currentPhotoFile = null;
    }
    const adv = document.getElementById('advanced-measures');
    if (adv) adv.style.display = 'none';
    const prev = document.getElementById('photo-preview');
    if (prev) { prev.src = ''; prev.style.display = 'none'; }
    ['btn-delete-in-modal','btn-receipt-in-modal', 'btn-whatsapp-in-modal'].forEach(id => {
        const b = document.getElementById(id); if (b) b.style.display = 'none';
    });
    await populateAssigneesSelect();
    modal.classList.add('active');
}

function closeNewTaskModal() {
    document.getElementById('task-modal')?.classList.remove('active');
}

async function openEditTask(id) {
    const tasks = await getTasks();
    const task = tasks.find(t => String(t.id) === String(id));
    if (!task) { showToast('Commande introuvable', 'danger'); return; }
    currentEditingTaskId = id;
    currentPhotoFile = null;
    const modal = document.getElementById('task-modal');
    if (!modal) return;

    const set = (eid, val) => { const el = document.getElementById(eid); if (el) el.value = val || ''; };
    set('client-name',  task.client);
    set('client-phone', task.phone);
    set('cloth-type',   task.type);
    set('task-price',   task.price);
    set('due-date',     task.dueDate);
    set('initial-step', task.step || 'agenda');
    set('task-notes',   task.notes);

    const m = task.measures || {};
    ['cou','epaule','poitrine','taille','bassin','bras','cuisse','pantalon','cheville']
        .forEach(k => set(`m-${k}`, m[k]));

    const prev = document.getElementById('photo-preview');
    if (prev) { prev.src = task.photo || ''; prev.style.display = task.photo ? 'block' : 'none'; }

    ['btn-delete-in-modal','btn-receipt-in-modal', 'btn-whatsapp-in-modal'].forEach(bid => {
        const b = document.getElementById(bid); if (b) b.style.display = 'block';
    });

    await populateAssigneesSelect();
    const sel = document.getElementById('task-assignee');
    if (sel && task.assignee) sel.value = task.assignee;
    modal.classList.add('active');
}

async function handleTaskForm(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement…'; }

    const task = {
        id:       currentEditingTaskId,
        client:   document.getElementById('client-name')?.value  || '',
        phone:    document.getElementById('client-phone')?.value || '',
        type:     document.getElementById('cloth-type')?.value   || '',
        price:    document.getElementById('task-price')?.value   || 0,
        dueDate:  document.getElementById('due-date')?.value     || '',
        step:     document.getElementById('initial-step')?.value || 'agenda',
        assignee: document.getElementById('task-assignee')?.value|| '',
        notes:    document.getElementById('task-notes')?.value   || '',
        photo:    null,
        measures: {
            cou:      document.getElementById('m-cou')?.value      || '',
            epaule:   document.getElementById('m-epaule')?.value   || '',
            poitrine: document.getElementById('m-poitrine')?.value || '',
            taille:   document.getElementById('m-taille')?.value   || '',
            bassin:   document.getElementById('m-bassin')?.value   || '',
            bras:     document.getElementById('m-bras')?.value     || '',
            cuisse:   document.getElementById('m-cuisse')?.value   || '',
            longueur: document.getElementById('m-pantalon')?.value || '', // Map to Longueur Pantalon
            cheville: document.getElementById('m-cheville')?.value || ''
        }
    };

    if (currentPhotoFile) {
        task.photo = await _toBase64(currentPhotoFile);
    } else if (currentEditingTaskId) {
        const ex = (await getTasks()).find(x => String(x.id) === String(currentEditingTaskId));
        if (ex) task.photo = ex.photo;
    }

    const result = await saveTask(task);
    if (result && result.success) {
        const isNew = !currentEditingTaskId;
        const savedId = result.id || currentEditingTaskId; // Récupère l'ID (nouveau ou existant)

        closeNewTaskModal();
        showToast(isNew ? '✅ Commande enregistrée !' : '✅ Commande mise à jour !', 'success');
        await syncTasks();

        // Envoi automatique après confirmation
        setTimeout(() => {
            if (confirm("📲 Souhaitez-vous envoyer le reçu par WhatsApp ?")) {
                sendWhatsAppReceipt(savedId);
            }
            setTimeout(() => {
                if (confirm("✉️ Souhaitez-vous envoyer aussi le reçu par SMS ?")) {
                    sendSMSReceipt(savedId);
                }
            }, 600);
        }, 500);
    } else {
        // Alerte forcée pour voir l'erreur exacte
        const errorMsg = (result && result.error) ? result.error : "Erreur inconnue de connexion au serveur.";
        window.alert("❌ ÉCHEC DE L'ENREGISTREMENT :\n" + errorMsg);
        console.error("Save failed:", result);
    }
    if (btn) { btn.disabled = false; btn.innerHTML = 'Enregistrer'; }
}

async function handleDeleteFromModal() {
    if (!currentEditingTaskId) return;
    if (!confirm('Supprimer définitivement cette commande ?')) return;
    const ok = await deleteTask(currentEditingTaskId);
    if (ok) {
        closeNewTaskModal();
        showToast('Commande supprimée.', 'info');
        await syncTasks();
    }
}

function viewReceipt(taskId) {
    if (!taskId) { showToast('ID manquant.', 'danger'); return; }
    window.open(`recu.html?id=${taskId}`, '_blank');
}

async function sendWhatsAppReceipt(taskId) {
    if (!taskId) return;
    const tasks = await getTasks();
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;

    const phone = task.phone ? task.phone.replace(/\s+/g, '') : '';
    if (!phone) {
        showToast('Aucun numéro WhatsApp associé à ce client.', 'warning');
        return;
    }

    const price = parseInt(task.price || 0).toLocaleString();
    const message = `*AFNANE COUTURE & BROTHERS* 🧵\n\nBonjour *${task.client}*,\n\nVoici le récapitulatif de votre commande :\n- *Type :* ${task.type || '—'}\n- *Montant :* ${price} FCFA\n- *Livraison prévue :* ${task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR') : '—'}\n\nVous pouvez consulter votre reçu ici : ${window.location.origin}${window.location.pathname.replace(/\/[^\/]*$/, '/') }recu.html?id=${task.id}\n\nMerci de votre confiance ! ✨`;
    
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
}

async function sendSMSReceipt(taskId) {
    if (!taskId) return;
    const tasks = await getTasks();
    const task = tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;

    const phone = task.phone ? task.phone.replace(/\s+/g, '') : '';
    if (!phone) {
        showToast('Aucun numéro de téléphone associé à ce client.', 'warning');
        return;
    }

    const price = parseInt(task.price || 0).toLocaleString();
    const message = `AFNANE COUTURE & BROTHERS\n\nBonjour ${task.client},\nVoici votre reçu de commande #${task.id} :\n- Type : ${task.type || '—'}\n- Montant : ${price} FCFA\n\nLien du reçu : ${window.location.origin}${window.location.pathname.replace(/\/[^\/]*$/, '/') }recu.html?id=${task.id}\n\nMerci de votre confiance !`;
    
    // Note: Protocol prefix 'sms:' for mobile sharing
    const smsUrl = `sms:${phone}?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, '_blank');
}



// ===================================================================
// 📊 RENDU DES DONNÉES PAR PAGE
// ===================================================================

async function renderAgenda() {
    const el = document.getElementById('agenda-list');
    if (!el) return;
    const tasks = await getTasks();
    const list = tasks.filter(t => !t.step || t.step === 'agenda');
    if (!list.length) {
        el.innerHTML = '<div class="empty-state"><span class="material-icons" style="font-size:3rem;opacity:0.3;">calendar_today</span><br>Aucune commande en attente.<br><small>Cliquez sur "+ Nouvelle Commande" pour commencer.</small></div>';
        return;
    }
    el.innerHTML = '';
    list.forEach(task => {
        const div = document.createElement('div');
        div.className = 'agenda-item glass-panel';
        const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR') : '—';
        div.innerHTML = `
            <div class="agenda-item-info">
                <div class="client-name">${escHtml(task.client)}</div>
                <div class="cloth-type">${escHtml(task.type || '—')}</div>
            </div>
            <div class="agenda-item-meta">
                <div class="due-date"><span class="material-icons" style="font-size:1rem;vertical-align:middle;margin-right:4px;">history</span> ${due}</div>
                <div style="display:flex;gap:6px;">
                    <button class="btn btn-sm btn-outline" onclick="openEditTask('${task.id}')" title="Modifier ou voir les détails">Détails</button>
                    <button class="btn btn-sm btn-primary" onclick="viewReceipt('${task.id}')" title="Générer le reçu PDF/Imprimable"><span class="material-icons" style="font-size:1.1rem;vertical-align:middle;margin-right:4px;">receipt_long</span> Reçu</button>
                </div>
            </div>`;
        el.appendChild(div);
    });
}

async function renderAtelier() {
    const el = document.getElementById('atelier-list');
    if (!el) return;
    const tasks = await getTasks();
    const list = tasks.filter(t => t.step === 'atelier');
    if (!list.length) {
        el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="material-icons" style="font-size:3rem;opacity:0.3;">content_cut</span><br>Aucune pièce en confection.<br><small>Les commandes en atelier s\'affichent ici.</small></div>';
        return;
    }
    el.innerHTML = '';
    list.forEach(task => {
        const card = document.createElement('div');
        card.className = 'task-card glass-panel';
        const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR') : '—';
        card.innerHTML = `
            ${task.photo ? `<img src="${task.photo}" alt="Modèle" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;margin-bottom:10px;">` : ''}
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div style="font-weight:700;">${escHtml(task.client)}</div>
                <span style="font-size:0.75rem;padding:3px 8px;border-radius:20px;background:rgba(241,196,15,0.15);color:#c9a000;border:1px solid rgba(241,196,15,0.3);">En cours</span>
            </div>
            <div style="color:var(--text-hint);font-size:0.88rem;margin-top:4px;">${escHtml(task.type||'—')}</div>
            <div style="font-size:0.82rem;color:#999;margin-top:5px;"><span class="material-icons" style="font-size:1rem;vertical-align:middle;margin-right:4px;">event</span> ${due}</div>
            ${task.assignee?`<div style="font-size:0.8rem;color:#999;margin-top:3px;"><span class="material-icons" style="font-size:1rem;vertical-align:middle;margin-right:4px;">person</span> ${escHtml(task.assignee)}</div>`:''}
            <div style="display:flex;gap:8px;margin-top:12px;">
                <button class="btn btn-sm btn-outline" onclick="openEditTask('${task.id}')" title="Modifier les mesures ou le statut">Modifier</button>
                <button onclick="moveTask('${task.id}','boutique')" style="background:#27ae60;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:0.82rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px;" title="Marquer comme prêt pour la boutique">
                    <span class="material-icons" style="font-size:1rem;">check_circle</span> Terminé
                </button>
            </div>`;
        el.appendChild(card);
    });
}

async function renderBoutique(filter = '') {
    const el = document.getElementById('boutique-list');
    if (!el) return;
    const tasks = await getTasks();
    let list = tasks.filter(t => t.step === 'boutique');
    if (filter) {
        const q = filter.toLowerCase();
        list = list.filter(t => (t.client||'').toLowerCase().includes(q) || (t.type||'').toLowerCase().includes(q) || (t.phone||'').includes(q));
    }
    if (!list.length) {
        el.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="material-icons" style="font-size:3rem;opacity:0.3;">storefront</span><br>${filter?'Aucun résultat.':'Aucune commande prête.'}<br><small>Les commandes terminées apparaissent ici.</small></div>`;
        return;
    }
    el.innerHTML = '';
    list.forEach(task => {
        const card = document.createElement('div');
        card.className = 'task-card glass-panel';
        const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR') : '—';
        card.innerHTML = `
            ${task.photo ? `<img src="${task.photo}" alt="Modèle" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;margin-bottom:10px;">` : ''}
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div style="font-weight:700;">${escHtml(task.client)}</div>
                <span style="font-size:0.75rem;padding:3px 8px;border-radius:20px;background:rgba(39,174,96,0.15);color:#27ae60;border:1px solid rgba(39,174,96,0.3);">Prêt</span>
            </div>
            <div style="color:var(--text-hint);font-size:0.88rem;margin-top:4px;">${escHtml(task.type||'—')}</div>
            <div style="font-size:0.82rem;color:#999;margin-top:5px;"><span class="material-icons" style="font-size:1rem;vertical-align:middle;margin-right:4px;">event</span> ${due}</div>
            <div style="font-weight:700;color:#27ae60;margin-top:5px;">${parseInt(task.price||0).toLocaleString()} FCFA</div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button class="btn btn-sm btn-outline" onclick="openEditTask('${task.id}')" title="Voir les mesures du client">Détails</button>
                <button class="btn btn-sm btn-primary" onclick="viewReceipt('${task.id}')" title="Imprimer ou Partager le Reçu"><span class="material-icons" style="font-size:1rem;vertical-align:middle;margin-right:4px;">receipt_long</span> Reçu</button>
                <button class="btn btn-sm" onclick="moveTask('${task.id}','livre')" style="background:#27ae60;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:0.82rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px;" title="Finaliser et livrer la commande au client">
                    <span class="material-icons" style="font-size:1.1rem;">local_shipping</span> Livrer
                </button>
            </div>`;
        el.appendChild(card);
    });
}

async function renderBibliotheque(filter = '') {
    const tbody = document.getElementById('biblio-table-body');
    if (!tbody) return;
    const tasks = await getTasks();
    let list = [...tasks];
    if (filter) {
        const q = filter.toLowerCase();
        list = list.filter(t => (t.client||'').toLowerCase().includes(q)||(t.type||'').toLowerCase().includes(q)||(t.phone||'').includes(q));
    }
    list.sort((a,b) => new Date(b.createdAt||0) - new Date(a.createdAt||0));
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;color:var(--text-hint);"><span class="material-icons" style="font-size:3rem;opacity:0.2;display:block;margin-bottom:8px;">folder_open</span>${filter?`Aucun résultat pour "${escHtml(filter)}".`:'Aucune commande enregistrée.'}</td></tr>`;
        return;
    }
    const SL = { agenda:'Agenda', atelier:'En cours', boutique:'Prêt', livre:'Livré' };
    const SC = { agenda:'#f1c40f', atelier:'#3498db', boutique:'#27ae60', livre:'#9b59b6' };
    tbody.innerHTML = '';
    list.forEach(task => {
        const step = task.step || 'agenda';
        const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR') : '—';
        const created = task.createdAt ? new Date(task.createdAt).toLocaleDateString('fr-FR') : '—';
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border-light)';
        tr.innerHTML = `
            <td style="padding:12px;">#${String(task.id).padStart(4,'0')}</td>
            <td style="padding:12px;">
                <div style="font-size:0.82rem;color:var(--text-hint);">${created}</div>
                <span style="padding:2px 8px;border-radius:20px;font-size:0.72rem;font-weight:600;background:${SC[step]}20;color:${SC[step]};">${SL[step]||step}</span>
            </td>
            <td style="padding:12px;"><div style="font-weight:600;">${escHtml(task.client)}</div><div style="font-size:0.8rem;color:var(--text-hint);">${escHtml(task.phone||'—')}</div></td>
            <td style="padding:12px;">${escHtml(task.type||'—')}</td>
            <td style="padding:12px;font-weight:700;color:#27ae60;">${parseInt(task.price||0).toLocaleString()} FCFA</td>
            <td style="padding:12px;"><div style="display:flex;gap:10px;">
                <button class="btn btn-sm btn-outline" onclick="openEditTask('${task.id}')" title="Modifier" style="display:flex;align-items:center;padding:6px;">
                    <span class="material-icons" style="font-size:1.2rem;">edit</span>
                </button>
                <button class="btn btn-sm" onclick="directDeleteTask('${task.id}')" title="Supprimer" style="background:#fffcf0;color:#ff4d4f;border:1px solid #ffd8bf;padding:6px;border-radius:6px;cursor:pointer;display:flex;align-items:center;">
                    <span class="material-icons" style="font-size:1.2rem;">delete</span>
                </button>
                <button onclick="viewReceipt('${task.id}')" title="Voir Reçu" style="background:#e6f7ff;color:#1890ff;border:1px solid #91d5ff;padding:6px;border-radius:6px;cursor:pointer;display:flex;align-items:center;">
                    <span class="material-icons" style="font-size:1.2rem;">receipt_long</span>
                </button>
            </div></td>`;
        tbody.appendChild(tr);
    });
}

async function moveTask(id, newStep) {
    const tasks = await getTasks();
    const task = tasks.find(t => String(t.id) === String(id));
    if (!task) return;
    task.step = newStep;
    const result = await saveTask(task);
    if (result) {
        showToast(`Déplacé vers "${newStep}".`, 'success');
        await syncTasks();
    }
}

// ===================================================================
// 📈 STATISTIQUES & GRAPHIQUES
// ===================================================================

// États de visibilité individuels pour les types de revenus
let revVisibility = {
    total: false,
    fabrics: false,
    materials: false
};
let currentRevenueTotal = 0;
let currentRevenueFabrics = 0;
let currentRevenueMaterials = 0;

async function updateStats() {
    const tasks = await getTasks();
    currentRevenueTotal = tasks.reduce((s,t) => s + (parseFloat(t.price)||0), 0);
    // Simulation pour les exemples (normalement viendrait d'une autre table)
    currentRevenueFabrics = 0; 
    currentRevenueMaterials = 0;
    
    const map = {
        'stat-clients':  [...new Set(tasks.map(t=>t.phone||t.client))].filter(Boolean).length,
        'stat-orders':   tasks.length,
        'stat-ongoing':  tasks.filter(t=>t.step==='atelier').length,
        'stat-done':     tasks.filter(t=>t.step==='boutique').length,
        'stat-fabrics':  tasks.filter(t=>(t.type||'').toLowerCase().includes('tissu')).length,
        'stat-materials':0
    };
    for (const [id, val] of Object.entries(map)) {
        const el = document.getElementById(id); if (el) el.innerText = val;
    }
    
    _refreshRevenueDisplay();

    const agEl = document.getElementById('stat-agenda-count');
    if (agEl) agEl.innerText = tasks.filter(t=>!t.step||t.step==='agenda').length + ' en attente';
}

function _refreshRevenueDisplay() {
    // Configuration des affichages
    const configs = [
        { id: 'rev-amount-display', iconId: 'rev-toggle-icon', value: currentRevenueTotal, key: 'total' },
        { id: 'rev-fabrics-display', iconId: 'rev-fabrics-icon', value: currentRevenueFabrics, key: 'fabrics' },
        { id: 'rev-materials-display', iconId: 'rev-materials-icon', value: currentRevenueMaterials, key: 'materials' }
    ];
    
    configs.forEach(cfg => {
        const el = document.getElementById(cfg.id);
        const icon = document.getElementById(cfg.iconId);
        const visible = revVisibility[cfg.key];
        
        if (el) {
            el.innerText = visible ? cfg.value.toLocaleString() + ' FCFA' : '•••••• FCFA';
        }
        if (icon) {
            // Utilisation des icônes Material (attention : nous sommes passés aux material-icons)
            icon.innerText = visible ? 'visibility' : 'visibility_off';
        }
    });
}

function toggleRevenue(e, type) {
    if (e) e.stopPropagation();
    if (revVisibility.hasOwnProperty(type)) {
        revVisibility[type] = !revVisibility[type];
        _refreshRevenueDisplay();
    }
}

let _chartRev = null, _chartExp = null;
function initCharts() { renderRevenueChart(); renderExpenseChart(); }

function renderRevenueChart() {
    const ctx = document.getElementById('revenueChart')?.getContext('2d');
    if (!ctx) return;
    if (_chartRev) _chartRev.destroy();
    _chartRev = new Chart(ctx, {
        type: 'line',
        data: { labels:['Jan','Fév','Mar','Avr','Mai','Jun'],
            datasets:[{label:'Revenus (FCFA)',data:[150000,230000,180000,450000,320000,600000],
                borderColor:'#0056b3',backgroundColor:'rgba(0,86,179,0.1)',fill:true,tension:0.4}]},
        options:{ responsive:true,maintainAspectRatio:false,
            plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}} }
    });
}

function renderExpenseChart() {
    const ctx = document.getElementById('expenseChart')?.getContext('2d');
    if (!ctx) return;
    if (_chartExp) _chartExp.destroy();
    _chartExp = new Chart(ctx, {
        type: 'bar',
        data: { labels:['Jan','Fév','Mar','Avr','Mai','Jun'],
            datasets:[{label:'Dépenses (FCFA)',data:[50000,80000,40000,120000,90000,150000],
                backgroundColor:'#e74c3c',borderRadius:5}]},
        options:{ responsive:true,maintainAspectRatio:false,
            plugins:{legend:{display:false}},scales:{y:{beginAtZero:true}} }
    });
}

// ===================================================================
// 🔧 UTILITAIRES
// ===================================================================

async function populateAssigneesSelect() {
    const sel = document.getElementById('task-assignee');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— Sans attribution —</option>';
    try {
        const res = await fetch('api/tailleurs.php', { cache: 'no-store' });
        if (res.ok) {
            const tailors = await res.json();
            tailors.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.username; opt.textContent = t.username;
                sel.appendChild(opt);
            });
        }
    } catch(_) {
        ['Moussa','Abdou','Ibrahim'].forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            sel.appendChild(opt);
        });
    }
    if (cur) sel.value = cur;
}

function _hideAllLoaders() {
    document.querySelectorAll('.loading-state').forEach(el => el.style.display = 'none');
}
function _showAllLoaders() {
    document.querySelectorAll('.loading-state').forEach(el => el.style.display = 'flex');
}
function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function logout() {
    localStorage.removeItem('afnane_user');
    window.location.href = 'connexion.html';
}
function showToast(msg, type = 'info') {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = `toast toast-${type} show`;
    t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
}
function initTheme() {
    const th = localStorage.getItem('theme') || 'light';
    document.body.className = th + '-theme';
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.innerHTML = `<span class="material-icons">${th === 'dark' ? 'light_mode' : 'dark_mode'}</span>`;
        btn.onclick = () => {
            const next = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
            localStorage.setItem('theme', next); initTheme();
        };
    }
}
function updateDateDisplay() {
    const el = document.getElementById('current-date');
    if (el) el.innerText = new Date().toLocaleDateString('fr-FR', {weekday:'long',day:'numeric',month:'long',year:'numeric'});
}
async function hashPassword(p) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function _toBase64(file) {
    return new Promise((res,rej) => {
        const r = new FileReader(); r.readAsDataURL(file);
        r.onload = () => res(r.result); r.onerror = rej;
    });
}

// ===================================================================
// 🔧 PARAMÈTRES & TAILLEURS (MYSQL & LOCAL)
// ===================================================================

/** Vérifie le mot de passe d'un tailleur */
async function verifyTailorPassword(username, password) {
    try {
        const hashedPassword = await hashPassword(password);
        const res = await fetch('api/connexion.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password: hashedPassword })
        });
        const result = await res.json();
        if (result.success) return result.user;
        return null;
    } catch (e) {
        console.error('Login error:', e);
        return null;
    }
}

/** Rendu des travaux pour un tailleur spécifique */
async function renderTailleur() {
    const el = document.getElementById('tailleur-list');
    if (!el) return;
    const tasks = await getTasks();
    const currentUser = sessionStorage.getItem('loggedTailor');
    const list = tasks.filter(t => t.assignee === currentUser && (t.step === 'atelier' || t.step === 'agenda'));
    
    if (!list.length) {
        el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="material-icons" style="font-size:3rem;opacity:0.3;">assignment</span><br>Aucun travail assigné.<br><small>Dès qu\'un travail (Agenda ou Atelier) vous est assigné, il apparaîtra ici.</small></div>';
        return;
    }
    el.innerHTML = '';
    list.forEach(task => {
        const card = document.createElement('div');
        card.className = 'task-card glass-panel';
        const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR') : '—';
        const isAgenda = task.step === 'agenda';
        
        card.innerHTML = `
            ${task.photo ? `<img src="${task.photo}" alt="Modèle" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px;margin-bottom:10px;">` : ''}
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <div style="font-weight:700; font-size:1.05rem;">${escHtml(task.client)}</div>
                <span style="font-size:0.7rem; padding:2px 8px; border-radius:12px; background:${isAgenda ? 'rgba(241,196,15,0.1)' : 'rgba(52,152,219,0.1)'}; color:${isAgenda ? '#f39c12' : '#3498db'}; border:1px solid ${isAgenda ? '#f1c40f50' : '#3498db50'}; font-weight:600;">
                    ${isAgenda ? 'EN ATTENTE' : 'EN COURS'}
                </span>
            </div>
            <div style="color:var(--text-hint);font-size:0.88rem;margin-top:4px;">${escHtml(task.type||'—')}</div>
            <div style="font-size:0.82rem;color:#999;margin-top:5px;"><span class="material-icons" style="font-size:1rem;vertical-align:middle;margin-right:4px;">event</span> ${due}</div>
            <div style="display:flex;gap:8px;margin-top:12px;">
                <button class="btn btn-sm btn-outline" onclick="openEditTask('${task.id}')" title="Voir les mesures">Voir Mesures</button>
                ${isAgenda ? `
                    <button onclick="moveTask('${task.id}','atelier')" style="background:#3498db;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:0.82rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px;">
                        <span class="material-icons" style="font-size:1rem;">play_arrow</span> Démarrer
                    </button>
                ` : `
                    <button onclick="moveTask('${task.id}','boutique')" style="background:#27ae60;color:#fff;border:none;padding:6px 12px;border-radius:6px;font-size:0.82rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px;">
                        <span class="material-icons" style="font-size:1rem;">check_circle</span> Fini
                    </button>
                `}
            </div>`;
        el.appendChild(card);
    });
}

/** Polling pour les nouvelles tâches (Son de notification) */
let _tailorPollingId = null;
let _lastPulseTaskCount = -1;
function startTailorPolling(user) {
    if (_tailorPollingId) clearInterval(_tailorPollingId);
    _tailorPollingId = setInterval(async () => {
        const tasks = await getTasks();
        const myTasks = tasks.filter(t => t.assignee === user && t.step === 'atelier');
        if (_lastPulseTaskCount !== -1 && myTasks.length > _lastPulseTaskCount) {
             const audioSrc = localStorage.getItem('sw_audio_' + user);
             if (audioSrc) new Audio(audioSrc).play().catch(e => console.log('Audio blocked', e));
             renderTailleur();
        }
        _lastPulseTaskCount = myTasks.length;
    }, 15000); // Toutes les 15 secondes
}
function stopTailorPolling() { if (_tailorPollingId) clearInterval(_tailorPollingId); _tailorPollingId = null; }

/** Récupère tous les tailleurs depuis l'API */
async function getTailors() {
    try {
        const res = await fetch('api/tailleurs.php', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error('getTailors error:', e);
        return [];
    }
}

/** Ajoute un nouveau tailleur via l'API */
async function addTailor(username, password) {
    try {
        const hashedPassword = await hashPassword(password);
        const res = await fetch('api/tailleurs.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password: hashedPassword, role: 'tailleur' })
        });
        const result = await res.json();
        if (!result.success) throw new Error(result.error);
        return result;
    } catch (e) {
        showToast('Erreur création tailleur : ' + e.message, 'danger');
        return null;
    }
}

/** Supprime un tailleur via l'API */
async function deleteTailor(username) {
    try {
        // L'API attend un ID, mais la page parametre.html passe un username.
        // On doit d'abord trouver l'ID du tailleur.
        const tailors = await getTailors();
        const t = tailors.find(x => x.username === username);
        if (!t) throw new Error('Tailleur introuvable');
        
        const res = await fetch(`api/tailleurs.php?id=${t.id}`, { method: 'DELETE' });
        const result = await res.json();
        if (!result.success) throw new Error(result.error);
        return true;
    } catch (e) {
        showToast('Erreur suppression : ' + e.message, 'danger');
        return false;
    }
}

/** Gère les paramètres généraux de l'atelier (Stockage local) */
async function getSettings() {
    const s = localStorage.getItem('afnane_settings');
    return s ? JSON.parse(s) : {
        name: 'Afnane Couture and Brothers',
        phone: '+227 95 95 13 13',
        address: 'Quartier Grand Marché, Niamey, Niger',
        currency: 'FCFA',
        photo: 'assets/img/logo.png'
    };
}

async function saveSettings(s) {
    localStorage.setItem('afnane_settings', JSON.stringify(s));
    return { success: true };
}

// Utilitaires de hashage (admin)
async function hashAdminPassword(p) { return await hashPassword(p); }
async function getAdminPasswordHash() {
    const s = await getSettings();
    return s.adminPasswordHash || await hashPassword('admin123');
}
const RESET_CODE = "2024REBOOT"; // Code de secours

async function showConfirmModal(msg) {
    return window.confirm(msg);
}

// ===================================================================
// 🔐 MOTEUR DE VERROUILLAGE (MODE KIOSQUE)
// Empêche toute interaction de navigation/défilement non-voulue.
// ===================================================================

/** Bloque toutes les touches de défilement et navigation */
const lockNavigation = (e) => {
    // Liste complète des touches qui provoquent un défilement ou une navigation
    const FORBIDDEN_KEYS = [
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
        ' ', 'PageUp', 'PageDown', 'Home', 'End'
    ];

    if (!FORBIDDEN_KEYS.includes(e.key)) return;

    // Autoriser les touches UNIQUEMENT dans les champs de saisie valides
    const tag = e.target.tagName.toLowerCase();
    const type = (e.target.type || '').toLowerCase();
    const isEditable = tag === 'textarea' 
        || tag === 'select'
        || (tag === 'input' && !['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'image'].includes(type))
        || e.target.isContentEditable;

    if (isEditable) return;

    // Empêche l'action (défilement, navigation Alt+Flèche, etc.)
    e.preventDefault();
};

/** Bloque le défilement par molette de souris ou pavé tactile */
const lockWheel = (e) => {
    // On ne bloque pas si on est dans un élément qui a spécifiquement besoin de scroll interne
    // (Mais ici, on veut forcer l'usage exclusif des boutons d'app)
    e.preventDefault();
};

/** Empêche l'utilisation du bouton "Retour" du navigateur et force la re-connexion */
const lockHistory = () => {
    // Si on est sur la page de connexion, on ne fait rien
    if (window.location.href.includes('connexion.html')) return;

    // On pousse un état fictif pour capturer le prochain "Retour"
    history.pushState(null, null, window.location.href);
    
    window.onpopstate = () => {
        // L'utilisateur a tenté un retour arrière (Flèche gauche, bouton navigateur, etc.)
        // Sécurité : On vide la session et on redirige vers le login
        localStorage.removeItem('afnane_user');
        window.location.href = 'connexion.html?ref=security_exit';
    };
};

// Activation du verrouillage
document.addEventListener('keydown', lockNavigation, { passive: false });
document.addEventListener('wheel', lockWheel, { passive: false });
document.addEventListener('mousewheel', lockWheel, { passive: false });
lockHistory();

// Démarrage du moteur
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    updateDateDisplay();

    // Upload photo
    const photoInput = document.getElementById('cloth-photo');
    if (photoInput) {
        photoInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            currentPhotoFile = file;
            const prev = document.getElementById('photo-preview');
            if (prev) { prev.src = URL.createObjectURL(file); prev.style.display = 'block'; }
        });
    }

    // Formulaire
    const form = document.getElementById('new-task-form');
    if (form) form.addEventListener('submit', handleTaskForm);

    await initApp();
});

