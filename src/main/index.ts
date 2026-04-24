import type {BrowserWindow} from 'electron'
import * as electron from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import {existsSync} from 'fs'
import {fileURLToPath} from 'url'
import {getFonts} from 'font-list'
import {
    buildSystemPrompt,
    chat as aiChat,
    type ChatMessage,
    fetchAvailableModels,
    fetchModelsForProvider,
    loadApiKeyForProvider,
    loadConfig as aiLoadConfig,
    maskApiKey,
    MASKED_KEY_PREFIX,
    PROVIDER_MODELS,
    saveConfig as aiSaveConfig
} from './aiService'
import {CLI_BINARY_NAMES, detectCliProvider} from './cliHelpers'
import {
    downloadAndImportMedia,
    loadConfig as mediaSearchLoadConfig,
    maskApiKey as maskMediaApiKey,
    MASKED_KEY_PREFIX as MEDIA_MASKED_PREFIX,
    type MediaSearchConfig,
    saveConfig as mediaSearchSaveConfig,
    searchMedia
} from './mediaSearchService'
import {isEncryptionSecure} from './cryptoHelpers'
import {buildAppMenu} from './menu'
import {createWelcomeBlocks} from '../shared/welcomeBlocks'
import '../publish/providers/index'
import {
    type ExportedFile,
    getAllPublishers,
    getPublisher,
    type PublishCredentials,
    type PublishProgress,
    type PublishResult,
    type ValidationResult
} from '../publish'
import {deletePublishCredentials, loadPublishCredentials, savePublishCredentials} from './publishCredentials'
import {
    deleteCredentialRecord,
    getCredentialDefinitions,
    getCredentialValues,
    listCredentialRecords,
    resolveSensitiveValues,
    saveCredentialRecord
} from './credentialCatalog'

const {app, ipcMain, protocol, dialog, shell, net, Menu} = electron;
const BrowserWindowCtor = electron.BrowserWindow;

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let currentProjectDir: string | null = null;
let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

const MAX_RECENT = 10;

// ---------------------------------------------------------------------------
// MIME type helper
// ---------------------------------------------------------------------------

const MIME_MAP: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
    '.apng': 'image/apng',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.eot': 'application/vnd.ms-fontobject',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogv': 'video/ogg',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf'
};

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_MAP[ext] || 'application/octet-stream'
}

// ---------------------------------------------------------------------------
// Security: path traversal prevention
// ---------------------------------------------------------------------------

function isPathSafe(requestedPath: string, allowedBase: string): boolean {
    const resolved = path.resolve(requestedPath);
    const base = path.resolve(allowedBase);
    return resolved.startsWith(base + path.sep) || resolved === base
}

// ---------------------------------------------------------------------------
// Recent projects (persisted via simple JSON in userData)
// ---------------------------------------------------------------------------

async function getRecentProjectsPath(): Promise<string> {
    return path.join(app.getPath('userData'), 'recent-projects.json')
}

async function loadRecentProjects(): Promise<string[]> {
    try {
        const filePath = await getRecentProjectsPath();
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data)
    } catch {
        return []
    }
}

async function addRecentProject(projectPath: string): Promise<void> {
    const recents = await loadRecentProjects();
    const filtered = recents.filter((p) => p !== projectPath);
    filtered.unshift(projectPath);
    if (filtered.length > MAX_RECENT) filtered.length = MAX_RECENT;
    const filePath = await getRecentProjectsPath();
    await fs.writeFile(filePath, JSON.stringify(filtered), 'utf-8')
}

async function removeRecentProject(projectPath: string): Promise<string[]> {
    const recents = await loadRecentProjects();
    const filtered = recents.filter((p) => p !== projectPath);
    const filePath = await getRecentProjectsPath();
    await fs.writeFile(filePath, JSON.stringify(filtered), 'utf-8');
    return filtered
}

async function resolveRecentProjects(
    projectPaths: string[]
): Promise<Array<{ path: string; name: string; framework?: string }>> {
    const projects = [];
    for (const projectPath of projectPaths) {
        if (!projectPath || !existsSync(projectPath)) continue;

        try {
            const content = await fs.readFile(projectPath, 'utf-8');
            const data = JSON.parse(content);
            const name = data.projectSettings?.name || 'Untitled Project';
            const framework = data.projectSettings?.framework || 'vanilla';
            projects.push({path: projectPath, name, framework})
        } catch {
            // If we can't read/parse the file, still show it with a filename fallback.
            const name = path.basename(projectPath, path.extname(projectPath)) || 'Untitled';
            projects.push({path: projectPath, name, framework: undefined})
        }
    }

    return projects
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

async function createWindow(): Promise<void> {
    mainWindow = new BrowserWindowCtor({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        title: 'Amagon',
        icon: path.join(__dirname, process.platform === 'win32' ? '../../assets/app.ico' : '../../assets/app.png'),
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        }
    });

    // In development, load from the Vite dev server
    if (process.env.ELECTRON_RENDERER_URL) {
        mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
        stopAutoSave()
    })
}

// ---------------------------------------------------------------------------
// app-media:// protocol handler  (Task 8.1)
// ---------------------------------------------------------------------------

function registerAppMediaProtocol(): void {
    protocol.handle('app-media', async (request) => {
        // URL format: app-media://project-asset/<relative-path>
        // or         app-media://absolute/<absolute-path>
        const url = new URL(request.url);

        let filePath: string;

        if (url.hostname === 'project-asset') {
            // Relative to the current project directory
            if (!currentProjectDir) {
                return new Response('No project directory set', {status: 400})
            }
            const relativePath = decodeURIComponent(url.pathname).replace(/^\//, '');
            filePath = path.join(currentProjectDir, relativePath);

            // Security: ensure the resolved path stays inside the project dir
            if (!isPathSafe(filePath, currentProjectDir)) {
                return new Response('Forbidden: path traversal detected', {status: 403})
            }
        } else if (url.hostname === 'absolute') {
            // Absolute path (used during development / for images outside project)
            filePath = decodeURIComponent(url.pathname);
            // On Windows, pathname starts with / before drive letter; strip it
            if (process.platform === 'win32' && filePath.startsWith('/')) {
                filePath = filePath.slice(1)
            }
        } else {
            // Legacy / fallback: treat entire URL path as absolute
            filePath = decodeURIComponent(url.pathname);
            if (url.hostname) {
                filePath = path.join(url.hostname, filePath)
            }
            if (process.platform !== 'win32') {
                filePath = '/' + filePath
            }
        }

        // Check file exists
        if (!existsSync(filePath)) {
            return new Response('File not found', {status: 404})
        }

        // Read and serve with correct MIME type
        try {
            const data = await fs.readFile(filePath);
            const mimeType = getMimeType(filePath);
            return new Response(data, {
                headers: {'Content-Type': mimeType}
            })
        } catch (err: any) {
            return new Response(`Error reading file: ${err.message}`, {status: 500})
        }
    })
}

// ---------------------------------------------------------------------------
// Auto-save  (Task 8.2 sub-feature)
// ---------------------------------------------------------------------------

function startAutoSave(intervalMs: number = 60_000): void {
    stopAutoSave();
    autoSaveTimer = setInterval(() => {
        if (mainWindow && currentProjectDir) {
            mainWindow.webContents.send('auto-save-tick')
        }
    }, intervalMs)
}

function stopAutoSave(): void {
    if (autoSaveTimer) {
        clearInterval(autoSaveTimer);
        autoSaveTimer = null
    }
}

// ---------------------------------------------------------------------------
// Publish credential helpers
// ---------------------------------------------------------------------------

function buildMaskedCredentials(providerId: string): PublishCredentials {
    const publisher = getPublisher(providerId);
    if (!publisher) {
        return {}
    }

    return publisher.credentialFields.reduce<PublishCredentials>((acc, field) => {
        acc[field.key] = '';
        return acc
    }, {})
}

async function getMaskedPublishCredentials(providerId: string): Promise<PublishCredentials> {
    const publisher = getPublisher(providerId);
    if (!publisher) {
        return {}
    }

    const storedCredentials = await loadPublishCredentials(providerId);
    const masked: PublishCredentials = {};

    for (const field of publisher.credentialFields) {
        const value = storedCredentials[field.key] ?? '';
        masked[field.key] = field.sensitive ? maskApiKey(value) : value
    }

    return masked
}

function getPublisherOrThrow(providerId: string) {
    const publisher = getPublisher(providerId);
    if (!publisher) {
        throw new Error(`Unknown publish provider: ${providerId}`)
    }
    return publisher
}

// ---------------------------------------------------------------------------
// IPC Handlers  (Tasks 8.2 – 8.5)
// ---------------------------------------------------------------------------

function registerIpcHandlers(): void {
    // ── Menu State ─────────────────────────────────────────────────────────

    ipcMain.handle('menu:setProjectLoaded', (_, isLoaded: boolean) => {
        if (mainWindow) {
            const menu = buildAppMenu(mainWindow, isLoaded);
            Menu.setApplicationMenu(menu)
        }
    });

    // ── Font Management ───────────────────────────────────────────────────

    ipcMain.handle('fonts:listSystem', async () => {
        try {
            const fonts = await getFonts();
            return {success: true, fonts}
        } catch (error: any) {
            return {success: false, error: error.message, fonts: []}
        }
    });

    ipcMain.handle('fonts:importFile', async () => {
        if (!mainWindow) return {success: false, error: 'Main window not available'};
        try {
            const {canceled, filePaths} = await dialog.showOpenDialog(mainWindow, {
                title: 'Import Font Files',
                filters: [{name: 'Font Files', extensions: ['ttf', 'otf', 'woff', 'woff2']}],
                properties: ['openFile', 'multiSelections']
            });

            if (canceled || filePaths.length === 0) {
                return {success: false, canceled: true, fonts: []}
            }

            if (!currentProjectDir) {
                return {success: false, error: 'No project directory set'}
            }

            const fontsDir = path.join(currentProjectDir, 'assets', 'fonts');
            await fs.mkdir(fontsDir, {recursive: true});

            const importedFonts: any[] = [];
            for (const srcPath of filePaths) {
                const fileName = path.basename(srcPath);
                let destPath = path.join(fontsDir, fileName);
                let counter = 1;
                while (existsSync(destPath)) {
                    const ext = path.extname(fileName);
                    const base = path.basename(fileName, ext);
                    destPath = path.join(fontsDir, `${base}-${counter}${ext}`);
                    counter++
                }

                await fs.copyFile(srcPath, destPath);

                const relativePath = path.relative(currentProjectDir, destPath);
                const ext = path.extname(fileName).slice(1) as 'ttf' | 'otf' | 'woff' | 'woff2';

                importedFonts.push({
                    id: `font_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
                    name: path.basename(fileName, path.extname(fileName)),
                    fileName: path.basename(destPath),
                    relativePath,
                    format: ext,
                    weight: '400',
                    style: 'normal',
                    source: 'imported'
                })
            }

            return {success: true, fonts: importedFonts}
        } catch (error: any) {
            return {success: false, error: error.message, fonts: []}
        }
    });

    ipcMain.handle('fonts:copySystemFont', async (_, args: { familyName: string; filePaths: string[] }) => {
        if (!currentProjectDir) return {success: false, error: 'No project directory set', fonts: []};
        if (!args?.familyName) return {success: false, error: 'familyName required', fonts: []};

        try {
            const fontsDir = path.join(currentProjectDir, 'assets', 'fonts');
            await fs.mkdir(fontsDir, {recursive: true});

            // Use provided file paths if available; otherwise try to get paths from font-list
            let srcPaths: string[] = (args.filePaths || []).filter(Boolean);
            if (srcPaths.length === 0) {
                try {
                    // font-list with { disableQuoting: true } returns detailed entries on some platforms
                    const allFonts: any = await getFonts();
                    // Some builds of font-list return paths; others just names — use paths if available
                    const match = Array.isArray(allFonts)
                        ? allFonts.find((f: any) => typeof f === 'object' && f.family === args.familyName && f.filePath)
                        : null;
                    if (match?.filePath) srcPaths = [match.filePath]
                } catch {
                    // ignore
                }
            }

            if (srcPaths.length === 0) {
                // Cannot locate the font file on disk — return a best-effort FontAsset for system stacks
                // (font won't be physically copied but the name will be available in the picker)
                const asset: any = {
                    id: `font_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
                    name: args.familyName,
                    fileName: '',
                    relativePath: '',
                    format: 'ttf' as const,
                    weight: '400',
                    style: 'normal',
                    source: 'system' as const
                };
                return {success: true, fonts: [asset]}
            }

            const imported: any[] = [];
            for (const srcPath of srcPaths) {
                if (!existsSync(srcPath)) continue;

                const fileName = path.basename(srcPath);
                let destPath = path.join(fontsDir, fileName);
                let counter = 1;
                while (existsSync(destPath)) {
                    const ext = path.extname(fileName);
                    const base = path.basename(fileName, ext);
                    destPath = path.join(fontsDir, `${base}-${counter}${ext}`);
                    counter++
                }

                await fs.copyFile(srcPath, destPath);
                const relativePath = path.relative(currentProjectDir, destPath).replace(/\\/g, '/');
                const ext = path.extname(fileName).slice(1) as 'ttf' | 'otf' | 'woff' | 'woff2';

                imported.push({
                    id: `font_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
                    name: args.familyName,
                    fileName: path.basename(destPath),
                    relativePath,
                    format: ext || 'ttf',
                    weight: '400',
                    style: 'normal',
                    source: 'system'
                })
            }

            return {success: true, fonts: imported}
        } catch (error: any) {
            return {success: false, error: error.message, fonts: []}
        }
    });

    ipcMain.handle(
        'fonts:downloadGoogleFont',
        async (_, args: { family: string; variants: Array<{ weight: string; style: string }> }) => {
            if (!currentProjectDir) return {success: false, error: 'No project directory set', fonts: []};
            if (!args?.family || typeof args.family !== 'string') {
                return {success: false, error: 'family required', fonts: []}
            }

            try {
                const fontsDir = path.join(currentProjectDir, 'assets', 'fonts');
                await fs.mkdir(fontsDir, {recursive: true});

                if (!isPathSafe(fontsDir, currentProjectDir)) {
                    return {success: false, error: 'Forbidden: invalid fonts directory', fonts: []}
                }

                const family = args.family.trim();
                const variants = Array.isArray(args.variants) && args.variants.length > 0
                    ? args.variants
                    : [{weight: '400', style: 'normal'}];

                const downloadedFonts: any[] = [];
                const errors: string[] = [];

                const encodedFamily = encodeURIComponent(family).replace(/%20/g, '+');
                const familySlug = family
                    .toLowerCase()
                    .replace(/\s+/g, '-')
                    .replace(/[^a-z0-9-]/g, '')
                    .replace(/-+/g, '-')
                    .replace(/^-|-$/g, '') || 'font';

                const userAgent =
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

                for (const variant of variants) {
                    const style = String(variant?.style || 'normal').toLowerCase() === 'italic' ? 'italic' : 'normal';
                    const italic = style === 'italic' ? '1' : '0';
                    const weightRaw = String(variant?.weight || '400');
                    const weightMatch = weightRaw.match(/\d{3}/);
                    const weight = weightMatch ? weightMatch[0] : '400';

                    try {
                        const cssUrl = `https://fonts.googleapis.com/css2?family=${encodedFamily}:ital,wght@${italic},${weight}&display=swap`;
                        const cssResponse = await net.fetch(cssUrl, {
                            headers: {
                                'User-Agent': userAgent
                            }
                        });
                        if (!cssResponse.ok) {
                            errors.push(`${family} ${weight} ${style}: CSS request failed (${cssResponse.status})`);
                            continue
                        }

                        const css = await cssResponse.text();
                        const latinBlock = css.match(/\/\*\s*latin\s*\*\/[\s\S]*?src:\s*url\(([^)]+)\)/i);
                        const srcMatch = latinBlock || css.match(/src:\s*url\(([^)]+)\)/i);
                        if (!srcMatch?.[1]) {
                            errors.push(`${family} ${weight} ${style}: Could not parse font URL from CSS`);
                            continue
                        }

                        const woff2Url = srcMatch[1].trim().replace(/^['"]|['"]$/g, '');
                        // Security: only fetch from the expected Google Fonts CDN domain
                        if (!woff2Url.startsWith('https://fonts.gstatic.com/')) {
                            errors.push(`${family} ${weight} ${style}: Unexpected font URL origin (blocked): ${woff2Url.slice(0, 80)}`);
                            continue
                        }
                        const fontResponse = await net.fetch(woff2Url);
                        if (!fontResponse.ok) {
                            errors.push(`${family} ${weight} ${style}: Font request failed (${fontResponse.status})`);
                            continue
                        }

                        const buffer = Buffer.from(await fontResponse.arrayBuffer());
                        if (buffer.length === 0) {
                            errors.push(`${family} ${weight} ${style}: Downloaded file is empty`);
                            continue
                        }

                        const baseName = `${familySlug}-${weight}-${style}`;
                        let fileName = `${baseName}.woff2`;
                        let destPath = path.join(fontsDir, fileName);
                        let counter = 1;
                        while (existsSync(destPath)) {
                            fileName = `${baseName}-${counter}.woff2`;
                            destPath = path.join(fontsDir, fileName);
                            counter++
                        }

                        if (!isPathSafe(destPath, fontsDir)) {
                            errors.push(`${family} ${weight} ${style}: Forbidden destination path`);
                            continue
                        }

                        await fs.writeFile(destPath, buffer);
                        const relativePath = path.relative(currentProjectDir, destPath).replace(/\\/g, '/');

                        downloadedFonts.push({
                            id: `font_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
                            name: family,
                            fileName,
                            relativePath,
                            format: 'woff2',
                            weight,
                            style,
                            source: 'google-fonts'
                        })
                    } catch (error: any) {
                        errors.push(`${family} ${weight} ${style}: ${error.message}`)
                    }
                }

                return {
                    success: downloadedFonts.length > 0,
                    fonts: downloadedFonts,
                    ...(errors.length ? {errors} : {})
                }
            } catch (error: any) {
                return {success: false, error: error.message, fonts: []}
            }
        }
    );

    ipcMain.handle('fonts:deleteFont', async (_, args: { relativePath: string }) => {
        if (!currentProjectDir) return {success: false, error: 'No project directory set'};
        if (!args?.relativePath) return {success: false, error: 'relativePath required'};

        try {
            const rel = String(args.relativePath).replace(/^[/\\]+/, '').replace(/\\/g, '/');

            // Security: block path traversal
            const targetPath = path.join(currentProjectDir, rel);
            if (!isPathSafe(targetPath, currentProjectDir)) {
                return {success: false, error: 'Forbidden: path traversal detected'}
            }

            // Extra guard: must be inside assets/fonts/
            const fontsDir = path.join(currentProjectDir, 'assets', 'fonts');
            if (!isPathSafe(targetPath, fontsDir)) {
                return {success: false, error: 'Forbidden: can only delete files from assets/fonts/'}
            }

            if (!existsSync(targetPath)) {
                // Already gone — treat as success so the store can clean up
                return {success: true}
            }

            await fs.unlink(targetPath);
            return {success: true}
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    ipcMain.handle('fonts:listProject', async () => {
        if (!currentProjectDir) return {success: true, fonts: []};

        try {
            const fontsDir = path.join(currentProjectDir, 'assets', 'fonts');
            try {
                await fs.access(fontsDir)
            } catch {
                return {success: true, fonts: []}
            }

            const entries = await fs.readdir(fontsDir);
            const FONT_EXTS = new Set(['.ttf', '.otf', '.woff', '.woff2']);

            const fonts: any[] = entries
                .filter((f) => FONT_EXTS.has(path.extname(f).toLowerCase()))
                .map((fileName) => {
                    const ext = path.extname(fileName).slice(1) as 'ttf' | 'otf' | 'woff' | 'woff2';
                    const relativePath = `assets/fonts/${fileName}`;
                    return {
                        id: `font_${Buffer.from(relativePath).toString('base64url').slice(0, 12)}`,
                        name: path.basename(fileName, path.extname(fileName)),
                        fileName,
                        relativePath,
                        format: ext,
                        weight: '400',
                        style: 'normal',
                        source: 'imported'
                    }
                });

            return {success: true, fonts}
        } catch (error: any) {
            return {success: false, error: error.message, fonts: []}
        }
    });

    // ── 8.2  Project Save ────────────────────────────────────────────────────

    ipcMain.handle(
        'project:save',
        async (_, data: { filePath?: string; content: string }) => {
            try {
                let targetPath = data.filePath;

                // If the renderer passes a relative path (e.g. "project.json"), resolve it
                // against the current project directory (when available). Otherwise treat
                // it as an unsaved project and show the Save dialog.
                if (targetPath && !path.isAbsolute(targetPath)) {
                    if (currentProjectDir) {
                        targetPath = path.join(currentProjectDir, targetPath)
                    } else {
                        targetPath = undefined
                    }
                }

                // If no path or untitled, show Save As dialog
                if (!targetPath || targetPath === 'untitled-project.json') {
                    const {canceled, filePath} = await dialog.showSaveDialog(mainWindow!, {
                        title: 'Save Project',
                        defaultPath: path.join(
                            app.getPath('documents'),
                            'project.json'
                        ),
                        filters: [{name: 'Amagon Project', extensions: ['json']}]
                    });
                    if (canceled || !filePath) return {success: false, canceled: true};
                    targetPath = filePath
                }

                // Ensure the parent directory exists
                await fs.mkdir(path.dirname(targetPath), {recursive: true});
                await fs.writeFile(targetPath, data.content, 'utf-8');

                // Update current project dir
                currentProjectDir = path.dirname(targetPath);
                await addRecentProject(targetPath);

                // Ensure assets/ subfolder exists
                const assetsDir = path.join(currentProjectDir, 'assets');
                await fs.mkdir(assetsDir, {recursive: true});

                return {success: true, filePath: targetPath}
            } catch (error: any) {
                return {success: false, error: error.message}
            }
        }
    );

    // ── Save As (always shows dialog) ─────────────────────────────────────

    ipcMain.handle(
        'project:saveAs',
        async (_, data: { content: string }) => {
            try {
                const {canceled, filePath} = await dialog.showSaveDialog(mainWindow!, {
                    title: 'Save Project As',
                    defaultPath: path.join(app.getPath('documents'), 'project.json'),
                    filters: [{name: 'Amagon Project', extensions: ['json']}]
                });
                if (canceled || !filePath) return {success: false, canceled: true};

                await fs.mkdir(path.dirname(filePath), {recursive: true});
                await fs.writeFile(filePath, data.content, 'utf-8');

                currentProjectDir = path.dirname(filePath);
                await addRecentProject(filePath);

                const assetsDir = path.join(currentProjectDir, 'assets');
                await fs.mkdir(assetsDir, {recursive: true});

                return {success: true, filePath}
            } catch (error: any) {
                return {success: false, error: error.message}
            }
        }
    );

    // ── 8.3  Project Load ────────────────────────────────────────────────────

    ipcMain.handle('project:load', async () => {
        try {
            const {canceled, filePaths} = await dialog.showOpenDialog(mainWindow!, {
                title: 'Open Project',
                filters: [{name: 'Amagon Project', extensions: ['json']}],
                properties: ['openFile']
            });

            if (canceled || filePaths.length === 0) {
                return {success: false, canceled: true}
            }

            const filePath = filePaths[0];
            const raw = await fs.readFile(filePath, 'utf-8');
            const content = JSON.parse(raw);

            // Basic schema validation
            if (!content.projectSettings || !content.pages) {
                return {
                    success: false,
                    error:
                        'Invalid project file: missing projectSettings or pages. Make sure you selected a valid .json project file.'
                }
            }

            currentProjectDir = path.dirname(filePath);
            await addRecentProject(filePath);
            startAutoSave();

            return {success: true, filePath, content}
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    // ── Load specific file path (for recent projects) ─────────────────────

    ipcMain.handle('project:loadFile', async (_, filePath: string) => {
        try {
            const raw = await fs.readFile(filePath, 'utf-8');
            const content = JSON.parse(raw);

            if (!content.projectSettings || !content.pages) {
                return {success: false, error: 'Invalid project file format.'}
            }

            currentProjectDir = path.dirname(filePath);
            await addRecentProject(filePath);
            startAutoSave();

            return {success: true, filePath, content}
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    // ── Recent projects list ──────────────────────────────────────────────

    ipcMain.handle('project:getRecent', async () => {
        try {
            const recents = await loadRecentProjects();
            const projects = await resolveRecentProjects(recents);
            return {success: true, projects}
        } catch (error: any) {
            return {success: false, error: error.message, projects: []}
        }
    });

    ipcMain.handle('project:removeRecent', async (_, projectPath: string) => {
        try {
            const updated = await removeRecentProject(projectPath);
            const projects = await resolveRecentProjects(updated);
            return {success: true, projects}
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    // ── Export HTML ────────────────────────────────────────────────────────

    ipcMain.handle(
        'project:exportHtml',
        async (_, data: { html: string; defaultPath?: string }) => {
            try {
                const {canceled, filePath} = await dialog.showSaveDialog(mainWindow!, {
                    title: 'Export HTML',
                    defaultPath: path.join(
                        app.getPath('documents'),
                        data.defaultPath || 'index.html'
                    ),
                    filters: [{name: 'HTML Files', extensions: ['html', 'htm']}]
                });

                if (canceled || !filePath) return {success: false, canceled: true};

                await fs.writeFile(filePath, data.html, 'utf-8');
                return {success: true, filePath}
            } catch (error: any) {
                return {success: false, error: error.message}
            }
        }
    );

    // ── Export Site (multi-file) ───────────────────────────────────────────

    ipcMain.handle(
        'project:exportSite',
        async (
            _,
            data: {
                files: { path: string; content: string | Uint8Array }[]
                defaultDirName?: string
                previewFile?: string
            }
        ) => {
            try {
                const {canceled, filePaths} = await dialog.showOpenDialog(mainWindow!, {
                    title: 'Choose Export Directory',
                    defaultPath: app.getPath('documents'),
                    properties: ['openDirectory', 'createDirectory']
                });

                if (canceled || filePaths.length === 0) return {success: false, canceled: true};

                const baseDir = filePaths[0];
                const dirName = (data.defaultDirName || '').trim();
                const exportDir = dirName ? path.join(baseDir, dirName) : baseDir;

                await fs.mkdir(exportDir, {recursive: true});

                const total = Array.isArray(data.files) ? data.files.length : 0;
                let written = 0;

                for (const file of data.files || []) {
                    const rel = String(file.path || '').replace(/^[/\\]+/, '');
                    if (!rel) continue;

                    if (path.isAbsolute(rel)) {
                        continue
                    }

                    const normalizedRel = path.normalize(rel);
                    const targetPath = path.join(exportDir, normalizedRel);

                    if (!isPathSafe(targetPath, exportDir)) {
                        continue
                    }

                    await fs.mkdir(path.dirname(targetPath), {recursive: true});

                    const content: any = (file as any).content;
                    if (typeof content === 'string') {
                        await fs.writeFile(targetPath, content, 'utf-8')
                    } else if (content && typeof content === 'object') {
                        // Handle Uint8Array or Buffer-like
                        if (content.type === 'Buffer' && Array.isArray(content.data)) {
                            await fs.writeFile(targetPath, Buffer.from(content.data))
                        } else {
                            await fs.writeFile(targetPath, Buffer.from(content as Uint8Array))
                        }
                    } else {
                        await fs.writeFile(targetPath, '')
                    }

                    written++;
                    if (mainWindow) {
                        mainWindow.webContents.send('project:exportProgress', {
                            written,
                            total,
                            path: normalizedRel
                        })
                    }
                }

                const previewRel = (data.previewFile || 'index.html').replace(/^[/\\]+/, '');
                const previewPath = path.join(exportDir, path.normalize(previewRel));
                const safePreview = isPathSafe(previewPath, exportDir) ? previewPath : undefined;

                return {success: true, directory: exportDir, previewPath: safePreview}
            } catch (error: any) {
                return {success: false, error: error.message}
            }
        }
    );

    // ── Preview (open exported HTML in default browser) ────────────────────

    ipcMain.handle('project:openInBrowser', async (_, filePath: string) => {
        try {
            const target = String(filePath || '');
            if (!target) return {success: false, error: 'No file path provided'};

            const isExternalUrl = /^https?:\/\//i.test(target);
            if (isExternalUrl) {
                await shell.openExternal(target);
                return {success: true}
            }

            const err = await shell.openPath(target);
            if (err) return {success: false, error: err};
            return {success: true}
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    // ── 8.4  Asset Management ─────────────────────────────────────────────

    ipcMain.handle('assets:selectImage', async () => {
        try {
            const {canceled, filePaths} = await dialog.showOpenDialog(mainWindow!, {
                title: 'Select Image(s)',
                filters: [
                    {
                        name: 'Images',
                        extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'apng', 'tif', 'tiff']
                    }
                ],
                properties: ['openFile', 'multiSelections']
            });

            if (canceled || filePaths.length === 0) {
                return {success: false, canceled: true}
            }

            // If we have a project directory, copy assets into project assets/ folder
            const resultPaths: string[] = [];

            if (currentProjectDir) {
                const assetsDir = path.join(currentProjectDir, 'assets');
                await fs.mkdir(assetsDir, {recursive: true});

                for (const srcPath of filePaths) {
                    const filename = path.basename(srcPath);
                    let destPath = path.join(assetsDir, filename);

                    // Handle duplicates by appending a counter
                    let counter = 1;
                    while (existsSync(destPath)) {
                        const ext = path.extname(filename);
                        const base = path.basename(filename, ext);
                        destPath = path.join(assetsDir, `${base}-${counter}${ext}`);
                        counter++
                    }

                    await fs.copyFile(srcPath, destPath);

                    // Return an app-media URL that references the project asset
                    const relativePath = path.relative(currentProjectDir, destPath);
                    resultPaths.push(`app-media://project-asset/${relativePath}`)
                }
            } else {
                // No project yet — return absolute app-media paths
                for (const srcPath of filePaths) {
                    resultPaths.push(`app-media://absolute/${srcPath}`)
                }
            }

            return {success: true, filePaths: resultPaths}
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    ipcMain.handle('assets:selectSingleImage', async () => {
        try {
            const {canceled, filePaths} = await dialog.showOpenDialog(mainWindow!, {
                title: 'Select Image',
                filters: [
                    {
                        name: 'Images',
                        extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'apng', 'tif', 'tiff']
                    }
                ],
                properties: ['openFile']
            });

            if (canceled || filePaths.length === 0) {
                return {success: false, canceled: true}
            }

            const srcPath = filePaths[0];
            const fileName = path.basename(srcPath);
            const mimeType = getMimeType(srcPath);

            if (currentProjectDir) {
                const assetsDir = path.join(currentProjectDir, 'assets');
                await fs.mkdir(assetsDir, {recursive: true});

                let destPath = path.join(assetsDir, fileName);
                let counter = 1;
                while (existsSync(destPath)) {
                    const ext = path.extname(fileName);
                    const base = path.basename(fileName, ext);
                    destPath = path.join(assetsDir, `${base}-${counter}${ext}`);
                    counter++
                }

                await fs.copyFile(srcPath, destPath);
                const relativePath = path.relative(currentProjectDir, destPath);
                return {
                    success: true,
                    filePath: `app-media://project-asset/${relativePath}`,
                    data: path.basename(destPath),
                    mimeType
                }
            }

            return {
                success: true,
                filePath: `app-media://absolute/${srcPath}`,
                data: fileName,
                mimeType
            }
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    ipcMain.handle('assets:selectVideo', async () => {
        try {
            const {canceled, filePaths} = await dialog.showOpenDialog(mainWindow!, {
                title: 'Select Video',
                filters: [
                    {
                        name: 'Videos',
                        extensions: ['mp4', 'webm', 'ogv', 'ogg', 'mov', 'm4v']
                    }
                ],
                properties: ['openFile']
            });

            if (canceled || filePaths.length === 0) {
                return {success: false, canceled: true}
            }

            const srcPath = filePaths[0];
            const fileName = path.basename(srcPath);
            const mimeType = getMimeType(srcPath);

            if (currentProjectDir) {
                const assetsDir = path.join(currentProjectDir, 'assets');
                await fs.mkdir(assetsDir, {recursive: true});

                let destPath = path.join(assetsDir, fileName);
                let counter = 1;
                while (existsSync(destPath)) {
                    const ext = path.extname(fileName);
                    const base = path.basename(fileName, ext);
                    destPath = path.join(assetsDir, `${base}-${counter}${ext}`);
                    counter++
                }

                await fs.copyFile(srcPath, destPath);
                const relativePath = path.relative(currentProjectDir, destPath);
                return {
                    success: true,
                    filePath: `app-media://project-asset/${relativePath}`,
                    data: path.basename(destPath),
                    mimeType
                }
            }

            return {
                success: true,
                filePath: `app-media://absolute/${srcPath}`,
                data: fileName,
                mimeType
            }
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    // ── List project assets ───────────────────────────────────────────────

    ipcMain.handle('assets:list', async () => {
        try {
            if (!currentProjectDir) {
                return {success: true, assets: []}
            }

            const assetsDir = path.join(currentProjectDir, 'assets');
            if (!existsSync(assetsDir)) {
                return {success: true, assets: []}
            }

            const entries = await fs.readdir(assetsDir, {withFileTypes: true});
            const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif', '.apng', '.tif', '.tiff'];
            const videoExts = ['.mp4', '.webm', '.ogv', '.ogg', '.mov', '.m4v'];
            const assets = entries
                .filter(
                    (e) =>
                        e.isFile() &&
                        (imageExts.includes(path.extname(e.name).toLowerCase()) ||
                            videoExts.includes(path.extname(e.name).toLowerCase()))
                )
                .map((e) => {
                    const ext = path.extname(e.name).toLowerCase();
                    const type = imageExts.includes(ext) ? 'image' : 'video';
                    const relativePath = `assets/${e.name}`;
                    return {
                        name: e.name,
                        path: `app-media://project-asset/${relativePath}`,
                        relativePath,
                        type
                    }
                });

            return {success: true, assets}
        } catch (error: any) {
            return {success: false, error: error.message, assets: []}
        }
    });

    ipcMain.handle('assets:readFileAsBase64', async (_, assetPath: string) => {
        try {
            const input = String(assetPath || '');
            if (!input) return {success: false, error: 'No file path provided'};

            const maxBytes = 5 * 1024 * 1024;

            if (/^https?:\/\//i.test(input)) {
                return await new Promise((resolve) => {
                    const request = net.request(input);
                    request.on('response', (response) => {
                        const chunks: Buffer[] = [];
                        let total = 0;

                        const contentTypeHeader = response.headers['content-type'];
                        const mimeFromHeader = Array.isArray(contentTypeHeader)
                            ? contentTypeHeader[0]
                            : (contentTypeHeader as string | undefined);

                        response.on('data', (chunk) => {
                            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                            total += buf.length;
                            if (total > maxBytes) {
                                resolve({
                                    success: false,
                                    error: `File is too large (${(total / (1024 * 1024)).toFixed(1)}MB). Max 5MB for base64 embedding.`
                                });
                                try {
                                    request.abort()
                                } catch {
                                    // ignore
                                }
                                return
                            }
                            chunks.push(buf)
                        });

                        response.on('end', () => {
                            const data = Buffer.concat(chunks);
                            const mimeType = (mimeFromHeader || 'application/octet-stream').split(';')[0];
                            resolve({
                                success: true,
                                data: `data:${mimeType};base64,${data.toString('base64')}`,
                                mimeType
                            })
                        });

                        response.on('error', (err) => {
                            resolve({success: false, error: err.message})
                        })
                    });

                    request.on('error', (err) => {
                        resolve({success: false, error: err.message})
                    });

                    request.end()
                })
            }

            if (input.startsWith('blob:')) {
                return {
                    success: false,
                    error: 'Blob URLs are not supported for base64 embedding in Electron mode. Please re-browse the file.'
                }
            }

            let filePath: string;

            if (input.startsWith('app-media://project-asset/')) {
                if (!currentProjectDir) {
                    return {success: false, error: 'No project directory'}
                }
                const rel = input.replace('app-media://project-asset/', '');
                filePath = path.join(currentProjectDir, decodeURIComponent(rel))
            } else if (input.startsWith('app-media://absolute/')) {
                filePath = decodeURIComponent(input.replace('app-media://absolute/', ''))
            } else {
                filePath = input
            }

            const data = await fs.readFile(filePath);
            const sizeMB = data.byteLength / (1024 * 1024);
            if (data.byteLength > maxBytes) {
                return {
                    success: false,
                    error: `File is too large (${sizeMB.toFixed(1)}MB). Max 5MB for base64 embedding.`
                }
            }

            const mime = getMimeType(filePath);
            const base64 = data.toString('base64');
            return {
                success: true,
                data: `data:${mime};base64,${base64}`,
                mimeType: mime
            }
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    // ── Delete an asset ───────────────────────────────────────────────────

    ipcMain.handle('assets:delete', async (_, relativePath: string) => {
        try {
            if (!currentProjectDir) {
                return {success: false, error: 'No project directory set'}
            }

            const fullPath = path.join(currentProjectDir, relativePath);

            // Security check
            if (!isPathSafe(fullPath, currentProjectDir)) {
                return {success: false, error: 'Path traversal detected'}
            }

            if (!existsSync(fullPath)) {
                return {success: false, error: 'File not found'}
            }

            await fs.unlink(fullPath);
            return {success: true}
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    // ── Read asset as base64 (for preview / export) ───────────────────────

    ipcMain.handle('assets:readAsset', async (_, assetPath: string) => {
        try {
            let filePath: string;

            if (assetPath.startsWith('app-media://project-asset/')) {
                if (!currentProjectDir) {
                    return {success: false, error: 'No project directory'}
                }
                const rel = assetPath.replace('app-media://project-asset/', '');
                filePath = path.join(currentProjectDir, decodeURIComponent(rel))
            } else if (assetPath.startsWith('app-media://absolute/')) {
                filePath = decodeURIComponent(
                    assetPath.replace('app-media://absolute/', '')
                )
            } else {
                filePath = assetPath
            }

            const data = await fs.readFile(filePath);
            const mime = getMimeType(filePath);
            const base64 = data.toString('base64');

            return {
                success: true,
                data: `data:${mime};base64,${base64}`,
                mimeType: mime
            }
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    // ── 8.5  New Project ──────────────────────────────────────────────────

    ipcMain.handle(
        'project:new',
        async (
            _,
            data: { name: string; framework: string; directory?: string }
        ) => {
            try {
                let projectDir = data.directory;

                if (!projectDir) {
                    const {canceled, filePaths} = await dialog.showOpenDialog(
                        mainWindow!,
                        {
                            title: 'Choose Project Location',
                            properties: ['openDirectory', 'createDirectory']
                        }
                    );
                    if (canceled || filePaths.length === 0) {
                        return {success: false, canceled: true}
                    }
                    projectDir = path.join(filePaths[0], data.name.replace(/\s+/g, '-').toLowerCase())
                }

                // Create directory structure
                await fs.mkdir(projectDir, {recursive: true});
                await fs.mkdir(path.join(projectDir, 'assets'), {recursive: true});

                // Create initial project.json
                const projectData = {
                    projectSettings: {
                        name: data.name,
                        framework: data.framework,
                        theme: {
                            name: 'Default',
                            colors: {
                                primary: '#1e66f5', secondary: '#6c757d', accent: '#7c3aed',
                                background: '#ffffff', surface: '#f8f9fa', text: '#212529',
                                textMuted: '#6c757d', border: '#dee2e6',
                                success: '#198754', warning: '#ffc107', danger: '#dc3545'
                            },
                            typography: {
                                fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                                headingFontFamily: 'inherit',
                                baseFontSize: '16px', lineHeight: '1.6', headingLineHeight: '1.2'
                            },
                            spacing: {baseUnit: '8px', scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8]},
                            borders: {radius: '6px', width: '1px', color: '#dee2e6'},
                            customCss: ''
                        },
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

                const filePath = path.join(projectDir, 'project.json');
                await fs.writeFile(filePath, JSON.stringify(projectData, null, 2), 'utf-8');

                currentProjectDir = projectDir;
                await addRecentProject(filePath);
                startAutoSave();

                return {success: true, filePath, content: projectData}
            } catch (error: any) {
                return {success: false, error: error.message}
            }
        }
    );

    // ── Auto-save configuration ───────────────────────────────────────────

    ipcMain.handle('autosave:start', (_, intervalMs?: number) => {
        startAutoSave(intervalMs || 60_000);
        return {success: true}
    });

    ipcMain.handle('autosave:stop', () => {
        stopAutoSave();
        return {success: true}
    });

    // ── Get current project directory ─────────────────────────────────────

    ipcMain.handle('project:getDir', () => {
        return {success: true, directory: currentProjectDir}
    });

    // ── Copy asset into project (for drag-in from external) ───────────────

    ipcMain.handle('assets:import', async (_, srcPath: string) => {
        try {
            if (!currentProjectDir) {
                return {success: false, error: 'No project directory'}
            }

            const assetsDir = path.join(currentProjectDir, 'assets');
            await fs.mkdir(assetsDir, {recursive: true});

            const filename = path.basename(srcPath);
            let destPath = path.join(assetsDir, filename);

            let counter = 1;
            while (existsSync(destPath)) {
                const ext = path.extname(filename);
                const base = path.basename(filename, ext);
                destPath = path.join(assetsDir, `${base}-${counter}${ext}`);
                counter++
            }

            await fs.copyFile(srcPath, destPath);
            const relativePath = path.relative(currentProjectDir, destPath);

            return {
                success: true,
                path: `app-media://project-asset/${relativePath}`,
                relativePath
            }
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    // ── App Settings ───────────────────────────────────────────────────────

    ipcMain.handle('app:getVersion', () => {
        return {success: true, version: app.getVersion()}
    });

    ipcMain.handle('app:getSettings', async () => {
        try {
            const filePath = path.join(app.getPath('userData'), 'app-settings.json');
            const raw = await fs.readFile(filePath, 'utf-8');
            const settings = JSON.parse(raw);
            return {success: true, settings}
        } catch {
            return {success: true, settings: null}
        }
    });

    ipcMain.handle('app:saveSettings', async (_, patch: any) => {
        try {
            const filePath = path.join(app.getPath('userData'), 'app-settings.json');
            let existing = {};
            try {
                const raw = await fs.readFile(filePath, 'utf-8');
                existing = JSON.parse(raw)
            } catch {
                // file doesn't exist yet, ignore
            }
            const updated = {...existing, ...patch};
            await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');
            return {success: true}
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    // ── Encryption status ────────────────────────────────────────────────

    ipcMain.handle('app:isEncryptionSecure', () => {
        return {secure: isEncryptionSecure()}
    });

    // ── Credential Manager ──────────────────────────────────────────────

    ipcMain.handle('app:getCredentials', async () => {
        try {
            const credentials = await listCredentialRecords();
            return {success: true, credentials, definitions: getCredentialDefinitions(), secure: isEncryptionSecure()}
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    ipcMain.handle('app:getCredentialDefinitions', async () => {
        try {
            return {success: true, definitions: getCredentialDefinitions()}
        } catch (error: any) {
            return {success: false, error: error.message, definitions: []}
        }
    });

    ipcMain.handle('app:getCredentialValues', async (_, id: string) => {
        try {
            return {success: true, values: await getCredentialValues(id)}
        } catch (error: any) {
            return {success: false, error: error.message, values: {}}
        }
    });

    ipcMain.handle('app:saveCredential', async (_, data: { id: string; values: PublishCredentials }) => {
        try {
            await saveCredentialRecord(data.id, data.values);
            return {success: true}
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    ipcMain.handle('app:deleteCredential', async (_, id: string) => {
        try {
            await deleteCredentialRecord(id);
            return {success: true}
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    // ── Publish ───────────────────────────────────────────────────────────────

    ipcMain.handle('publish:getProviders', () => {
        return getAllPublishers().map((publisher) => ({
            id: publisher.meta.id,
            displayName: publisher.meta.displayName,
            description: publisher.meta.description,
            credentialFields: publisher.credentialFields.map((field) => ({...field}))
        }))
    });

    ipcMain.handle('publish:getCredentials', async (_, providerId: string) => {
        try {
            return await getMaskedPublishCredentials(providerId)
        } catch {
            return buildMaskedCredentials(providerId)
        }
    });

    ipcMain.handle(
        'publish:saveCredentials',
        async (_, data: { providerId: string; credentials: PublishCredentials }) => {
            try {
                getPublisherOrThrow(data.providerId);
                await savePublishCredentials(data.providerId, data.credentials);
                return {success: true}
            } catch (error: any) {
                return {success: false, error: error.message}
            }
        }
    );

    ipcMain.handle('publish:deleteCredentials', async (_, providerId: string) => {
        try {
            getPublisherOrThrow(providerId);
            await deletePublishCredentials(providerId);
            return {success: true}
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    ipcMain.handle(
        'publish:validate',
        async (
            _,
            data: {
                providerId: string
                files: ExportedFile[]
                credentials?: PublishCredentials
            }
        ): Promise<ValidationResult> => {
            const publisher = getPublisher(data.providerId);
            if (!publisher) {
                return {
                    ok: false,
                    issues: [
                        {
                            severity: 'error',
                            message: `Unknown publish provider: ${data.providerId}`
                        }
                    ]
                }
            }

            const storedCredentials = await loadPublishCredentials(data.providerId);
            const credentials = resolveSensitiveValues(
                publisher.credentialFields,
                storedCredentials,
                data.credentials || {}
            );
            return publisher.validate(data.files, credentials)
        }
    );

    ipcMain.handle(
        'publish:publish',
        async (
            event,
            data: {
                providerId: string
                files: ExportedFile[]
                credentials?: PublishCredentials
            }
        ): Promise<PublishResult> => {
            const publisher = getPublisher(data.providerId);
            if (!publisher) {
                return {
                    success: false,
                    error: `Unknown publish provider: ${data.providerId}`,
                    warnings: []
                }
            }

            const storedCredentials = await loadPublishCredentials(data.providerId);
            const credentials = resolveSensitiveValues(
                publisher.credentialFields,
                storedCredentials,
                data.credentials || {}
            );
            return publisher.publish(data.files, credentials, (progress: PublishProgress) => {
                event.sender.send('publish:progress', progress)
            })
        }
    );

    // ── AI Assistant ─────────────────────────────────────────────────────

    ipcMain.handle(
        'ai:chat',
        async (
            _,
            data: {
                messages: ChatMessage[]
                blockRegistry?: string
                config?: any
                themeContext?: { projectTheme?: unknown; uiTheme?: 'light' | 'dark' }
            }
        ) => {
            try {
                // Prepend system prompt if block registry schema is provided
                let messages = data.messages;
                if (data.blockRegistry) {
                    const systemPrompt = buildSystemPrompt(data.blockRegistry, data.themeContext);
                    messages = [
                        {role: 'system' as const, content: systemPrompt},
                        ...messages.filter((m) => m.role !== 'system')
                    ]
                }

                const result = await aiChat(messages, data.config);
                if (result.error) {
                    return {success: false, error: result.error}
                }
                return {success: true, content: result.content}
            } catch (error: any) {
                return {success: false, error: error.message}
            }
        }
    );

    ipcMain.handle('ai:checkCliAvailability', async () => {
        try {
            const entries = await Promise.all(
                (Object.keys(CLI_BINARY_NAMES) as Array<keyof typeof CLI_BINARY_NAMES>).map(
                    async (providerId) => [providerId, await detectCliProvider(providerId)] as const
                )
            );

            return {
                success: true,
                availability: Object.fromEntries(entries)
            }
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    ipcMain.handle('ai:getConfig', async () => {
        try {
            const config = await aiLoadConfig();
            // Never send the raw API key to the renderer — mask it
            return {
                success: true,
                config: {
                    ...config,
                    apiKey: maskApiKey(config.apiKey)
                }
            }
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    ipcMain.handle('ai:setConfig', async (_, config: any) => {
        try {
            const configToSave = {...config};
            // If the renderer sent back a masked key, the user didn't change it
            if (configToSave.apiKey && configToSave.apiKey.startsWith(MASKED_KEY_PREFIX)) {
                delete configToSave.apiKey  // preserve existing encrypted key
            }
            const saved = await aiSaveConfig(configToSave);
            return {
                success: true,
                config: {
                    ...saved,
                    apiKey: maskApiKey(saved.apiKey)
                }
            }
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    ipcMain.handle('ai:getModels', async () => {
        try {
            const models = await fetchAvailableModels();
            return {success: true, models}
        } catch {
            // Fall back to static list if dynamic fetch fails entirely
            return {success: true, models: PROVIDER_MODELS}
        }
    });

    ipcMain.handle('ai:fetchModelsForProvider', async (_event, data: {
        provider: string;
        apiKey: string;
        ollamaUrl?: string
    }) => {
        try {
            let apiKeyToUse = data.apiKey || '';
            // If the renderer sent a masked or empty key, look up the saved key for this specific provider
            if (!apiKeyToUse || apiKeyToUse.startsWith(MASKED_KEY_PREFIX)) {
                apiKeyToUse = await loadApiKeyForProvider(data.provider as any)
            }

            const models = await fetchModelsForProvider(data.provider as any, apiKeyToUse, data.ollamaUrl);
            return {success: true, models}
        } catch (error: any) {
            return {success: false, error: error.message, models: []}
        }
    });

    // ── Media Search ───────────────────────────────────────────────────────

    ipcMain.handle('mediaSearch:getConfig', async () => {
        try {
            const config = await mediaSearchLoadConfig();
            return {
                success: true,
                config: {
                    ...config,
                    apiKey: maskMediaApiKey(config.apiKey)
                }
            }
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    ipcMain.handle('mediaSearch:setConfig', async (_, config: Partial<MediaSearchConfig>) => {
        try {
            const configToSave = {...config};
            // If the renderer sent back a masked key, the user didn't change it
            if (configToSave.apiKey && configToSave.apiKey.startsWith(MEDIA_MASKED_PREFIX)) {
                delete configToSave.apiKey
            }
            const saved = await mediaSearchSaveConfig(configToSave);
            return {
                success: true,
                config: {
                    ...saved,
                    apiKey: maskMediaApiKey(saved.apiKey)
                }
            }
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    });

    ipcMain.handle('mediaSearch:search', async (_, options: {
        query: string;
        perPage?: number;
        page?: number;
        type?: 'image' | 'video'
    }) => {
        try {
            const config = await mediaSearchLoadConfig();
            return await searchMedia(options, config)
        } catch (error: any) {
            return {results: [], error: error.message}
        }
    });

    ipcMain.handle('mediaSearch:downloadAndImport', async (_, url: string) => {
        try {
            if (!currentProjectDir) {
                return {success: false, error: 'No project directory'}
            }

            return await downloadAndImportMedia(url, currentProjectDir)
        } catch (error: any) {
            return {success: false, error: error.message}
        }
    })
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
    registerAppMediaProtocol();
    registerIpcHandlers();
    await createWindow();

    if (mainWindow) {
        const menu = buildAppMenu(mainWindow, false);
        Menu.setApplicationMenu(menu)
    }

    app.on('activate', () => {
        if (BrowserWindowCtor.getAllWindows().length === 0) {
            createWindow()
        }
    })
});

app.on('window-all-closed', () => {
    stopAutoSave();
    if (process.platform !== 'darwin') {
        app.quit()
    }
});
