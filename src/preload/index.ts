import * as electron from 'electron'

const { contextBridge, ipcRenderer } = electron

// ---------------------------------------------------------------------------
// Expose a typed API to the renderer process via contextBridge.
// The renderer accesses this as `window.api`.
// ---------------------------------------------------------------------------

const api = {
  project: {
    save: (data: { filePath?: string; content: string }) =>
      ipcRenderer.invoke('project:save', data),

    saveAs: (data: { content: string }) =>
      ipcRenderer.invoke('project:saveAs', data),

    load: () => ipcRenderer.invoke('project:load'),

    loadFile: (filePath: string) =>
      ipcRenderer.invoke('project:loadFile', filePath),

    exportHtml: (data: { html: string; defaultPath?: string }) =>
      ipcRenderer.invoke('project:exportHtml', data),

    exportSite: (data: {
      files: { path: string; content: string | Uint8Array }[]
      defaultDirName?: string
      previewFile?: string
    }) => ipcRenderer.invoke('project:exportSite', data),

    openInBrowser: (filePath: string) =>
      ipcRenderer.invoke('project:openInBrowser', filePath),

    onExportProgress: (callback: (data: { written: number; total: number; path?: string }) => void) => {
      const handler = (_event: any, data: { written: number; total: number; path?: string }) => {
        callback(data)
      }
      ipcRenderer.on('project:exportProgress', handler)
      return () => ipcRenderer.removeListener('project:exportProgress', handler)
    },

    getRecent: () => ipcRenderer.invoke('project:getRecent'),

    new: (data: { name: string; framework: string; directory?: string }) =>
      ipcRenderer.invoke('project:new', data),

    getDir: () => ipcRenderer.invoke('project:getDir')
  },

  assets: {
    selectImage: () => ipcRenderer.invoke('assets:selectImage'),

    list: () => ipcRenderer.invoke('assets:list'),

    delete: (relativePath: string) =>
      ipcRenderer.invoke('assets:delete', relativePath),

    readAsset: (assetPath: string) =>
      ipcRenderer.invoke('assets:readAsset', assetPath),

    import: (srcPath: string) =>
      ipcRenderer.invoke('assets:import', srcPath)
  },

  autosave: {
    start: (intervalMs?: number) =>
      ipcRenderer.invoke('autosave:start', intervalMs),

    stop: () => ipcRenderer.invoke('autosave:stop'),

    onTick: (callback: () => void) => {
      ipcRenderer.on('auto-save-tick', callback)
      return () => ipcRenderer.removeListener('auto-save-tick', callback)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

// Export the type so the renderer can reference it
export type ElectronApi = typeof api
