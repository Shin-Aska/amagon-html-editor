import { useState, useEffect } from 'react'
import {
  Menu,
  FilePlus,
  FolderOpen,
  Save,
  Download,
  Undo,
  Redo,
  Scissors,
  Copy,
  Clipboard,
  Trash2,
  Monitor,
  Tablet,
  Smartphone,
  ZoomIn,
  ZoomOut,
  Moon,
  Sun,
  Code,
  Settings,
  Image as ImageIcon,
  FileType,
  Layout,
  PanelLeft,
  PanelRight,
  Palette,
  KeyRound,
  Menu as MenuIcon,
  ChevronDown
} from 'lucide-react'
import { getApi } from '../../utils/api'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { useToastStore } from '../../store/toastStore'
import { createBlock } from '../../store/types'
import type { Block, EditorLayout } from '../../store/types'
import AssetManager from '../AssetManager/AssetManager'
import CredentialManager from '../CredentialManager/CredentialManager'
import NewProjectWizard from '../NewProjectWizard/NewProjectWizard'
import ExportDialog from '../ExportDialog/ExportDialog'
import SettingsDialog from '../SettingsDialog/SettingsDialog'
import './Toolbar.css'

interface ToolbarProps {
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  codeEditorOpen: boolean
  editorLayout: EditorLayout
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
  onToggleCodeEditor: () => void
  onSetEditorLayout: (layout: EditorLayout) => void
  onOpenThemeEditor: () => void
}

export default function Toolbar({
  leftPanelOpen,
  rightPanelOpen,
  codeEditorOpen,
  editorLayout,
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleCodeEditor,
  onSetEditorLayout,
  onOpenThemeEditor
}: ToolbarProps): JSX.Element {
  const api = getApi()

  const showToast = useToastStore((s) => s.showToast)
  
  // Project Store
  const getProjectData = useProjectStore((s) => s.getProjectData)
  const setProject = useProjectStore((s) => s.setProject)
  const filePath = useProjectStore((s) => s.filePath)
  const setFilePath = useProjectStore((s) => s.setFilePath)
  const currentPageId = useProjectStore((s) => s.currentPageId)
  const projectName = useProjectStore((s) => s.settings.name)
  const updateSettings = useProjectStore((s) => s.updateSettings)
  const updatePage = useProjectStore((s) => s.updatePage)

  // Editor Store
  const editorBlocks = useEditorStore((s) => s.blocks)
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
  const customCss = useEditorStore((s) => s.customCss)
  const viewportMode = useEditorStore((s) => s.viewportMode)
  const zoom = useEditorStore((s) => s.zoom)
  const theme = useEditorStore((s) => s.theme)
  const showLayoutOutlines = useEditorStore((s) => s.showLayoutOutlines)
  const markSaved = useEditorStore((s) => s.markSaved)
  const setCustomCss = useEditorStore((s) => s.setCustomCss)
  
  const addBlock = useEditorStore((s) => s.addBlock)
  const removeBlock = useEditorStore((s) => s.removeBlock)
  const setPageBlocks = useEditorStore((s) => s.setPageBlocks)
  const setViewportMode = useEditorStore((s) => s.setViewportMode)
  const setZoom = useEditorStore((s) => s.setZoom)
  const setTheme = useEditorStore((s) => s.setTheme)
  const setLayoutOutlines = useEditorStore((s) => s.setLayoutOutlines)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const getBlockById = useEditorStore((s) => s.getBlockById)

  const [showAssetManager, setShowAssetManager] = useState(false)
  const [showCredentialManager, setShowCredentialManager] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState(projectName)
  const [isSaving, setIsSaving] = useState(false)
  const [showLayoutMenu, setShowLayoutMenu] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [editingZoom, setEditingZoom] = useState(false)
  const [tempZoom, setTempZoom] = useState(String(zoom))

  // Store access for pages (read-only for display)
  const currentPage = useProjectStore((s) => s.getCurrentPage())

  // Sync temp name when project name changes
  useEffect(() => {
    setTempName(projectName)
  }, [projectName])

  // Auto-save listener
  useEffect(() => {
    const cleanup = api.autosave.onTick(() => {
      handleSave(true)
    })
    return cleanup
  }, [filePath, currentPageId])

  const ensureBackendReadyAndFlushEdits = async (): Promise<boolean> => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
    const isElectron = /electron/i.test(ua)
    if (isElectron && !window.api) {
      showToast('Electron backend not available (window.api missing)', 'error')
      return false
    }

    const active = document.activeElement as HTMLElement | null
    active?.blur?.()
    await new Promise((r) => setTimeout(r, 0))

    // If the user is typing in the code editor, wait for the debounce commit.
    // (HTML parse debounce is 800ms; CSS debounce is 500ms.)
    if (useEditorStore.getState().isTypingCode) {
      await new Promise((r) => setTimeout(r, 900))
    }
    return true
  }

  const handleSave = async (silent = false): Promise<void> => {
    if (isSaving) return
    setIsSaving(true)

    try {
      const ok = await ensureBackendReadyAndFlushEdits()
      if (!ok) return

      const editorState = useEditorStore.getState()
      const projectState = useProjectStore.getState()
      const pageId = projectState.currentPageId

      const pages = projectState.pages.map((p) =>
        pageId && p.id === pageId ? { ...p, blocks: editorState.blocks } : p
      )

      const content = JSON.stringify(
        {
          projectSettings: projectState.settings,
          pages,
          folders: projectState.folders,
          userBlocks: projectState.userBlocks,
          customCss: editorState.customCss
        },
        null,
        2
      )

      if (pageId) {
        projectState.updatePage(pageId, { blocks: editorState.blocks })
      }

      const result = await api.project.save({
        filePath: projectState.filePath || undefined,
        content
      })

      if (result.success) {
        markSaved()
        if (result.filePath && result.filePath !== projectState.filePath) {
          projectState.setFilePath(result.filePath)
        }
        if (!silent) {
          const shownPath = (result.filePath || projectState.filePath || '').toString()
          showToast(shownPath ? `Saved: ${shownPath}` : 'Saved', 'success')
        }
      } else if (!result.canceled) {
        if (!silent) showToast(result.error || 'Save failed', 'error')
      }
    } catch (err) {
      if (!silent) showToast(String(err), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLoad = async (): Promise<void> => {
    const result = await api.project.load()
    if (result.success && result.content) {
      setProject(result.content as any, result.filePath)
      const data = result.content as any
      const firstPage = Array.isArray(data.pages) ? data.pages[0] : null
      if (firstPage && Array.isArray(firstPage.blocks)) {
        useEditorStore.getState().loadPageBlocks(firstPage.blocks)
      }
      setCustomCss(typeof data.customCss === 'string' ? data.customCss : '')
      markSaved()
      showToast('Project loaded', 'success')
    } else if (!result.canceled) {
      showToast(result.error || 'Load failed', 'error')
    }
  }

  const handleExport = async (): Promise<void> => {
    const ok = await ensureBackendReadyAndFlushEdits()
    if (!ok) return
    if (currentPageId) {
      updatePage(currentPageId, { blocks: useEditorStore.getState().blocks })
    }
    setShowExport(true)
  }

  const handleCopyHtml = async (): Promise<void> => {
    try {
      const ok = await ensureBackendReadyAndFlushEdits()
      if (!ok) return
      if (currentPageId) {
        updatePage(currentPageId, { blocks: useEditorStore.getState().blocks })
      }
      const projectData = getProjectData()
      const { exportProject } = await import('../../utils/exportEngine')

      const files = await exportProject(projectData, {
        customCss,
        onlyPageId: currentPageId || undefined,
        inlineCss: true,
        inlineAssets: true,
        includeJs: true,
        minify: false
      })

      const htmlFile = files.find((f) => f.path.endsWith('.html'))
      const html = htmlFile && typeof htmlFile.content === 'string' ? htmlFile.content : ''
      if (!html) return

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(html)
        console.log('Copied HTML to clipboard')
        return
      }

      const el = document.createElement('textarea')
      el.value = html
      el.style.position = 'fixed'
      el.style.left = '-9999px'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      console.log('Copied HTML to clipboard')
    } catch (err) {
      console.error('Copy HTML failed:', err)
    }
  }

  // Simple clipboard implementation (memory-only for now)
  const [clipboard, setClipboard] = useState<Block | null>(null)

  const handleCopy = () => {
    if (selectedBlockId) {
      const block = getBlockById(selectedBlockId)
      if (block) {
        setClipboard(block)
      }
    }
  }

  const handleCut = () => {
    if (selectedBlockId) {
      const block = getBlockById(selectedBlockId)
      if (block) {
        setClipboard(block)
        removeBlock(selectedBlockId)
      }
    }
  }

  const handlePaste = () => {
    if (clipboard) {
      // Clone the clipboard block to generate new IDs
      const cloneBlock = (b: Block): Block => {
        return createBlock(b.type, {
          props: { ...b.props },
          styles: { ...b.styles },
          classes: [...b.classes],
          content: b.content,
          children: b.children.map(cloneBlock)
        })
      }
      
      const newBlock = cloneBlock(clipboard)
      addBlock(newBlock, selectedBlockId) // Add as child of selected, or root
    }
  }

  const handleDelete = () => {
    if (selectedBlockId) {
      removeBlock(selectedBlockId)
    }
  }

  // Name Editing
  const saveName = () => {
    updateSettings({ name: tempName })
    setEditingName(false)
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveName()
    if (e.key === 'Escape') {
      setTempName(projectName)
      setEditingName(false)
    }
  }

  // Zoom editing handlers
  const commitZoom = () => {
    const parsed = parseInt(tempZoom, 10)
    if (!isNaN(parsed)) {
      setZoom(parsed)
    }
    setEditingZoom(false)
  }

  const handleZoomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitZoom()
    if (e.key === 'Escape') {
      setTempZoom(String(zoom))
      setEditingZoom(false)
    }
  }

  // Keep tempZoom in sync when zoom changes externally
  useEffect(() => {
    if (!editingZoom) setTempZoom(String(zoom))
  }, [zoom, editingZoom])

  return (
    <>
      <div className="toolbar">
        {/* LEFT: Menu, Name + Mobile Hamburger */}
        <div className="toolbar-section toolbar-left">
          <button
            className={`toolbar-btn ${leftPanelOpen ? 'active' : ''}`}
            onClick={onToggleLeftPanel}
            title="Toggle Widgets Panel"
            aria-label="Toggle left sidebar panel"
            aria-pressed={leftPanelOpen}
          >
            <Menu size={16} aria-hidden="true" />
          </button>
          
          <div className="toolbar-divider" />
          
          {editingName ? (
            <input
              className="toolbar-input-name"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={saveName}
              onKeyDown={handleNameKeyDown}
              autoFocus
            />
          ) : (
            <span
              className="toolbar-title"
              onClick={() => setEditingName(true)}
              title="Click to rename"
            >
              {projectName || 'Untitled Project'}
            </span>
          )}

          <button
            className="toolbar-btn toolbar-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            title="Toggle menu"
            aria-label="Toggle toolbar menu"
            aria-expanded={mobileMenuOpen}
          >
            <ChevronDown size={16} aria-hidden="true" style={{ transform: mobileMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {/* Collapsible sections (hidden on mobile unless hamburger is open) */}
        <div className={`toolbar-collapsible ${mobileMenuOpen ? 'open' : ''}`}>

        {/* LEFT-CENTER: File & Edit Operations */}
        <div className="toolbar-section">
          <button className="toolbar-btn" onClick={() => setShowNewProject(true)} title="New Project" aria-label="Create new project">
            <FilePlus size={16} aria-hidden="true" />
          </button>
          <button className="toolbar-btn" onClick={handleLoad} title="Open Project (Ctrl+O)" aria-label="Open existing project">
            <FolderOpen size={16} aria-hidden="true" />
          </button>
          <button className="toolbar-btn" onClick={() => handleSave()} disabled={isSaving} title="Save Project (Ctrl+S)" aria-label="Save project">
            <Save size={16} aria-hidden="true" />
          </button>
          <button className="toolbar-btn" onClick={handleExport} title="Export" aria-label="Export project">
            <Download size={16} aria-hidden="true" />
          </button>
          
          <div className="toolbar-divider" />
          
          <button className="toolbar-btn" onClick={undo} title="Undo (Ctrl+Z)" aria-label="Undo last action">
            <Undo size={16} aria-hidden="true" />
          </button>
          <button className="toolbar-btn" onClick={redo} title="Redo (Ctrl+Y)" aria-label="Redo last undone action">
            <Redo size={16} aria-hidden="true" />
          </button>
          <button className="toolbar-btn" onClick={handleCut} disabled={!selectedBlockId} title="Cut" aria-label="Cut selected block">
            <Scissors size={16} aria-hidden="true" />
          </button>
          <button className="toolbar-btn" onClick={handleCopy} disabled={!selectedBlockId} title="Copy" aria-label="Copy selected block">
            <Copy size={16} aria-hidden="true" />
          </button>
          <button className="toolbar-btn" onClick={handlePaste} disabled={!clipboard} title="Paste" aria-label="Paste block from clipboard">
            <Clipboard size={16} aria-hidden="true" />
          </button>
          <button className="toolbar-btn" onClick={handleDelete} disabled={!selectedBlockId} title="Delete" aria-label="Delete selected block">
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>

        {/* CENTER: Viewport & Zoom */}
        <div className="toolbar-section toolbar-center">
          <div className="toolbar-group">
            <button
              className={`toolbar-btn ${viewportMode === 'desktop' ? 'active' : ''}`}
              onClick={() => setViewportMode('desktop')}
              title="Desktop View"
              aria-label="Switch to desktop viewport"
              aria-pressed={viewportMode === 'desktop'}
            >
              <Monitor size={16} aria-hidden="true" />
            </button>
            <button
              className={`toolbar-btn ${viewportMode === 'tablet' ? 'active' : ''}`}
              onClick={() => setViewportMode('tablet')}
              title="Tablet View"
              aria-label="Switch to tablet viewport"
              aria-pressed={viewportMode === 'tablet'}
            >
              <Tablet size={16} aria-hidden="true" />
            </button>
            <button
              className={`toolbar-btn ${viewportMode === 'mobile' ? 'active' : ''}`}
              onClick={() => setViewportMode('mobile')}
              title="Mobile View"
              aria-label="Switch to mobile viewport"
              aria-pressed={viewportMode === 'mobile'}
            >
              <Smartphone size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button
              className={`toolbar-btn ${showLayoutOutlines ? 'active' : ''}`}
              onClick={() => setLayoutOutlines(!showLayoutOutlines)}
              title="Toggle Layout Outlines"
              aria-label="Toggle layout outlines"
              aria-pressed={showLayoutOutlines}
            >
              <FileType size={16} aria-hidden="true" />
            </button>
            <div className="toolbar-divider" />
            <button className="toolbar-btn" onClick={() => setZoom(zoom - 10)} title="Zoom Out" aria-label="Zoom out">
              <ZoomOut size={16} aria-hidden="true" />
            </button>
            {editingZoom ? (
              <div
                className="toolbar-zoom-controls"
                style={{ display: 'flex', alignItems: 'center' }}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    commitZoom()
                  }
                }}
              >
                <input
                  className="toolbar-zoom-input"
                  type="text"
                  value={tempZoom}
                  onChange={(e) => setTempZoom(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={handleZoomKeyDown}
                  autoFocus
                  aria-label="Zoom percentage"
                />
                <input
                  type="range"
                  className="toolbar-zoom-slider"
                  min={25}
                  max={200}
                  step={5}
                  value={zoom}
                  onChange={(e) => { setZoom(Number(e.target.value)); setTempZoom(e.target.value) }}
                  title={`Zoom: ${zoom}%`}
                  aria-label="Zoom slider"
                />
              </div>
            ) : (
              <span
                className="toolbar-text toolbar-zoom-text"
                onClick={() => { setTempZoom(String(zoom)); setEditingZoom(true) }}
                title="Click to edit zoom"
                aria-live="polite"
                role="button"
                tabIndex={0}
              >
                {zoom}%
              </span>
            )}
            <button className="toolbar-btn" onClick={() => setZoom(zoom + 10)} title="Zoom In" aria-label="Zoom in">
              <ZoomIn size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* RIGHT: Tools, Theme, Panels */}
        <div className="toolbar-section toolbar-right">
          <button className="toolbar-btn" onClick={() => setShowAssetManager(true)} title="Asset Manager" aria-label="Open asset manager">
            <ImageIcon size={16} aria-hidden="true" />
          </button>

          <div className="cred-manager-wrapper">
            <button
              className={`toolbar-btn ${showCredentialManager ? 'active' : ''}`}
              onClick={() => setShowCredentialManager((prev) => !prev)}
              title="Credential Manager"
              aria-label="Open credential manager"
              aria-pressed={showCredentialManager}
            >
              <KeyRound size={16} aria-hidden="true" />
            </button>
            <CredentialManager
              open={showCredentialManager}
              onClose={() => setShowCredentialManager(false)}
            />
          </div>
          
          <div className="toolbar-divider" />

          <button
            className={`toolbar-btn ${codeEditorOpen ? 'active' : ''}`}
            onClick={onToggleCodeEditor}
            title="Toggle Code Editor"
            aria-label="Toggle code editor panel"
            aria-pressed={codeEditorOpen}
          >
            <Code size={16} aria-hidden="true" />
          </button>

          {/* Theme Editor */}
          <button
            className="toolbar-btn"
            onClick={onOpenThemeEditor}
            title="Theme Editor"
            aria-label="Open theme editor"
          >
            <Palette size={16} aria-hidden="true" />
          </button>

          {/* Layout Switcher */}
          <div className="toolbar-layout-switcher" style={{ position: 'relative' }}>
            <button
              className="toolbar-btn"
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              title="Change Layout"
              aria-label="Change editor layout"
              aria-haspopup="menu"
              aria-expanded={showLayoutMenu}
            >
              <Layout size={16} aria-hidden="true" />
            </button>
            {showLayoutMenu && (
              <>
                <div className="toolbar-layout-menu" role="menu">
                  <div
                    className={`toolbar-layout-item ${editorLayout === 'standard' ? 'active' : ''}`}
                    onClick={() => { onSetEditorLayout('standard'); setShowLayoutMenu(false); }}
                    role="menuitem"
                  >
                    Standard
                  </div>
                  <div
                    className={`toolbar-layout-item ${editorLayout === 'no-sidebar' ? 'active' : ''}`}
                    onClick={() => { onSetEditorLayout('no-sidebar'); setShowLayoutMenu(false); }}
                    role="menuitem"
                  >
                    No Sidebar
                  </div>
                  <div
                    className={`toolbar-layout-item ${editorLayout === 'no-inspector' ? 'active' : ''}`}
                    onClick={() => { onSetEditorLayout('no-inspector'); setShowLayoutMenu(false); }}
                    role="menuitem"
                  >
                    No Inspector
                  </div>
                  <div
                    className={`toolbar-layout-item ${editorLayout === 'canvas-only' ? 'active' : ''}`}
                    onClick={() => { onSetEditorLayout('canvas-only'); setShowLayoutMenu(false); }}
                    role="menuitem"
                  >
                    Canvas Only
                  </div>
                  <div
                    className={`toolbar-layout-item ${editorLayout === 'code-focus' ? 'active' : ''}`}
                    onClick={() => { onSetEditorLayout('code-focus'); setShowLayoutMenu(false); }}
                    role="menuitem"
                  >
                    Code Focus
                  </div>
                  <div
                    className={`toolbar-layout-item ${editorLayout === 'zen' ? 'active' : ''}`}
                    onClick={() => { onSetEditorLayout('zen'); setShowLayoutMenu(false); }}
                    role="menuitem"
                  >
                    Zen Mode
                  </div>
                </div>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 89 }}
                  onClick={() => setShowLayoutMenu(false)}
                />
              </>
            )}
          </div>

          <button
            className="toolbar-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle Theme"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
          </button>

          <button
            className={`toolbar-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(true)}
            title="Global Settings"
            aria-label="Open global settings"
            aria-pressed={showSettings}
          >
            <Settings size={16} aria-hidden="true" />
          </button>
        </div>

        </div>{/* end toolbar-collapsible */}
      </div>

      {showAssetManager && (
        <AssetManager onClose={() => setShowAssetManager(false)} />
      )}

      {showNewProject && (
        <NewProjectWizard onClose={() => setShowNewProject(false)} />
      )}

      {showExport && (
        <ExportDialog onClose={() => setShowExport(false)} />
      )}

      {showSettings && (
        <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      )}
    </>
  )
}
