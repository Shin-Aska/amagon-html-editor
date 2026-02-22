import React, { useState } from 'react'
import './BlockTree.css'
import { useEditorStore } from '../../store/editorStore'
import { type Block } from '../../store/types'
import { componentRegistry } from '../../registry/ComponentRegistry'

interface TreeNodeProps {
  block: Block
  depth: number
  onContextMenu: (e: React.MouseEvent, blockId: string) => void
}

function TreeNode({ block, depth, onContextMenu }: TreeNodeProps): JSX.Element {
  const [expanded, setExpanded] = useState(true)
  const { selectedBlockId, hoveredBlockId, selectBlock, hoverBlock } = useEditorStore()

  const isSelected = selectedBlockId === block.id
  const isHovered = hoveredBlockId === block.id
  const hasChildren = block.children && block.children.length > 0

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }

  const def = componentRegistry.get(block.type)
  const icon = def?.icon || '📦'
  const label = def?.label || block.type

  return (
    <>
      <div
        className={`tree-node ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => selectBlock(block.id)}
        onMouseEnter={() => hoverBlock(block.id)}
        onMouseLeave={() => hoverBlock(null)}
        onContextMenu={(e) => onContextMenu(e, block.id)}
      >
        <div
          className={`tree-toggle ${hasChildren ? (expanded ? 'expanded' : '') : 'hidden'}`}
          onClick={toggleExpand}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
        <div className="tree-icon">{icon}</div>
        <div className="tree-label">{label}</div>
      </div>
      {hasChildren && expanded && (
        <div className="tree-children">
          {block.children.map((child) => (
            <TreeNode key={child.id} block={child} depth={depth + 1} onContextMenu={onContextMenu} />
          ))}
        </div>
      )}
    </>
  )
}

import ContextMenu from '../ContextMenu/ContextMenu'

export default function BlockTree(): JSX.Element {
  const blocks = useEditorStore((s) => s.blocks)
  const removeBlock = useEditorStore((s) => s.removeBlock)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; blockId: string } | null>(null)

  const handleContextMenu = (e: React.MouseEvent, blockId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, blockId })
  }

  const closeContextMenu = () => setContextMenu(null)

  if (blocks.length === 0) {
    return (
      <div className="block-tree empty">
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
          No blocks on page
        </div>
      </div>
    )
  }

  return (
    <div className="block-tree">
      {blocks.map((block) => (
        <TreeNode key={block.id} block={block} depth={0} onContextMenu={handleContextMenu} />
      ))}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          items={[
            {
              label: 'Delete Component',
              danger: true,
              action: () => removeBlock(contextMenu.blockId)
            }
          ]}
        />
      )}
    </div>
  )
}
