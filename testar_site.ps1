$ErrorActionPreference = "Stop"

$Raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Raiz

Write-Host ""
Write-Host "Servidor local do Diário dos Heróis"
Write-Host "Abra http://localhost:8000 no navegador."
Write-Host "Pressione Ctrl+C para encerrar."
Write-Host ""

Start-Process "http://localhost:8000"
python -m http.server 8000
