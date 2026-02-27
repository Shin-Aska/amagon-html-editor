import { useEffect, useCallback } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { createBlock, type Block, generateBlockId } from '../store/types'

interface UseKeyboardShortcutsOptions {
  onSave: () => void
  onSaveAs: () => void
  onOpen: () => void
  onExport: () => void
  onToggleCodeEditor: () => void
  onToggleLeftPanel: () => void
  onToggleRightPanel: () => void
  leftPanelOpen: boolean
  rightPanelOpen: boolean
  codeEditorOpen: boolean
  onNewProject: () => void
  onSetEditorLayout?: (layout: 'standard' | 'no-sidebar' | 'no-inspector' | 'canvas-only' | 'code-focus' | 'zen') => void
}

// Deep clone a block tree with new IDs
function cloneBlockTree(block: Block): Block {
  const newBlock = createBlock(block.type, {
    props: { ...block.props },
    styles: { ...block.styles },
    classes: [...block.classes],
    content: block.content,
    tag: block.tag
  })

  if (block.children && block.children.length > 0) {
    newBlock.children = block.children.map(child => cloneBlockTree(child))
  }

  return newBlock
}

// Find parent of a block
function findParent(blocks: Block[], targetId: string): Block | null {
  const findInChildren = (parent: Block, targetId: string): Block | null => {
    for (const child of parent.children) {
      if (child.id === targetId) return parent
      const found = findInChildren(child, targetId)
      if (found) return found
    }
    return null
  }

  for (const block of blocks) {
    if (block.id === targetId) return null // Top-level block
    const found = findInChildren(block, targetId)
    if (found) return found
  }

  return null
}

// Get siblings of a block
function getSiblings(blocks: Block[], blockId: string): Block[] | null {
  for (const block of blocks) {
    if (block.id === blockId) {
      return blocks // Top-level siblings
    }
    const childSiblings = getSiblings(block.children, blockId)
    if (childSiblings) return childSiblings
  }
  return null
}

// Find block index among siblings
function findSiblingIndex(siblings: Block[], blockId: string): number {
  return siblings.findIndex(b => b.id === blockId)
}

// Find next/previous sibling
function findAdjacentSibling(
  blocks: Block[],
  blockId: string,
  direction: 'next' | 'prev'
): Block | null {
  const siblings = getSiblings(blocks, blockId)
  if (!siblings) return null

  const index = findSiblingIndex(siblings, blockId)
  if (index === -1) return null

  if (direction === 'next' && index < siblings.length - 1) {
    return siblings[index + 1]
  }
  if (direction === 'prev' && index > 0) {
    return siblings[index - 1]
  }
  return null
}

// Find first child of a block
function getFirstChild(block: Block): Block | null {
  if (block.children && block.children.length > 0) {
    return block.children[0]
  }
  return null
}

// Find parent from root
function findParentFromRoot(blocks: Block[], targetId: string): Block | null {
  for (const block of blocks) {
    if (block.id === targetId) return null
    for (const child of block.children) {
      if (child.id === targetId) return block
      const found = findParentFromRoot(block.children, targetId)
      if (found) return found
    }
  }
  return null
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const {
    onSave,
    onSaveAs,
    onOpen,
    onExport,
    onToggleCodeEditor,
    onToggleLeftPanel,
    onToggleRightPanel,
    onNewProject,
    onSetEditorLayout
  } = options

  // Store access
  const blocks = useEditorStore((s) => s.blocks)
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
  const selectBlock = useEditorStore((s) => s.selectBlock)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const addBlock = useEditorStore((s) => s.addBlock)
  const removeBlock = useEditorStore((s) => s.removeBlock)
  const getBlockById = useEditorStore((s) => s.getBlockById)
  const clipboard = useEditorStore((s) => s.clipboard)
  const setClipboard = useEditorStore((s) => s.setClipboard)
  const setIsDragging = useEditorStore((s) => s.setIsDragging)
  const isDragging = useEditorStore((s) => s.isDragging)
  const isTypingCode = useEditorStore((s) => s.isTypingCode)

  // Clipboard operations
  const handleCopy = useCallback(() => {
    if (selectedBlockId) {
      const block = getBlockById(selectedBlockId)
      if (block) {
        // Clone to clipboard with new IDs (so we can paste multiple times)
        const cloned = cloneBlockTree(block)
        setClipboard(cloned)
      }
    }
  }, [selectedBlockId, getBlockById, setClipboard])

  const handleCut = useCallback(() => {
    if (selectedBlockId) {
      const block = getBlockById(selectedBlockId)
      if (block) {
        const cloned = cloneBlockTree(block)
        setClipboard(cloned)
        removeBlock(selectedBlockId)
      }
    }
  }, [selectedBlockId, getBlockById, setClipboard, removeBlock])

  const handlePaste = useCallback(() => {
    if (clipboard) {
      // Clone the clipboard block to generate new IDs
      const newBlock = cloneBlockTree(clipboard)

      // Insert after selected block, or at root if nothing selected
      if (selectedBlockId) {
        const parent = findParentFromRoot(blocks, selectedBlockId)
        const siblings = getSiblings(blocks, selectedBlockId)
        if (siblings) {
          const index = findSiblingIndex(siblings, selectedBlockId)
          addBlock(newBlock, parent?.id ?? null, index + 1)
        } else {
          addBlock(newBlock, null)
        }
      } else {
        // Add to root
        addBlock(newBlock, null)
      }
      selectBlock(newBlock.id)
    }
  }, [clipboard, selectedBlockId, blocks, addBlock, selectBlock])

  const handleDuplicate = useCallback(() => {
    if (selectedBlockId) {
      const block = getBlockById(selectedBlockId)
      if (block) {
        const newBlock = cloneBlockTree(block)
        const parent = findParentFromRoot(blocks, selectedBlockId)
        const siblings = getSiblings(blocks, selectedBlockId)
        if (siblings) {
          const index = findSiblingIndex(siblings, selectedBlockId)
          addBlock(newBlock, parent?.id ?? null, index + 1)
        } else {
          addBlock(newBlock, null)
        }
        selectBlock(newBlock.id)
      }
    }
  }, [selectedBlockId, getBlockById, blocks, addBlock, selectBlock])

  const handleDelete = useCallback(() => {
    if (selectedBlockId) {
      // Find next sibling to select after deletion
      const nextSibling = findAdjacentSibling(blocks, selectedBlockId, 'next')
      const prevSibling = findAdjacentSibling(blocks, selectedBlockId, 'prev')

      removeBlock(selectedBlockId)

      // Select adjacent block
      if (nextSibling) {
        selectBlock(nextSibling.id)
      } else if (prevSibling) {
        selectBlock(prevSibling.id)
      }
    }
  }, [selectedBlockId, blocks, removeBlock, selectBlock])

  // Navigation with arrow keys
  const handleArrowNavigation = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!selectedBlockId) {
      // Select first block if nothing selected
      if (blocks.length > 0) {
        selectBlock(blocks[0].id)
      }
      return
    }

    const block = getBlockById(selectedBlockId)
    if (!block) return

    if (direction === 'down') {
      // Next sibling
      const next = findAdjacentSibling(blocks, selectedBlockId, 'next')
      if (next) selectBlock(next.id)
    } else if (direction === 'up') {
      // Previous sibling
      const prev = findAdjacentSibling(blocks, selectedBlockId, 'prev')
      if (prev) selectBlock(prev.id)
    } else if (direction === 'right') {
      // Navigate into first child
      const firstChild = getFirstChild(block)
      if (firstChild) selectBlock(firstChild.id)
    } else if (direction === 'left') {
      // Navigate to parent
      const parent = findParentFromRoot(blocks, selectedBlockId)
      if (parent) selectBlock(parent.id)
    }
  }, [selectedBlockId, blocks, getBlockById, selectBlock])

  // Tab navigation (into/out of children)
  const handleTabNavigation = useCallback((forward: boolean) => {
    if (!selectedBlockId) {
      if (blocks.length > 0) {
        selectBlock(blocks[0].id)
      }
      return
    }

    const block = getBlockById(selectedBlockId)
    if (!block) return

    if (forward) {
      // Try to navigate into first child
      const firstChild = getFirstChild(block)
      if (firstChild) {
        selectBlock(firstChild.id)
      }
    } else {
      // Navigate to parent
      const parent = findParentFromRoot(blocks, selectedBlockId)
      if (parent) {
        selectBlock(parent.id)
      }
    }
  }, [selectedBlockId, blocks, getBlockById, selectBlock])

  // Main keyboard handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in an input, textarea, or contenteditable
    const target = e.target as HTMLElement
    // If e.target is the Window (e.g. from artificial window.dispatchEvent bubbling from Canvas), these properties will be undefined
    const closestContentEditable = target?.closest?.('[contenteditable="true"]') ?? null
    const isInputElement =
      target?.tagName === 'INPUT' ||
      target?.tagName === 'TEXTAREA' ||
      target?.contentEditable === 'true' ||
      closestContentEditable !== null

    const isCtrl = e.ctrlKey || e.metaKey

    const isBackslash =
      e.code === 'Backslash' ||
      e.code === 'IntlBackslash' ||
      e.code === 'IntlYen' ||
      e.key === '\\' ||
      e.key === '¥'
    const isSlash = e.code === 'Slash' || e.code === 'NumpadDivide' || e.key === '/'
    const isQuestionMark = e.key === '?'

    if (isCtrl && e.key.toLowerCase() === 's') {
      e.preventDefault()
      if (e.shiftKey) {
        onSaveAs()
      } else {
        onSave()
      }
      return
    }

    if (isCtrl && (isBackslash || (isSlash && !isQuestionMark))) {
      e.preventDefault()
      if (isBackslash) {
        onToggleLeftPanel()
      } else {
        onToggleRightPanel()
      }
      return
    }

    // Special handling for Escape
    if (e.key === 'Escape') {
      if (isDragging) {
        setIsDragging(false)
        e.preventDefault()
        return
      }
      // Deselect if not typing
      if (!isTypingCode && !isInputElement) {
        selectBlock(null)
        e.preventDefault()
        return
      }
    }

    // If typing in input, only handle Escape
    if (isInputElement) return

    // Handle Ctrl/Cmd key combinations
    if (isCtrl) {
      switch (e.key.toLowerCase()) {
        case 'o':
          e.preventDefault()
          onOpen()
          return

        case 'n':
          e.preventDefault()
          onNewProject()
          return

        case 'e':
          e.preventDefault()
          onToggleCodeEditor()
          return

        case 'z':
          e.preventDefault()
          if (e.shiftKey) {
            redo()
          } else {
            undo()
          }
          return

        case 'y':
          e.preventDefault()
          redo()
          return

        case 'c':
          e.preventDefault()
          handleCopy()
          return

        case 'x':
          e.preventDefault()
          handleCut()
          return

        case 'v':
          e.preventDefault()
          handlePaste()
          return

        case 'd':
          e.preventDefault()
          handleDuplicate()
          return

        case 'k':
          // Command palette - handled by the CommandPalette component
          return

        case '\\':
          e.preventDefault()
          onToggleLeftPanel()
          return

        case '/':
          e.preventDefault()
          onToggleRightPanel()
          return

        case '1':
        case '2':
        case '3':
          // Panel toggles with numbers
          e.preventDefault()
          if (e.key === '1') onToggleLeftPanel()
          if (e.key === '2') onToggleCodeEditor()
          if (e.key === '3') onToggleRightPanel()
          return

        // Layout switching with F1-F6
        case 'f1':
          e.preventDefault()
          onSetEditorLayout?.('standard')
          return
        case 'f2':
          e.preventDefault()
          onSetEditorLayout?.('no-sidebar')
          return
        case 'f3':
          e.preventDefault()
          onSetEditorLayout?.('no-inspector')
          return
        case 'f4':
          e.preventDefault()
          onSetEditorLayout?.('canvas-only')
          return
        case 'f5':
          e.preventDefault()
          onSetEditorLayout?.('code-focus')
          return
        case 'f6':
          e.preventDefault()
          onSetEditorLayout?.('zen')
          return
      }
    }

    // Delete/Backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // Don't delete if we have a selection in the document
      const selection = window.getSelection()
      if (selection && selection.toString().length > 0) {
        return
      }
      e.preventDefault()
      handleDelete()
      return
    }

    // Arrow key navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault()
      const direction = e.key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right'
      handleArrowNavigation(direction)
      return
    }

    // Tab navigation
    if (e.key === 'Tab') {
      e.preventDefault()
      handleTabNavigation(!e.shiftKey)
      return
    }
  }, [
    isDragging,
    isTypingCode,
    setIsDragging,
    selectBlock,
    onSave,
    onSaveAs,
    onOpen,
    onExport,
    onNewProject,
    onToggleCodeEditor,
    onToggleLeftPanel,
    onToggleRightPanel,
    onSetEditorLayout,
    undo,
    redo,
    handleCopy,
    handleCut,
    handlePaste,
    handleDuplicate,
    handleDelete,
    handleArrowNavigation,
    handleTabNavigation
  ])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [handleKeyDown])
}
