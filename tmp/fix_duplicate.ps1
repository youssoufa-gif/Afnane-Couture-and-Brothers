$path = 'c:\Users\Youssoufa\Documents\FWS V2\assets\js\app.v2.js'
$c = Get-Content $path -Raw

# On cherche le bloc getTasks dupliqué qui commence après line 1700
# et s'arrête avant calculateFinances
$pattern = '(?s)async function getTasks\(\) \{.*?localStorage\.setItem\(''sw_tasks_cache'', JSON\.stringify\(tasks\)\);.*?return \[\];.*?\}\r?\n\r?\nasync function calculateFinances'
$replacement = 'async function calculateFinances'

if ($c -match $pattern) {
    $c = $c -replace $pattern, $replacement
    Set-Content -Path $path -Value $c -Encoding UTF8
    Write-Host "Duplicate getTasks removed with regex."
} else {
    Write-Host "Regex match failed. Function not found or different pattern."
}
