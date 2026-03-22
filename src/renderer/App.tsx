import { useCallback, useMemo, useState, useRef, useEffect, lazy, Suspense } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragCancelEvent,
  type DragEndEvent
} from '@dnd-kit/core'
import Sidebar from './components/Sidebar/Sidebar'
import Canvas from './components/Canvas/Canvas'
import Inspector from './components/Inspector/Inspector'
import Toolbar from './components/Toolbar/Toolbar'
import StatusBar from './components/StatusBar/StatusBar'
import DragOverlayManager, { type DropTargetHint } from './components/DragOverlayManager/DragOverlayManager'
import CommandPalette from './components/CommandPalette/CommandPalette'
import Toast from './components/Toast/Toast'
import { useEditorStore } from './store/editorStore'
import { useProjectStore } from './store/projectStore'
import { useToastStore } from './store/toastStore'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import type { Block } from './store/types'
import { createBlock } from './store/types'
import { componentRegistry } from './registry/ComponentRegistry'
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen'
import { getApi } from './utils/api'
import KeyboardShortcutsHelp from './components/KeyboardShortcutsHelp/KeyboardShortcutsHelp'

// Lazy load heavy components for performance
const CodeEditor = lazy(() => import('./components/CodeEditor/CodeEditor'))
const AssetManager = lazy(() => import('./components/AssetManager/AssetManager'))
const NewProjectWizard = lazy(() => import('./components/NewProjectWizard/NewProjectWizard'))
const ExportDialog = lazy(() => import('./components/ExportDialog/ExportDialog'))
const ThemeEditor = lazy(() => import('./components/ThemeEditor/ThemeEditor'))
const AboutAmagon = lazy(() => import('./components/AboutAmagon/AboutAmagon'))

// Loading fallback component
const DialogLoader = () => (
  <div style={{
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)',
    zIndex: 9999
  }}>
    <div style={{ padding: 20, background: '#1e1e2e', borderRadius: 8 }}>
      Loading...
    </div>
  </div>
)

function App(): JSX.Element {
  const api = getApi()

  const showToast = useToastStore((s) => s.showToast)

  const [codeEditorOpen, setCodeEditorOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [showAssetManager, setShowAssetManager] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false)
  const [showThemeEditor, setShowThemeEditor] = useState(false)
  const [showAbout, setShowAbout] = useState(false)

  const addBlock = useEditorStore((s) => s.addBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)
  const blocks = useEditorStore((s) => s.blocks)
  const isTypingCode = useEditorStore((s) => s.isTypingCode)
  const setIsDragging = useEditorStore((s) => s.setIsDragging)
  const markSaved = useEditorStore((s) => s.markSaved)
  const setCustomCss = useEditorStore((s) => s.setCustomCss)
  const editorLayout = useEditorStore((s) => s.editorLayout)
  const setEditorLayout = useEditorStore((s) => s.setEditorLayout)
  const userBlocks = useProjectStore((s) => s.userBlocks)
  const isProjectLoaded = useProjectStore((s) => s.isProjectLoaded)
  const currentPageId = useProjectStore((s) => s.currentPageId)

  const prevPageIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isProjectLoaded) {
      prevPageIdRef.current = null
      return
    }

    const projectState = useProjectStore.getState()
    const nextPageId = projectState.currentPageId
    if (!nextPageId) return

    const prevPageId = prevPageIdRef.current
    if (prevPageId && prevPageId !== nextPageId) {
      const prevExists = projectState.pages.some((p) => p.id === prevPageId)
      if (prevExists) {
        projectState.updatePage(prevPageId, { blocks: useEditorStore.getState().blocks })
      }
    }

    const nextPage = projectState.pages.find((p) => p.id === nextPageId)
    if (nextPage) {
      useEditorStore.getState().loadPageBlocks(nextPage.blocks)
    }

    prevPageIdRef.current = nextPageId
  }, [currentPageId, isProjectLoaded])

  // Sync menu state with the main process based on project load status
  useEffect(() => {
    if (window.api && window.api.menu && window.api.menu.setProjectLoaded) {
      window.api.menu.setProjectLoaded(isProjectLoaded)
    }
  }, [isProjectLoaded, api])

  // Auto-open code editor if switching to code-focus layout
  useEffect(() => {
    if (editorLayout === 'code-focus') {
      setCodeEditorOpen(true)
    }
  }, [editorLayout])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  )

  // Handlers for keyboard shortcuts - direct API calls
  const handleNewProject = useCallback(() => {
    setShowNewProject(true)
  }, [])

  const ensureBackendReadyAndFlushEdits = useCallback(async (): Promise<boolean> => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
    const isElectron = /electron/i.test(ua)
    if (isElectron && !window.api) {
      showToast('Electron backend not available (window.api missing)', 'error')
      return false
    }

    const active = document.activeElement as HTMLElement | null
    active?.blur?.()
    await new Promise((r) => setTimeout(r, 0))

    if (useEditorStore.getState().isTypingCode) {
      await new Promise((r) => setTimeout(r, 900))
    }
    return true
  }, [showToast])

  const handleSave = useCallback(async () => {
    const ok = await ensureBackendReadyAndFlushEdits()
    if (!ok) return

    const editorState = useEditorStore.getState()
    const projectState = useProjectStore.getState()
    const pageId = projectState.currentPageId

    const pages = projectState.pages.map((p) =>
      pageId && p.id === pageId ? { ...p, blocks: editorState.getFullBlocks() } : p
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
      projectState.updatePage(pageId, { blocks: editorState.getFullBlocks() })
    }
    const filePath = projectState.filePath

    try {
      const result = await api.project.save({ filePath: filePath || undefined, content })
      if (result.success && result.filePath) {
        useProjectStore.getState().setFilePath(result.filePath)
        markSaved()
        showToast(`Saved: ${result.filePath}`, 'success')
        return
      }
      if (!result.canceled) {
        showToast(result.error || 'Save failed', 'error')
      }
    } catch (err) {
      showToast(String(err), 'error')
    }
  }, [api, ensureBackendReadyAndFlushEdits])

  const handleSaveAs = useCallback(async () => {
    const ok = await ensureBackendReadyAndFlushEdits()
    if (!ok) return

    const editorState = useEditorStore.getState()
    const projectState = useProjectStore.getState()
    const pageId = projectState.currentPageId

    const pages = projectState.pages.map((p) =>
      pageId && p.id === pageId ? { ...p, blocks: editorState.getFullBlocks() } : p
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
      projectState.updatePage(pageId, { blocks: editorState.getFullBlocks() })
    }

    try {
      const result = await api.project.saveAs({ content })
      if (result.success && result.filePath) {
        useProjectStore.getState().setFilePath(result.filePath)
        markSaved()
        showToast(`Saved: ${result.filePath}`, 'success')
        return
      }
      if (!result.canceled) {
        showToast(result.error || 'Save failed', 'error')
      }
    } catch (err) {
      showToast(String(err), 'error')
    }
  }, [api, ensureBackendReadyAndFlushEdits])

  const handleLoad = useCallback(async () => {
    const result = await api.project.load()
    if (result.success && result.content) {
      useProjectStore.getState().setProject(result.content as any, result.filePath)
      const data = result.content as any
      const firstPage = Array.isArray(data.pages) ? data.pages[0] : null
      if (firstPage && Array.isArray(firstPage.blocks)) {
        useEditorStore.getState().loadPageBlocks(firstPage.blocks)
      }
      setCustomCss(typeof data.customCss === 'string' ? data.customCss : '')
      markSaved()
      showToast('Project loaded', 'success')
      return
    }
    if (!result.canceled) {
      showToast(result.error || 'Load failed', 'error')
    }
  }, [api])

  const handleExport = useCallback(() => {
    setShowExport(true)
  }, [])

  const getLayoutPanels = useCallback((layout: typeof editorLayout) => {
    const sidebar = layout === 'standard' || layout === 'no-inspector'
    const inspector = layout === 'standard' || layout === 'no-sidebar' || layout === 'zen'
    return { sidebar, inspector }
  }, [])

  const layoutFromPanels = useCallback(
    (sidebar: boolean, inspector: boolean): typeof editorLayout => {
      if (sidebar && inspector) return 'standard'
      if (!sidebar && inspector) return 'no-sidebar'
      if (sidebar && !inspector) return 'no-inspector'
      return 'canvas-only'
    },
    []
  )

  const handleToggleSidebar = useCallback(() => {
    const { sidebar, inspector } = getLayoutPanels(editorLayout)
    setEditorLayout(layoutFromPanels(!sidebar, inspector))
  }, [editorLayout, getLayoutPanels, layoutFromPanels, setEditorLayout])

  const handleToggleInspector = useCallback(() => {
    const { sidebar, inspector } = getLayoutPanels(editorLayout)
    setEditorLayout(layoutFromPanels(sidebar, !inspector))
  }, [editorLayout, getLayoutPanels, layoutFromPanels, setEditorLayout])

  // Derived panel visibility from layout
  const showSidebar = editorLayout === 'standard' || editorLayout === 'no-inspector'
  const showInspector = editorLayout === 'standard' || editorLayout === 'no-sidebar' || editorLayout === 'zen'
  const showCodeEditor = codeEditorOpen && (editorLayout === 'standard' || editorLayout === 'no-sidebar' || editorLayout === 'no-inspector' || editorLayout === 'code-focus' || editorLayout === 'zen')
  const showCanvas = editorLayout !== 'code-focus'  // Hide canvas in code-focus layout
  useKeyboardShortcuts({
    onSave: handleSave,
    onSaveAs: handleSaveAs,
    onOpen: handleLoad,
    onExport: handleExport,
    onToggleCodeEditor: () => setCodeEditorOpen(prev => !prev),
    onToggleLeftPanel: handleToggleSidebar,
    onToggleRightPanel: handleToggleInspector,
    leftPanelOpen: showSidebar,
    rightPanelOpen: showInspector,
    codeEditorOpen,
    onNewProject: handleNewProject,
    onSetEditorLayout: setEditorLayout
  })

  // Command palette keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(prev => !prev)
      }
      // Keyboard shortcuts help: Ctrl+?
      if ((e.ctrlKey || e.metaKey) && e.key === '?') {
        e.preventDefault()
        setShowKeyboardShortcuts(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Electron menu action listener
  useEffect(() => {
    const cleanup = api.menu.onAction((action: string) => {
      switch (action) {
        case 'new-project': handleNewProject(); break
        case 'open-project': handleLoad(); break
        case 'close-project': {
          useProjectStore.getState().closeProject()
          useEditorStore.getState().loadPageBlocks([])
          break
        }
        case 'save': handleSave(); break
        case 'save-as': handleSaveAs(); break
        case 'export': handleExport(); break
        case 'undo': useEditorStore.getState().undo(); break
        case 'redo': useEditorStore.getState().redo(); break
        case 'cut':
        case 'copy':
        case 'paste':
        case 'duplicate':
        case 'delete':
          // These are handled by keyboard shortcuts via accelerators;
          // dispatch a synthetic keydown so the existing handler picks them up
          break
        case 'toggle-sidebar': handleToggleSidebar(); break
        case 'toggle-inspector': handleToggleInspector(); break
        case 'toggle-code-editor': setCodeEditorOpen(prev => !prev); break
        case 'command-palette': setCommandPaletteOpen(prev => !prev); break
        case 'keyboard-shortcuts': setShowKeyboardShortcuts(prev => !prev); break
        case 'about': setShowAbout(true); break
      }
    })
    return cleanup
  }, [api, handleNewProject, handleLoad, handleSave, handleSaveAs, handleExport, handleToggleSidebar, handleToggleInspector])

  const [activeWidget, setActiveWidget] = useState<{ widgetType: string; label?: string; icon?: string } | null>(null)
  const [dropHint, setDropHint] = useState<DropTargetHint | null>(null)

  const findParentAndIndex = useCallback((tree: Block[], targetId: string): { parentId: string | null; index: number } | null => {
    const walk = (nodes: Block[], parentId: string | null): { parentId: string | null; index: number } | null => {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        if (node.id === targetId) return { parentId, index: i }
        const found = walk(node.children, node.id)
        if (found) return found
      }
      return null
    }
    return walk(tree, null)
  }, [])

  // Helper to recursively create blocks from a definition (e.g. for defaultChildren)
  const createBlockFromDef = useCallback((def: any): Block => {
    const block = createBlock(def.type, {
      props: def.props ? { ...def.props } : {},
      classes: def.classes ? [...def.classes] : [],
      styles: def.styles ? { ...def.styles } : {}
    })

    if (def.children && Array.isArray(def.children)) {
      block.children = def.children.map((child: any) => createBlockFromDef(child))
    }

    return block
  }, [])

  // Helper to deep clone a block and regenerate IDs
  const cloneBlockWithNewIds = useCallback((block: Block): Block => {
    const newBlock = createBlock(block.type, {
      props: { ...block.props },
      classes: [...block.classes],
      styles: { ...block.styles },
      content: block.content,
      tag: block.tag
    })

    if (block.children) {
      newBlock.children = block.children.map(child => cloneBlockWithNewIds(child))
    }

    return newBlock
  }, [])

  const createBlockFromWidget = useCallback((widgetType: string): Block | null => {
    // Check for User Block
    if (widgetType.startsWith('user:')) {
      const userBlockId = widgetType.replace('user:', '')
      const userBlock = userBlocks.find(ub => ub.id === userBlockId)
      if (!userBlock) return null
      return cloneBlockWithNewIds(userBlock.content)
    }

    const def = componentRegistry.get(widgetType)
    if (!def) return null

    const block = createBlock(def.type, {
      props: def.defaultProps ? { ...def.defaultProps } : {},
      classes: def.defaultClasses ? [...def.defaultClasses] : [],
      styles: def.defaultStyles ? { ...def.defaultStyles } : {}
    })

    if (def.defaultChildren && Array.isArray(def.defaultChildren)) {
      block.children = def.defaultChildren.map((child) => createBlockFromDef(child))
    }

    return block
  }, [createBlockFromDef, cloneBlockWithNewIds, userBlocks])

  const onDragStart = useCallback((event: DragStartEvent) => {
    if (isTypingCode) return
    setIsDragging(true)
    const data = event.active.data.current as unknown as { widgetType?: string; label?: string; icon?: string } | undefined
    if (data?.widgetType) {
      setActiveWidget({ widgetType: data.widgetType, label: data.label, icon: data.icon })
    }
  }, [isTypingCode, setIsDragging])

  const onDragCancel = useCallback((_event: DragCancelEvent) => {
    setIsDragging(false)
    setActiveWidget(null)
    setDropHint(null)
  }, [setIsDragging])

  const onDragEnd = useCallback(
    (_event: DragEndEvent) => {
      setIsDragging(false)
      if (!activeWidget?.widgetType) {
        setActiveWidget(null)
        setDropHint(null)
        return
      }

      const newBlock = createBlockFromWidget(activeWidget.widgetType)
      if (!newBlock) {
        setActiveWidget(null)
        setDropHint(null)
        return
      }

      let parentId: string | null = null
      let index = -1

      if (dropHint) {
        if (dropHint.mode === 'inside') {
          parentId = dropHint.targetBlockId
          index = -1
        } else {
          const loc = findParentAndIndex(blocks, dropHint.targetBlockId)
          if (loc) {
            parentId = loc.parentId
            index = dropHint.mode === 'before' ? loc.index : loc.index + 1
          }
        }
      }

      addBlock(newBlock, parentId, index)
      selectBlock(newBlock.id)

      setActiveWidget(null)
      setDropHint(null)
    },
    [activeWidget?.widgetType, addBlock, blocks, createBlockFromWidget, dropHint, findParentAndIndex, selectBlock, setIsDragging]
  )

  const dragOverlayPreview = useMemo(() => {
    if (!activeWidget) return null
    return (
      <div className="widget-drag-preview">
        <div className="widget-drag-preview__icon">{activeWidget.icon ?? '▢'}</div>
        <div className="widget-drag-preview__label">{activeWidget.label ?? activeWidget.widgetType}</div>
      </div>
    )
  }, [activeWidget])

  const renderEditorContent = () => {
    if (!isProjectLoaded) {
      return <WelcomeScreen />
    }

    return (
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragCancel={onDragCancel} onDragEnd={onDragEnd}>
        <div className="app-container">
          <Toolbar
            leftPanelOpen={showSidebar}
            rightPanelOpen={showInspector}
            codeEditorOpen={codeEditorOpen}
            editorLayout={editorLayout}
            onToggleLeftPanel={handleToggleSidebar}
            onToggleRightPanel={handleToggleInspector}
            onToggleCodeEditor={() => setCodeEditorOpen(!codeEditorOpen)}
            onSetEditorLayout={setEditorLayout}
            onOpenThemeEditor={() => setShowThemeEditor(true)}
          />
          <PanelGroup id="html-editor-layout" autoSaveId="html-editor-layout" direction="horizontal" className="editor-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {showSidebar && (
              <>
                <Panel defaultSize={20} minSize={15} maxSize={40} className="panel panel-left" id="panel-left" order={1}>
                  <Sidebar />
                </Panel>
                <PanelResizeHandle className="panel-resize-handle" />
              </>
            )}

            <Panel className="panel panel-center" id="panel-center" order={2}>
              <PanelGroup id="html-editor-center" autoSaveId="html-editor-center" direction="vertical">
                {showCanvas && (
                  <Panel className="canvas-area" id="panel-canvas" order={1}>
                    <Canvas />
                    <DragOverlayManager onDropTargetChange={setDropHint} />
                  </Panel>
                )}

                {showCodeEditor && showCanvas && (
                  <PanelResizeHandle className="panel-resize-handle-horizontal" />
                )}

                {showCodeEditor && (
                  <Panel defaultSize={30} minSize={10} maxSize={80} className="code-editor-area" id="panel-code" order={2}>
                    <Suspense fallback={<div style={{ padding: 20 }}>Loading editor...</div>}>
                      <CodeEditor />
                    </Suspense>
                  </Panel>
                )}
              </PanelGroup>
            </Panel>

            {showInspector && (
              <>
                <PanelResizeHandle className="panel-resize-handle" />
                <Panel defaultSize={25} minSize={20} maxSize={45} className="panel panel-right" id="panel-right" order={3}>
                  <Inspector />
                </Panel>
              </>
            )}
          </PanelGroup>
          <StatusBar />
        </div>
        <DragOverlay dropAnimation={null}>{dragOverlayPreview}</DragOverlay>
      </DndContext>
    )
  }

  return (
    <>
      {renderEditorContent()}

      <Toast />

      {commandPaletteOpen && (
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onNewProject={handleNewProject}
          onOpen={handleLoad}
          onSave={handleSave}
          onExport={handleExport}
          onToggleCodeEditor={() => setCodeEditorOpen(!codeEditorOpen)}
          onToggleLeftPanel={handleToggleSidebar}
          onToggleRightPanel={handleToggleInspector}
        />
      )}

      <Suspense fallback={<DialogLoader />}>
        {showAssetManager && (
          <AssetManager onClose={() => setShowAssetManager(false)} />
        )}
      </Suspense>

      <Suspense fallback={<DialogLoader />}>
        {showNewProject && (
          <NewProjectWizard onClose={() => setShowNewProject(false)} />
        )}
      </Suspense>

      <Suspense fallback={<DialogLoader />}>
        {showExport && (
          <ExportDialog onClose={() => setShowExport(false)} />
        )}
      </Suspense>

      <KeyboardShortcutsHelp
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />

      <Suspense fallback={<DialogLoader />}>
        {showThemeEditor && (
          <ThemeEditor
            isOpen={showThemeEditor}
            onClose={() => setShowThemeEditor(false)}
          />
        )}
      </Suspense>

      <Suspense fallback={<DialogLoader />}>
        {showAbout && (
          <AboutAmagon
            isOpen={showAbout}
            onClose={() => setShowAbout(false)}
          />
        )}
      </Suspense>

      <Suspense fallback={<DialogLoader />}>
        {showAbout && (
          <AboutAmagon
            isOpen={showAbout}
            onClose={() => setShowAbout(false)}
          />
        )}
      </Suspense>
    </>
  )
}

export default App
