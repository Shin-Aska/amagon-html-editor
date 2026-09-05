import * as electron from 'electron'
import type { FontAsset } from '../renderer/store/types'
import type {
    ProjectCloseRequest,
    ProjectCloseResult,
    ProjectNewRequest,
    ProjectOpenRecentRequest,
    ProjectProgress,
    ProjectSaveRequest,
    ProjectSessionResult,
    ProjectTransitionRequest,
    RecentProjectsResult,
    RecentProjectId,
    RemoveRecentResult,
    SessionRequest,
    MutationResult,
    AssetInfo,
    MediaDownloadId,
    MediaSearchResult,
} from '../shared/projects/projectIpcContract'
import type {LifecycleRequest, LifecycleResult} from '../main/projects/projectLifecycle'

const {contextBridge, ipcRenderer} = electron;

// ---------------------------------------------------------------------------
// Expose a typed API to the renderer process via contextBridge.
// The renderer accesses this as `window.api`.
// ---------------------------------------------------------------------------

const api = {
    project: {
        save: (data: ProjectSaveRequest): Promise<ProjectSessionResult> =>
            ipcRenderer.invoke('project:save', data),

        saveAs: (data: ProjectSaveRequest): Promise<ProjectSessionResult> =>
            ipcRenderer.invoke('project:saveAs', data),

        load: (data: ProjectTransitionRequest): Promise<ProjectSessionResult> =>
            ipcRenderer.invoke('project:load', data),

        openRecent: (data: ProjectOpenRecentRequest): Promise<ProjectSessionResult> =>
            ipcRenderer.invoke('project:openRecent', data),

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
            };
            ipcRenderer.on('project:exportProgress', handler);
            return () => ipcRenderer.removeListener('project:exportProgress', handler)
        },

        getRecent: (): Promise<RecentProjectsResult> => ipcRenderer.invoke('project:getRecent'),

        removeRecent: (recentId: RecentProjectId): Promise<RemoveRecentResult> =>
            ipcRenderer.invoke('project:removeRecent', recentId),

        new: (data: ProjectNewRequest): Promise<ProjectSessionResult> =>
            ipcRenderer.invoke('project:new', data),

        close: (data: ProjectCloseRequest): Promise<ProjectCloseResult> =>
            ipcRenderer.invoke('project:close', data),

        onProgress: (callback: (progress: ProjectProgress) => void) => {
            const handler = (_event: electron.IpcRendererEvent, progress: ProjectProgress) => callback(progress)
            ipcRenderer.on('project:progress', handler)
            return () => ipcRenderer.removeListener('project:progress', handler)
        },

        onLifecycleCloseRequest: (callback: (request: LifecycleRequest) => void) => {
            const handler = (_event: electron.IpcRendererEvent, request: LifecycleRequest) => callback(request)
            ipcRenderer.on('project:lifecycle-close-request', handler)
            return () => ipcRenderer.removeListener('project:lifecycle-close-request', handler)
        },

        finishLifecycleClose: (result: LifecycleResult): Promise<boolean> =>
            ipcRenderer.invoke('project:finish-lifecycle-close', result),

        getDir: () => ipcRenderer.invoke('project:getDir')
    },

    assets: {
        selectImage: (data: SessionRequest): Promise<MutationResult<readonly AssetInfo[]>> =>
            ipcRenderer.invoke('assets:selectImage', data),

        selectSingleImage: (data: SessionRequest): Promise<MutationResult<AssetInfo>> =>
            ipcRenderer.invoke('assets:selectSingleImage', data),

        selectVideo: (data: SessionRequest): Promise<MutationResult<readonly AssetInfo[]>> =>
            ipcRenderer.invoke('assets:selectVideo', data),

        list: () => ipcRenderer.invoke('assets:list'),

        delete: (data: SessionRequest & { readonly relativePath: string }): Promise<MutationResult<null>> =>
            ipcRenderer.invoke('assets:delete', data),

        readAsset: (reference: string) =>
            ipcRenderer.invoke('assets:readAsset', reference),

        readFileAsBase64: (reference: string) =>
            ipcRenderer.invoke('assets:readFileAsBase64', reference),

    },

    autosave: {
        start: (intervalMs?: number) =>
            ipcRenderer.invoke('autosave:start', intervalMs),

        stop: () => ipcRenderer.invoke('autosave:stop'),

        onTick: (callback: () => void) => {
            ipcRenderer.on('auto-save-tick', callback);
            return () => ipcRenderer.removeListener('auto-save-tick', callback)
        }
    },

    menu: {
        setProjectLoaded: (isLoaded: boolean) =>
            ipcRenderer.invoke('menu:setProjectLoaded', isLoaded),

        onAction: (callback: (action: string) => void) => {
            const handler = (_event: any, action: string) => {
                callback(action)
            };
            ipcRenderer.on('menu:action', handler);
            return () => ipcRenderer.removeListener('menu:action', handler)
        }
    },

    publish: (() => {
        const progressListeners = new WeakMap<Function, (...args: any[]) => void>();

        return {
            getProviders: () => ipcRenderer.invoke('publish:getProviders'),

            getCredentials: (providerId: string) =>
                ipcRenderer.invoke('publish:getCredentials', providerId),

            saveCredentials: (providerId: string, credentials: Record<string, string>) =>
                ipcRenderer.invoke('publish:saveCredentials', {providerId, credentials}),

            deleteCredentials: (providerId: string) =>
                ipcRenderer.invoke('publish:deleteCredentials', providerId),

            validate: (
                providerId: string,
                files: { path: string; content: string | Uint8Array }[],
                credentials?: Record<string, string>
            ) => ipcRenderer.invoke('publish:validate', {providerId, files, credentials}),

            publish: (
                providerId: string,
                files: { path: string; content: string | Uint8Array }[],
                credentials?: Record<string, string>
            ) => ipcRenderer.invoke('publish:publish', {providerId, files, credentials}),

            onProgress: (callback: (progress: { phase: string; percent: number; message: string }) => void) => {
                const handler = (_event: any, progress: { phase: string; percent: number; message: string }) => {
                    callback(progress)
                };
                progressListeners.set(callback, handler);
                ipcRenderer.on('publish:progress', handler);
                return () => {
                    ipcRenderer.removeListener('publish:progress', handler);
                    progressListeners.delete(callback)
                }
            },

            offProgress: (callback: (progress: { phase: string; percent: number; message: string }) => void) => {
                const handler = progressListeners.get(callback);
                if (handler) {
                    ipcRenderer.removeListener('publish:progress', handler);
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
        saveCredential: (id: string, values: Record<string, string>) => ipcRenderer.invoke('app:saveCredential', {
            id,
            values
        }),
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

    fonts: {
        listSystem: () => ipcRenderer.invoke('fonts:listSystem'),

        importFile: (data: SessionRequest): Promise<MutationResult<readonly FontAsset[]>> =>
            ipcRenderer.invoke('fonts:importFile', data),

        downloadGoogleFont: (args: SessionRequest & {
            readonly family: string
            readonly variants: readonly { readonly weight: string; readonly style: string }[]
        }): Promise<MutationResult<readonly FontAsset[]>> =>
            ipcRenderer.invoke('fonts:downloadGoogleFont', args),

        copySystemFont: (args: SessionRequest & {
            readonly familyName: string
        }): Promise<MutationResult<readonly FontAsset[]>> =>
            ipcRenderer.invoke('fonts:copySystemFont', args),

        fetchGoogleFontCss: (args: { family: string; weight: string; style: string }) =>
            ipcRenderer.invoke('fonts:fetchGoogleFontCss', args),

        fetchGoogleFontFile: (args: { url: string }) =>
            ipcRenderer.invoke('fonts:fetchGoogleFontFile', args),

        deleteFont: (args: SessionRequest & { readonly relativePath: string }): Promise<MutationResult<null>> =>
            ipcRenderer.invoke('fonts:deleteFont', args),

        checkFileExists: (args: { relativePath: string }) =>
            ipcRenderer.invoke('fonts:checkFileExists', args),

        listProject: () => ipcRenderer.invoke('fonts:listProject')
    },

    mediaSearch: {
        getConfig: () => ipcRenderer.invoke('mediaSearch:getConfig'),

        setConfig: (config: any) => ipcRenderer.invoke('mediaSearch:setConfig', config),

        search: (options: { query: string; perPage?: number; page?: number; type?: 'image' | 'video' }): Promise<{
            readonly results: readonly MediaSearchResult[]
            readonly error?: string
        }> =>
            ipcRenderer.invoke('mediaSearch:search', options),

        downloadAndImport: (data: SessionRequest & { readonly downloadId: MediaDownloadId }): Promise<MutationResult<AssetInfo>> =>
            ipcRenderer.invoke('mediaSearch:downloadAndImport', data)
    }
};

contextBridge.exposeInMainWorld('api', api);

// Export the type so the renderer can reference it
export type ElectronApi = typeof api
