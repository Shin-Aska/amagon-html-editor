// React 19 removed the global JSX namespace from @types/react.
// Re-declare it here so existing JSX.Element return-type annotations continue to compile.
import type { JSX as ReactJSX } from 'react'
import { type IpcResult } from './renderer/utils/api'
import { type FontAsset } from './renderer/store/types'

export {}

declare global {
  interface Window {
    api: ElectronApi
  }

  interface ElectronApi {
    project: {
      save: (data: { filePath?: string; content: string }) => Promise<IpcResult>
      saveAs: (data: { content: string }) => Promise<IpcResult>
      load: () => Promise<IpcResult>
      loadFile: (filePath: string) => Promise<IpcResult>
      exportHtml: (data: { html: string; defaultPath?: string }) => Promise<IpcResult>
      exportSite: (data: { files: { path: string, content: string | Uint8Array}[], defaultDirName?: string, previewFile?: string }) => Promise<IpcResult>
      openInBrowser: (filePath: string) => Promise<IpcResult>
      getRecent: () => Promise<IpcResult>
      removeRecent: (projectPath: string) => Promise<IpcResult>
      new: (data: { name: string, framework: string, directory?: string }) => Promise<IpcResult>
      getDir: () => Promise<IpcResult>
      onExportProgress: (callback: (data: {
        written: number,
        total: number,
        path?: string
      }) => void) => () => void,
    }
    assets: {
      selectImage: () => Promise<IpcResult>
      selectSingleImage: () => Promise<IpcResult>
      selectVideo: () => Promise<IpcResult>
      list: () => Promise<IpcResult>
      delete: (relativePath: string) => Promise<IpcResult>
      readFileAsBase64: (filePath: string) => Promise<IpcResult>
      readAsset: (assetPath: string) => Promise<IpcResult>
      import: (srcPath: string) => Promise<IpcResult>
    }
    autosave: {
      start: (intervalMs?: number) => Promise<IpcResult>
      stop: () => Promise<IpcResult>
      onTick: (callback: () => void) => () => void
    },
    fonts: {
      listSystem: () => Promise<IpcResult & { fonts: string[] }>
      importFile: () => Promise<IpcResult & { fonts: FontAsset[] }>
      downloadGoogleFont: (args: { family: string; variants: { weight: string; style: string }[] }) => Promise<IpcResult & { fonts: FontAsset[]; errors?: string[] }>
      copySystemFont: (args: { familyName: string; filePaths: string[] }) => Promise<IpcResult & { fonts: FontAsset[] }>
      deleteFont: (args: { relativePath: string }) => Promise<IpcResult>
      listProject: () => Promise<IpcResult & { fonts: FontAsset[] }>
    }
    menu: {
      setProjectLoaded: (isLoaded: boolean) => Promise<any>
      onAction: (callback: (action: string) => void) => () => void
    }
    publish: {
      getProviders: () => Promise<any>
      getCredentials: (providerId: string) => Promise<any>
      saveCredentials: (providerId: string, credentials: Record<string, string>) => Promise<any>
      deleteCredentials: (providerId: string) => Promise<any>
      validate: (providerId: string, files: { path: string, content: string | Uint8Array}[], credentials?: Record<string, string>) => Promise<any>
      publish: (providerId: string, files: { path: string, content: string | Uint8Array}[], credentials?: Record<string, string>) => Promise<any>
      onProgress: (callback: (progress: { phase: 'validating' | 'exporting' | 'uploading' | 'done', percent: number, message: string}) => void) => () => void
      offProgress: (callback: (progress: { phase: 'validating' | 'exporting' | 'uploading' | 'done', percent: number, message: string}) => void) => void
    },
    app: {
      getVersion: () => Promise<{ success: boolean, version: string }>
      isEncryptionSecure: () => Promise<{ secure: boolean }>
      getCredentials: () => Promise<any>
      getCredentialDefinitions: () => Promise<any>
      getCredentialValues: (id: string) => Promise<any>
      saveCredential: (id: string, values: Record<string, string>) => Promise<any>
      deleteCredential: (id: string) => Promise<any>
      getSettings: () => Promise<any>
      saveSettings: (settings: any) => Promise<any>
    },
    ai: {
      chat: (data: { messages: { role: string, content: string}[], blockRegistry?: string, config?: any, themeContext?: any }) => Promise<IpcResult & { content?: string }>
      checkCliAvailability: () => Promise<any>
      getConfig: () => Promise<any>
      setConfig: (config: any) => Promise<any>
      getModels: () => Promise<any>
      fetchModelsForProvider: (data: { provider: string, apiKey: string, ollamaUrl?: string }) => Promise<any>
    },
    mediaSearch: {
      getConfig: () => Promise<any>
      setConfig: (config: any) => Promise<any>
      search: (options: { query: string, perPage?: number, page?: number, type?: 'image' | 'video' }) => Promise<any>
      downloadAndImport: (url: string) => Promise<any>
    }
  }

  namespace JSX {
    type Element = ReactJSX.Element
    type IntrinsicElements = ReactJSX.IntrinsicElements
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty
    type ElementChildrenAttribute = ReactJSX.ElementChildrenAttribute
    type IntrinsicAttributes = ReactJSX.IntrinsicAttributes
  }
}
