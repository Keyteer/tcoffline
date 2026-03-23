# TrakCare Offline Backend - Windows Service Uninstaller

param(
    [string]$InstallPath = "C:\TrakCareOffline\Backend",
    [string]$ServiceName = "TrakCareOfflineBackend"
)

Write-Host "=== TrakCare Offline Backend - Desinstalador de Servicio ===" -ForegroundColor Cyan
Write-Host ""

# Verificar privilegios de administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Este script requiere privilegios de administrador." -ForegroundColor Red
    exit 1
}

$nssmPath = Join-Path $InstallPath "nssm.exe"

# Verificar si el servicio existe
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
    Write-Host "El servicio '$ServiceName' no está instalado." -ForegroundColor Yellow
} else {
    Write-Host "Deteniendo servicio..." -ForegroundColor Cyan
    if (Test-Path $nssmPath) {
        & $nssmPath stop $ServiceName
    } else {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2

    Write-Host "Eliminando servicio..." -ForegroundColor Cyan
    if (Test-Path $nssmPath) {
        & $nssmPath remove $ServiceName confirm
    } else {
        sc.exe delete $ServiceName
    }

    Write-Host "Servicio desinstalado correctamente." -ForegroundColor Green
}

# Preguntar si eliminar archivos
Write-Host ""
$removeFiles = Read-Host "¿Desea eliminar los archivos de instalación en $InstallPath? (S/N)"
if ($removeFiles -eq "S" -or $removeFiles -eq "s") {
    if (Test-Path $InstallPath) {
        Write-Host "Eliminando archivos..." -ForegroundColor Cyan
        Remove-Item -Path $InstallPath -Recurse -Force
        Write-Host "Archivos eliminados." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Desinstalación completada!" -ForegroundColor Green
