$path = 'c:\Users\Youssoufa\Documents\FWS V2\assets\js\app.v2.js'
$c = Get-Content $path -Raw
if ($c -notmatch "collection\('tasks'\).onSnapshot") {
    $pattern = "db = firebase.firestore\(\);"
    $injection = "`n    // ✅ TEMPS RÉEL (Automatique)`n    db.collection('tasks').onSnapshot(snap => {`n        const ts = []; snap.forEach(d => ts.push({...d.data(), id:d.id}));`n        localStorage.setItem('sw_tasks_cache', JSON.stringify(ts));`n        if(typeof renderAgenda==='function') renderAgenda();`n        if(typeof renderAtelier==='function') renderAtelier();`n        if(typeof renderBoutique==='function') renderBoutique();`n        if(typeof updateStats==='function') updateStats();`n    });"
    $c = $c -replace $pattern, ($pattern + $injection)
    Set-Content -Path $path -Value $c -Encoding UTF8
    Write-Host "Real-time sync injected successfully."
} else {
    Write-Host "Real-time already present."
}
