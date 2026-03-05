// ─── Core Data Types ─────────────────────────────────────────────────────────

export interface Block {
  id: string
  type: string           // e.g., 'heading', 'image', 'hero-section', 'container'
  tag?: string           // HTML tag override (div, section, article, etc.)
  props: Record<string, unknown>
  styles: Record<string, string>
  classes: string[]
  events?: Record<string, string>  // JS event handlers, e.g. { onclick: "alert('hi')" }
  content?: string       // Raw HTML escape hatch
  children: Block[]
  locked?: boolean
}

export interface Page {
  id: string
  title: string
  slug: string
  tags?: string[]
  folderId?: string
  blocks: Block[]
  meta: Record<string, string>
}

export interface PageFolder {
  id: string
  name: string
  tags?: string[]
}

export interface UserBlock {
  id: string
  label: string
  icon?: string
  category?: string
  content: Block
}

export type FrameworkChoice = 'bootstrap-5' | 'tailwind' | 'vanilla'

export type EditorLayout = 'standard' | 'no-sidebar' | 'no-inspector' | 'canvas-only' | 'code-focus' | 'zen'

// ─── Project Theme ────────────────────────────────────────────────────────────

export interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  background: string
  surface: string
  text: string
  textMuted: string
  border: string
  success: string
  warning: string
  danger: string
}

export interface ThemeTypography {
  fontFamily: string
  headingFontFamily: string
  baseFontSize: string        // e.g. '16px'
  lineHeight: string          // e.g. '1.6'
  headingLineHeight: string   // e.g. '1.2'
}

export interface ThemeSpacing {
  baseUnit: string            // e.g. '8px'
  scale: number[]             // multipliers, e.g. [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8]
}

export interface ThemeBorders {
  radius: string              // e.g. '6px'
  width: string               // e.g. '1px'
  color: string               // e.g. '#dee2e6'
}

export interface ProjectTheme {
  name: string
  colors: ThemeColors
  typography: ThemeTypography
  spacing: ThemeSpacing
  borders: ThemeBorders
  customCss: string           // raw CSS appended after variables
}

export function createDefaultTheme(): ProjectTheme {
  return {
    name: 'Default',
    colors: {
      primary: '#1e66f5',
      secondary: '#6c757d',
      accent: '#7c3aed',
      background: '#ffffff',
      surface: '#f8f9fa',
      text: '#212529',
      textMuted: '#6c757d',
      border: '#dee2e6',
      success: '#198754',
      warning: '#ffc107',
      danger: '#dc3545'
    },
    typography: {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      headingFontFamily: 'inherit',
      baseFontSize: '16px',
      lineHeight: '1.6',
      headingLineHeight: '1.2'
    },
    spacing: {
      baseUnit: '8px',
      scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8]
    },
    borders: {
      radius: '6px',
      width: '1px',
      color: '#dee2e6'
    },
    customCss: ''
  }
}

export function themeToCSS(theme: ProjectTheme): string {
  const lines: string[] = []
  lines.push(':root {')

  // Colors
  lines.push(`  --theme-primary: ${theme.colors.primary};`)
  lines.push(`  --theme-secondary: ${theme.colors.secondary};`)
  lines.push(`  --theme-accent: ${theme.colors.accent};`)
  lines.push(`  --theme-bg: ${theme.colors.background};`)
  lines.push(`  --theme-surface: ${theme.colors.surface};`)
  lines.push(`  --theme-text: ${theme.colors.text};`)
  lines.push(`  --theme-text-muted: ${theme.colors.textMuted};`)
  lines.push(`  --theme-border: ${theme.colors.border};`)
  lines.push(`  --theme-success: ${theme.colors.success};`)
  lines.push(`  --theme-warning: ${theme.colors.warning};`)
  lines.push(`  --theme-danger: ${theme.colors.danger};`)

  // Typography
  lines.push(`  --theme-font-family: ${theme.typography.fontFamily};`)
  lines.push(`  --theme-heading-font-family: ${theme.typography.headingFontFamily};`)
  lines.push(`  --theme-font-size: ${theme.typography.baseFontSize};`)
  lines.push(`  --theme-line-height: ${theme.typography.lineHeight};`)
  lines.push(`  --theme-heading-line-height: ${theme.typography.headingLineHeight};`)

  // Spacing
  lines.push(`  --theme-spacing-unit: ${theme.spacing.baseUnit};`)
  const unit = parseFloat(theme.spacing.baseUnit) || 8
  const unitSuffix = theme.spacing.baseUnit.replace(/[\d.]+/, '') || 'px'
  theme.spacing.scale.forEach((mult, i) => {
    lines.push(`  --theme-space-${i}: ${mult * unit}${unitSuffix};`)
  })

  // Borders
  lines.push(`  --theme-border-radius: ${theme.borders.radius};`)
  lines.push(`  --theme-border-width: ${theme.borders.width};`)
  lines.push(`  --theme-border-color: ${theme.borders.color};`)

  lines.push('}')

  // Base body styles using theme variables
  lines.push('')
  lines.push('body {')
  lines.push('  font-family: var(--theme-font-family);')
  lines.push('  font-size: var(--theme-font-size);')
  lines.push('  line-height: var(--theme-line-height);')
  lines.push('  color: var(--theme-text);')
  lines.push('  background-color: var(--theme-bg);')
  lines.push('}')
  lines.push('')
  lines.push('h1, h2, h3, h4, h5, h6 {')
  lines.push('  font-family: var(--theme-heading-font-family);')
  lines.push('  line-height: var(--theme-heading-line-height);')
  lines.push('}')

  // Append custom CSS
  if (theme.customCss.trim()) {
    lines.push('')
    lines.push(theme.customCss.trim())
  }

  return lines.join('\n')
}

// ─── Project Settings ─────────────────────────────────────────────────────────

export interface ProjectSettings {
  name: string
  framework: FrameworkChoice
  theme: ProjectTheme
  globalStyles: Record<string, string>
}

export interface ProjectData {
  projectSettings: ProjectSettings
  pages: Page[]
  folders?: PageFolder[]
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
  editorLayout: EditorLayout

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

  // Editor layout preference
  setEditorLayout: (layout: EditorLayout) => void
  setPageBlocks: (blocks: Block[]) => void

  // Load blocks for page switching / project load (should reset selection + history without marking dirty)
  loadPageBlocks: (blocks: Block[]) => void

  // Mark the current state as saved (clears dirty indicator)
  markSaved: () => void

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
    events: {},
    children: [],
    ...overrides
  }
}
