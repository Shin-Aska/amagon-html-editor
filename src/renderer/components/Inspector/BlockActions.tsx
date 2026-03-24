import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { createBlock } from '../../store/types'
import { componentRegistry } from '../../registry/ComponentRegistry'
import { useToastStore } from '../../store/toastStore'
import { getApi } from '../../utils/api'
import './BlockActions.css'
import { useMemo, useState } from 'react'
import SaveCustomBlockDialog from './SaveCustomBlockDialog'
import { ArrowUp, ArrowDown, Copy, Lock, LockOpen, Star, Trash2 } from 'lucide-react'

interface BlockActionsProps {
  blockId: string
  blockType: string
}

export default function BlockActions({ blockId, blockType }: BlockActionsProps): JSX.Element {
  const api = getApi()
  const getBlockById = useEditorStore((s) => s.getBlockById)
  const getBlockPath = useEditorStore((s) => s.getBlockPath)
  const addBlock = useEditorStore((s) => s.addBlock)
  const removeBlock = useEditorStore((s) => s.removeBlock)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const moveBlock = useEditorStore((s) => s.moveBlock)
  const blocks = useEditorStore((s) => s.blocks)
  const addUserBlock = useProjectStore((s) => s.addUserBlock)
  const userBlocks = useProjectStore((s) => s.userBlocks)
  const showToast = useToastStore((s) => s.showToast)

  const [showSaveCustomBlock, setShowSaveCustomBlock] = useState(false)

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
    setShowSaveCustomBlock(true)
  }

  const saveDefaults = useMemo(() => {
    const definition = componentRegistry.get(blockType)
    const defaultLabel = definition?.label ? `${definition.label}` : 'My Custom Block'
    const defaultIcon = blockType ? `lucide:${blockType}` : 'lucide:user-block'
    const defaultCategory = definition?.category ? definition.category : 'User Blocks'

    const preferredCategories = ['Layout', 'Typography', 'Media', 'Interactive', 'Components', 'Embed']
    const existingCategories = componentRegistry.getCategories()
    const userCategories = (userBlocks || []).map((ub) => (ub.category || '').trim()).filter(Boolean)

    const registryLucideIcons = componentRegistry.getAll().map((d) => `lucide:${d.type}`)
    const userIcons = (userBlocks || [])
      .map((ub) => (ub.icon || '').trim())
      .filter((i) => !!i && i.startsWith('lucide:'))

    const availableCategories = Array.from(new Set([...preferredCategories, ...existingCategories, ...userCategories]))
    const availableIcons = Array.from(new Set([defaultIcon, ...registryLucideIcons, ...userIcons]))

    return {
      availableCategories,
      availableIcons,
      defaultLabel,
      defaultIcon,
      defaultCategory
    }
  }, [blockType, userBlocks])

  return (
    <div className="block-actions-editor">
      <div className="action-buttons-grid">
        <button className="action-btn" onClick={handleMoveUp} title="Move Up" disabled={isLocked}>
          <span className="action-icon"><ArrowUp size={14} /></span> Move Up
        </button>
        <button className="action-btn" onClick={handleMoveDown} title="Move Down" disabled={isLocked}>
          <span className="action-icon"><ArrowDown size={14} /></span> Move Down
        </button>
        <button className="action-btn" onClick={handleDuplicate} title="Duplicate" disabled={isLocked}>
          <span className="action-icon"><Copy size={14} /></span> Duplicate
        </button>
        <button className={`action-btn ${isLocked ? 'active' : ''}`} onClick={handleToggleLock} title={isLocked ? "Unlock Block" : "Lock Block"}>
          <span className="action-icon">{isLocked ? <Lock size={14} /> : <LockOpen size={14} />}</span> {isLocked ? 'Unlock' : 'Lock'}
        </button>
      </div>

      <button className="action-btn primary-action-btn mt-2" onClick={handleSaveAsUserBlock} title="Save as reusable block">
        <span className="action-icon"><Star size={14} /></span> Save as Custom Block
      </button>

      <SaveCustomBlockDialog
        isOpen={showSaveCustomBlock}
        availableCategories={saveDefaults.availableCategories}
        availableIcons={saveDefaults.availableIcons}
        defaultLabel={saveDefaults.defaultLabel}
        defaultIcon={saveDefaults.defaultIcon}
        defaultCategory={saveDefaults.defaultCategory}
        onCancel={() => setShowSaveCustomBlock(false)}
        onSave={({ label, icon, category }) => {
          const clonedContent = JSON.parse(JSON.stringify(block))
          addUserBlock({
            id: `custom-${Date.now().toString(36)}`,
            label,
            icon,
            category,
            content: clonedContent
          })
          setShowSaveCustomBlock(false)
          showToast(`Saved custom block: ${label}`, 'success')

          ;(async () => {
            try {
              const editorState = useEditorStore.getState()
              const projectState = useProjectStore.getState()
              const pageId = projectState.currentPageId
              if (!projectState.filePath) return

              const pages = projectState.pages.map((p) =>
                pageId && p.id === pageId ? { ...p, blocks: editorState.getFullBlocks() } : p
              )

              if (pageId) {
                projectState.updatePage(pageId, { blocks: editorState.getFullBlocks() })
              }

              const content = JSON.stringify(
                {
                  projectSettings: projectState.settings,
                  pages,
                  userBlocks: projectState.userBlocks,
                  customCss: editorState.customCss
                },
                null,
                2
              )

              const result = await api.project.save({
                filePath: projectState.filePath || undefined,
                content
              })

              if (result.success && result.filePath && result.filePath !== projectState.filePath) {
                projectState.setFilePath(result.filePath)
              }
            } catch {
              // ignore background persistence errors
            }
          })()
        }}
      />

      <button className="action-btn danger-action-btn mt-2" onClick={handleDelete} title="Delete Block" disabled={isLocked}>
        <span className="action-icon"><Trash2 size={14} /></span> Delete Block
      </button>
    </div>
  )
}
