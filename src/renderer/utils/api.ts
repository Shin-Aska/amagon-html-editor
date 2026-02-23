// Mock API layer for browser-based development.
// In production (Electron), this will be replaced by the real IPC bridge.
// For now, uses browser APIs (localStorage, File API, download links).

import { createDefaultTheme } from '../store/types'

export interface IpcResult {
  success: boolean
  canceled?: boolean
  error?: string
  filePath?: string
  filePaths?: string[]
  content?: unknown
  data?: string
  mimeType?: string
  projects?: string[]
  assets?: { name: string; path: string; relativePath: string }[]
  directory?: string | null
  previewPath?: string
  path?: string
  relativePath?: string
}

const mockApi: ElectronApi = {
  project: {
    save: async (data: { filePath?: string; content: string }): Promise<IpcResult> => {
      try {
        const key = data.filePath || 'untitled-project.json'
        localStorage.setItem(`project:${key}`, data.content)
        console.log('[Mock API] Project saved to localStorage:', key)
        return { success: true, filePath: key }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },

    saveAs: async (data: { content: string }): Promise<IpcResult> => {
      try {
        const blob = new Blob([data.content], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'project.json'
        a.click()
        URL.revokeObjectURL(url)
        return { success: true, filePath: 'project.json' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },

    load: async (): Promise<IpcResult> => {
      try {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.json'

        return new Promise((resolve) => {
          input.onchange = async () => {
            const file = input.files?.[0]
            if (!file) {
              resolve({ success: false, canceled: true })
              return
            }
            const text = await file.text()
            resolve({
              success: true,
              filePath: file.name,
              content: JSON.parse(text)
            })
          }
          input.oncancel = () => resolve({ success: false, canceled: true })
          input.click()
        })
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },

    loadFile: async (_filePath: string): Promise<IpcResult> => {
      // In browser mode, we can't load arbitrary files by path
      return { success: false, error: 'Not supported in browser mode' }
    },

    exportHtml: async (data: { html: string; defaultPath?: string }): Promise<IpcResult> => {
      try {
        const blob = new Blob([data.html], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = data.defaultPath || 'index.html'
        a.click()
        URL.revokeObjectURL(url)
        return { success: true, filePath: data.defaultPath || 'index.html' }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },

    exportSite: async (data: {
      files: { path: string; content: string | Uint8Array }[]
      defaultDirName?: string
      previewFile?: string
    }): Promise<IpcResult> => {
      try {
        for (const file of data.files || []) {
          const relPath = String(file.path || '').replace(/^[/\\]+/, '')
          if (!relPath) continue

          const content: any = (file as any).content
          let blob: Blob

          if (typeof content === 'string') {
            const ext = relPath.toLowerCase().endsWith('.css')
              ? 'text/css'
              : relPath.toLowerCase().endsWith('.html')
                ? 'text/html'
                : 'text/plain'
            blob = new Blob([content], { type: ext })
          } else {
            const bytes: Uint8Array = content instanceof Uint8Array ? content : new Uint8Array(content)
            const ab = new ArrayBuffer(bytes.byteLength)
            new Uint8Array(ab).set(bytes)
            blob = new Blob([ab], { type: 'application/octet-stream' })
          }

          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = relPath.split('/').pop() || 'file'
          a.click()
          URL.revokeObjectURL(url)
        }

        return { success: true, directory: null }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },

    openInBrowser: async (_filePath: string): Promise<IpcResult> => {
      // Not supported in browser mode
      return { success: false, error: 'Not supported in browser mode' }
    },

    onExportProgress: (_callback: (data: { written: number; total: number; path?: string }) => void) => {
      // No-op in browser mode
      return () => { }
    },

    getRecent: async (): Promise<IpcResult> => {
      try {
        const raw = localStorage.getItem('recent-projects')
        const projects = raw ? JSON.parse(raw) : []
        return { success: true, projects }
      } catch {
        return { success: true, projects: [] }
      }
    },

    new: async (data: { name: string; framework: string; directory?: string }): Promise<IpcResult> => {
      // In browser mode, just return a fresh project object
      const projectData = {
        projectSettings: {
          name: data.name,
          framework: data.framework,
          theme: createDefaultTheme(),
          globalStyles: {}
        },
        pages: [
          {
            id: `page_${Date.now().toString(36)}`,
            title: 'Home',
            slug: 'index',
            blocks: [],
            meta: {
              charset: 'UTF-8',
              viewport: 'width=device-width, initial-scale=1.0',
              description: ''
            }
          }
        ],
        userBlocks: []
      }
      return { success: true, filePath: 'project.json', content: projectData }
    },

    getDir: async (): Promise<IpcResult> => {
      return { success: true, directory: null }
    }
  },

  assets: {
    selectImage: async (): Promise<IpcResult> => {
      try {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.multiple = true

        return new Promise((resolve) => {
          input.onchange = () => {
            const files = input.files
            if (!files || files.length === 0) {
              resolve({ success: false, canceled: true })
              return
            }
            const filePaths = Array.from(files).map((f) => URL.createObjectURL(f))
            resolve({ success: true, filePaths })
          }
          input.oncancel = () => resolve({ success: false, canceled: true })
          input.click()
        })
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },

    selectSingleImage: async (): Promise<IpcResult> => {
      try {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/svg+xml,image/webp'

        return new Promise((resolve) => {
          input.onchange = () => {
            const file = input.files?.[0]
            if (!file) {
              resolve({ success: false, canceled: true })
              return
            }
            const blobUrl = URL.createObjectURL(file)
            resolve({
              success: true,
              filePath: blobUrl,
              data: file.name,
              mimeType: file.type
            })
          }
          input.oncancel = () => resolve({ success: false, canceled: true })
          input.click()
        })
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },

    readFileAsBase64: async (filePath: string): Promise<IpcResult> => {
      try {
        const response = await fetch(filePath)
        const blob = await response.blob()
        const sizeMB = blob.size / (1024 * 1024)
        if (sizeMB > 5) {
          return { success: false, error: `File is too large (${sizeMB.toFixed(1)}MB). Max 5MB for base64 embedding.` }
        }
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => {
            resolve({
              success: true,
              data: reader.result as string,
              mimeType: blob.type
            })
          }
          reader.onerror = () => {
            resolve({ success: false, error: 'Failed to read file' })
          }
          reader.readAsDataURL(blob)
        })
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },

    list: async (): Promise<IpcResult> => {
      // In browser mode, we can't list files on disk
      return { success: true, assets: [] }
    },

    delete: async (_relativePath: string): Promise<IpcResult> => {
      return { success: false, error: 'Not supported in browser mode' }
    },

    readAsset: async (assetPath: string): Promise<IpcResult> => {
      try {
        const response = await fetch(assetPath)
        const blob = await response.blob()
        const reader = new FileReader()

        return new Promise((resolve) => {
          reader.onload = () => {
            resolve({
              success: true,
              data: reader.result as string,
              mimeType: blob.type
            })
          }
          reader.readAsDataURL(blob)
        })
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },

    import: async (_srcPath: string): Promise<IpcResult> => {
      return { success: false, error: 'Not supported in browser mode' }
    }
  },

  autosave: {
    start: async (_intervalMs?: number): Promise<IpcResult> => {
      return { success: true }
    },

    stop: async (): Promise<IpcResult> => {
      return { success: true }
    },

    onTick: (_callback: () => void) => {
      // No-op in browser mode
      return () => { }
    }
  },

  ai: {
    chat: async (_data: any): Promise<IpcResult> => {
      // Simulated AI response in browser mode
      return {
        success: true,
        content: 'This is a simulated AI response. To use real AI, run the app in Electron mode and configure your API key in the AI settings.'
      } as any
    },

    getConfig: async (): Promise<any> => {
      return {
        success: true,
        config: {
          provider: 'openai',
          model: 'gpt-4o',
          apiKey: '',
          ollamaUrl: 'http://localhost:11434'
        }
      }
    },

    setConfig: async (_config: any): Promise<any> => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { apiKey: _, ...rest } = _config
      return { success: true, config: { ...rest, apiKey: '' } }
    },

    getModels: async (): Promise<any> => {
      return {
        success: true,
        models: {
          openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o1', 'o1-mini'],
          anthropic: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
          google: ['gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
          ollama: ['llama3.3', 'deepseek-r1', 'qwen3', 'mistral', 'phi4', 'gemma3']
        }
      }
    }
  }
}

// Export the API — in Electron mode, window.api will be set by the preload script.
// In browser mode, we use this mock.
let didWarnMissingElectronApi = false
export function getApi(): ElectronApi {
  if (window.api) {
    return window.api
  }

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
  const isElectron = /electron/i.test(ua)
  if (isElectron && !didWarnMissingElectronApi) {
    didWarnMissingElectronApi = true
    console.warn('[Amagon] window.api is missing in Electron. Falling back to mock API; save/load will not persist to disk.')
  }
  return mockApi
}

export default mockApi
