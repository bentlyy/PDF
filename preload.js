const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFile: () => ipcRenderer.invoke('open-file'),
  openMultipleFiles: () => ipcRenderer.invoke('open-multiple-files'),
  saveFile: (opts) => ipcRenderer.invoke('save-file', opts),
  saveFileDirect: (opts) => ipcRenderer.invoke('save-file-direct', opts),
  saveImage: (opts) => ipcRenderer.invoke('save-image', opts),
  saveImagesBatch: (opts) => ipcRenderer.invoke('save-images-batch', opts),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openImageFile: () => ipcRenderer.invoke('open-image-file'),
  openCertificate: () => ipcRenderer.invoke('open-certificate'),

  // Menu events
  on: (channel, callback) => {
    const validChannels = [
      'menu-open', 'menu-save', 'menu-save-as', 'menu-export-image',
      'menu-merge', 'menu-undo', 'menu-redo', 'menu-delete', 'menu-select-all',
      'menu-zoom-in', 'menu-zoom-out', 'menu-zoom-reset',
      'menu-fit-width', 'menu-fit-page', 'menu-toggle-sidebar',
      'menu-shortcuts',
      'tool-select', 'tool-text', 'tool-draw', 'tool-shapes',
      'tool-image', 'tool-signature'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  removeListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
