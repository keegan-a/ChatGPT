const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onNetworkStatus: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const channel = 'app:network-status';
    const listener = (_event, status) => {
      try {
        callback(status);
      } catch (error) {
        console.error('network status callback failed', error);
      }
    };

    ipcRenderer.on(channel, listener);

    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
});
