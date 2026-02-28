import * as electron from 'electron'
import type { BrowserWindow } from 'electron'
import * as path from 'path'
import * as fs from 'fs/promises'
import { existsSync, createReadStream } from 'fs'
import { fileURLToPath } from 'url'
import { chat as aiChat, loadConfig as aiLoadConfig, saveConfig as aiSaveConfig, PROVIDER_MODELS, fetchAvailableModels, fetchModelsForProvider, buildSystemPrompt, maskApiKey, MASKED_KEY_PREFIX, type ChatMessage } from './aiService'

const { app, ipcMain, protocol, dialog, shell, net } = electron
const BrowserWindowCtor = electron.BrowserWindow

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
let currentProjectDir: string | null = null
let autoSaveTimer: ReturnType<typeof setInterval> | null = null

const RECENT_PROJECTS_KEY = 'recent-projects'
const MAX_RECENT = 10

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
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
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
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.pdf': 'application/pdf'
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return MIME_MAP[ext] || 'application/octet-stream'
}

// ---------------------------------------------------------------------------
// Security: path traversal prevention
// ---------------------------------------------------------------------------

function isPathSafe(requestedPath: string, allowedBase: string): boolean {
  const resolved = path.resolve(requestedPath)
  const base = path.resolve(allowedBase)
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
    const filePath = await getRecentProjectsPath()
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function addRecentProject(projectPath: string): Promise<void> {
  const recents = await loadRecentProjects()
  const filtered = recents.filter((p) => p !== projectPath)
  filtered.unshift(projectPath)
  if (filtered.length > MAX_RECENT) filtered.length = MAX_RECENT
  const filePath = await getRecentProjectsPath()
  await fs.writeFile(filePath, JSON.stringify(filtered), 'utf-8')
}

async function removeRecentProject(projectPath: string): Promise<string[]> {
  const recents = await loadRecentProjects()
  const filtered = recents.filter((p) => p !== projectPath)
  const filePath = await getRecentProjectsPath()
  await fs.writeFile(filePath, JSON.stringify(filtered), 'utf-8')
  return filtered
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
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  // In development, load from the Vite dev server
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
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
    const url = new URL(request.url)

    let filePath: string

    if (url.hostname === 'project-asset') {
      // Relative to the current project directory
      if (!currentProjectDir) {
        return new Response('No project directory set', { status: 400 })
      }
      const relativePath = decodeURIComponent(url.pathname).replace(/^\//, '')
      filePath = path.join(currentProjectDir, relativePath)

      // Security: ensure the resolved path stays inside the project dir
      if (!isPathSafe(filePath, currentProjectDir)) {
        return new Response('Forbidden: path traversal detected', { status: 403 })
      }
    } else if (url.hostname === 'absolute') {
      // Absolute path (used during development / for images outside project)
      filePath = decodeURIComponent(url.pathname)
      // On Windows, pathname starts with / before drive letter; strip it
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1)
      }
    } else {
      // Legacy / fallback: treat entire URL path as absolute
      filePath = decodeURIComponent(url.pathname)
      if (url.hostname) {
        filePath = path.join(url.hostname, filePath)
      }
      if (process.platform !== 'win32') {
        filePath = '/' + filePath
      }
    }

    // Check file exists
    if (!existsSync(filePath)) {
      return new Response('File not found', { status: 404 })
    }

    // Read and serve with correct MIME type
    try {
      const data = await fs.readFile(filePath)
      const mimeType = getMimeType(filePath)
      return new Response(data, {
        headers: { 'Content-Type': mimeType }
      })
    } catch (err: any) {
      return new Response(`Error reading file: ${err.message}`, { status: 500 })
    }
  })
}

// ---------------------------------------------------------------------------
// Auto-save  (Task 8.2 sub-feature)
// ---------------------------------------------------------------------------

function startAutoSave(intervalMs: number = 60_000): void {
  stopAutoSave()
  autoSaveTimer = setInterval(() => {
    if (mainWindow && currentProjectDir) {
      mainWindow.webContents.send('auto-save-tick')
    }
  }, intervalMs)
}

function stopAutoSave(): void {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer)
    autoSaveTimer = null
  }
}

// ---------------------------------------------------------------------------
// IPC Handlers  (Tasks 8.2 – 8.5)
// ---------------------------------------------------------------------------

function registerIpcHandlers(): void {
  // ── 8.2  Project Save ────────────────────────────────────────────────────

  ipcMain.handle(
    'project:save',
    async (_, data: { filePath?: string; content: string }) => {
      try {
        let targetPath = data.filePath

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
          const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
            title: 'Save Project',
            defaultPath: path.join(
              app.getPath('documents'),
              'project.json'
            ),
            filters: [{ name: 'Amagon Project', extensions: ['json'] }]
          })
          if (canceled || !filePath) return { success: false, canceled: true }
          targetPath = filePath
        }

        // Ensure the parent directory exists
        await fs.mkdir(path.dirname(targetPath), { recursive: true })
        await fs.writeFile(targetPath, data.content, 'utf-8')

        // Update current project dir
        currentProjectDir = path.dirname(targetPath)
        await addRecentProject(targetPath)

        // Ensure assets/ subfolder exists
        const assetsDir = path.join(currentProjectDir, 'assets')
        await fs.mkdir(assetsDir, { recursive: true })

        return { success: true, filePath: targetPath }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  // ── Save As (always shows dialog) ─────────────────────────────────────

  ipcMain.handle(
    'project:saveAs',
    async (_, data: { content: string }) => {
      try {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
          title: 'Save Project As',
          defaultPath: path.join(app.getPath('documents'), 'project.json'),
          filters: [{ name: 'Amagon Project', extensions: ['json'] }]
        })
        if (canceled || !filePath) return { success: false, canceled: true }

        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, data.content, 'utf-8')

        currentProjectDir = path.dirname(filePath)
        await addRecentProject(filePath)

        const assetsDir = path.join(currentProjectDir, 'assets')
        await fs.mkdir(assetsDir, { recursive: true })

        return { success: true, filePath }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  // ── 8.3  Project Load ────────────────────────────────────────────────────

  ipcMain.handle('project:load', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
        title: 'Open Project',
        filters: [{ name: 'Amagon Project', extensions: ['json'] }],
        properties: ['openFile']
      })

      if (canceled || filePaths.length === 0) {
        return { success: false, canceled: true }
      }

      const filePath = filePaths[0]
      const raw = await fs.readFile(filePath, 'utf-8')
      const content = JSON.parse(raw)

      // Basic schema validation
      if (!content.projectSettings || !content.pages) {
        return {
          success: false,
          error:
            'Invalid project file: missing projectSettings or pages. Make sure you selected a valid .json project file.'
        }
      }

      currentProjectDir = path.dirname(filePath)
      await addRecentProject(filePath)
      startAutoSave()

      return { success: true, filePath, content }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ── Load specific file path (for recent projects) ─────────────────────

  ipcMain.handle('project:loadFile', async (_, filePath: string) => {
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      const content = JSON.parse(raw)

      if (!content.projectSettings || !content.pages) {
        return { success: false, error: 'Invalid project file format.' }
      }

      currentProjectDir = path.dirname(filePath)
      await addRecentProject(filePath)
      startAutoSave()

      return { success: true, filePath, content }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ── Recent projects list ──────────────────────────────────────────────

  ipcMain.handle('project:getRecent', async () => {
    try {
      const recents = await loadRecentProjects()
      // Filter out projects whose files no longer exist
      const valid = recents.filter((p) => existsSync(p))
      return { success: true, projects: valid }
    } catch (error: any) {
      return { success: false, error: error.message, projects: [] }
    }
  })

  ipcMain.handle('project:removeRecent', async (_, projectPath: string) => {
    try {
      const updated = await removeRecentProject(projectPath)
      return { success: true, projects: updated }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ── Export HTML ────────────────────────────────────────────────────────

  ipcMain.handle(
    'project:exportHtml',
    async (_, data: { html: string; defaultPath?: string }) => {
      try {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
          title: 'Export HTML',
          defaultPath: path.join(
            app.getPath('documents'),
            data.defaultPath || 'index.html'
          ),
          filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }]
        })

        if (canceled || !filePath) return { success: false, canceled: true }

        await fs.writeFile(filePath, data.html, 'utf-8')
        return { success: true, filePath }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

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
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
          title: 'Choose Export Directory',
          defaultPath: app.getPath('documents'),
          properties: ['openDirectory', 'createDirectory']
        })

        if (canceled || filePaths.length === 0) return { success: false, canceled: true }

        const baseDir = filePaths[0]
        const dirName = (data.defaultDirName || '').trim()
        const exportDir = dirName ? path.join(baseDir, dirName) : baseDir

        await fs.mkdir(exportDir, { recursive: true })

        const total = Array.isArray(data.files) ? data.files.length : 0
        let written = 0

        for (const file of data.files || []) {
          const rel = String(file.path || '').replace(/^[/\\]+/, '')
          if (!rel) continue

          if (path.isAbsolute(rel)) {
            continue
          }

          const normalizedRel = path.normalize(rel)
          const targetPath = path.join(exportDir, normalizedRel)

          if (!isPathSafe(targetPath, exportDir)) {
            continue
          }

          await fs.mkdir(path.dirname(targetPath), { recursive: true })

          const content: any = (file as any).content
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

          written++
          if (mainWindow) {
            mainWindow.webContents.send('project:exportProgress', {
              written,
              total,
              path: normalizedRel
            })
          }
        }

        const previewRel = (data.previewFile || 'index.html').replace(/^[/\\]+/, '')
        const previewPath = path.join(exportDir, path.normalize(previewRel))
        const safePreview = isPathSafe(previewPath, exportDir) ? previewPath : undefined

        return { success: true, directory: exportDir, previewPath: safePreview }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  // ── Preview (open exported HTML in default browser) ────────────────────

  ipcMain.handle('project:openInBrowser', async (_, filePath: string) => {
    try {
      const target = String(filePath || '')
      if (!target) return { success: false, error: 'No file path provided' }
      const err = await shell.openPath(target)
      if (err) return { success: false, error: err }
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ── 8.4  Asset Management ─────────────────────────────────────────────

  ipcMain.handle('assets:selectImage', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
        title: 'Select Image(s)',
        filters: [
          {
            name: 'Images',
            extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
          }
        ],
        properties: ['openFile', 'multiSelections']
      })

      if (canceled || filePaths.length === 0) {
        return { success: false, canceled: true }
      }

      // If we have a project directory, copy assets into project assets/ folder
      const resultPaths: string[] = []

      if (currentProjectDir) {
        const assetsDir = path.join(currentProjectDir, 'assets')
        await fs.mkdir(assetsDir, { recursive: true })

        for (const srcPath of filePaths) {
          const filename = path.basename(srcPath)
          let destPath = path.join(assetsDir, filename)

          // Handle duplicates by appending a counter
          let counter = 1
          while (existsSync(destPath)) {
            const ext = path.extname(filename)
            const base = path.basename(filename, ext)
            destPath = path.join(assetsDir, `${base}-${counter}${ext}`)
            counter++
          }

          await fs.copyFile(srcPath, destPath)

          // Return an app-media URL that references the project asset
          const relativePath = path.relative(currentProjectDir, destPath)
          resultPaths.push(`app-media://project-asset/${relativePath}`)
        }
      } else {
        // No project yet — return absolute app-media paths
        for (const srcPath of filePaths) {
          resultPaths.push(`app-media://absolute/${srcPath}`)
        }
      }

      return { success: true, filePaths: resultPaths }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ── List project assets ───────────────────────────────────────────────

  ipcMain.handle('assets:list', async () => {
    try {
      if (!currentProjectDir) {
        return { success: true, assets: [] }
      }

      const assetsDir = path.join(currentProjectDir, 'assets')
      if (!existsSync(assetsDir)) {
        return { success: true, assets: [] }
      }

      const entries = await fs.readdir(assetsDir, { withFileTypes: true })
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']
      const assets = entries
        .filter(
          (e) =>
            e.isFile() &&
            imageExts.includes(path.extname(e.name).toLowerCase())
        )
        .map((e) => {
          const relativePath = `assets/${e.name}`
          return {
            name: e.name,
            path: `app-media://project-asset/${relativePath}`,
            relativePath
          }
        })

      return { success: true, assets }
    } catch (error: any) {
      return { success: false, error: error.message, assets: [] }
    }
  })

  // ── Delete an asset ───────────────────────────────────────────────────

  ipcMain.handle('assets:delete', async (_, relativePath: string) => {
    try {
      if (!currentProjectDir) {
        return { success: false, error: 'No project directory set' }
      }

      const fullPath = path.join(currentProjectDir, relativePath)

      // Security check
      if (!isPathSafe(fullPath, currentProjectDir)) {
        return { success: false, error: 'Path traversal detected' }
      }

      if (!existsSync(fullPath)) {
        return { success: false, error: 'File not found' }
      }

      await fs.unlink(fullPath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ── Read asset as base64 (for preview / export) ───────────────────────

  ipcMain.handle('assets:readAsset', async (_, assetPath: string) => {
    try {
      let filePath: string

      if (assetPath.startsWith('app-media://project-asset/')) {
        if (!currentProjectDir) {
          return { success: false, error: 'No project directory' }
        }
        const rel = assetPath.replace('app-media://project-asset/', '')
        filePath = path.join(currentProjectDir, decodeURIComponent(rel))
      } else if (assetPath.startsWith('app-media://absolute/')) {
        filePath = decodeURIComponent(
          assetPath.replace('app-media://absolute/', '')
        )
      } else {
        filePath = assetPath
      }

      const data = await fs.readFile(filePath)
      const mime = getMimeType(filePath)
      const base64 = data.toString('base64')

      return {
        success: true,
        data: `data:${mime};base64,${base64}`,
        mimeType: mime
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // ── 8.5  New Project ──────────────────────────────────────────────────

  ipcMain.handle(
    'project:new',
    async (
      _,
      data: { name: string; framework: string; directory?: string }
    ) => {
      try {
        let projectDir = data.directory

        if (!projectDir) {
          const { canceled, filePaths } = await dialog.showOpenDialog(
            mainWindow!,
            {
              title: 'Choose Project Location',
              properties: ['openDirectory', 'createDirectory']
            }
          )
          if (canceled || filePaths.length === 0) {
            return { success: false, canceled: true }
          }
          projectDir = path.join(filePaths[0], data.name.replace(/\s+/g, '-').toLowerCase())
        }

        // Create directory structure
        await fs.mkdir(projectDir, { recursive: true })
        await fs.mkdir(path.join(projectDir, 'assets'), { recursive: true })

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
              spacing: { baseUnit: '8px', scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8] },
              borders: { radius: '6px', width: '1px', color: '#dee2e6' },
              customCss: ''
            },
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

        const filePath = path.join(projectDir, 'project.json')
        await fs.writeFile(filePath, JSON.stringify(projectData, null, 2), 'utf-8')

        currentProjectDir = projectDir
        await addRecentProject(filePath)
        startAutoSave()

        return { success: true, filePath, content: projectData }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  // ── Auto-save configuration ───────────────────────────────────────────

  ipcMain.handle('autosave:start', (_, intervalMs?: number) => {
    startAutoSave(intervalMs || 60_000)
    return { success: true }
  })

  ipcMain.handle('autosave:stop', () => {
    stopAutoSave()
    return { success: true }
  })

  // ── Get current project directory ─────────────────────────────────────

  ipcMain.handle('project:getDir', () => {
    return { success: true, directory: currentProjectDir }
  })

  // ── Copy asset into project (for drag-in from external) ───────────────

  ipcMain.handle('assets:import', async (_, srcPath: string) => {
    try {
      if (!currentProjectDir) {
        return { success: false, error: 'No project directory' }
      }

      const assetsDir = path.join(currentProjectDir, 'assets')
      await fs.mkdir(assetsDir, { recursive: true })

      const filename = path.basename(srcPath)
      let destPath = path.join(assetsDir, filename)

      let counter = 1
      while (existsSync(destPath)) {
        const ext = path.extname(filename)
        const base = path.basename(filename, ext)
        destPath = path.join(assetsDir, `${base}-${counter}${ext}`)
        counter++
      }

      await fs.copyFile(srcPath, destPath)
      const relativePath = path.relative(currentProjectDir, destPath)

      return {
        success: true,
        path: `app-media://project-asset/${relativePath}`,
        relativePath
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

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
        let messages = data.messages
        if (data.blockRegistry) {
          const systemPrompt = buildSystemPrompt(data.blockRegistry, data.themeContext)
          messages = [
            { role: 'system' as const, content: systemPrompt },
            ...messages.filter((m) => m.role !== 'system')
          ]
        }

        const result = await aiChat(messages, data.config)
        if (result.error) {
          return { success: false, error: result.error }
        }
        return { success: true, content: result.content }
      } catch (error: any) {
        return { success: false, error: error.message }
      }
    }
  )

  ipcMain.handle('ai:getConfig', async () => {
    try {
      const config = await aiLoadConfig()
      // Never send the raw API key to the renderer — mask it
      return {
        success: true,
        config: {
          ...config,
          apiKey: maskApiKey(config.apiKey)
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('ai:setConfig', async (_, config: any) => {
    try {
      const configToSave = { ...config }
      // If the renderer sent back a masked key, the user didn't change it
      if (configToSave.apiKey && configToSave.apiKey.startsWith(MASKED_KEY_PREFIX)) {
        delete configToSave.apiKey  // preserve existing encrypted key
      }
      const saved = await aiSaveConfig(configToSave)
      return {
        success: true,
        config: {
          ...saved,
          apiKey: maskApiKey(saved.apiKey)
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('ai:getModels', async () => {
    try {
      const models = await fetchAvailableModels()
      return { success: true, models }
    } catch {
      // Fall back to static list if dynamic fetch fails entirely
      return { success: true, models: PROVIDER_MODELS }
    }
  })

  ipcMain.handle('ai:fetchModelsForProvider', async (_event, data: { provider: string; apiKey: string; ollamaUrl?: string }) => {
    try {
      let apiKeyToUse = data.apiKey || ''
      if (apiKeyToUse && apiKeyToUse.startsWith(MASKED_KEY_PREFIX)) {
        const saved = await aiLoadConfig()
        apiKeyToUse = saved.provider === data.provider ? saved.apiKey : ''
      } else if (!apiKeyToUse) {
        const saved = await aiLoadConfig()
        apiKeyToUse = saved.provider === data.provider ? saved.apiKey : ''
      }

      const models = await fetchModelsForProvider(data.provider as any, apiKeyToUse, data.ollamaUrl)
      return { success: true, models }
    } catch (error: any) {
      return { success: false, error: error.message, models: [] }
    }
  })
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  registerAppMediaProtocol()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindowCtor.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopAutoSave()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
