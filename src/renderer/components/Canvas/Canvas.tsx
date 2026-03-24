import { useEffect, useMemo, useRef, useState } from 'react'
import { Layers } from 'lucide-react'
import ContextMenu, { type ContextMenuItem } from '../ContextMenu/ContextMenu'
import './Canvas.css'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { useAppSettingsStore } from '../../store/appSettingsStore'
import { blockToHtml } from '../../utils/blockToHtml'
import { createBlock, themeToCSS } from '../../store/types'
import type { Block } from '../../store/types'

type ViewportMode = 'desktop' | 'tablet' | 'mobile'

type CanvasRuntimeMessage =
  | { source: 'canvas-runtime'; type: 'ready' }
  | {
    source: 'canvas-runtime'
    type: 'clicked'
    blockId?: string
    rect?: { top: number; left: number; width: number; height: number; right: number; bottom: number }
    redirectedFromNestedTabContent?: boolean
  }
  | {
    source: 'canvas-runtime'
    type: 'hovered'
    blockId?: string
  }
  | {
    source: 'canvas-runtime'
    type: 'contextMenu'
    blockId?: string
    rect?: { top: number; left: number; width: number; height: number; right: number; bottom: number }
    clientX?: number
    clientY?: number
    redirectedFromNestedTabContent?: boolean
  }
  | {
    source: 'canvas-runtime'
    type: 'debug'
    payload?: Record<string, unknown>
  }
  | {
    source: 'canvas-runtime'
    type: 'moveBlock'
    blockId: string
    dropTarget: { targetBlockId: string; mode: 'inside' | 'before' | 'after' }
  }
  | {
    source: 'canvas-runtime'
    type: 'updateText'
    blockId: string
    text: string
  }
  | {
    source: 'canvas-runtime'
    type: 'keydown'
    key: string
    code?: string
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean
    altKey: boolean
  }
  | {
    source: 'canvas-runtime'
    type: 'deleteBlock'
    blockId: string
  }

function findBlockById(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) return block
    const found = findBlockById(block.children, id)
    if (found) return found
  }
  return null
}

function findParentAndIndex(
  blocks: Block[],
  targetId: string
): { parentId: string | null; index: number } | null {
  const walk = (nodes: Block[], parentId: string | null): { parentId: string | null; index: number } | null => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (node.id === targetId) return { parentId, index: i }
      const found = walk(node.children, node.id)
      if (found) return found
    }
    return null
  }

  return walk(blocks, null)
}

function Canvas(): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [runtimeReady, setRuntimeReady] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; blockId: string } | null>(null)
  const [tabWarningVisible, setTabWarningVisible] = useState(false)

  const blocks = useEditorStore((s) => s.blocks)
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
  const hoveredBlockId = useEditorStore((s) => s.hoveredBlockId)
  const setPageBlocks = useEditorStore((s) => s.setPageBlocks)
  const selectBlock = useEditorStore((s) => s.selectBlock)
  const hoverBlock = useEditorStore((s) => s.hoverBlock)
  const moveBlock = useEditorStore((s) => s.moveBlock)
  const addBlock = useEditorStore((s) => s.addBlock)
  const removeBlock = useEditorStore((s) => s.removeBlock)
  const getBlockById = useEditorStore((s) => s.getBlockById)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const setClipboard = useEditorStore((s) => s.setClipboard)
  const clipboard = useEditorStore((s) => s.clipboard)
  const isTypingCode = useEditorStore((s) => s.isTypingCode)
  const customCss = useEditorStore((s) => s.customCss)
  const viewportMode = useEditorStore((s) => s.viewportMode)
  const zoom = useEditorStore((s) => s.zoom)
  const theme = useEditorStore((s) => s.theme)
  const showLayoutOutlines = useEditorStore((s) => s.showLayoutOutlines)
  const projectTheme = useProjectStore((s) => s.settings.theme)
  const projectThemeVariants = useProjectStore((s) => s.settings.themes)
  const framework = useProjectStore((s) => s.settings.framework)
  const pages = useProjectStore((s) => s.pages)
  const folders = useProjectStore((s) => s.folders)
  const showTabChildSelectionWarning = useAppSettingsStore((s) => s.showTabChildSelectionWarning)
  const setShowTabChildSelectionWarning = useAppSettingsStore((s) => s.setShowTabChildSelectionWarning)
  const activeTabEditBlockId = useEditorStore((s) => s.activeTabEditBlockId)
  const activeTabIndex = useEditorStore((s) => s.activeTabIndex)
  const exitTabEditMode = useEditorStore((s) => s.exitTabEditMode)

  const blocksRef = useRef(blocks)
  useEffect(() => {
    blocksRef.current = blocks
  }, [blocks])



  useEffect(() => {
    if (showTabChildSelectionWarning) return
    console.warn('[amagon][tabs-warning][canvas] setting disabled, hiding warning')
    setTabWarningVisible(false)
  }, [showTabChildSelectionWarning])

  useEffect(() => {
    const maybeShowNestedTabSelectionToast = (redirected?: boolean) => {
      console.warn('[amagon][tabs-warning][canvas] maybeShowNestedTabSelectionToast', {
        redirected,
        showTabChildSelectionWarning
      })
      if (!redirected || !showTabChildSelectionWarning) return
      console.warn('[amagon][tabs-warning][canvas] showing warning')
      setTabWarningVisible(true)
    }

    const onMessage = (event: MessageEvent) => {
      const data = event.data as CanvasRuntimeMessage
      if (!data || data.source !== 'canvas-runtime') return
      if (data.type === 'debug') {
        console.warn('[amagon][tabs-warning][bridge]', data.payload)
        return
      }
      if (data.type === 'clicked' || data.type === 'contextMenu') {
        console.warn('[amagon][tabs-warning][canvas] received runtime message', data)
      }

      switch (data.type) {
        case 'ready':
          setRuntimeReady(true)
          break
        case 'clicked':
          selectBlock(data.blockId ?? null)
          maybeShowNestedTabSelectionToast(data.redirectedFromNestedTabContent)
          setContextMenu(null)
          break
        case 'hovered':
          hoverBlock(data.blockId ?? null)
          break
        case 'contextMenu':
          if (data.blockId) {
            selectBlock(data.blockId)
            maybeShowNestedTabSelectionToast(data.redirectedFromNestedTabContent)
            const iframeRect = iframeRef.current?.getBoundingClientRect()
            if (iframeRect && data.clientX !== undefined && data.clientY !== undefined) {
              setContextMenu({
                x: iframeRect.left + data.clientX * (zoom / 100),
                y: iframeRect.top + data.clientY * (zoom / 100),
                blockId: data.blockId
              })
            }
          }
          break
        case 'moveBlock': {
          if (isTypingCode) return
          const tree = blocksRef.current
          const movedId = data.blockId
          const drop = data.dropTarget
          if (!movedId || !drop?.targetBlockId) return
          if (drop.targetBlockId === movedId) return

          const movedLoc = findParentAndIndex(tree, movedId)
          if (!movedLoc) return

          let newParentId: string | null = null
          let newIndex = 0

          if (drop.mode === 'inside') {
            newParentId = drop.targetBlockId
            const parent = findBlockById(tree, newParentId)
            newIndex = parent?.children.length ?? 0
          } else {
            const targetLoc = findParentAndIndex(tree, drop.targetBlockId)
            if (!targetLoc) return
            newParentId = targetLoc.parentId
            newIndex = drop.mode === 'before' ? targetLoc.index : targetLoc.index + 1
          }

          if (movedLoc && movedLoc.parentId === newParentId && movedLoc.index < newIndex) {
            newIndex = Math.max(0, newIndex - 1)
          }

          if (movedLoc.parentId === newParentId && movedLoc.index === newIndex) {
            return
          }

          moveBlock(movedId, newParentId, newIndex)
          break
        }
        case 'updateText': {
          if (data.blockId && data.text !== undefined) {
            updateBlock(data.blockId, { props: { text: data.text } })
          }
          break
        }
        case 'keydown': {
          const ke = new KeyboardEvent('keydown', {
            key: data.key,
            code: data.code,
            ctrlKey: data.ctrlKey,
            metaKey: data.metaKey,
            shiftKey: data.shiftKey,
            altKey: data.altKey,
            bubbles: true,
            cancelable: true
          })
          window.dispatchEvent(ke)
          break
        }
        case 'deleteBlock': {
          if (data.blockId) {
            removeBlock(data.blockId)
          }
          break
        }
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [hoverBlock, isTypingCode, moveBlock, selectBlock, zoom, updateBlock, removeBlock, showTabChildSelectionWarning])

  useEffect(() => {
    console.warn('[amagon][tabs-warning][canvas] render state', {
      tabWarningVisible,
      showTabChildSelectionWarning
    })
  }, [tabWarningVisible, showTabChildSelectionWarning])

  const menuItems = useMemo<ContextMenuItem[]>(() => {
    if (!contextMenu) return []
    const blockId = contextMenu.blockId

    return [
      {
        label: 'Cut',
        action: () => {
          const block = getBlockById(blockId)
          if (block) {
            setClipboard(block)
            removeBlock(blockId)
          }
        }
      },
      {
        label: 'Copy',
        action: () => {
          const block = getBlockById(blockId)
          if (block) {
            setClipboard(block)
          }
        }
      },
      {
        label: 'Paste',
        disabled: !clipboard,
        action: () => {
          if (clipboard) {
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
            addBlock(newBlock, blockId)
          }
        }
      },
      { divider: true, label: '' },
      {
        label: 'Delete',
        danger: true,
        action: () => {
          removeBlock(blockId)
        }
      }
    ]
  }, [contextMenu, clipboard, addBlock, removeBlock, setClipboard, getBlockById])

  const postToIframe = (msg: unknown): void => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    win.postMessage(msg, '*')
  }

  useEffect(() => {
    setRuntimeReady(false)
  }, [framework])

  useEffect(() => {
    if (!runtimeReady) return
    postToIframe({ type: 'setFramework', framework })
  }, [runtimeReady, framework])

  useEffect(() => {
    if (!runtimeReady) return
    const html = blockToHtml(blocks, { includeDataAttributes: true, pages, folders, framework })
    postToIframe({ type: 'render', html })
  }, [blocks, runtimeReady, pages, folders, framework])

  useEffect(() => {
    if (!runtimeReady) return
    const themeCss = themeToCSS(projectTheme, projectThemeVariants)
    postToIframe({ type: 'setThemeCss', css: themeCss })
  }, [projectTheme, projectThemeVariants, runtimeReady])

  useEffect(() => {
    if (!runtimeReady) return
    postToIframe({ type: 'setPageThemeMode', mode: projectThemeVariants?.previewMode ?? 'device' })
  }, [projectThemeVariants?.previewMode, runtimeReady])

  useEffect(() => {
    if (!runtimeReady) return
    postToIframe({ type: 'setCustomCss', css: customCss })
  }, [customCss, runtimeReady])

  useEffect(() => {
    if (!runtimeReady) return
    postToIframe({ type: 'select', blockId: selectedBlockId })
  }, [runtimeReady, selectedBlockId])

  useEffect(() => {
    if (!runtimeReady) return
    postToIframe({ type: 'highlight', blockId: hoveredBlockId })
  }, [runtimeReady, hoveredBlockId])

  useEffect(() => {
    if (!runtimeReady) return
    postToIframe({ type: 'toggleLayoutOutlines', show: showLayoutOutlines })
  }, [runtimeReady, showLayoutOutlines])

  useEffect(() => {
    if (!runtimeReady) return
    postToIframe({ type: 'setUiTheme', isDark: theme === 'dark' })
  }, [runtimeReady, theme])

  const scale = zoom / 100
  const viewportWidth = viewportMode === 'desktop' ? '100%' : viewportMode === 'tablet' ? '820px' : '390px'
  const viewportHeight = '100%'
  const scaledContentWidth = `${100 / scale}%`
  const scaledContentHeight = `${100 / scale}%`

  return (
    <div className="canvas-wrapper" style={{ display: 'flex', flexDirection: 'column' }}>
      {activeTabEditBlockId && activeTabIndex !== null && (
        <div className="tab-edit-toolbar" style={{
          padding: '8px 16px',
          background: 'var(--theme-surface)',
          borderBottom: '2px solid var(--theme-primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--theme-text)',
          flexShrink: 0,
          zIndex: 10
        }}>
          <div>
            <strong><Layers size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Editing Tab Content</strong>
          </div>
          <button 
            onClick={() => exitTabEditMode()}
            style={{
              padding: '6px 12px',
              background: 'var(--theme-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            ← Back to Main Page
          </button>
        </div>
      )}
      {!runtimeReady && (
        <div className="canvas-loading">
          <div className="canvas-spinner" />
          <span>Initializing Editor...</span>
        </div>
      )}
      <div
        className="canvas-viewport"
        style={{
          width: viewportWidth,
          maxWidth: viewportWidth,
          height: viewportHeight,
          flex: 1,
          minHeight: 0,
          alignSelf: viewportMode === 'desktop' ? 'flex-start' : undefined,
          transition: 'width 0.3s ease, max-width 0.3s ease, height 0.3s ease'
        }}
      >
        <div
          style={{
            width: scaledContentWidth,
            height: scaledContentHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            transition: 'width 0.3s ease, height 0.3s ease, transform 0.2s ease'
          }}
        >
          <iframe
            key={framework}
            ref={iframeRef}
            className="canvas-iframe"
            src="./canvas.html"
            title="Page Preview"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
        {tabWarningVisible && showTabChildSelectionWarning && (
          <div className="canvas-warning-toast" role="status" aria-live="polite">
            <div className="canvas-warning-message">You are trying to select a component inside a tab component</div>
            <div className="canvas-warning-actions">
              <button type="button" className="canvas-warning-btn" onClick={() => setTabWarningVisible(false)}>
                OK
              </button>
              <button
                type="button"
                className="canvas-warning-btn"
                onClick={() => {
                  setShowTabChildSelectionWarning(false)
                  setTabWarningVisible(false)
                }}
              >
                Hide this warning
              </button>
            </div>
          </div>
        )}
      </div>
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={menuItems} onClose={() => setContextMenu(null)} />}
    </div>
  )
}

export default Canvas
