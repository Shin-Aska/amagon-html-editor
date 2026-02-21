import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { createBlock } from '../../store/types'
import { componentRegistry } from '../../registry/ComponentRegistry'
import './BlockActions.css'

interface BlockActionsProps {
  blockId: string
  blockType: string
}

export default function BlockActions({ blockId, blockType }: BlockActionsProps): JSX.Element {
  const getBlockById = useEditorStore((s) => s.getBlockById)
  const getBlockPath = useEditorStore((s) => s.getBlockPath)
  const addBlock = useEditorStore((s) => s.addBlock)
  const removeBlock = useEditorStore((s) => s.removeBlock)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const moveBlock = useEditorStore((s) => s.moveBlock)
  const blocks = useEditorStore((s) => s.blocks)
  const addUserBlock = useProjectStore((s) => s.addUserBlock)

  const block = getBlockById(blockId)
  if (!block) return <></>

  const isLocked = block.locked || false

  const handleDuplicate = () => {
    // We need to find parent and insert after this block
    const path = getBlockPath(blockId)
    const parentId = path.length > 1 ? path[path.length - 2] : null
    
    // Find index of current block
    let siblings = blocks
    if (parentId) {
      const parent = getBlockById(parentId)
      if (parent) siblings = parent.children
    }
    
    const index = siblings.findIndex(b => b.id === blockId)
    if (index === -1) return

    // Clone the block (generate new IDs recursively)
    const cloneNode = (node: any): any => {
      const cloned = createBlock(node.type, {
        props: { ...node.props },
        styles: { ...node.styles },
        classes: [...node.classes],
        content: node.content,
        tag: node.tag
      })
      if (node.children) {
        cloned.children = node.children.map(cloneNode)
      }
      return cloned
    }

    const newBlock = cloneNode(block)
    addBlock(newBlock, parentId, index + 1)
  }

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this block?')) {
      removeBlock(blockId)
    }
  }

  const handleMoveUp = () => {
    const path = getBlockPath(blockId)
    const parentId = path.length > 1 ? path[path.length - 2] : null
    
    let siblings = blocks
    if (parentId) {
      const parent = getBlockById(parentId)
      if (parent) siblings = parent.children
    }
    
    const index = siblings.findIndex(b => b.id === blockId)
    if (index > 0) {
      moveBlock(blockId, parentId, index - 1)
    }
  }

  const handleMoveDown = () => {
    const path = getBlockPath(blockId)
    const parentId = path.length > 1 ? path[path.length - 2] : null
    
    let siblings = blocks
    if (parentId) {
      const parent = getBlockById(parentId)
      if (parent) siblings = parent.children
    }
    
    const index = siblings.findIndex(b => b.id === blockId)
    if (index !== -1 && index < siblings.length - 1) {
      moveBlock(blockId, parentId, index + 2) // +2 because moveBlock inserts before the item at index
    }
  }

  const handleToggleLock = () => {
    updateBlock(blockId, { locked: !isLocked })
  }

  const handleSaveAsUserBlock = () => {
    const label = prompt('Enter a name for this custom block:', 'My Custom Block')
    if (label) {
      const definition = componentRegistry.get(blockType)
      addUserBlock({
        id: `custom-${Date.now().toString(36)}`,
        label,
        icon: typeof definition?.icon === 'string' ? definition.icon : '🧩',
        content: block
      })
      alert(`Block "${label}" saved to User Blocks!`)
    }
  }

  return (
    <div className="block-actions-editor">
      <div className="action-buttons-grid">
        <button className="action-btn" onClick={handleMoveUp} title="Move Up" disabled={isLocked}>
          <span className="action-icon">↑</span> Move Up
        </button>
        <button className="action-btn" onClick={handleMoveDown} title="Move Down" disabled={isLocked}>
          <span className="action-icon">↓</span> Move Down
        </button>
        <button className="action-btn" onClick={handleDuplicate} title="Duplicate" disabled={isLocked}>
          <span className="action-icon">⧉</span> Duplicate
        </button>
        <button className={`action-btn ${isLocked ? 'active' : ''}`} onClick={handleToggleLock} title={isLocked ? "Unlock Block" : "Lock Block"}>
          <span className="action-icon">{isLocked ? '🔒' : '🔓'}</span> {isLocked ? 'Unlock' : 'Lock'}
        </button>
      </div>
      
      <button className="action-btn primary-action-btn mt-2" onClick={handleSaveAsUserBlock} title="Save as reusable block">
        <span className="action-icon">⭐</span> Save as Custom Block
      </button>

      <button className="action-btn danger-action-btn mt-2" onClick={handleDelete} title="Delete Block" disabled={isLocked}>
        <span className="action-icon">🗑️</span> Delete Block
      </button>
    </div>
  )
}
