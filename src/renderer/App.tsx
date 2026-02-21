import { useCallback, useMemo, useState } from 'react'
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
import CodeEditor from './components/CodeEditor/CodeEditor'
import DragOverlayManager, { type DropTargetHint } from './components/DragOverlayManager/DragOverlayManager'
import { useEditorStore } from './store/editorStore'
import { useProjectStore } from './store/projectStore'
import type { Block } from './store/types'
import { createBlock } from './store/types'
import { componentRegistry } from './registry/ComponentRegistry'
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen'

function App(): JSX.Element {
  const [leftPanelOpen, setLeftPanelOpen] = useState(true)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const [codeEditorOpen, setCodeEditorOpen] = useState(false)

  const addBlock = useEditorStore((s) => s.addBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)
  const blocks = useEditorStore((s) => s.blocks)
  const isTypingCode = useEditorStore((s) => s.isTypingCode)
  const setIsDragging = useEditorStore((s) => s.setIsDragging)
  const userBlocks = useProjectStore((s) => s.userBlocks)
  const isProjectLoaded = useProjectStore((s) => s.isProjectLoaded)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  )

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
  if (!isProjectLoaded) {
    return <WelcomeScreen />
  }

  }, [activeWidget])

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragCancel={onDragCancel} onDragEnd={onDragEnd}>
      <div className="app-container">
        <Toolbar
          leftPanelOpen={leftPanelOpen}
          rightPanelOpen={rightPanelOpen}
          codeEditorOpen={codeEditorOpen}
          onToggleLeftPanel={() => setLeftPanelOpen(!leftPanelOpen)}
          onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
          onToggleCodeEditor={() => setCodeEditorOpen(!codeEditorOpen)}
        />
        <PanelGroup id="html-editor-layout" autoSaveId="html-editor-layout" direction="horizontal" className="editor-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {leftPanelOpen && (
            <>
              <Panel defaultSize={20} minSize={15} maxSize={40} className="panel panel-left" id="panel-left">
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="panel-resize-handle" />
            </>
          )}

          <Panel className="panel panel-center" id="panel-center">
            <PanelGroup id="html-editor-center" autoSaveId="html-editor-center" direction="vertical">
              <Panel className="canvas-area" id="panel-canvas">
                <Canvas />
                <DragOverlayManager onDropTargetChange={setDropHint} />
              </Panel>

              {codeEditorOpen && (
                <>
                  <PanelResizeHandle className="panel-resize-handle-horizontal" />
                  <Panel defaultSize={30} minSize={10} maxSize={80} className="code-editor-area" id="panel-code">
                    <CodeEditor />
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>

          {rightPanelOpen && (
            <>
              <PanelResizeHandle className="panel-resize-handle" />
              <Panel defaultSize={25} minSize={20} maxSize={45} className="panel panel-right" id="panel-right">
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

export default App
