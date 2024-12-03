const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectFile: () => ipcRenderer.invoke('select-file'),
    uploadFile: (filePath) => ipcRenderer.invoke('upload-file-to-docker', { filePath }),
    getContainerDiskUsage: () => ipcRenderer.invoke('get-container-disk-usage') 
});
