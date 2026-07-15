const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Editor PDF',
    icon: path.join(__dirname, 'icons', 'app.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    backgroundColor: '#1a1a2e',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Abrir PDF',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow.webContents.send('menu-open')
        },
        {
          label: 'Guardar',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-save')
        },
        {
          label: 'Guardar como...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu-save-as')
        },
        { type: 'separator' },
        {
          label: 'Exportar como imagen',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow.webContents.send('menu-export-image')
        },
        { type: 'separator' },
        {
          label: 'Combinar PDFs',
          click: () => mainWindow.webContents.send('menu-merge')
        },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Edición',
      submenu: [
        {
          label: 'Deshacer',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow.webContents.send('menu-undo')
        },
        {
          label: 'Rehacer',
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow.webContents.send('menu-redo')
        },
        { type: 'separator' },
        {
          label: 'Eliminar selección',
          accelerator: 'Delete',
          click: () => mainWindow.webContents.send('menu-delete')
        },
        {
          label: 'Seleccionar todo',
          accelerator: 'CmdOrCtrl+A',
          click: () => mainWindow.webContents.send('menu-select-all')
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        {
          label: 'Zoom +',
          accelerator: 'CmdOrCtrl+=',
          click: () => mainWindow.webContents.send('menu-zoom-in')
        },
        {
          label: 'Zoom -',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow.webContents.send('menu-zoom-out')
        },
        {
          label: 'Zoom 100%',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow.webContents.send('menu-zoom-reset')
        },
        {
          label: 'Ajustar ancho',
          accelerator: 'CmdOrCtrl+1',
          click: () => mainWindow.webContents.send('menu-fit-width')
        },
        {
          label: 'Ajustar página',
          accelerator: 'CmdOrCtrl+2',
          click: () => mainWindow.webContents.send('menu-fit-page')
        },
        { type: 'separator' },
        {
          label: 'Panel de miniaturas',
          accelerator: 'CmdOrCtrl+T',
          click: () => mainWindow.webContents.send('menu-toggle-sidebar')
        },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollador' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    },
    {
      label: 'Herramientas',
      submenu: [
        {
          label: 'Seleccionar',
          accelerator: 'V',
          click: () => mainWindow.webContents.send('tool-select')
        },
        {
          label: 'Texto',
          accelerator: 'T',
          click: () => mainWindow.webContents.send('tool-text')
        },
        {
          label: 'Dibujar',
          accelerator: 'D',
          click: () => mainWindow.webContents.send('tool-draw')
        },
        {
          label: 'Formas',
          accelerator: 'S',
          click: () => mainWindow.webContents.send('tool-shapes')
        },
        {
          label: 'Imagen',
          accelerator: 'I',
          click: () => mainWindow.webContents.send('tool-image')
        },
        {
          label: 'Firma',
          click: () => mainWindow.webContents.send('tool-signature')
        }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Atajos de teclado',
          click: () => mainWindow.webContents.send('menu-shortcuts')
        },
        {
          label: 'Acerca de',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Acerca de Editor PDF',
              message: 'Editor PDF v1.0.0',
              detail: 'Editor de PDF completo con visualizador, anotaciones, firmas, combinar/separar páginas y exportar como imagen.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Abrir PDF',
    filters: [{ name: 'Archivos PDF', extensions: ['pdf'] }],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const data = fs.readFileSync(filePath);
    return { filePath, data: Array.from(data), name: path.basename(filePath) };
  }
  return null;
});

ipcMain.handle('open-multiple-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar PDFs para combinar',
    filters: [{ name: 'Archivos PDF', extensions: ['pdf'] }],
    properties: ['openFile', 'multiSelections']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths.map(fp => {
      const data = fs.readFileSync(fp);
      return { filePath: fp, data: Array.from(data), name: path.basename(fp) };
    });
  }
  return null;
});

ipcMain.handle('save-file', async (event, { data, defaultPath }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar PDF',
    defaultPath: defaultPath || 'documento.pdf',
    filters: [{ name: 'Archivos PDF', extensions: ['pdf'] }]
  });

  if (!result.canceled && result.filePath) {
    const buffer = Buffer.from(data);
    fs.writeFileSync(result.filePath, buffer);
    return result.filePath;
  }
  return null;
});

ipcMain.handle('save-file-direct', async (event, { filePath, data }) => {
  try {
    const buffer = Buffer.from(data);
    fs.writeFileSync(filePath, buffer);
    return true;
  } catch (err) {
    return false;
  }
});

ipcMain.handle('save-image', async (event, { data, defaultPath, format }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar como imagen',
    defaultPath: defaultPath || `pagina.${format}`,
    filters: [{ name: format === 'png' ? 'PNG' : 'JPEG', extensions: [format] }]
  });

  if (!result.canceled && result.filePath) {
    const base64 = data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(result.filePath, buffer);
    return result.filePath;
  }
  return null;
});

ipcMain.handle('save-images-batch', async (event, { folder, images, format }) => {
  try {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    for (const img of images) {
      const base64 = img.data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(path.join(folder, `pagina_${img.page}.${format}`), buffer);
    }
    return true;
  } catch (err) {
    return false;
  }
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar carpeta de destino',
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('open-image-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar imagen',
    filters: [
      { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    return {
      data: `data:${mimeType};base64,${data.toString('base64')}`,
      name: path.basename(filePath)
    };
  }
  return null;
});

ipcMain.handle('open-certificate', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar certificado digital',
    filters: [
      { name: 'Certificados', extensions: ['p12', 'pfx'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const data = fs.readFileSync(filePath);
    return { filePath, data: Array.from(data), name: path.basename(filePath) };
  }
  return null;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
