# 🎨 Architecture UI/UX — Afnane Couture & Brothers (v4.0)

Ce document détaille la structure visuelle et technique de l'interface utilisateur, conçue pour offrir une expérience premium et professionnelle.

---

## 1. 🏗️ Structure HTML5 sémantique
L'application utilise une structure HTML5 moderne pour un référencement optimal et une navigation claire :
- **`<nav class="sidebar">`** : Navigation principale persistante (Desktop).
- **`<header class="top-header">`** : Zone de titre dynamique et accès aux statistiques.
- **`<main class="main-content">`** : Zone de contenu principal (Agenda, Atelier, etc.).
- **`<nav class="bottom-nav">`** : Barre de navigation tactile optimisée pour Mobile (PWA).

### Identifiants Uniques (IDs)
Chaque élément interactif possède un ID unique (ex: `#task-modal`, `#client-name`) pour permettre au moteur JavaScript d'injecter des données sans conflits.

---

## 2. 💎 Système de Design CSS (Premium Blue)
Le style est entièrement géré par `assets/css/style.v2.css` avec un système de variables centralisé :

### Variables Globales (`:root`)
```css
:root {
  --primary-color: #0056b3;       /* Bleu Institutionnel */
  --bg-alpha: rgba(244, 247, 250, 0.85); /* Effet Verre */
  --card-shadow: 0 10px 30px rgba(0, 86, 179, 0.12);
  --glass-border: 1px solid rgba(255, 255, 255, 0.6);
}
```

### Concepts Clés appliqués :
- **Glassmorphism** : Utilisation de `backdrop-filter: blur(10px)` sur les panneaux pour un aspect moderne et épuré.
- **Micro-animations** : Transition douce de 0.3s sur tous les boutons et entrées de formulaires (`transition: all 0.3s ease`).
- **Cartes Kanban** : Utilisation de `display: flex` et `border-left` colorés pour indiquer l'urgence ou l'état de la commande.

---

## 3. 📱 Adaptabilité (Responsive)
L'interface s'adapte à tous les écrans grâce aux **Media Queries** :
- **Desktop (> 992px)** : Barre latérale visible à gauche, grille de cartes sur 3 ou 4 colonnes.
- **Tablette (768px - 991px)** : Réduction de la sidebar, passage à 2 colonnes.
- **Mobile (< 767px)** : Disparition de la sidebar au profit de la `bottom-nav` et empilement vertical complet.

---

## 4. 🧩 Composants Réutilisables
- **`.glass-panel`** : Conteneur standard avec effet de flou et bordure subtile.
- **`.btn-primary`** : Bouton d'action principale avec dégradé bleu et effet de survol lumineux.
- **`.stat-card`** : Cartes de statistiques avec icônes FontAwesome harmonisées.
- **`.form-group`** : Entrées de formulaires avec libellés flottants et focus coloré en bleu.

---

## 5. 🛡️ Accessibilité et Performance
- **Font Face** : Les polices sont chargées via Google Fonts avec `font-display: swap` pour éviter les textes invisibles pendant le chargement.
- **Contrastes** : La palette bleue a été choisie pour respecter les standards d'accessibilité (Contraste élevé sur fond blanc).

*Rapport rédigé par Antigravity pour Afnane Couture & Brothers.*
