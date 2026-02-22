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
  FileType
} from 'lucide-react'
import { getApi } from '../../utils/api'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { createBlock } from '../../store/types'
import type { Block } from '../../store/types'
import AssetManager from '../AssetManager/AssetManager'
import NewProjectWizard from '../NewProjectWizard/NewProjectWizard'
import ExportDialog from '../ExportDialog/ExportDialog'
import './Toolbar.css'

interface ToolbarProps {
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  codeEditorOpen: boolean
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
  onToggleCodeEditor: () => void
}

export default function Toolbar({
  leftPanelOpen,
  rightPanelOpen,
  codeEditorOpen,
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleCodeEditor
}: ToolbarProps): JSX.Element {
  const api = getApi()
  
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
  
  const addBlock = useEditorStore((s) => s.addBlock)
  const removeBlock = useEditorStore((s) => s.removeBlock)
  const setPageBlocks = useEditorStore((s) => s.setPageBlocks)
  const setViewportMode = useEditorStore((s) => s.setViewportMode)
  const setZoom = useEditorStore((s) => s.setZoom)
  const setTheme = useEditorStore((s) => s.setTheme)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const getBlockById = useEditorStore((s) => s.getBlockById)

  // Local State
  const [showAssetManager, setShowAssetManager] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [tempName, setTempName] = useState(projectName)
  const [showPageMenu, setShowPageMenu] = useState(false)
  const [isAddingPage, setIsAddingPage] = useState(false)
  const [newPageName, setNewPageName] = useState('')

  // Store access for pages
  const pages = useProjectStore((s) => s.pages)
  const currentPage = useProjectStore((s) => s.getCurrentPage())
  const setCurrentPage = useProjectStore((s) => s.setCurrentPage)
  const addPage = useProjectStore((s) => s.addPage)
  const removePage = useProjectStore((s) => s.removePage)

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

  const handleSave = async (silent = false): Promise<void> => {
    if (currentPageId) {
      updatePage(currentPageId, { blocks: editorBlocks })
    }

    const projectData = getProjectData()
    const content = JSON.stringify(projectData, null, 2)

    const result = await api.project.save({
      filePath: filePath || undefined,
      content
    })

    if (result.success) {
      if (!silent) console.log('Project saved successfully!')
      if (result.filePath && result.filePath !== filePath) {
        setFilePath(result.filePath)
      }
    } else if (!result.canceled) {
      console.error('Save failed:', result.error)
    }
  }

  const handleLoad = async (): Promise<void> => {
    const result = await api.project.load()
    if (result.success && result.content) {
      setProject(result.content as any, result.filePath)
      const data = result.content as any
      if (data.pages && data.pages.length > 0) {
        useEditorStore.getState().setPageBlocks(data.pages[0].blocks)
      }
    } else if (!result.canceled) {
      console.error('Load failed:', result.error)
    }
  }

  const handleExport = async (): Promise<void> => {
    if (currentPageId) {
      updatePage(currentPageId, { blocks: editorBlocks })
    }
    setShowExport(true)
  }

  const handleCopyHtml = async (): Promise<void> => {
    try {
      if (currentPageId) {
        updatePage(currentPageId, { blocks: editorBlocks })
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

  // Page Operations
  const handleAddPage = () => {
    if (!newPageName.trim()) return
    const page = addPage(newPageName.trim())
    setNewPageName('')
    setIsAddingPage(false)
    // Auto-switch to new page? The store's addPage already sets it as current.
  }

  const handleDeletePage = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation()
    if (pages.length <= 1) {
      alert('Cannot delete the last page.')
      return
    }
    if (confirm('Are you sure you want to delete this page?')) {
      removePage(pageId)
    }
  }

  // Edit Operations
  const handleDelete = () => {
    if (selectedBlockId) {
      removeBlock(selectedBlockId)
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

  return (
    <>
      <div className="toolbar">
        {/* LEFT: Menu, Name */}
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
        </div>
        
        {/* Page Selector */}
        <div className="toolbar-page-wrapper">
          <button
            className="toolbar-btn toolbar-page-btn"
            onClick={() => setShowPageMenu(!showPageMenu)}
            title="Switch Page"
          >
            <span style={{ fontWeight: 500 }}>{currentPage?.title || 'Page'}</span>
            <span style={{ fontSize: 10, opacity: 0.7 }}>▼</span>
          </button>

          {showPageMenu && (
            <div className="toolbar-page-menu">
              {pages.map((p) => (
                <div
                  key={p.id}
                  className="page-menu-item"
                  onClick={() => {
                    setCurrentPage(p.id)
                    setShowPageMenu(false)
                  }}
                >
                  <div className={`page-menu-label ${p.id === currentPageId ? 'active' : ''}`}>
                    {p.title}
                    {p.slug !== 'index' && <span className="page-slug">/{p.slug}</span>}
                  </div>
                  {pages.length > 1 && (
                    <button
                      className="page-menu-delete"
                      onClick={(e) => handleDeletePage(e, p.id)}
                      title="Delete Page"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
              
              <div className="page-menu-divider" />
              
              {isAddingPage ? (
                <div className="page-menu-item" onClick={(e) => e.stopPropagation()}>
                  <input
                    className="toolbar-input-name"
                    style={{ width: '100%' }}
                    placeholder="Page Name"
                    value={newPageName}
                    onChange={(e) => setNewPageName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddPage()
                      if (e.key === 'Escape') setIsAddingPage(false)
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <div
                  className="page-menu-item add-page"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsAddingPage(true)
                  }}
                >
                  <FilePlus size={14} />
                  <span>Add New Page</span>
                </div>
              )}
            </div>
          )}
          
          {/* Overlay to close menu on click outside */}
          {showPageMenu && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 90 }}
              onClick={() => {
                setShowPageMenu(false)
                setIsAddingPage(false)
              }}
            />
          )}
        </div>

        {/* LEFT-CENTER: File & Edit Operations */}
        <div className="toolbar-section">
          <button className="toolbar-btn" onClick={() => setShowNewProject(true)} title="New Project" aria-label="Create new project">
            <FilePlus size={16} aria-hidden="true" />
          </button>
          <button className="toolbar-btn" onClick={handleLoad} title="Open Project (Ctrl+O)" aria-label="Open existing project">
            <FolderOpen size={16} aria-hidden="true" />
          </button>
          <button className="toolbar-btn" onClick={() => handleSave()} title="Save Project (Ctrl+S)" aria-label="Save project">
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
            <button className="toolbar-btn" onClick={() => setZoom(zoom - 10)} title="Zoom Out" aria-label="Zoom out">
              <ZoomOut size={16} aria-hidden="true" />
            </button>
            <span className="toolbar-text" aria-live="polite">{zoom}%</span>
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

          <button
            className="toolbar-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle Theme"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
          </button>

          <button
            className={`toolbar-btn ${rightPanelOpen ? 'active' : ''}`}
            onClick={onToggleRightPanel}
            title="Toggle Inspector"
            aria-label="Toggle right inspector panel"
            aria-pressed={rightPanelOpen}
          >
            <Settings size={16} aria-hidden="true" />
          </button>
        </div>
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
    </>
  )
}
