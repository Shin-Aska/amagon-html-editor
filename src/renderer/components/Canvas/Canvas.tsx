import { useEffect, useMemo, useRef, useState } from 'react'
import ContextMenu, { type ContextMenuItem } from '../ContextMenu/ContextMenu'
import './Canvas.css'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
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

  const blocksRef = useRef(blocks)
  useEffect(() => {
    blocksRef.current = blocks
  }, [blocks])

  const seededBlocks = useMemo(() => {
    return [
      createBlock('container', {
        classes: ['container', 'py-5', 'text-center'],
        children: [
          createBlock('heading', {
            props: { text: 'Welcome to Amagon', level: 1 },
            classes: ['mb-3']
          }),
          createBlock('paragraph', {
            props: { text: 'Drag widgets from the sidebar to start building your page.' },
            classes: ['text-muted']
          }),
          createBlock('button', {
            props: { text: 'Get Started', type: 'button' },
            classes: ['btn', 'btn-primary', 'mt-3']
          })
        ]
      })
    ]
  }, [])

  useEffect(() => {
    if (blocks.length === 0) {
      setPageBlocks(seededBlocks)
    }
  }, [blocks.length, seededBlocks, setPageBlocks])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as CanvasRuntimeMessage
      if (!data || data.source !== 'canvas-runtime') return

      switch (data.type) {
        case 'ready':
          setRuntimeReady(true)
          break
        case 'clicked':
          selectBlock(data.blockId ?? null)
          setContextMenu(null)
          break
        case 'hovered':
          hoverBlock(data.blockId ?? null)
          break
        case 'contextMenu':
          if (data.blockId) {
            selectBlock(data.blockId)
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
  }, [hoverBlock, isTypingCode, moveBlock, selectBlock, zoom, updateBlock, removeBlock])

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
    if (!runtimeReady) return
    const html = blockToHtml(blocks, { includeDataAttributes: true })
    postToIframe({ type: 'render', html })
  }, [blocks, runtimeReady])

  useEffect(() => {
    if (!runtimeReady) return
    const themeCss = themeToCSS(projectTheme)
    postToIframe({ type: 'setThemeCss', css: themeCss })
  }, [projectTheme, runtimeReady])

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

  const viewportMaxWidth =
    viewportMode === 'desktop' ? '100%' : viewportMode === 'tablet' ? '820px' : '390px'

  return (
    <div className="canvas-wrapper">
      {!runtimeReady && (
        <div className="canvas-loading">
          <div className="canvas-spinner" />
          <span>Initializing Editor...</span>
        </div>
      )}
      <div
        className="canvas-viewport"
        style={{
          maxWidth: viewportMaxWidth,
          transform: `scale(${zoom / 100})`,
          transformOrigin: 'top center',
          transition: 'max-width 0.3s ease, transform 0.2s ease'
        }}
      >
        <iframe
          ref={iframeRef}
          className="canvas-iframe"
          src="/canvas.html"
          title="Page Preview"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={menuItems} onClose={() => setContextMenu(null)} />}
    </div>
  )
}

export default Canvas
