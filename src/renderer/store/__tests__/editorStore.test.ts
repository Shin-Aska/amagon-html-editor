import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../../store/editorStore'
import type { Block } from '../../store/types'
import { createBlock } from '../../store/types'

const get = () => useEditorStore.getState()

// Initial state for resetting store between tests
const initialEditorState = {
  blocks: [],
  selectedBlockId: null,
  hoveredBlockId: null,
  history: [{ blocks: [], timestamp: Date.now() }],
  historyIndex: 0,
  isDirty: false,
  isDragging: false,
  isTypingCode: false,
  customCss: '',
  viewportMode: 'desktop' as const,
  zoom: 100,
  theme: 'dark' as const,
  clipboard: null
}

describe('editorStore - block tree manipulation', () => {
  let store: ReturnType<typeof useEditorStore.getState>

  beforeEach(() => {
    useEditorStore.setState(initialEditorState)
    store = get()
  })

  describe('addBlock', () => {
    it('adds a block to root when no parent specified', () => {
      const block = createBlock('heading', { props: { text: 'Test', level: 1 } })
      store.addBlock(block)
      
      expect(get().blocks).toHaveLength(1)
      expect(get().blocks[0].type).toBe('heading')
      expect(get().blocks[0].props.text).toBe('Test')
    })

    it('adds a block as child when parent specified', () => {
      const parent = createBlock('container', { classes: ['wrapper'] })
      store.addBlock(parent)
      
      const child = createBlock('paragraph', { props: { text: 'Child' } })
      store.addBlock(child, parent.id)
      
      const addedParent = get().blocks[0]
      expect(addedParent.children).toHaveLength(1)
      expect(addedParent.children[0].type).toBe('paragraph')
    })

    it('inserts block at specific index', () => {
      const block1 = createBlock('heading', { props: { text: 'First', level: 1 } })
      const block2 = createBlock('heading', { props: { text: 'Second', level: 1 } })
      const block3 = createBlock('heading', { props: { text: 'Middle', level: 1 } })
      
      store.addBlock(block1)
      store.addBlock(block2)
      store.addBlock(block3, null, 1)
      
      expect(get().blocks).toHaveLength(3)
      expect(get().blocks[1].props.text).toBe('Middle')
    })
  })

  describe('removeBlock', () => {
    it('removes a block from root', () => {
      const block = createBlock('heading', { props: { text: 'Test', level: 1 } })
      store.addBlock(block)
      
      store.removeBlock(block.id)
      
      expect(get().blocks).toHaveLength(0)
    })

    it('removes a block from parent children', () => {
      const parent = createBlock('container', { classes: ['wrapper'] })
      const child = createBlock('paragraph', { props: { text: 'Child' } })
      parent.children.push(child)
      store.addBlock(parent)
      
      store.removeBlock(child.id)
      
      expect(get().blocks[0].children).toHaveLength(0)
    })

    it('clears selection when selected block is removed', () => {
      const block = createBlock('heading', { props: { text: 'Test', level: 1 } })
      store.addBlock(block)
      store.selectBlock(block.id)
      
      store.removeBlock(block.id)
      
      expect(get().selectedBlockId).toBeNull()
    })
  })

  describe('moveBlock', () => {
    it('moves a block to a new parent', () => {
      const container = createBlock('container')
      const block = createBlock('paragraph', { props: { text: 'Move me' } })
      store.addBlock(container)
      store.addBlock(block)
      
      store.moveBlock(block.id, container.id, -1)
      
      expect(get().blocks).toHaveLength(1) // Only container at root
      expect(get().blocks[0].children).toHaveLength(1)
      expect(get().blocks[0].children[0].props.text).toBe('Move me')
    })

    it('moves a block to a specific index', () => {
      const block1 = createBlock('heading', { props: { text: 'First', level: 1 } })
      const block2 = createBlock('heading', { props: { text: 'Second', level: 1 } })
      const block3 = createBlock('heading', { props: { text: 'Third', level: 1 } })
      
      store.addBlock(block1)
      store.addBlock(block2)
      store.addBlock(block3)
      
      // Move Third to index 0
      store.moveBlock(block3.id, null, 0)
      
      expect(get().blocks[0].props.text).toBe('Third')
      expect(get().blocks[1].props.text).toBe('First')
      expect(get().blocks[2].props.text).toBe('Second')
    })

    it('prevents moving a block into its own descendant', () => {
      const parent = createBlock('container')
      const child = createBlock('paragraph')
      parent.children.push(child)
      store.addBlock(parent)
      
      // Try to move parent into child (should be prevented)
      store.moveBlock(parent.id, child.id, 0)
      
      // Structure should remain unchanged
      expect(get().blocks).toHaveLength(1)
      expect(get().blocks[0].children).toHaveLength(1)
    })
  })

  describe('updateBlock', () => {
    it('updates block props', () => {
      const block = createBlock('heading', { props: { text: 'Old', level: 1 } })
      store.addBlock(block)
      
      store.updateBlock(block.id, { props: { text: 'New' } })
      
      expect(get().blocks[0].props.text).toBe('New')
      expect(get().blocks[0].props.level).toBe(1) // Unchanged
    })

    it('updates block classes', () => {
      const block = createBlock('container', { classes: ['old-class'] })
      store.addBlock(block)
      
      store.updateBlock(block.id, { classes: ['new-class', 'another'] })
      
      expect(get().blocks[0].classes).toEqual(['new-class', 'another'])
    })

    it('updates block styles', () => {
      const block = createBlock('container', { styles: { color: 'red' } })
      store.addBlock(block)
      
      store.updateBlock(block.id, { styles: { backgroundColor: 'blue' } })
      
      expect(get().blocks[0].styles.color).toBe('red')
      expect(get().blocks[0].styles.backgroundColor).toBe('blue')
    })

    it('updates nested block', () => {
      const parent = createBlock('container')
      const child = createBlock('paragraph', { props: { text: 'Child' } })
      parent.children.push(child)
      store.addBlock(parent)
      
      store.updateBlock(child.id, { props: { text: 'Updated' } })
      
      expect(get().blocks[0].children[0].props.text).toBe('Updated')
    })

    it('replaces button variant classes when the variant prop changes', () => {
      const block = createBlock('button', {
        props: { text: 'CTA', variant: 'btn-primary' },
        classes: ['btn', 'btn-primary', 'mt-3']
      })
      store.addBlock(block)

      store.updateBlock(block.id, { props: { variant: 'btn-secondary' } })

      expect(get().blocks[0].props.variant).toBe('btn-secondary')
      expect(get().blocks[0].classes).toEqual(['btn', 'mt-3', 'btn-secondary'])
    })

    it('removes button size classes when size is cleared', () => {
      const block = createBlock('button', {
        props: { text: 'CTA', size: 'btn-lg' },
        classes: ['btn', 'btn-primary', 'btn-lg']
      })
      store.addBlock(block)

      store.updateBlock(block.id, { props: { size: '' } })

      expect(get().blocks[0].props.size).toBe('')
      expect(get().blocks[0].classes).toEqual(['btn', 'btn-primary'])
    })
  })

  describe('getBlockById', () => {
    it('finds a block at root level', () => {
      const block = createBlock('heading', { props: { text: 'Test', level: 1 } })
      store.addBlock(block)
      
      const found = store.getBlockById(block.id)
      
      expect(found).toBeDefined()
      expect(found?.id).toBe(block.id)
    })

    it('finds a nested block', () => {
      const parent = createBlock('container')
      const child = createBlock('paragraph', { props: { text: 'Deep' } })
      const grandchild = createBlock('span', { content: 'Nested' })
      child.children.push(grandchild)
      parent.children.push(child)
      store.addBlock(parent)
      
      const found = store.getBlockById(grandchild.id)
      
      expect(found).toBeDefined()
      expect(found?.id).toBe(grandchild.id)
    })

    it('returns undefined for non-existent block', () => {
      const found = store.getBlockById('non-existent-id')
      expect(found).toBeNull()
    })
  })
})

describe('editorStore - undo/redo', () => {
  let store: ReturnType<typeof useEditorStore.getState>

  beforeEach(() => {
    useEditorStore.setState(initialEditorState)
    store = get()
  })

  it('pushes history entry on addBlock', () => {
    const block = createBlock('heading')
    store.addBlock(block)
    
    expect(get().history).toHaveLength(2)
    expect(get().historyIndex).toBe(1)
  })

  it('pushes history entry on removeBlock', () => {
    const block = createBlock('heading')
    store.addBlock(block)
    store.removeBlock(block.id)
    
    expect(get().history).toHaveLength(3)
  })

  it('pushes history entry on updateBlock', () => {
    const block = createBlock('heading', { props: { text: 'Original' } })
    store.addBlock(block)
    store.updateBlock(block.id, { props: { text: 'Updated' } })
    
    expect(get().history).toHaveLength(3)
  })

  it('undoes last action', () => {
    const block = createBlock('heading', { props: { text: 'Test' } })
    store.addBlock(block)
    
    store.undo()
    
    expect(get().blocks).toHaveLength(0)
    expect(get().historyIndex).toBe(0)
  })

  it('redoes undone action', () => {
    const block = createBlock('heading', { props: { text: 'Test' } })
    store.addBlock(block)
    store.undo()
    
    store.redo()
    
    expect(get().blocks).toHaveLength(1)
    expect(get().blocks[0].props.text).toBe('Test')
    expect(get().historyIndex).toBe(1)
  })

  it('clears redo history when new action is performed after undo', () => {
    const block1 = createBlock('heading')
    const block2 = createBlock('paragraph')
    store.addBlock(block1)
    store.addBlock(block2)
    expect(get().history).toHaveLength(3)
    
    store.undo()
    expect(get().historyIndex).toBe(1)
    
    // Add new block after undo - should clear the redo branch
    const block3 = createBlock('container')
    store.addBlock(block3)
    
    expect(get().history).toHaveLength(3) // Not 3
    expect(get().historyIndex).toBe(2)
  })

  it('limits history to 50 entries', () => {
    // Add 55 blocks
    for (let i = 0; i < 55; i++) {
      store.addBlock(createBlock('paragraph', { props: { text: `Block ${i}` } }))
    }
    
    expect(get().history).toHaveLength(50)
  })

  it('clears selection on undo', () => {
    const block = createBlock('heading')
    store.addBlock(block)
    store.selectBlock(block.id)
    
    store.undo()
    
    expect(get().selectedBlockId).toBeNull()
  })

  it('clears selection on redo', () => {
    const block = createBlock('heading')
    store.addBlock(block)
    store.selectBlock(block.id)
    store.undo()
    
    store.redo()
    
    expect(get().selectedBlockId).toBeNull()
  })
})
