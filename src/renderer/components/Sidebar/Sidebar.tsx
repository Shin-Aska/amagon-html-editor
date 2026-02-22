import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
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

  const style = {
    transform: CSS.Translate.toString(transform)
  }

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
  const [activeTab, setActiveTab] = useState<'widgets' | 'layers'>('widgets')

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

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Design</h3>
      </div>
      <div className="sidebar-tabs">
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
        {activeTab === 'widgets' ? (
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
        ) : (
          <BlockTree />
        )}
      </div>
    </div>
  )
}

export default Sidebar
