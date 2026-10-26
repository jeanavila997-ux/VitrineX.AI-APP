<#
.SYNOPSIS
  Sobe Ollama (se preciso), 9Router e o VitrineX em Electron.
#>
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host '=== VitrineX local-up ===' -ForegroundColor Cyan

# Ollama API
try {
    $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3
    Write-Host '[ok] Ollama API em :11434' -ForegroundColor Green
} catch {
    Write-Host '[..] Tentando iniciar Ollama (app)…' -ForegroundColor Yellow
    $ollamaApp = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama app.exe'
    if (Test-Path $ollamaApp) {
        Start-Process $ollamaApp
    } else {
        Start-Process 'ollama' -ArgumentList 'serve' -WindowStyle Minimized
    }
    Start-Sleep -Seconds 4
}

# 9Router
& (Join-Path $env:USERPROFILE 'scripts\start-9router.ps1')

if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
    Write-Host '[..] npm install…' -ForegroundColor Yellow
    npm install --no-fund --no-audit
}

if (-not (Test-Path (Join-Path $Root '.env'))) {
    Write-Warning '.env ausente — copie de .env.example e preencha VITE_9ROUTER_API_KEY / modelos.'
}

Write-Host '[..] Abrindo Electron + Vite…' -ForegroundColor Cyan
npm run electron:dev
