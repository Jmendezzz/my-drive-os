const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { uploadFileWithCheck, getContainerDiskUsage} = require('./docker'); 

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true, 
      preload: path.join(__dirname, 'preload.js') 
    },
  });

  win.loadFile('src/index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) {
      return null;
  }
  return filePaths[0]; 
});

ipcMain.handle('upload-file-to-docker', async (event, { filePath }) => {
    await uploadFileWithCheck(filePath);
});

ipcMain.handle('get-container-disk-usage', async () => {
  try {
      return await getContainerDiskUsage();
  } catch (error) {
      console.error('Error al obtener información de los contenedores:', error);
      return [];
  }
});
