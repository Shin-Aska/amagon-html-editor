import { useMemo } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import type { Block } from '../../store/types'
import './StatusBar.css'

function countBlocks(blocks: Block[]): number {
  let count = blocks.length
  for (const block of blocks) {
    count += countBlocks(block.children)
  }
  return count
}

export default function StatusBar(): JSX.Element {
  const zoom = useEditorStore((s) => s.zoom)
  const blocks = useEditorStore((s) => s.blocks)
  const isDirty = useEditorStore((s) => s.isDirty)
  
  const currentPageId = useProjectStore((s) => s.currentPageId)
  const pages = useProjectStore((s) => s.pages)
  
  const currentPage = useMemo(() => 
    pages.find(p => p.id === currentPageId), 
    [pages, currentPageId]
  )

  const blockCount = useMemo(() => countBlocks(blocks), [blocks])

  return (
    <div className="status-bar">
      <div className="status-section">
        <div className="status-item">
          <span className="status-label">Page:</span>
          <span>{currentPage?.title || 'None'}</span>
          {currentPage?.slug && <span style={{ opacity: 0.5 }}>({currentPage.slug})</span>}
        </div>
        
        <div className="status-item">
          <span className="status-label">Blocks:</span>
          <span>{blockCount}</span>
        </div>
      </div>

      <div className="status-section">
        <div className="status-item">
          <span className="status-icon" style={{ color: isDirty ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
            {isDirty ? '● Unsaved' : 'Saved'}
          </span>
        </div>

        <div className="status-item">
          <span className="status-label">Zoom:</span>
          <span>{zoom}%</span>
        </div>
      </div>
    </div>
  )
}
