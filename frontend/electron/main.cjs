const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Mitiga pantallas negras en algunos equipos/VMs/drivers
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

let mainWindow;

function resolveProdIndex() {
  const candidates = [
    path.join(__dirname, '../dist/index.html'),
    path.join(__dirname, 'dist/index.html'),
    path.join(process.resourcesPath || '', 'dist/index.html')
  ].filter(Boolean);

  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }

  return candidates[0];
}

async function loadRenderer(win) {
  const isDev = Boolean(process.env.ELECTRON_START_URL);

  console.log('Is Dev:', isDev);
  console.log('__dirname:', __dirname);
  console.log('process.resourcesPath:', process.resourcesPath);

  if (isDev) {
    const startUrl = process.env.ELECTRON_START_URL;
    console.log('Loading DEV URL:', startUrl);
    await win.loadURL(startUrl);
    return;
  }

  const indexPath = resolveProdIndex();
  console.log('Loading PROD FILE:', indexPath);

  if (!fs.existsSync(indexPath)) {
    throw new Error(`No se encontró index.html en: ${indexPath}`);
  }

  await win.loadFile(indexPath);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    show: true,
    backgroundColor: '#ffffff',
    title: 'TrakCare Offline',
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      devTools: false,
      backgroundThrottling: false
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('did-fail-load:', { errorCode, errorDescription, validatedURL });
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <html>
        <body style="font-family: sans-serif; padding: 24px;">
          <h2>Error cargando la aplicación</h2>
          <p><b>Código:</b> ${errorCode}</p>
          <p><b>Descripción:</b> ${errorDescription}</p>
          <p><b>URL:</b> ${validatedURL || ''}</p>
        </body>
      </html>
    `)}`);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('render-process-gone:', details);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer ${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Renderer loaded OK');
  });

  mainWindow.webContents.openDevTools({ mode: 'detach' });

  loadRenderer(mainWindow).catch((err) => {
    console.error('Error loading renderer:', err);
    dialog.showErrorBox('Error iniciando TrakCare Offline', String(err && err.message ? err.message : err));
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
      <html>
        <body style="font-family: sans-serif; padding: 24px;">
          <h2>No fue posible iniciar la aplicación</h2>
          <pre>${String(err && err.stack ? err.stack : err)}</pre>
        </body>
      </html>
    `)}`);
  });

  const menuTemplate = [
    {
      label: 'Archivo',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollador' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
