const fs = require('fs');
const path = 'c:\\Users\\Youssoufa\\Documents\\FWS V2\\assets\\js\\app.v2.js';
let content = fs.readFileSync(path, 'utf8');

// Injection du temps réél Tasks
if (!content.includes("collection('tasks').onSnapshot")) {
    const pattern = "db = firebase.firestore();";
    const injection = `\n\n    // ✅ TEMPS RÉEL : Écouteur automatique des changements\n    db.collection('tasks').onSnapshot(snap => {\n        const tasks = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));\n        localStorage.setItem('sw_tasks_cache', JSON.stringify(tasks));\n        if(typeof renderAgenda === 'function') renderAgenda();\n        if(typeof renderAtelier === 'function') renderAtelier();\n        if(typeof renderBoutique === 'function') renderBoutique();\n        if(typeof updateStats === 'function') updateStats();\n        if(typeof renderRevenueBanner === 'function') renderRevenueBanner();\n    }, err => console.error("Erreur onSnapshot Tasks:", err));`;
    
    // On cherche un endroit stratégique après l'init db
    content = content.replace(pattern, pattern + injection);
}

fs.writeFileSync(path, content, 'utf8');
console.log("Transformation app.v2.js REUSSIE !");
