// Mock API layer for browser-based development.
// In production (Electron), this will be replaced by the real IPC bridge.
// For now, uses browser APIs (localStorage, File API, download links).

import packageJson from '../../../package.json'
import {createDefaultTheme, type FontAsset} from '../store/types'
import {createWelcomeBlocks} from '../../shared/welcomeBlocks'

export interface IpcResult {
    success: boolean
    canceled?: boolean
    error?: string
    filePath?: string
    filePaths?: string[]
    content?: unknown
    data?: string
    mimeType?: string
    projects?: Array<{ path: string; name: string }>
    assets?: { name: string; path: string; relativePath: string; type?: 'image' | 'video' }[]
    directory?: string | null
    previewPath?: string
    path?: string
    relativePath?: string,
    fonts?: any[]
}

type MockAsset = { name: string; path: string; relativePath: string; type: 'image' | 'video' }

const MOCK_ASSETS_KEY = 'mock-assets';

function loadMockAssets(): MockAsset[] {
    try {
        const raw = localStorage.getItem(MOCK_ASSETS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

function saveMockAssets(assets: MockAsset[]): void {
    try {
        localStorage.setItem(MOCK_ASSETS_KEY, JSON.stringify(assets))
    } catch {
        // ignore
    }
}

function upsertMockAssets(newAssets: MockAsset[]): void {
    const existing = loadMockAssets();
    const byPath = new Map<string, MockAsset>();
    existing.forEach((a) => byPath.set(a.path, a));
    newAssets.forEach((a) => byPath.set(a.path, a));
    saveMockAssets(Array.from(byPath.values()))
}

const mockApi: ElectronApi = {
    project: {
        save: async (data: { filePath?: string; content: string }): Promise<IpcResult> => {
            try {
                const key = data.filePath || 'untitled-project.json';
                localStorage.setItem(`project:${key}`, data.content);
                console.log('[Mock API] Project saved to localStorage:', key);
                return {success: true, filePath: key}
            } catch (error) {
                return {success: false, error: String(error)}
            }
        },

        saveAs: async (data: { content: string }): Promise<IpcResult> => {
            try {
                const blob = new Blob([data.content], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'project.json';
                a.click();
                URL.revokeObjectURL(url);
                return {success: true, filePath: 'project.json'}
            } catch (error) {
                return {success: false, error: String(error)}
            }
        },

        load: async (): Promise<IpcResult> => {
            try {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';

                return new Promise((resolve) => {
                    input.onchange = async () => {
                        const file = input.files?.[0];
                        if (!file) {
                            resolve({success: false, canceled: true});
                            return
                        }
                        const text = await file.text();
                        resolve({
                            success: true,
                            filePath: file.name,
                            content: JSON.parse(text)
                        })
                    };
                    input.oncancel = () => resolve({success: false, canceled: true});
                    input.click()
                })
            } catch (error) {
                return {success: false, error: String(error)}
            }
        },

        loadFile: async (_filePath: string): Promise<IpcResult> => {
            // In browser mode, we can't load arbitrary files by path
            return {success: false, error: 'Not supported in browser mode'}
        },

        exportHtml: async (data: { html: string; defaultPath?: string }): Promise<IpcResult> => {
            try {
                const blob = new Blob([data.html], {type: 'text/html'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = data.defaultPath || 'index.html';
                a.click();
                URL.revokeObjectURL(url);
                return {success: true, filePath: data.defaultPath || 'index.html'}
            } catch (error) {
                return {success: false, error: String(error)}
            }
        },

        exportSite: async (data: {
            files: { path: string; content: string | Uint8Array }[]
            defaultDirName?: string
            previewFile?: string
        }): Promise<IpcResult> => {
            try {
                for (const file of data.files || []) {
                    const relPath = String(file.path || '').replace(/^[/\\]+/, '');
                    if (!relPath) continue;

                    const content: any = (file as any).content;
                    let blob: Blob;

                    if (typeof content === 'string') {
                        const ext = relPath.toLowerCase().endsWith('.css')
                            ? 'text/css'
                            : relPath.toLowerCase().endsWith('.html')
                                ? 'text/html'
                                : 'text/plain';
                        blob = new Blob([content], {type: ext})
                    } else {
                        const bytes: Uint8Array = content instanceof Uint8Array ? content : new Uint8Array(content);
                        const ab = new ArrayBuffer(bytes.byteLength);
                        new Uint8Array(ab).set(bytes);
                        blob = new Blob([ab], {type: 'application/octet-stream'})
                    }

                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = relPath.split('/').pop() || 'file';
                    a.click();
                    URL.revokeObjectURL(url)
                }

                return {success: true, directory: null}
            } catch (error) {
                return {success: false, error: String(error)}
            }
        },

        openInBrowser: async (target: string): Promise<IpcResult> => {
            if (/^https?:\/\//i.test(target)) {
                window.open(target, '_blank', 'noopener,noreferrer');
                return {success: true}
            }

            // Local file open is not supported in browser mode.
            return {success: false, error: 'Not supported in browser mode'}
        },

        onExportProgress: (_callback: (data: { written: number; total: number; path?: string }) => void) => {
            // No-op in browser mode
            return () => {
            }
        },

        getRecent: async (): Promise<IpcResult> => {
            try {
                const raw = localStorage.getItem('recent-projects');
                const projects: Array<string | { path: string; name: string }> = raw ? JSON.parse(raw) : [];
                // Normalize to object format
                const normalized = projects.map((p) =>
                    typeof p === 'string' ? {
                        path: p,
                        name: p.split(/[/\\]/).pop()?.replace('.json', '') || 'Untitled'
                    } : p
                );
                return {success: true, projects: normalized}
            } catch {
                return {success: true, projects: []}
            }
        },

        removeRecent: async (projectPath: string): Promise<IpcResult> => {
            try {
                const raw = localStorage.getItem('recent-projects');
                const projects: Array<string | { path: string; name: string }> = raw ? JSON.parse(raw) : [];
                const filtered = projects.filter((p) =>
                    typeof p === 'string' ? p !== projectPath : p.path !== projectPath
                );
                localStorage.setItem('recent-projects', JSON.stringify(filtered));
                // Return normalized format
                const normalized = filtered.map((p) =>
                    typeof p === 'string' ? {
                        path: p,
                        name: p.split(/[/\\]/).pop()?.replace('.json', '') || 'Untitled'
                    } : p
                );
                return {success: true, projects: normalized}
            } catch {
                return {success: true, projects: []}
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
                        tags: ['nav'],
                        blocks: createWelcomeBlocks(data.name),
                        meta: {
                            charset: 'UTF-8',
                            viewport: 'width=device-width, initial-scale=1.0',
                            description: ''
                        }
                    }
                ],
                folders: [],
                userBlocks: []
            };
            return {success: true, filePath: 'project.json', content: projectData}
        },

        getDir: async (): Promise<IpcResult> => {
            return {success: true, directory: null}
        }
    },

    assets: {
        selectImage: async (): Promise<IpcResult> => {
            try {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.multiple = true;

                return new Promise((resolve) => {
                    input.onchange = () => {
                        const files = input.files;
                        if (!files || files.length === 0) {
                            resolve({success: false, canceled: true});
                            return
                        }
                        const selected = Array.from(files).map((f) => {
                            const url = URL.createObjectURL(f);
                            return {
                                name: f.name,
                                path: url,
                                relativePath: `assets/${f.name}`,
                                type: 'image' as const
                            }
                        });
                        upsertMockAssets(selected);
                        const filePaths = selected.map((s) => s.path);
                        resolve({success: true, filePaths})
                    };
                    input.oncancel = () => resolve({success: false, canceled: true});
                    input.click()
                })
            } catch (error) {
                return {success: false, error: String(error)}
            }
        },

        selectSingleImage: async (): Promise<IpcResult> => {
            try {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';

                return new Promise((resolve) => {
                    input.onchange = () => {
                        const file = input.files?.[0];
                        if (!file) {
                            resolve({success: false, canceled: true});
                            return
                        }
                        const blobUrl = URL.createObjectURL(file);
                        upsertMockAssets([
                            {
                                name: file.name,
                                path: blobUrl,
                                relativePath: `assets/${file.name}`,
                                type: 'image'
                            }
                        ]);
                        resolve({
                            success: true,
                            filePath: blobUrl,
                            data: file.name,
                            mimeType: file.type
                        })
                    };
                    input.oncancel = () => resolve({success: false, canceled: true});
                    input.click()
                })
            } catch (error) {
                return {success: false, error: String(error)}
            }
        },

        selectVideo: async (): Promise<IpcResult> => {
            try {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'video/*';

                return new Promise((resolve) => {
                    input.onchange = () => {
                        const file = input.files?.[0];
                        if (!file) {
                            resolve({success: false, canceled: true});
                            return
                        }
                        const blobUrl = URL.createObjectURL(file);
                        upsertMockAssets([
                            {
                                name: file.name,
                                path: blobUrl,
                                relativePath: `assets/${file.name}`,
                                type: 'video'
                            }
                        ]);
                        resolve({
                            success: true,
                            filePath: blobUrl,
                            data: file.name,
                            mimeType: file.type
                        })
                    };
                    input.oncancel = () => resolve({success: false, canceled: true});
                    input.click()
                })
            } catch (error) {
                return {success: false, error: String(error)}
            }
        },

        readFileAsBase64: async (filePath: string): Promise<IpcResult> => {
            try {
                const response = await fetch(filePath);
                const blob = await response.blob();
                const sizeMB = blob.size / (1024 * 1024);
                if (sizeMB > 5) {
                    return {
                        success: false,
                        error: `File is too large (${sizeMB.toFixed(1)}MB). Max 5MB for base64 embedding.`
                    }
                }
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        resolve({
                            success: true,
                            data: reader.result as string,
                            mimeType: blob.type
                        })
                    };
                    reader.onerror = () => {
                        resolve({success: false, error: 'Failed to read file'})
                    };
                    reader.readAsDataURL(blob)
                })
            } catch (error) {
                return {success: false, error: String(error)}
            }
        },

        list: async (): Promise<IpcResult> => {
            return {success: true, assets: loadMockAssets()}
        },

        delete: async (relativePath: string): Promise<IpcResult> => {
            try {
                const existing = loadMockAssets();
                const next = existing.filter((a) => a.relativePath !== relativePath);
                saveMockAssets(next);
                return {success: true}
            } catch (error) {
                return {success: false, error: String(error)}
            }
        },

        readAsset: async (assetPath: string): Promise<IpcResult> => {
            try {
                const response = await fetch(assetPath);
                const blob = await response.blob();
                const reader = new FileReader();

                return new Promise((resolve) => {
                    reader.onload = () => {
                        resolve({
                            success: true,
                            data: reader.result as string,
                            mimeType: blob.type
                        })
                    };
                    reader.readAsDataURL(blob)
                })
            } catch (error) {
                return {success: false, error: String(error)}
            }
        },

        import: async (_srcPath: string): Promise<IpcResult> => {
            return {success: false, error: 'Not supported in browser mode'}
        }
    },

    autosave: {
        start: async (_intervalMs?: number): Promise<IpcResult> => {
            return {success: true}
        },

        stop: async (): Promise<IpcResult> => {
            return {success: true}
        },

        onTick: (_callback: () => void) => {
            // No-op in browser mode
            return () => {
            }
        }
    },

    fonts: {
        listSystem: async (): Promise<IpcResult & { fonts: string[] }> => {
            console.log('[Mock API] Listing system fonts (mocked)');
            const mockFonts = [
                'Arial', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Times New Roman',
                'Georgia', 'Garamond', 'Courier New', 'Brush Script MT', 'Impact',
                'Comic Sans MS'
            ];
            return {success: true, fonts: mockFonts}
        },
        importFile: async (): Promise<IpcResult & { fonts: FontAsset[] }> => {
            console.log('[Mock API] Importing font files (mocked)');
            return {success: false, canceled: true, fonts: []}
        },
        downloadGoogleFont: async (_args: {
            family: string
            variants: { weight: string; style: string }[]
        }): Promise<IpcResult & { fonts: FontAsset[]; errors?: string[] }> => {
            console.log('[Mock API] downloadGoogleFont (mocked)');
            return {success: false, error: 'Not supported in browser mode', fonts: []}
        },
        copySystemFont: async (_args: { familyName: string; filePaths: string[] }): Promise<IpcResult & {
            fonts: FontAsset[]
        }> => {
            console.log('[Mock API] copySystemFont (mocked)');
            return {success: false, error: 'Not supported in browser mode', fonts: []}
        },
        deleteFont: async (_args: { relativePath: string }): Promise<IpcResult> => {
            console.log('[Mock API] deleteFont (mocked)');
            return {success: true}
        },
        listProject: async (): Promise<IpcResult & { fonts: FontAsset[] }> => {
            console.log('[Mock API] listProject fonts (mocked)');
            return {success: true, fonts: []}
        }
    },

    menu: {
        setProjectLoaded: async (_isLoaded: boolean): Promise<any> => {
            // No-op in browser mode
            return {success: true}
        },
        onAction: (_callback: (action: string) => void) => {
            // No-op in browser mode — menus are Electron-only
            return () => {
            }
        }
    },

    publish: {
        getProviders: async (): Promise<any> => {
            return [
                {
                    id: 'neocities',
                    displayName: 'Neocities',
                    description: 'Indie-friendly static site hosting with a simple upload API',
                    credentialFields: [
                        {
                            key: 'apiKey',
                            label: 'API Key',
                            placeholder: 'your-neocities-api-key',
                            helpUrl: 'https://neocities.org/settings#api_key',
                            sensitive: true
                        }
                    ]
                },
                {
                    id: 'cloudflare-pages',
                    displayName: 'Cloudflare Pages',
                    description: 'Fast, scalable static hosting with global CDN',
                    credentialFields: [
                        {key: 'apiToken', label: 'API Token', sensitive: true},
                        {key: 'accountId', label: 'Account ID', sensitive: false},
                        {key: 'projectName', label: 'Project Name', sensitive: false}
                    ]
                },
                {
                    id: 'github-pages',
                    displayName: 'GitHub Pages',
                    description: 'Free static hosting from a GitHub repository branch',
                    credentialFields: [
                        {key: 'pat', label: 'Personal Access Token', sensitive: true},
                        {key: 'owner', label: 'GitHub Username / Org', sensitive: false},
                        {key: 'repo', label: 'Repository Name', sensitive: false},
                        {key: 'branch', label: 'Branch (e.g. gh-pages)', sensitive: false}
                    ]
                }
            ]
        },

        getCredentials: async (_providerId: string): Promise<any> => {
            return {}
        },

        saveCredentials: async (_providerId: string, _credentials: Record<string, string>): Promise<any> => {
            return {success: true}
        },

        deleteCredentials: async (_providerId: string): Promise<any> => {
            return {success: true}
        },

        validate: async (
            _providerId: string,
            _files: { path: string; content: string | Uint8Array }[],
            _credentials?: Record<string, string>
        ): Promise<any> => {
            return {
                ok: false,
                issues: [
                    {
                        severity: 'error',
                        message: 'Publish validation is only available in Electron mode.'
                    }
                ]
            }
        },

        publish: async (
            _providerId: string,
            _files: { path: string; content: string | Uint8Array }[],
            _credentials?: Record<string, string>
        ): Promise<any> => {
            return {
                success: false,
                error: 'Publishing is only available in Electron mode.',
                warnings: []
            }
        },

        onProgress: (_callback: (progress: {
            phase: 'validating' | 'exporting' | 'uploading' | 'done';
            percent: number;
            message: string
        }) => void) => {
            return () => {
            }
        },

        offProgress: (_callback: (progress: {
            phase: 'validating' | 'exporting' | 'uploading' | 'done';
            percent: number;
            message: string
        }) => void) => {
            // No-op in browser mode
        }
    },

    app: {
        getVersion: async (): Promise<any> => {
            return {success: true, version: packageJson.version}
        },
        isEncryptionSecure: async (): Promise<any> => {
            // In browser mode, report as secure (no real keys stored anyway)
            return {secure: true}
        },
        getCredentials: async (): Promise<any> => {
            return {
                success: true,
                secure: true,
                credentials: [
                    {
                        id: 'ai:openai',
                        category: 'ai',
                        categoryLabel: 'AI',
                        label: 'OpenAI',
                        source: 'ai',
                        providerId: 'openai',
                        provider: 'OpenAI',
                        description: 'Credential for OpenAI in the AI Assistant.',
                        fields: [{key: 'apiKey', label: 'API Key', sensitive: true}],
                        values: {apiKey: ''},
                        maskedKey: '',
                        hasKey: false
                    },
                    {
                        id: 'multimedia:unsplash',
                        category: 'multimedia',
                        categoryLabel: 'Multimedia',
                        label: 'Unsplash',
                        source: 'multimedia',
                        providerId: 'unsplash',
                        provider: 'Unsplash',
                        description: 'Credential for Unsplash media search.',
                        fields: [{key: 'apiKey', label: 'Access Key', sensitive: true}],
                        values: {apiKey: ''},
                        maskedKey: '',
                        hasKey: false
                    }
                ],
                definitions: [
                    {
                        id: 'ai:openai',
                        category: 'ai',
                        categoryLabel: 'AI',
                        providerId: 'openai',
                        label: 'OpenAI',
                        description: 'Credential for OpenAI in the AI Assistant.',
                        fields: [{key: 'apiKey', label: 'API Key', sensitive: true}]
                    },
                    {
                        id: 'multimedia:unsplash',
                        category: 'multimedia',
                        categoryLabel: 'Multimedia',
                        providerId: 'unsplash',
                        label: 'Unsplash',
                        description: 'Credential for Unsplash media search.',
                        fields: [{key: 'apiKey', label: 'Access Key', sensitive: true}]
                    },
                    {
                        id: 'publisher:neocities',
                        category: 'publisher',
                        categoryLabel: 'Publisher',
                        providerId: 'neocities',
                        label: 'Neocities',
                        description: 'Indie-friendly static site hosting with a simple upload API',
                        fields: [{key: 'apiKey', label: 'API Key', sensitive: true}]
                    }
                ]
            }
        },
        getCredentialDefinitions: async (): Promise<any> => {
            const result = await mockApi.app.getCredentials();
            return {success: true, definitions: result.definitions}
        },
        getCredentialValues: async (_id: string): Promise<any> => {
            return {success: true, values: {}}
        },
        saveCredential: async (_id: string, _values: Record<string, string>): Promise<any> => {
            return {success: true}
        },
        deleteCredential: async (_id: string): Promise<any> => {
            return {success: true}
        },
        getSettings: async (): Promise<any> => {
            try {
                const raw = localStorage.getItem('app-settings');
                if (raw) return {success: true, settings: JSON.parse(raw)}
            } catch {
            }
            return {success: true, settings: null}
        },
        saveSettings: async (settings: any): Promise<any> => {
            try {
                localStorage.setItem('app-settings', JSON.stringify(settings));
                return {success: true}
            } catch (err: any) {
                return {success: false, error: String(err)}
            }
        }
    },

    ai: {
        chat: async (_data: {
            messages: { role: string; content: string }[]
            blockRegistry?: string
            config?: any
            themeContext?: { projectTheme?: unknown; uiTheme?: 'light' | 'dark' }
        }): Promise<IpcResult & { content?: string }> => {
            // Simulated AI response in browser mode
            return {
                success: true,
                content: 'This is a simulated AI response. To use real AI, run the app in Electron mode and configure your API key in the AI settings.'
            }
        },

        checkCliAvailability: async (): Promise<any> => {
            return {
                success: true,
                availability: {
                    'claude-cli': {available: false},
                    'codex-cli': {available: false},
                    'gemini-cli': {available: false},
                    'github-cli': {available: false},
                    'junie-cli': {available: false}
                }
            }
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
            const {apiKey: _, ...rest} = _config;
            return {success: true, config: {...rest, apiKey: ''}}
        },

        getModels: async (): Promise<any> => {
            return {
                success: true,
                models: {
                    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o1', 'o1-mini'],
                    anthropic: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
                    google: ['gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
                    ollama: ['llama3.3', 'deepseek-r1', 'qwen3', 'mistral', 'phi4', 'gemma3'],
                    mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest', 'mistral-nemo'],
                    'claude-cli': [],
                    'codex-cli': [],
                    'gemini-cli': [],
                    'github-cli': ['default'],
                    'junie-cli': ['default', 'claude-opus-4-6', 'claude-opus-4-7', 'claude-sonnet-4-6', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview', 'gemini-3.1-pro-preview', 'gemini-flash', 'gemini-pro', 'gpt', 'gpt-5-2025-08-07', 'gpt-5.2-2025-12-11', 'gpt-5.3-codex', 'gpt-5.4', 'gpt-codex', 'grok', 'grok-4-1-fast-reasoning', 'opus', 'sonnet']
                }
            }
        },

        fetchModelsForProvider: async (data: {
            provider: string;
            apiKey: string;
            ollamaUrl?: string
        }): Promise<any> => {
            // Simulate a brief network delay
            await new Promise((r) => setTimeout(r, 600));
            const fallback: Record<string, string[]> = {
                openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o1', 'o1-mini'],
                anthropic: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
                google: ['gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
                ollama: ['llama3.3', 'deepseek-r1', 'qwen3', 'mistral', 'phi4', 'gemma3'],
                mistral: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest', 'mistral-nemo'],
                'claude-cli': ['sonnet', 'opus', 'haiku'],
                'codex-cli': ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.2'],
                'gemini-cli': ['gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
                'github-cli': ['default'],
                'junie-cli': ['default', 'claude-opus-4-6', 'claude-opus-4-7', 'claude-sonnet-4-6', 'gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview', 'gemini-3.1-pro-preview', 'gemini-flash', 'gemini-pro', 'gpt', 'gpt-5-2025-08-07', 'gpt-5.2-2025-12-11', 'gpt-5.3-codex', 'gpt-5.4', 'gpt-codex', 'grok', 'grok-4-1-fast-reasoning', 'opus', 'sonnet']
            };
            if (data.provider.endsWith('-cli')) {
                return {success: true, models: fallback[data.provider] || []}
            }
            if (!data.apiKey && data.provider !== 'ollama') {
                return {success: true, models: []}
            }
            return {success: true, models: fallback[data.provider] || []}
        }
    },

    mediaSearch: {
        getConfig: async (): Promise<any> => {
            return {
                success: true,
                config: {
                    enabled: false,
                    provider: 'unsplash',
                    apiKey: ''
                }
            }
        },

        setConfig: async (_config: any): Promise<any> => {
            return {success: true, config: {..._config, apiKey: ''}}
        },

        search: async (_options: {
            query: string;
            perPage?: number;
            page?: number;
            type?: 'image' | 'video'
        }): Promise<any> => {
            return {
                results: [],
                error: 'Web search is only available in Electron mode. Please configure your API key in the application settings.'
            }
        },

        downloadAndImport: async (_url: string): Promise<any> => {
            return {
                success: false,
                error: 'Download and import is only available in Electron mode.'
            }
        }
    }
};

// Export the API — in Electron mode, window.api will be set by the preload script.
// In browser mode, we use this mock.
let didWarnMissingElectronApi = false;

export function getApi(): ElectronApi {
    if (window.api) {
        return window.api
    }

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isElectron = /electron/i.test(ua);
    if (isElectron && !didWarnMissingElectronApi) {
        didWarnMissingElectronApi = true;
        console.warn('[Amagon] window.api is missing in Electron. Falling back to mock API; save/load will not persist to disk.')
    }
    return mockApi
}

export default mockApi
