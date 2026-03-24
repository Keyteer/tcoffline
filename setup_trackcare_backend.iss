#define MyAppName "TrakCare Offline Backend"
#define MyAppVersion "1.9.0"
#define MyAppPublisher "ISC@Cl SE Team"
#define MyAppURL "https://github.com/"
#define MyAppExeName "install-backend-service.bat"

[Setup]
AppId={{8B272B68-8A5D-4B20-8F4B-1AF289D0F8F1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName=C:\TrakCareOffline\BackendPackage
DisableDirPage=no
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
OutputDir=output
OutputBaseFilename=TrakCareOfflineBackendInstaller
SetupIconFile=installer_files\icon.ico
UninstallDisplayIcon={app}\installer_files\icon.ico

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo al desinstalador"; GroupDescription: "Accesos directos:"; Flags: unchecked

[Dirs]
Name: "{app}"

[Files]
; Payload completo del backend. Ejecuta este .iss desde la carpeta raíz del backend.
Source: "app\*"; DestDir: "{app}\app"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "alembic\*"; DestDir: "{app}\alembic"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "alembic.ini"; DestDir: "{app}"; Flags: ignoreversion
Source: "requirements.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: ".env"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: ".env.example"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "install-backend-service.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "uninstall-backend-service.bat"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "installer_files\icon.ico"; DestDir: "{app}\installer_files"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{autodesktop}\Desinstalar TrakCare Offline Backend"; Filename: "{uninstallexe}"; Tasks: desktopicon

[Run]
Filename: "{app}\install-backend-service.bat"; \
  Description: "Instalar servicio backend"; \
  Parameters: ""; \
  Flags: waituntilterminated postinstall shellexec runasoriginaluser skipifsilent

[UninstallRun]
Filename: "{cmd}"; Parameters: "/C if exist ""{app}\uninstall-backend-service.bat"" call ""{app}\uninstall-backend-service.bat"""; Flags: runhidden

[Code]
function InitializeSetup(): Boolean;
begin
  Result := True;
  MsgBox(
    'Este instalador copiará el backend y ejecutará la instalación del servicio de Windows.' + #13#10 +
    'Requisitos:' + #13#10 +
    ' - Ejecutar como administrador' + #13#10 +
    ' - Python 3.11 o superior instalado' + #13#10 +
    ' - Conectividad a Internet para descargar NSSM y dependencias de Python',
    mbInformation, MB_OK);
end;
