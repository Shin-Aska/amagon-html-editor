import { create } from 'zustand'
import type { Block, EditorState, EditorActions, HistoryEntry } from './types'

const MAX_HISTORY = 50

// ─── Deep clone helper ───────────────────────────────────────────────────────

function cloneBlocks(blocks: Block[]): Block[] {
  return JSON.parse(JSON.stringify(blocks))
}

// ─── Tree traversal helpers ──────────────────────────────────────────────────

function findBlockById(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) return block
    const found = findBlockById(block.children, id)
    if (found) return found
  }
  return null
}

function findBlockPath(blocks: Block[], id: string, path: string[] = []): string[] | null {
  for (const block of blocks) {
    if (block.id === id) return [...path, block.id]
    const found = findBlockPath(block.children, id, [...path, block.id])
    if (found) return found
  }
  return null
}

function removeBlockFromTree(blocks: Block[], id: string): { tree: Block[]; removed: Block | null } {
  let removed: Block | null = null

  const filter = (items: Block[]): Block[] => {
    return items.reduce<Block[]>((acc, block) => {
      if (block.id === id) {
        removed = block
        return acc
      }
      acc.push({ ...block, children: filter(block.children) })
      return acc
    }, [])
  }

  return { tree: filter(blocks), removed }
}

function insertBlockInTree(
  blocks: Block[],
  block: Block,
  parentId: string | null,
  index: number
): Block[] {
  if (parentId === null) {
    const newBlocks = [...blocks]
    const clampedIndex = Math.max(0, Math.min(index, newBlocks.length))
    newBlocks.splice(clampedIndex, 0, block)
    return newBlocks
  }

  return blocks.map((b) => {
    if (b.id === parentId) {
      const newChildren = [...b.children]
      const clampedIndex = Math.max(0, Math.min(index, newChildren.length))
      newChildren.splice(clampedIndex, 0, block)
      return { ...b, children: newChildren }
    }
    return { ...b, children: insertBlockInTree(b.children, block, parentId, index) }
  })
}

function updateBlockInTree(
  blocks: Block[],
  id: string,
  patch: Partial<Omit<Block, 'id' | 'children'>>
): Block[] {
  return blocks.map((block) => {
    if (block.id === id) {
      return { ...block, ...patch }
    }
    return { ...block, children: updateBlockInTree(block.children, id, patch) }
  })
}

function isDescendantOf(blocks: Block[], ancestorId: string, descendantId: string): boolean {
  const ancestor = findBlockById(blocks, ancestorId)
  if (!ancestor) return false
  return findBlockById(ancestor.children, descendantId) !== null
}

// ─── Store ───────────────────────────────────────────────────────────────────

type EditorStore = EditorState & EditorActions

function createHistoryEntry(blocks: Block[]): HistoryEntry {
  return {
    blocks: cloneBlocks(blocks),
    timestamp: Date.now()
  }
}

export const useEditorStore = create<EditorStore>((set, get) => {
  // Push a snapshot onto the history stack, truncating any redo entries
  function pushHistory(currentBlocks: Block[]): { history: HistoryEntry[]; historyIndex: number } {
    const state = get()
    const newHistory = state.history.slice(0, state.historyIndex + 1)
    newHistory.push(createHistoryEntry(currentBlocks))

    // Cap at MAX_HISTORY
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift()
    }

    return {
      history: newHistory,
      historyIndex: newHistory.length - 1
    }
  }

  return {
    // ─── Initial State ─────────────────────────────────────────────────
    blocks: [],
    selectedBlockId: null,
    hoveredBlockId: null,
    history: [createHistoryEntry([])],
    historyIndex: 0,
    isDirty: false,

    isDragging: false,
    isTypingCode: false,

    customCss: '',

    viewportMode: 'desktop',
    zoom: 100,
    theme: 'dark',
    clipboard: null,

    // ─── Block Mutations ───────────────────────────────────────────────

    addBlock: (block, parentId = null, index = -1) => {
      set((state) => {
        const idx = index < 0 ? (parentId ? (findBlockById(state.blocks, parentId)?.children.length ?? 0) : state.blocks.length) : index
        const newBlocks = insertBlockInTree(state.blocks, block, parentId, idx)
        return {
          blocks: newBlocks,
          isDirty: true,
          ...pushHistory(newBlocks)
        }
      })
    },

    updateBlock: (id, patch) => {
      set((state) => {
        const newBlocks = updateBlockInTree(state.blocks, id, patch)
        return {
          blocks: newBlocks,
          isDirty: true,
          ...pushHistory(newBlocks)
        }
      })
    },

    moveBlock: (id, newParentId, newIndex) => {
      set((state) => {
        // Prevent moving a block into its own descendant
        if (newParentId && isDescendantOf(state.blocks, id, newParentId)) {
          return state
        }

        const { tree, removed } = removeBlockFromTree(state.blocks, id)
        if (!removed) return state

        const newBlocks = insertBlockInTree(tree, removed, newParentId, newIndex)
        return {
          blocks: newBlocks,
          isDirty: true,
          ...pushHistory(newBlocks)
        }
      })
    },

    removeBlock: (id) => {
      set((state) => {
        const { tree } = removeBlockFromTree(state.blocks, id)
        const newSelectedId = state.selectedBlockId === id ? null : state.selectedBlockId
        return {
          blocks: tree,
          selectedBlockId: newSelectedId,
          isDirty: true,
          ...pushHistory(tree)
        }
      })
    },

    setIsDragging: (value) => {
      set({ isDragging: value })
    },

    setIsTypingCode: (value) => {
      set({ isTypingCode: value })
    },

    setCustomCss: (css) => {
      set({ customCss: css })
    },

    setViewportMode: (mode) => {
      set({ viewportMode: mode })
    },

    setZoom: (zoom) => {
      set({ zoom: Math.max(25, Math.min(200, zoom)) })
    },

    setTheme: (theme) => {
      set({ theme })
      if (theme === 'dark') {
        document.body.classList.add('dark')
      } else {
        document.body.classList.remove('dark')
      }
    },

    setClipboard: (block) => {
      set({ clipboard: block })
    },

    setPageBlocks: (blocks) => {
      set((state) => {
        const newBlocks = cloneBlocks(blocks)
        return {
          blocks: newBlocks,
          selectedBlockId: null,
          hoveredBlockId: null,
          isDirty: true,
          ...pushHistory(newBlocks)
        }
      })
    },

    // ─── Selection ─────────────────────────────────────────────────────

    selectBlock: (id) => {
      set({ selectedBlockId: id })
    },

    hoverBlock: (id) => {
      set({ hoveredBlockId: id })
    },

    // ─── History ───────────────────────────────────────────────────────

    undo: () => {
      set((state) => {
        if (state.historyIndex <= 0) return state
        const newIndex = state.historyIndex - 1
        const entry = state.history[newIndex]
        return {
          blocks: cloneBlocks(entry.blocks),
          historyIndex: newIndex,
          selectedBlockId: null,
          hoveredBlockId: null
        }
      })
    },

    redo: () => {
      set((state) => {
        if (state.historyIndex >= state.history.length - 1) return state
        const newIndex = state.historyIndex + 1
        const entry = state.history[newIndex]
        return {
          blocks: cloneBlocks(entry.blocks),
          historyIndex: newIndex,
          selectedBlockId: null,
          hoveredBlockId: null
        }
      })
    },

    // ─── Utility ───────────────────────────────────────────────────────

    getBlockById: (id) => {
      return findBlockById(get().blocks, id)
    },

    getBlockPath: (id) => {
      return findBlockPath(get().blocks, id) ?? []
    }
  }
})
