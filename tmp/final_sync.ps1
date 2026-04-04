$path = 'c:\Users\Youssoufa\Documents\FWS V2\assets\js\app.v2.js'
$c = Get-Content $path -Raw
if ($c -notmatch "collection\('tasks'\)\.onSnapshot") {
    $pattern = "db\s*=\s*firebase\.firestore\(\);"
    $injection = "`n        // ✅ TEMPS RÉEL (Automatique)`n        db.collection('tasks').onSnapshot(snapshot => {`n            const remoteTasks = [];`n            snapshot.forEach(doc => { const data = doc.data(); data.id = doc.id; remoteTasks.push(data); });`n            localStorage.setItem('sw_tasks_cache', JSON.stringify(remoteTasks));`n            if (typeof renderAgenda === 'function') renderAgenda();`n            if (typeof renderAtelier === 'function') renderAtelier();`n            if (typeof renderBoutique === 'function') renderBoutique();`n            if (typeof updateStats === 'function') updateStats();`n        });"
    $c = [regex]::replace($c, $pattern, "db      = firebase.firestore();" + $injection)
    Set-Content -Path $path -Value $c -Encoding UTF8
    Write-Host "Real-time sync for tasks injected."
} else {
    Write-Host "Real-time sync for tasks already present."
}
