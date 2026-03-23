# TrakCare Offline Backend - Windows Service Installer
# Este script instala el backend como un servicio de Windows usando NSSM

param(
    [string]$InstallPath = "C:\TrakCareOffline\Backend",
    [string]$ServiceName = "TrakCareOfflineBackend",
    [string]$ServiceDisplayName = "TrakCare Offline Backend Service",
    [string]$PythonPath = ""
)

Write-Host "=== TrakCare Offline Backend - Instalador de Servicio Windows ===" -ForegroundColor Cyan
Write-Host ""

# Verificar privilegios de administrador
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Este script requiere privilegios de administrador." -ForegroundColor Red
    Write-Host "Por favor, ejecute PowerShell como Administrador y vuelva a intentarlo." -ForegroundColor Yellow
    exit 1
}

# Detectar Python
if ($PythonPath -eq "") {
    $pythonCandidates = @(
        "python",
        "python3",
        "C:\Python313\python.exe",
        "C:\Python312\python.exe",
        "C:\Python311\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
    )

    foreach ($candidate in $pythonCandidates) {
        try {
            $version = & $candidate --version 2>&1
            if ($LASTEXITCODE -eq 0) {
                $PythonPath = (Get-Command $candidate).Source
                Write-Host "Python encontrado: $PythonPath" -ForegroundColor Green
                Write-Host "Versión: $version" -ForegroundColor Gray
                break
            }
        } catch {}
    }
}

if ($PythonPath -eq "" -or -not (Test-Path $PythonPath)) {
    Write-Host "ERROR: No se pudo encontrar Python. Por favor, instale Python 3.11 o superior." -ForegroundColor Red
    exit 1
}

# Crear directorio de instalación
Write-Host ""
Write-Host "Creando directorio de instalación: $InstallPath" -ForegroundColor Cyan
if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}

# Copiar archivos del backend
Write-Host "Copiando archivos del backend..." -ForegroundColor Cyan
$currentDir = $PSScriptRoot
$filesToCopy = @(
    "app",
    "alembic",
    "alembic.ini",
    "requirements.txt",
    ".env.example"
)

foreach ($item in $filesToCopy) {
    $sourcePath = Join-Path $currentDir $item
    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination $InstallPath -Recurse -Force
        Write-Host "  Copiado: $item" -ForegroundColor Gray
    }
}

# Copiar o crear archivo .env
$envSource = Join-Path $currentDir ".env"
$envDest = Join-Path $InstallPath ".env"
if (Test-Path $envSource) {
    Copy-Item -Path $envSource -Destination $envDest -Force
    Write-Host "  Copiado: .env (configuración existente)" -ForegroundColor Gray
} else {
    Copy-Item -Path (Join-Path $InstallPath ".env.example") -Destination $envDest -Force
    Write-Host "  Creado: .env (desde .env.example)" -ForegroundColor Yellow
    Write-Host "  IMPORTANTE: Edite $envDest con su configuración" -ForegroundColor Yellow
}

# Crear entorno virtual
Write-Host ""
Write-Host "Creando entorno virtual de Python..." -ForegroundColor Cyan
$venvPath = Join-Path $InstallPath "venv"
& $PythonPath -m venv $venvPath
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: No se pudo crear el entorno virtual." -ForegroundColor Red
    exit 1
}

# Instalar dependencias
Write-Host "Instalando dependencias de Python..." -ForegroundColor Cyan
$pipPath = Join-Path $venvPath "Scripts\pip.exe"
& $pipPath install -r (Join-Path $InstallPath "requirements.txt")
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: No se pudieron instalar las dependencias." -ForegroundColor Red
    exit 1
}

# Descargar NSSM si no existe
Write-Host ""
Write-Host "Verificando NSSM (Non-Sucking Service Manager)..." -ForegroundColor Cyan
$nssmPath = Join-Path $InstallPath "nssm.exe"
if (-not (Test-Path $nssmPath)) {
    Write-Host "Descargando NSSM..." -ForegroundColor Cyan
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = Join-Path $env:TEMP "nssm.zip"
    $nssmExtract = Join-Path $env:TEMP "nssm"

    Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip
    Expand-Archive -Path $nssmZip -DestinationPath $nssmExtract -Force

    # Copiar NSSM correcto (64-bit)
    Copy-Item -Path (Join-Path $nssmExtract "nssm-2.24\win64\nssm.exe") -Destination $nssmPath

    # Limpiar
    Remove-Item $nssmZip -Force
    Remove-Item $nssmExtract -Recurse -Force

    Write-Host "NSSM descargado exitosamente" -ForegroundColor Green
}

# Crear script de inicio
Write-Host ""
Write-Host "Creando script de inicio del servicio..." -ForegroundColor Cyan
$startScript = Join-Path $InstallPath "start-service.bat"
$uvicornPath = Join-Path $venvPath "Scripts\uvicorn.exe"
$appPath = Join-Path $InstallPath "app.main:app"

@"
@echo off
cd /d "$InstallPath"
call venv\Scripts\activate.bat
set DATABASE_URL=sqlite:///./local.db
set SECRET_KEY=your-secret-key-change-this
uvicorn app.main:app --host 0.0.0.0 --port 8000
"@ | Out-File -FilePath $startScript -Encoding ASCII

# Detener servicio existente si existe
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "Deteniendo servicio existente..." -ForegroundColor Yellow
    & $nssmPath stop $ServiceName
    Start-Sleep -Seconds 2
    & $nssmPath remove $ServiceName confirm
    Start-Sleep -Seconds 2
}

# Instalar servicio con NSSM
Write-Host "Instalando servicio de Windows..." -ForegroundColor Cyan
& $nssmPath install $ServiceName $startScript

# Configurar servicio
& $nssmPath set $ServiceName DisplayName "$ServiceDisplayName"
& $nssmPath set $ServiceName Description "TrakCare Offline Backend API - FastAPI Service"
& $nssmPath set $ServiceName Start SERVICE_AUTO_START
& $nssmPath set $ServiceName AppDirectory $InstallPath
& $nssmPath set $ServiceName AppStdout (Join-Path $InstallPath "service-output.log")
& $nssmPath set $ServiceName AppStderr (Join-Path $InstallPath "service-error.log")
& $nssmPath set $ServiceName AppRotateFiles 1
& $nssmPath set $ServiceName AppRotateOnline 1
& $nssmPath set $ServiceName AppRotateBytes 1048576

Write-Host ""
Write-Host "Servicio instalado exitosamente!" -ForegroundColor Green
Write-Host ""
Write-Host "=== Información del Servicio ===" -ForegroundColor Cyan
Write-Host "Nombre: $ServiceName" -ForegroundColor White
Write-Host "Ruta de instalación: $InstallPath" -ForegroundColor White
Write-Host "Puerto: 8000" -ForegroundColor White
Write-Host "URL API: http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "=== Comandos útiles ===" -ForegroundColor Cyan
Write-Host "Iniciar servicio:  " -NoNewline; Write-Host "net start $ServiceName" -ForegroundColor Yellow
Write-Host "Detener servicio:  " -NoNewline; Write-Host "net stop $ServiceName" -ForegroundColor Yellow
Write-Host "Estado servicio:   " -NoNewline; Write-Host "sc query $ServiceName" -ForegroundColor Yellow
Write-Host "Ver logs:          " -NoNewline; Write-Host "Get-Content '$InstallPath\service-output.log' -Tail 50" -ForegroundColor Yellow
Write-Host ""

# Preguntar si iniciar el servicio
$startNow = Read-Host "¿Desea iniciar el servicio ahora? (S/N)"
if ($startNow -eq "S" -or $startNow -eq "s") {
    Write-Host ""
    Write-Host "Iniciando servicio..." -ForegroundColor Cyan
    Start-Service -Name $ServiceName
    Start-Sleep -Seconds 3

    $service = Get-Service -Name $ServiceName
    if ($service.Status -eq "Running") {
        Write-Host "Servicio iniciado correctamente!" -ForegroundColor Green
        Write-Host "El backend está disponible en http://localhost:8000" -ForegroundColor Green
    } else {
        Write-Host "ADVERTENCIA: El servicio no se inició correctamente." -ForegroundColor Yellow
        Write-Host "Revise los logs en: $InstallPath\service-error.log" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Instalación completada!" -ForegroundColor Green
Write-Host ""
