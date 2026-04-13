/**
 * AFNANE COUTURE GALERIE — LOGIQUE DE LA PAGE (V2)
 */

// ===================================================================
// 🔐 MOTEUR DE VERROUILLAGE (Galerie)
// ===================================================================
const lockNavigation = (e) => {
    const FORBIDDEN_KEYS = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','PageUp','PageDown','Home','End'];
    if (!FORBIDDEN_KEYS.includes(e.key)) return;
    const tag = e.target.tagName.toLowerCase();
    const type = (e.target.type || '').toLowerCase();
    const isEditable = tag === 'textarea' || tag === 'select' || (tag === 'input' && !['checkbox', 'radio', 'range', 'button', 'submit'].includes(type)) || e.target.isContentEditable;
    if (isEditable) return;
    e.preventDefault();
};
const lockWheel = (e) => e.preventDefault();
const lockHistory = () => {
    history.pushState(null, null, window.location.href);
    window.onpopstate = () => {
        localStorage.removeItem('afnane_user');
        window.location.href = 'connexion.html?ref=security_exit_gallery';
    };
};
document.addEventListener('keydown', lockNavigation, { passive: false });
document.addEventListener('wheel', lockWheel, { passive: false });
document.addEventListener('mousewheel', lockWheel, { passive: false });
lockHistory();

document.addEventListener('DOMContentLoaded', () => {
    renderGallery();
    initGalleryUI();
});

let isAdminMode = false;

function initGalleryUI() {
    const photoInput = document.getElementById('p-photo');
    if (photoInput) {
        photoInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                const preview = document.getElementById('p-preview');
                const box = document.getElementById('p-upload-box');
                preview.src = ev.target.result;
                preview.style.display = 'block';
                box.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
    }

    const form = document.getElementById('gallery-form');
    if (form) {
        form.onsubmit = e => {
            e.preventDefault();
            handleSaveProduct();
        };
    }
}

async function renderGallery(filter = 'tous') {
    const list = document.getElementById('gallery-list');
    if (!list) return;

    try {
        const res = await fetch('api/galerie.php');
        const items = await res.json();
        
        const filtered = filter === 'tous' ? items : items.filter(i => i.category === filter);
        
        if (filtered.length === 0) {
            list.innerHTML = '<div class="loading-state">Aucun produit trouvé dans cette catégorie.</div>';
            return;
        }

        list.innerHTML = filtered.map(item => `
            <div class="product-card">
                <div class="product-image-wrap">
                    <img src="${item.photo || 'assets/img/logo.png'}" alt="${item.title}" class="product-image">
                    
                    ${isAdminMode ? `
                    <div class="admin-controls">
                        <button class="btn btn-icon" style="background:#fff;" onclick="editProduct('${item.id}')"><i class="fa-solid fa-edit"></i></button>
                        <button class="btn btn-icon" style="background:#fff;color:var(--danger-color);" onclick="deleteProduct('${item.id}')"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    ` : ''}
                </div>
                <div class="product-info">
                    <div class="product-category">${item.category}</div>
                    <div class="product-title">${item.title}</div>
                    <div class="product-price">${parseInt(item.price).toLocaleString()} FCFA</div>
                </div>
            </div>
        `).join('');

    } catch (e) {
        console.error(e);
        list.innerHTML = '<div class="loading-state">Erreur de chargement.</div>';
    }
}

function filterGallery(cat) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.innerText === cat || (cat === 'tous' && b.innerText === 'Tous')));
    renderGallery(cat);
}

function toggleAdminMode() {
    // Dans une version plus poussée, on demanderait un mot de passe ici.
    // L'utilisateur a demandé "faire en sorte que ce soit le gérant qui a ce lien".
    // On va juste basculer le mode et changer le bouton.

    isAdminMode = !isAdminMode;
    document.body.classList.toggle('admin-active', isAdminMode);
    const btn = document.getElementById('admin-toggle-btn');
    if (isAdminMode) {
        btn.innerHTML = '<i class="fa-solid fa-unlock-alt"></i> Mode Gérant Actif';
        btn.classList.add('active');
    } else {
        btn.innerHTML = '<i class="fa-solid fa-lock"></i> Mode Gérant';
        btn.classList.remove('active');
    }
    renderGallery(); // Pour rafraichir les contrôles admin
}

function openGalleryModal() {
    document.getElementById('modal-title').innerText = "Ajouter un Produit";
    document.getElementById('p-title').value = '';
    document.getElementById('p-price').value = '';
    document.getElementById('product-id').value = '';
    document.getElementById('p-preview').style.display = 'none';
    document.getElementById('p-upload-box').style.display = 'flex';
    document.getElementById('gallery-modal').classList.add('active');
}

function closeGalleryModal() {
    document.getElementById('gallery-modal').classList.remove('active');
}

async function handleSaveProduct() {
    const id = document.getElementById('product-id').value;
    const item = {
        title: document.getElementById('p-title').value,
        price: document.getElementById('p-price').value,
        category: document.getElementById('p-category').value,
        photo: document.getElementById('p-preview').src,
    };
    if (id) item.id = id;

    try {
        const res = await fetch('api/galerie.php', {
            method: 'POST',
            body: JSON.stringify(item),
            headers: { 'Content-Type': 'application/json' }
        });
        const d = await res.json();
        if (d.success) {
            closeGalleryModal();
            renderGallery();
        }
    } catch (e) {
        alert("Erreur lors de la sauvegarde.");
    }
}

async function editProduct(id) {
    try {
        const res = await fetch(`api/galerie.php?id=${id}`);
        const item = await res.json();
        if (item) {
            document.getElementById('modal-title').innerText = "Modifier le Produit";
            document.getElementById('p-title').value = item.title;
            document.getElementById('p-price').value = parseInt(item.price);
            document.getElementById('p-category').value = item.category;
            document.getElementById('product-id').value = item.id;
            
            const preview = document.getElementById('p-preview');
            const box = document.getElementById('p-upload-box');
            preview.src = item.photo || 'assets/img/logo.png';
            preview.style.display = 'block';
            box.style.display = 'none';
            
            document.getElementById('gallery-modal').classList.add('active');
        }
    } catch (e) { console.error(e); }
}

async function deleteProduct(id) {
    if (!confirm("Supprimer ce produit de la galerie ?")) return;
    try {
        const res = await fetch(`api/galerie.php?id=${id}`, { method: 'DELETE' });
        const d = await res.json();
        if (d.success) renderGallery();
    } catch (e) { console.error(e); }
}
