import React, { useState } from 'react'
import './BlockTree.css'
import { useEditorStore } from '../../store/editorStore'
import { Block } from '../../types'
import { componentRegistry } from '../../registry/ComponentRegistry'

interface TreeNodeProps {
  block: Block
  depth: number
}

function TreeNode({ block, depth }: TreeNodeProps): JSX.Element {
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
            <TreeNode key={child.id} block={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  )
}

export default function BlockTree(): JSX.Element {
  const blocks = useEditorStore((s) => s.blocks)

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
        <TreeNode key={block.id} block={block} depth={0} />
      ))}
    </div>
  )
}
