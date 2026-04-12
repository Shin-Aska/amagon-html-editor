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

    removeRecent: (projectPath: string) =>
      ipcRenderer.invoke('project:removeRecent', projectPath),

    new: (data: { name: string; framework: string; directory?: string }) =>
      ipcRenderer.invoke('project:new', data),

    getDir: () => ipcRenderer.invoke('project:getDir')
  },

  assets: {
    selectImage: () => ipcRenderer.invoke('assets:selectImage'),

    selectSingleImage: () => ipcRenderer.invoke('assets:selectSingleImage'),

    selectVideo: () => ipcRenderer.invoke('assets:selectVideo'),

    list: () => ipcRenderer.invoke('assets:list'),

    delete: (relativePath: string) =>
      ipcRenderer.invoke('assets:delete', relativePath),

    readAsset: (assetPath: string) =>
      ipcRenderer.invoke('assets:readAsset', assetPath),

    readFileAsBase64: (filePath: string) =>
      ipcRenderer.invoke('assets:readFileAsBase64', filePath),

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
  },

  menu: {
    setProjectLoaded: (isLoaded: boolean) =>
      ipcRenderer.invoke('menu:setProjectLoaded', isLoaded),

    onAction: (callback: (action: string) => void) => {
      const handler = (_event: any, action: string) => {
        callback(action)
      }
      ipcRenderer.on('menu:action', handler)
      return () => ipcRenderer.removeListener('menu:action', handler)
    }
  },

  publish: (() => {
    const progressListeners = new WeakMap<Function, (...args: any[]) => void>()

    return {
      getProviders: () => ipcRenderer.invoke('publish:getProviders'),

      getCredentials: (providerId: string) =>
        ipcRenderer.invoke('publish:getCredentials', providerId),

      saveCredentials: (providerId: string, credentials: Record<string, string>) =>
        ipcRenderer.invoke('publish:saveCredentials', { providerId, credentials }),

      deleteCredentials: (providerId: string) =>
        ipcRenderer.invoke('publish:deleteCredentials', providerId),

      validate: (
        providerId: string,
        files: { path: string; content: string | Uint8Array }[],
        credentials?: Record<string, string>
      ) => ipcRenderer.invoke('publish:validate', { providerId, files, credentials }),

      publish: (
        providerId: string,
        files: { path: string; content: string | Uint8Array }[],
        credentials?: Record<string, string>
      ) => ipcRenderer.invoke('publish:publish', { providerId, files, credentials }),

      onProgress: (callback: (progress: { phase: string; percent: number; message: string }) => void) => {
        const handler = (_event: any, progress: { phase: string; percent: number; message: string }) => {
          callback(progress)
        }
        progressListeners.set(callback, handler)
        ipcRenderer.on('publish:progress', handler)
        return () => {
          ipcRenderer.removeListener('publish:progress', handler)
          progressListeners.delete(callback)
        }
      },

      offProgress: (callback: (progress: { phase: string; percent: number; message: string }) => void) => {
        const handler = progressListeners.get(callback)
        if (handler) {
          ipcRenderer.removeListener('publish:progress', handler)
          progressListeners.delete(callback)
        }
      }
    }
  })(),

  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    isEncryptionSecure: () => ipcRenderer.invoke('app:isEncryptionSecure'),
    getCredentials: () => ipcRenderer.invoke('app:getCredentials'),
    getCredentialDefinitions: () => ipcRenderer.invoke('app:getCredentialDefinitions'),
    getCredentialValues: (id: string) => ipcRenderer.invoke('app:getCredentialValues', id),
    saveCredential: (id: string, values: Record<string, string>) => ipcRenderer.invoke('app:saveCredential', { id, values }),
    deleteCredential: (id: string) => ipcRenderer.invoke('app:deleteCredential', id),
    getSettings: () => ipcRenderer.invoke('app:getSettings'),
    saveSettings: (settings: any) => ipcRenderer.invoke('app:saveSettings', settings)
  },

  ai: {
    chat: (data: {
      messages: { role: string; content: string }[]
      blockRegistry?: string
      config?: any
      themeContext?: { projectTheme?: unknown; uiTheme?: 'light' | 'dark' }
    }) => ipcRenderer.invoke('ai:chat', data),

    checkCliAvailability: () => ipcRenderer.invoke('ai:checkCliAvailability'),

    getConfig: () => ipcRenderer.invoke('ai:getConfig'),

    setConfig: (config: any) => ipcRenderer.invoke('ai:setConfig', config),

    getModels: () => ipcRenderer.invoke('ai:getModels'),

    fetchModelsForProvider: (data: { provider: string; apiKey: string; ollamaUrl?: string }) =>
      ipcRenderer.invoke('ai:fetchModelsForProvider', data)
  },

  mediaSearch: {
    getConfig: () => ipcRenderer.invoke('mediaSearch:getConfig'),

    setConfig: (config: any) => ipcRenderer.invoke('mediaSearch:setConfig', config),

    search: (options: { query: string; perPage?: number; page?: number; type?: 'image' | 'video' }) =>
      ipcRenderer.invoke('mediaSearch:search', options),

    downloadAndImport: (url: string) => ipcRenderer.invoke('mediaSearch:downloadAndImport', url)
  }
}

contextBridge.exposeInMainWorld('api', api)

// Export the type so the renderer can reference it
export type ElectronApi = typeof api
