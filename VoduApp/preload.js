const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('alluffyAPI', {
  getHomepage: () => ipcRenderer.invoke('get-homepage'),
  search: (query) => ipcRenderer.invoke('search', query),
  getContent: (id) => ipcRenderer.invoke('get-content', id),
});
