import { create } from 'zustand'
import type { Page, ProjectSettings, ProjectData, FrameworkChoice, UserBlock } from './types'
import { generateBlockId } from './types'

// ─── Project State ───────────────────────────────────────────────────────────

interface ProjectState {
  settings: ProjectSettings
  pages: Page[]
  userBlocks: UserBlock[]
  currentPageId: string | null
  filePath: string | null
  isProjectLoaded: boolean
}

interface ProjectActions {
  // Project-level
  setProject: (data: ProjectData, filePath?: string) => void
  updateSettings: (patch: Partial<ProjectSettings>) => void
  setFramework: (framework: FrameworkChoice) => void
  setFilePath: (path: string | null) => void
  getProjectData: () => ProjectData

  // Page management
  addPage: (title: string, slug?: string) => Page
  removePage: (id: string) => void
  updatePage: (id: string, patch: Partial<Omit<Page, 'id'>>) => void
  setCurrentPage: (id: string) => void
  getCurrentPage: () => Page | null
  reorderPages: (fromIndex: number, toIndex: number) => void

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
    theme: 'default',
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
      viewport: 'width=device-width, initial-scale=1.0'
    }
  }
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStore>((set, get) => {
  const defaultPage = createDefaultPage()

  return {
    settings: createDefaultSettings(),
    pages: [defaultPage],
    userBlocks: [],
    currentPageId: defaultPage.id,
    filePath: null,
    isProjectLoaded: false,

    // ─── Project-level ───────────────────────────────────────────────

    setProject: (data, filePath) => {
      set({
        settings: { ...createDefaultSettings(), ...data.projectSettings },
        pages: data.pages.length > 0 ? data.pages : [createDefaultPage()],
        userBlocks: data.userBlocks || [],
        currentPageId: data.pages.length > 0 ? data.pages[0].id : null,
        filePath: filePath ?? null,
        isProjectLoaded: true
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
        userBlocks: state.userBlocks
      }
    },

    // ─── Page management ─────────────────────────────────────────────

    addPage: (title, slug) => {
      const page = createDefaultPage(title, slug ?? title.toLowerCase().replace(/\s+/g, '-'))
      set((state) => ({
        pages: [...state.pages, page],
        currentPageId: page.id
      }))
      return page
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
