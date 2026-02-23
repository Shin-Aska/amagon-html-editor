import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { FilePlus, FileText } from 'lucide-react'
import './Sidebar.css'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { componentRegistry, type BlockDefinition } from '../../registry/ComponentRegistry'
import BlockIcon from '../BlockIcon/BlockIcon'
import BlockTree from '../BlockTree/BlockTree'
import { useState } from 'react'

function WidgetItem({ widget }: { widget: BlockDefinition }): JSX.Element {
  const isTypingCode = useEditorStore((s) => s.isTypingCode)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `widget:${widget.type}`,
    disabled: isTypingCode,
    data: { widgetType: widget.type, label: widget.label, icon: widget.icon }
  })

  const style = transform ? {
    // DragOverlay handles the dragged preview.
    // To prevent the original element from shifting around while dragging,
    // we do not apply the transform here.
  } : undefined

  return (
    <div
      ref={setNodeRef}
      className={`widget-item ${isDragging ? 'dragging' : ''}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      <div className="widget-icon">
        <BlockIcon name={widget.type} />
      </div>
      <span>{widget.label}</span>
    </div>
  )
}

function WidgetCategory({ title, widgets }: { title: string; widgets: BlockDefinition[] }): JSX.Element {
  if (widgets.length === 0) return <></>

  return (
    <div className="widget-category">
      <div className="category-title">{title}</div>
      <div className="widget-grid">
        {widgets.map((w) => (
          <WidgetItem key={w.type} widget={w} />
        ))}
      </div>
    </div>
  )
}

function Sidebar(): JSX.Element {
  const categories = componentRegistry.getCategories()
  const userBlocks = useProjectStore((s) => s.userBlocks)
  const [activeTab, setActiveTab] = useState<'widgets' | 'layers' | 'pages'>('widgets')

  // Page management
  const pages = useProjectStore((s) => s.pages)
  const currentPageId = useProjectStore((s) => s.currentPageId)
  const setCurrentPage = useProjectStore((s) => s.setCurrentPage)
  const addPage = useProjectStore((s) => s.addPage)
  const removePage = useProjectStore((s) => s.removePage)
  const updatePage = useProjectStore((s) => s.updatePage)
  const [isAddingPage, setIsAddingPage] = useState(false)
  const [newPageName, setNewPageName] = useState('')

  // Define a specific order for categories if desired, or just use the insertion order
  const orderedCategories = ['Layout', 'Typography', 'Media', 'Interactive', 'Components', 'Embed']
  // Combine ordered known categories with any others found in the registry
  const allCategories = Array.from(new Set([...orderedCategories, ...categories]))

  // Convert user blocks to BlockDefinition format for display
  const userBlockDefinitions: BlockDefinition[] = userBlocks.map((ub) => ({
    type: `user:${ub.id}`,
    label: ub.label,
    category: 'User Blocks',
    icon: ub.icon || '🧩',
    propsSchema: {} // Not needed for sidebar display
  }))

  const handleAddPage = () => {
    if (!newPageName.trim()) return
    addPage(newPageName.trim())
    setNewPageName('')
    setIsAddingPage(false)
  }

  const handleDeletePage = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation()
    if (pages.length <= 1) {
      alert('Cannot delete the last page.')
      return
    }
    if (confirm('Are you sure you want to delete this page?')) {
      removePage(pageId)
    }
  }

  const handleSwitchPage = (pageId: string) => {
    if (currentPageId && currentPageId !== pageId) {
      // Save current page blocks before switching
      updatePage(currentPageId, { blocks: useEditorStore.getState().blocks })
    }
    setCurrentPage(pageId)
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Design</h3>
      </div>
      <div className="sidebar-tabs">
        <div
          className={`sidebar-tab ${activeTab === 'pages' ? 'active' : ''}`}
          onClick={() => setActiveTab('pages')}
        >
          Pages
        </div>
        <div
          className={`sidebar-tab ${activeTab === 'widgets' ? 'active' : ''}`}
          onClick={() => setActiveTab('widgets')}
        >
          Widgets
        </div>
        <div
          className={`sidebar-tab ${activeTab === 'layers' ? 'active' : ''}`}
          onClick={() => setActiveTab('layers')}
        >
          Layers
        </div>
      </div>
      <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'pages' && (
          <div className="pages-panel">
            <div className="pages-list">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className={`page-item ${page.id === currentPageId ? 'active' : ''}`}
                  onClick={() => handleSwitchPage(page.id)}
                >
                  <div className="page-info">
                    <FileText size={14} className="page-icon" />
                    <span className="page-name">{page.title}</span>
                    {page.slug !== 'index' && <span className="page-slug">/{page.slug}</span>}
                  </div>
                  {pages.length > 1 && (
                    <button
                      className="page-delete-btn"
                      onClick={(e) => handleDeletePage(e, page.id)}
                      title="Delete Page"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {isAddingPage ? (
              <div className="page-add-form">
                <input
                  className="page-add-input"
                  placeholder="Page Name"
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddPage()
                    if (e.key === 'Escape') {
                      setIsAddingPage(false)
                      setNewPageName('')
                    }
                  }}
                  autoFocus
                />
              </div>
            ) : (
              <button className="page-add-btn" onClick={() => setIsAddingPage(true)}>
                <FilePlus size={14} />
                <span>Add New Page</span>
              </button>
            )}
          </div>
        )}
        {activeTab === 'widgets' && (
          <>
            {allCategories.map((category) => (
              <WidgetCategory
                key={category}
                title={category}
                widgets={componentRegistry.getByCategory(category)}
              />
            ))}
            {userBlockDefinitions.length > 0 && (
              <WidgetCategory title="User Blocks" widgets={userBlockDefinitions} />
            )}
          </>
        )}
        {activeTab === 'layers' && <BlockTree />}
      </div>
    </div>
  )
}

export default Sidebar
