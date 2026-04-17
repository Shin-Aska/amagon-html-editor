/// <reference types="vite/client" />

import type {
  CredentialField,
  ExportedFile,
  PublishCredentials,
  PublishProgress,
  PublishResult,
  ProviderMeta,
  ValidationResult
} from '../publish'

declare global {
  type CredentialCategory = 'ai' | 'multimedia' | 'publisher'

  interface CredentialDefinitionInfo {
    id: string
    category: CredentialCategory
    categoryLabel: string
    providerId: string
    label: string
    description: string
    fields: CredentialField[]
  }

  interface CredentialRecordInfo extends CredentialDefinitionInfo {
    source: CredentialCategory
    provider: string
    values: PublishCredentials
    maskedKey: string
    hasKey: boolean
  }

  interface PublishProviderInfo extends Pick<ProviderMeta, 'id' | 'displayName' | 'description'> {
    credentialFields: CredentialField[]
  }

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
    publish: {
      getProviders: () => Promise<PublishProviderInfo[]>
      getCredentials: (providerId: string) => Promise<PublishCredentials>
      saveCredentials: (providerId: string, credentials: PublishCredentials) => Promise<{ success: boolean; error?: string }>
      deleteCredentials: (providerId: string) => Promise<{ success: boolean; error?: string }>
      validate: (providerId: string, files: ExportedFile[], credentials?: PublishCredentials) => Promise<ValidationResult>
      publish: (providerId: string, files: ExportedFile[], credentials?: PublishCredentials) => Promise<PublishResult>
      onProgress: (callback: (progress: PublishProgress) => void) => () => void
      offProgress: (callback: (progress: PublishProgress) => void) => void
    }
    app: {
      getVersion: () => Promise<any>
      isEncryptionSecure: () => Promise<any>
      getCredentials: () => Promise<any>
      getCredentialDefinitions: () => Promise<any>
      getCredentialValues: (id: string) => Promise<any>
      saveCredential: (id: string, values: PublishCredentials) => Promise<any>
      deleteCredential: (id: string) => Promise<any>
      getSettings: () => Promise<any>
      saveSettings: (settings: any) => Promise<any>
    }
    ai: {
      chat: (data: {
        messages: { role: string; content: string }[]
        blockRegistry?: string
        config?: any
        themeContext?: { projectTheme?: unknown; uiTheme?: 'light' | 'dark' }
      }) => Promise<any>
      checkCliAvailability: () => Promise<{
        success: boolean
        availability?: Record<
          'claude-cli' | 'codex-cli' | 'gemini-cli' | 'github-cli' | 'junie-cli',
          { available: boolean; path?: string; version?: string }
        >
        error?: string
      }>
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
}

declare module 'prettier/standalone' {
  export function format(input: string, options: Record<string, unknown>): Promise<string> | string
}

declare module 'prettier/plugins/html' {
  const plugin: unknown
  export default plugin
}

export {}
