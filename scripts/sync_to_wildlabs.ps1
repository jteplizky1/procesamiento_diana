$ErrorActionPreference = "Stop"

$targetRepo = "Wild-Labs/wildfi-sb-diana-analysis"
$targetUrl = "https://github.com/Wild-Labs/wildfi-sb-diana-analysis.git"
$integrationBranch = "integration/gcs-gemini"
$originalBranch = git branch --show-current

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falló: git $($Arguments -join ' ')"
    }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "No se encontró GitHub CLI. Instalalo con: winget install --id GitHub.cli"
}

$activeUserOutput = & gh api user --jq .login
$activeUser = ([string]($activeUserOutput -join "")).Trim()
if ($LASTEXITCODE -ne 0 -or $activeUser -ne "jtwildfi") {
    throw "La cuenta activa debe ser jtwildfi. Ejecutá: gh auth switch --hostname github.com --user jtwildfi"
}

$pending = git status --porcelain
if ($pending) {
    throw "Hay cambios locales sin guardar. Hacé commit o descartalos antes de sincronizar."
}

$wildlabsRemote = git remote get-url wildlabs 2>$null
if ($LASTEXITCODE -ne 0) {
    Invoke-Git remote add wildlabs $targetUrl
} elseif ($wildlabsRemote.Trim() -ne $targetUrl) {
    throw "El remoto wildlabs apunta a '$wildlabsRemote' y no al repositorio esperado."
}

Invoke-Git fetch origin main
Invoke-Git fetch wildlabs main

$localBranch = git branch --list $integrationBranch
if ($localBranch) {
    Invoke-Git switch $integrationBranch
    Invoke-Git merge -X ours --no-edit wildlabs/main
} else {
    Invoke-Git switch -c $integrationBranch wildlabs/main
}

# Evita que Git intente abrir Antigravity como editor durante el merge.
$previousEditor = $env:GIT_EDITOR
$env:GIT_EDITOR = "true"
try {
    Invoke-Git merge -X ours --no-edit origin/main
} finally {
    $env:GIT_EDITOR = $previousEditor
}

Invoke-Git push -u wildlabs $integrationBranch

$existingPrOutput = & gh pr list --repo $targetRepo --head $integrationBranch --base main --state open --json url --jq '.[0].url // empty'
$existingPr = ([string]($existingPrOutput -join "")).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "No se pudo consultar si ya existe un pull request."
}

if ($existingPr) {
    Write-Host "Pull request actualizado: $existingPr" -ForegroundColor Green
} else {
    $prUrlOutput = & gh pr create `
        --repo $targetRepo `
        --base main `
        --head $integrationBranch `
        --title "Sincronizar D1ana Wizard Tool" `
        --body "Sincronización manual desde jteplizky1/procesamiento_diana:main."
    $prUrl = ([string]($prUrlOutput -join "")).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "La rama se publicó, pero no se pudo crear el pull request."
    }
    Write-Host "Pull request creado: $prUrl" -ForegroundColor Green
}

if ($originalBranch -and $originalBranch -ne $integrationBranch) {
    Invoke-Git switch $originalBranch
}

