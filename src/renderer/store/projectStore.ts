import { create } from 'zustand'
import type { Page, PageFolder, ProjectSettings, ProjectData, FrameworkChoice, UserBlock, ProjectTheme, CssFile } from './types'
import { generateBlockId, createDefaultTheme } from './types'
import { createPageHeaderBlock } from '../../shared/welcomeBlocks'

// ─── Project State ───────────────────────────────────────────────────────────

interface ProjectState {
  settings: ProjectSettings
  pages: Page[]
  folders: PageFolder[]
  userBlocks: UserBlock[]
  customPresets: ProjectTheme[]  // user-created custom theme presets
  currentPageId: string | null
  filePath: string | null
  isProjectLoaded: boolean
}

interface ProjectActions {
  // Project-level
  setProject: (data: ProjectData, filePath?: string) => void
  closeProject: () => void
  updateSettings: (patch: Partial<ProjectSettings>) => void
  setFramework: (framework: FrameworkChoice) => void
  setFilePath: (path: string | null) => void
  getProjectData: () => ProjectData

  // Theme management
  setProjectTheme: (theme: ProjectTheme) => void
  updateProjectTheme: (patch: Partial<ProjectTheme>) => void
  updateThemeColors: (patch: Partial<ProjectTheme['colors']>) => void
  updateThemeTypography: (patch: Partial<ProjectTheme['typography']>) => void
  updateThemeSpacing: (patch: Partial<ProjectTheme['spacing']>) => void
  updateThemeBorders: (patch: Partial<ProjectTheme['borders']>) => void
  setThemeCustomCss: (css: string) => void

  // Custom preset management
  addCustomPreset: (preset: ProjectTheme) => void
  updateCustomPreset: (name: string, patch: Partial<ProjectTheme>) => void
  deleteCustomPreset: (name: string) => void

  // CSS file management
  addCssFile: (name: string) => CssFile
  removeCssFile: (id: string) => void
  updateCssFile: (id: string, patch: Partial<Omit<CssFile, 'id'>>) => void
  reorderCssFiles: (fromIndex: number, toIndex: number) => void
  toggleCssFile: (id: string) => void

  // Page management
  addPage: (title: string, slug?: string) => Page
  removePage: (id: string) => void
  updatePage: (id: string, patch: Partial<Omit<Page, 'id'>>) => void
  setCurrentPage: (id: string) => void
  getCurrentPage: () => Page | null
  reorderPages: (fromIndex: number, toIndex: number) => void

  // Folder management
  addFolder: (name: string, tags?: string[]) => PageFolder
  removeFolder: (id: string) => void
  updateFolder: (id: string, patch: Partial<Omit<PageFolder, 'id'>>) => void

  // Effective tags (page own tags + folder inherited tags)
  getEffectiveTags: (page: Page) => string[]

  // User Blocks
  addUserBlock: (block: UserBlock) => void
  removeUserBlock: (id: string) => void
}

type ProjectStore = ProjectState & ProjectActions

// ─── Defaults ────────────────────────────────────────────────────────────────

function createDefaultSettings(): ProjectSettings {
  return {
    name: 'Untitled Project',
    framework: 'bootstrap-5',
    theme: createDefaultTheme(),
    globalStyles: {}
  }
}

function createDefaultPage(title = 'Home', slug = 'index'): Page {
  return {
    id: generateBlockId(),
    title,
    slug,
    blocks: [],
    meta: {
      description: '',
      charset: 'UTF-8',
      viewport: 'width=device-width, initial-scale=1.0',
      author: '',
      keywords: '',
      robots: 'index, follow'
    }
  }
}

function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
}

function ensureUniqueSlug(baseSlug: string, pages: Page[]): string {
  const existing = new Set(pages.map((p) => p.slug))
  if (!existing.has(baseSlug)) return baseSlug

  let i = 1
  while (existing.has(`${baseSlug}-${i}`)) i++
  return `${baseSlug}-${i}`
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStore>((set, get) => {
  const defaultPage = createDefaultPage()

  return {
    settings: createDefaultSettings(),
    pages: [defaultPage],
    folders: [],
    userBlocks: [],
    customPresets: [],
    currentPageId: defaultPage.id,
    filePath: null,
    isProjectLoaded: false,

    // ─── Project-level ───────────────────────────────────────────────

    setProject: (data, filePath) => {
      // Backward compatibility: migrate old string theme to ProjectTheme object
      const incoming = data.projectSettings
      const migratedSettings = {
        ...createDefaultSettings(),
        ...incoming,
        theme:
          incoming?.theme && typeof incoming.theme === 'object' && (incoming.theme as ProjectTheme).colors
            ? (incoming.theme as ProjectTheme)
            : createDefaultTheme()
      }

      // Migrate legacy customCss string to customCssFiles
      const theme = migratedSettings.theme
      if (!theme.customCssFiles || theme.customCssFiles.length === 0) {
        if (theme.customCss && theme.customCss.trim().length > 0) {
          theme.customCssFiles = [{
            id: generateBlockId(),
            name: 'Custom Styles',
            css: theme.customCss,
            enabled: true
          }]
        } else {
          theme.customCssFiles = []
        }
      }

      set({
        settings: migratedSettings,
        pages: data.pages.length > 0 ? data.pages : [createDefaultPage()],
        folders: data.folders || [],
        userBlocks: data.userBlocks || [],
        customPresets: (data as any).customPresets || [],
        currentPageId: data.pages.length > 0 ? data.pages[0].id : null,
        filePath: filePath ?? null,
        isProjectLoaded: true
      })
    },

    closeProject: () => {
      const newDefault = createDefaultPage()
      set({
        settings: createDefaultSettings(),
        pages: [newDefault],
        folders: [],
        userBlocks: [],
        customPresets: [],
        currentPageId: newDefault.id,
        filePath: null,
        isProjectLoaded: false
      })
    },

    updateSettings: (patch) => {
      set((state) => ({
        settings: { ...state.settings, ...patch }
      }))
    },

    setFramework: (framework) => {
      set((state) => ({
        settings: { ...state.settings, framework }
      }))
    },

    setFilePath: (path) => {
      set({ filePath: path })
    },

    getProjectData: () => {
      const state = get()
      return {
        projectSettings: state.settings,
        pages: state.pages,
        folders: state.folders,
        userBlocks: state.userBlocks,
        customPresets: state.customPresets
      }
    },

    // ─── Theme management ─────────────────────────────────────────────

    setProjectTheme: (theme) => {
      set((state) => ({
        settings: { ...state.settings, theme }
      }))
    },

    updateProjectTheme: (patch) => {
      set((state) => ({
        settings: { ...state.settings, theme: { ...state.settings.theme, ...patch } }
      }))
    },

    updateThemeColors: (patch) => {
      set((state) => ({
        settings: {
          ...state.settings,
          theme: { ...state.settings.theme, colors: { ...state.settings.theme.colors, ...patch } }
        }
      }))
    },

    updateThemeTypography: (patch) => {
      set((state) => ({
        settings: {
          ...state.settings,
          theme: { ...state.settings.theme, typography: { ...state.settings.theme.typography, ...patch } }
        }
      }))
    },

    updateThemeSpacing: (patch) => {
      set((state) => ({
        settings: {
          ...state.settings,
          theme: { ...state.settings.theme, spacing: { ...state.settings.theme.spacing, ...patch } }
        }
      }))
    },

    updateThemeBorders: (patch) => {
      set((state) => ({
        settings: {
          ...state.settings,
          theme: { ...state.settings.theme, borders: { ...state.settings.theme.borders, ...patch } }
        }
      }))
    },

    setThemeCustomCss: (css) => {
      set((state) => ({
        settings: {
          ...state.settings,
          theme: { ...state.settings.theme, customCss: css }
        }
      }))
    },

    // ─── Custom preset management ────────────────────────────────────

    addCustomPreset: (preset) => {
      set((state) => ({
        customPresets: [...state.customPresets, { ...preset, isCustom: true }]
      }))
    },

    updateCustomPreset: (name, patch) => {
      set((state) => ({
        customPresets: state.customPresets.map((p) =>
          p.name === name ? { ...p, ...patch, isCustom: true } : p
        )
      }))
    },

    deleteCustomPreset: (name) => {
      set((state) => ({
        customPresets: state.customPresets.filter((p) => p.name !== name)
      }))
    },

    // ─── CSS file management ─────────────────────────────────────────

    addCssFile: (name) => {
      const file: CssFile = {
        id: generateBlockId(),
        name,
        css: '',
        enabled: true
      }
      set((state) => ({
        settings: {
          ...state.settings,
          theme: {
            ...state.settings.theme,
            customCssFiles: [...(state.settings.theme.customCssFiles || []), file]
          }
        }
      }))
      return file
    },

    removeCssFile: (id) => {
      set((state) => ({
        settings: {
          ...state.settings,
          theme: {
            ...state.settings.theme,
            customCssFiles: (state.settings.theme.customCssFiles || []).filter((f) => f.id !== id)
          }
        }
      }))
    },

    updateCssFile: (id, patch) => {
      set((state) => ({
        settings: {
          ...state.settings,
          theme: {
            ...state.settings.theme,
            customCssFiles: (state.settings.theme.customCssFiles || []).map((f) =>
              f.id === id ? { ...f, ...patch } : f
            )
          }
        }
      }))
    },

    reorderCssFiles: (fromIndex, toIndex) => {
      set((state) => {
        const files = [...(state.settings.theme.customCssFiles || [])]
        const [moved] = files.splice(fromIndex, 1)
        files.splice(toIndex, 0, moved)
        return {
          settings: {
            ...state.settings,
            theme: { ...state.settings.theme, customCssFiles: files }
          }
        }
      })
    },

    toggleCssFile: (id) => {
      set((state) => ({
        settings: {
          ...state.settings,
          theme: {
            ...state.settings.theme,
            customCssFiles: (state.settings.theme.customCssFiles || []).map((f) =>
              f.id === id ? { ...f, enabled: !f.enabled } : f
            )
          }
        }
      }))
    },

    // ─── Page management ─────────────────────────────────────────────

    addPage: (title, slug) => {
      const state = get()
      const base = normalizeSlug(slug ?? title) || 'page'
      const unique = ensureUniqueSlug(base, state.pages)
      const created = createDefaultPage(title, unique)
      created.blocks = createPageHeaderBlock(title) as any

      set({
        pages: [...state.pages, created],
        currentPageId: created.id
      })

      return created
    },

    removePage: (id) => {
      set((state) => {
        const filtered = state.pages.filter((p) => p.id !== id)
        if (filtered.length === 0) {
          const newPage = createDefaultPage()
          return { pages: [newPage], currentPageId: newPage.id }
        }
        const newCurrentId = state.currentPageId === id ? filtered[0].id : state.currentPageId
        return { pages: filtered, currentPageId: newCurrentId }
      })
    },

    updatePage: (id, patch) => {
      set((state) => ({
        pages: state.pages.map((p) => (p.id === id ? { ...p, ...patch } : p))
      }))
    },

    setCurrentPage: (id) => {
      set({ currentPageId: id })
    },

    getCurrentPage: () => {
      const state = get()
      return state.pages.find((p) => p.id === state.currentPageId) ?? null
    },

    reorderPages: (fromIndex, toIndex) => {
      set((state) => {
        const pages = [...state.pages]
        const [moved] = pages.splice(fromIndex, 1)
        pages.splice(toIndex, 0, moved)
        return { pages }
      })
    },

    // ─── Folder management ───────────────────────────────────────────

    addFolder: (name, tags) => {
      const folder: PageFolder = {
        id: generateBlockId(),
        name,
        tags: tags && tags.length > 0 ? tags : undefined
      }
      set((state) => ({
        folders: [...state.folders, folder]
      }))
      return folder
    },

    removeFolder: (id) => {
      set((state) => ({
        folders: state.folders.filter((f) => f.id !== id),
        // Unset folderId on pages that belonged to this folder
        pages: state.pages.map((p) =>
          p.folderId === id ? { ...p, folderId: undefined } : p
        )
      }))
    },

    updateFolder: (id, patch) => {
      set((state) => ({
        folders: state.folders.map((f) => (f.id === id ? { ...f, ...patch } : f))
      }))
    },

    getEffectiveTags: (page) => {
      const state = get()
      const ownTags = page.tags ?? []
      if (!page.folderId) return ownTags

      const folder = state.folders.find((f) => f.id === page.folderId)
      if (!folder || !folder.tags || folder.tags.length === 0) return ownTags

      // Merge and deduplicate
      return Array.from(new Set([...ownTags, ...folder.tags]))
    },

    // ─── User Blocks ─────────────────────────────────────────────────

    addUserBlock: (block) => {
      set((state) => ({
        userBlocks: [...state.userBlocks, block]
      }))
    },

    removeUserBlock: (id) => {
      set((state) => ({
        userBlocks: state.userBlocks.filter((b) => b.id !== id)
      }))
    }
  }
})
