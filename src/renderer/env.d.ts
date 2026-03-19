/// <reference types="vite/client" />

interface ElectronApi {
  project: {
    save: (data: { filePath?: string; content: string }) => Promise<any>
    saveAs: (data: { content: string }) => Promise<any>
    load: () => Promise<any>
    loadFile: (filePath: string) => Promise<any>
    exportHtml: (data: { html: string; defaultPath?: string }) => Promise<any>
    exportSite: (data: { files: { path: string; content: string | Uint8Array }[]; defaultDirName?: string; previewFile?: string }) => Promise<any>
    openInBrowser: (filePath: string) => Promise<any>
    onExportProgress: (callback: (data: { written: number; total: number; path?: string }) => void) => () => void
    getRecent: () => Promise<any>
    removeRecent: (path: string) => Promise<any>
    new: (data: { name: string; framework: string; directory?: string }) => Promise<any>
    getDir: () => Promise<any>
  }
  assets: {
    selectImage: () => Promise<any>
    selectSingleImage: () => Promise<any>
    selectVideo: () => Promise<any>
    list: () => Promise<any>
    delete: (relativePath: string) => Promise<any>
    readAsset: (assetPath: string) => Promise<any>
    readFileAsBase64: (filePath: string) => Promise<any>
    import: (srcPath: string) => Promise<any>
  }
  autosave: {
    start: (intervalMs?: number) => Promise<any>
    stop: () => Promise<any>
    onTick: (callback: () => void) => () => void
  }
  menu: {
    setProjectLoaded: (isLoaded: boolean) => Promise<any>
    onAction: (callback: (action: string) => void) => () => void
  }
  app: {
    isEncryptionSecure: () => Promise<any>
    getCredentials: () => Promise<any>
    deleteCredential: (id: string) => Promise<any>
  }
  ai: {
    chat: (data: {
      messages: { role: string; content: string }[]
      blockRegistry?: string
      config?: any
      themeContext?: { projectTheme?: unknown; uiTheme?: 'light' | 'dark' }
    }) => Promise<any>
    getConfig: () => Promise<any>
    setConfig: (config: any) => Promise<any>
    getModels: () => Promise<any>
    fetchModelsForProvider: (data: { provider: string; apiKey: string; ollamaUrl?: string }) => Promise<any>
  }
  mediaSearch: {
    getConfig: () => Promise<any>
    setConfig: (config: any) => Promise<any>
    search: (options: { query: string; perPage?: number; page?: number; type?: 'image' | 'video' }) => Promise<any>
    downloadAndImport: (url: string) => Promise<any>
  }
}

interface Window {
  // Electron preload script will set this; in browser mode we use the mock API.
  api?: ElectronApi
}

declare module 'prettier/standalone' {
  export function format(input: string, options: Record<string, unknown>): Promise<string> | string
}

declare module 'prettier/plugins/html' {
  const plugin: unknown
  export default plugin
}
