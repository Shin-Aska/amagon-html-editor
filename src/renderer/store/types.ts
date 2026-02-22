// ─── Core Data Types ─────────────────────────────────────────────────────────

export interface Block {
  id: string
  type: string           // e.g., 'heading', 'image', 'hero-section', 'container'
  tag?: string           // HTML tag override (div, section, article, etc.)
  props: Record<string, unknown>
  styles: Record<string, string>
  classes: string[]
  content?: string       // Raw HTML escape hatch
  children: Block[]
  locked?: boolean
}

export interface Page {
  id: string
  title: string
  slug: string
  blocks: Block[]
  meta: Record<string, string>
}

export interface UserBlock {
  id: string
  label: string
  icon?: string
  content: Block
}

export type FrameworkChoice = 'bootstrap-5' | 'tailwind' | 'vanilla'

export interface ProjectSettings {
  name: string
  framework: FrameworkChoice
  theme: string
  globalStyles: Record<string, string>
}

export interface ProjectData {
  projectSettings: ProjectSettings
  pages: Page[]
  userBlocks: UserBlock[]
  isProjectLoaded?: boolean
}

// ─── Editor State Types ──────────────────────────────────────────────────────

export interface HistoryEntry {
  blocks: Block[]
  timestamp: number
}

export interface EditorState {
  // Block tree for the current page
  blocks: Block[]

  // Selection
  selectedBlockId: string | null
  hoveredBlockId: string | null

  // History (undo/redo)
  history: HistoryEntry[]
  historyIndex: number

  // Dirty flag
  isDirty: boolean

  isDragging: boolean
  isTypingCode: boolean

  customCss: string

  // View state
  viewportMode: 'desktop' | 'tablet' | 'mobile'
  zoom: number
  theme: 'light' | 'dark'
  showLayoutOutlines: boolean

  // Clipboard
  clipboard: Block | null
}

export interface EditorActions {
  // Block mutations
  addBlock: (block: Block, parentId?: string | null, index?: number) => void
  updateBlock: (id: string, patch: Partial<Omit<Block, 'id' | 'children'>>) => void
  moveBlock: (id: string, newParentId: string | null, newIndex: number) => void
  removeBlock: (id: string) => void

  setIsDragging: (value: boolean) => void
  setIsTypingCode: (value: boolean) => void

  setCustomCss: (css: string) => void

  setViewportMode: (mode: 'desktop' | 'tablet' | 'mobile') => void
  setZoom: (zoom: number) => void
  setTheme: (theme: 'light' | 'dark') => void
  setLayoutOutlines: (show: boolean) => void
  setClipboard: (block: Block | null) => void

  // Bulk replace (for code→visual sync)
  setPageBlocks: (blocks: Block[]) => void

  // Selection
  selectBlock: (id: string | null) => void
  hoverBlock: (id: string | null) => void

  // History
  undo: () => void
  redo: () => void

  // Utility
  getBlockById: (id: string) => Block | null
  getBlockPath: (id: string) => string[]
}

// ─── Utility ─────────────────────────────────────────────────────────────────

let _idCounter = 0

export function generateBlockId(): string {
  _idCounter++
  return `blk_${Date.now().toString(36)}_${_idCounter.toString(36)}`
}

export function createBlock(
  type: string,
  overrides?: Partial<Block>
): Block {
  return {
    id: generateBlockId(),
    type,
    props: {},
    styles: {},
    classes: [],
    children: [],
    ...overrides
  }
}
