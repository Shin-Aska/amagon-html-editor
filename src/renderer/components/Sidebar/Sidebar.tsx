import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, FilePlus, FileText, FolderPlus, Folder, FolderOpen } from 'lucide-react'
import './Sidebar.css'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { componentRegistry, type BlockDefinition } from '../../registry/ComponentRegistry'
import BlockIcon from '../BlockIcon/BlockIcon'
import BlockTree from '../BlockTree/BlockTree'
import AiAssistant from '../AiAssistant/AiAssistant'
import { useRef, useState, type MouseEvent } from 'react'
import ContextMenu from '../ContextMenu/ContextMenu'
import { useToastStore } from '../../store/toastStore'
import { getApi } from '../../utils/api'
import PageModal from '../PageModal/PageModal'
import type { PageFolder } from '../../store/types'

function WidgetItem({ widget, onContextMenu }: { widget: BlockDefinition; onContextMenu?: (e: MouseEvent, widget: BlockDefinition) => void }): JSX.Element {
  const isTypingCode = useEditorStore((s) => s.isTypingCode)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `widget:${widget.type}`,
    disabled: isTypingCode,
    data: { widgetType: widget.type, label: widget.label, icon: widget.icon }
  })

  const iconString = typeof widget.icon === 'string' ? widget.icon.trim() : ''
  const isBadIconGlyph = (s: string): boolean => {
    if (!s) return true
    if (s.startsWith('lucide:')) return false
    if (/^[\u2500-\u257F\u2580-\u259F\u25A0-\u25FF]$/.test(s)) return true
    if (s === '☐' || s === '☑' || s === '▢' || s === '▣' || s === '▭' || s === '🔲' || s === '🔳') return true
    return false
  }

  const style = transform ? {
  } : undefined

  return (
    <div
      ref={setNodeRef}
      className={`widget-item ${widget.type.startsWith('user:') ? 'custom' : ''} ${isDragging ? 'dragging' : ''}`}
      style={style}
      {...attributes}
      {...listeners}
      onContextMenu={(e) => onContextMenu?.(e, widget)}
    >
      <div className="widget-icon">
        {widget.type.startsWith('user:') ? (
          iconString && iconString.startsWith('lucide:') ? (
            <BlockIcon name={iconString.replace(/^lucide:/, '')} />
          ) : iconString && !isBadIconGlyph(iconString) ? (
            iconString
          ) : (
            <BlockIcon name="user-block" />
          )
        ) : (
          <BlockIcon name={widget.type} />
        )}
      </div>
      <span>{widget.label}</span>
    </div>
  )
}

function WidgetCategory({
  title,
  widgets,
  onWidgetContextMenu
}: {
  title: string
  widgets: BlockDefinition[]
  onWidgetContextMenu?: (e: MouseEvent, widget: BlockDefinition) => void
}): JSX.Element {
  if (widgets.length === 0) return <></>

  return (
    <div className="widget-category">
      <div className="category-title">{title}</div>
      <div className="widget-grid">
        {widgets.map((w) => (
          <WidgetItem key={w.type} widget={w} onContextMenu={onWidgetContextMenu} />
        ))}
      </div>
    </div>
  )
}

function Sidebar(): JSX.Element {
  const api = getApi()
  const categories = componentRegistry.getCategories()
  const userBlocks = useProjectStore((s) => s.userBlocks)
  const removeUserBlock = useProjectStore((s) => s.removeUserBlock)
  const showToast = useToastStore((s) => s.showToast)
  const [activeTab, setActiveTab] = useState<'widgets' | 'layers' | 'pages' | 'ai'>('widgets')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; widget: BlockDefinition } | null>(null)

  // Page management
  const pages = useProjectStore((s) => s.pages)
  const currentPageId = useProjectStore((s) => s.currentPageId)
  const setCurrentPage = useProjectStore((s) => s.setCurrentPage)
  const addPage = useProjectStore((s) => s.addPage)
  const removePage = useProjectStore((s) => s.removePage)
  const updatePage = useProjectStore((s) => s.updatePage)
  const getEffectiveTags = useProjectStore((s) => s.getEffectiveTags)
  const reorderPages = useProjectStore((s) => s.reorderPages)

  // Folder management
  const folders = useProjectStore((s) => s.folders)
  const addFolder = useProjectStore((s) => s.addFolder)
  const removeFolder = useProjectStore((s) => s.removeFolder)
  const updateFolder = useProjectStore((s) => s.updateFolder)

  // UI state
  const [pageModal, setPageModal] = useState<{
    mode: 'create' | 'edit' | 'create-folder' | 'edit-folder'
    pageId?: string
    folderId?: string
    initialName?: string
    initialTags?: string[]
    initialPath?: string
    targetFolderId?: string // folder to place new page into
  } | null>(null)

  const [pageContextMenu, setPageContextMenu] = useState<{
    x: number
    y: number
    pageId?: string
    folderId?: string
  } | null>(null)

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Page drag-reorder state
  const [dragPageId, setDragPageId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null)
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null)
  const dragPageIdRef = useRef<string | null>(null)

  // Define a specific order for categories if desired, or just use the insertion order
  const orderedCategories = ['Layout', 'Typography', 'Media', 'Interactive', 'Components', 'Embed']

  // Convert user blocks to BlockDefinition format for display
  const userBlockDefinitions: BlockDefinition[] = userBlocks.map((ub) => ({
    type: `user:${ub.id}`,
    label: ub.label,
    category: ub.category || 'User Blocks',
    icon:
      typeof ub.icon === 'string' && ub.icon.trim() && ub.icon.trim().startsWith('lucide:')
        ? ub.icon.trim()
        : typeof ub.icon === 'string' && ub.icon.trim() && !/^[\u2500-\u257F\u2580-\u259F\u25A0-\u25FF]$/.test(ub.icon.trim())
          ? ub.icon.trim()
          : 'lucide:user-block',
    propsSchema: {}
  }))

  const allRegistryCategories = Array.from(new Set([...orderedCategories, ...categories]))
  const userCategories = Array.from(new Set(userBlockDefinitions.map((d) => d.category).filter(Boolean)))
  const customOnlyCategories = userCategories.filter((c) => !allRegistryCategories.includes(c))
  const allCategories = [...allRegistryCategories, ...customOnlyCategories]

  const handleWidgetContextMenu = (e: MouseEvent, widget: BlockDefinition) => {
    if (!widget.type.startsWith('user:')) return
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, widget })
  }

  const closeContextMenu = () => setContextMenu(null)

  // ── Page/Folder handlers ──────────────────────────────────────────────

  const handleSwitchPage = (pageId: string) => {
    if (currentPageId && currentPageId !== pageId) {
      updatePage(currentPageId, { blocks: useEditorStore.getState().blocks })
    }
    setCurrentPage(pageId)
  }

  const handlePageContextMenu = (e: MouseEvent, pageId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setPageContextMenu({ x: e.clientX, y: e.clientY, pageId })
  }

  const handleFolderContextMenu = (e: MouseEvent, folderId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setPageContextMenu({ x: e.clientX, y: e.clientY, folderId })
  }

  const closePageContextMenu = () => setPageContextMenu(null)

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const handleCreatePage = (name: string, tags: string[], path?: string) => {
    const created = addPage(name, path || undefined)
    const patch: Record<string, unknown> = {}
    if (tags.length > 0) patch.tags = tags
    if (pageModal?.targetFolderId) patch.folderId = pageModal.targetFolderId
    if (Object.keys(patch).length > 0) updatePage(created.id, patch)
    setPageModal(null)
  }

  const handleEditPage = (name: string, tags: string[], path?: string) => {
    if (!pageModal?.pageId) return
    const patch: Partial<{ title: string; tags: string[]; slug: string }> = { title: name, tags }
    if (path) patch.slug = path
    updatePage(pageModal.pageId, patch)
    setPageModal(null)
  }

  const handleCreateFolder = (name: string, tags: string[]) => {
    const folder = addFolder(name, tags)
    setExpandedFolders((prev) => new Set(prev).add(folder.id))
    setPageModal(null)
  }

  const handleEditFolder = (name: string, tags: string[]) => {
    if (!pageModal?.folderId) return
    updateFolder(pageModal.folderId, { name, tags: tags.length > 0 ? tags : undefined })
    setPageModal(null)
  }

  const handleDeletePage = (pageId: string) => {
    if (pages.length <= 1) {
      alert('Cannot delete the last page.')
      return
    }
    if (confirm('Are you sure you want to delete this page?')) {
      removePage(pageId)
    }
  }

  const handleDeleteFolder = (folderId: string) => {
    if (confirm('Delete this folder? Pages inside will be moved to the root level.')) {
      removeFolder(folderId)
    }
  }

  // ── Folder move submenu ──────────────────────────────────────────────

  const buildMoveToItems = (pageId: string) => {
    const page = pages.find((p) => p.id === pageId)
    if (!page) return []

    const items: Array<{ label: string; action: () => void; disabled?: boolean }> = []

    // Move to root
    if (page.folderId) {
      items.push({
        label: '📁 (Root)',
        action: () => updatePage(pageId, { folderId: undefined })
      })
    }

    // Move to specific folder
    for (const folder of folders) {
      items.push({
        label: `📁 ${folder.name}`,
        disabled: page.folderId === folder.id,
        action: () => updatePage(pageId, { folderId: folder.id })
      })
    }

    return items
  }

  // ── Derived data ─────────────────────────────────────────────────────

  const ungroupedPages = pages.filter((p) => !p.folderId)
  const pagesByFolder = (folderId: string) => pages.filter((p) => p.folderId === folderId)

  // ── Render a page item ────────────────────────────────────────────────

  const getDraggedPageId = (e: React.DragEvent | null): string | null => {
    if (dragPageIdRef.current) return dragPageIdRef.current
    const dt = e?.dataTransfer?.getData('text/plain')
    return dt ? String(dt) : null
  }

  const handlePageDragStart = (e: React.DragEvent, pageId: string) => {
    dragPageIdRef.current = pageId
    setDragPageId(pageId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', pageId)
  }

  const handlePageDragOver = (e: React.DragEvent, pageId: string) => {
    const draggedId = getDraggedPageId(e)
    if (!draggedId || draggedId === pageId) return
    // Required for onDrop to fire in HTML5 DnD.
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDropTargetId(pageId)
    setDropPosition(e.clientY < midY ? 'above' : 'below')
  }

  const handlePageDrop = (e: React.DragEvent, targetPageId: string) => {
    e.preventDefault()
    const draggedId = getDraggedPageId(e)
    if (!draggedId || draggedId === targetPageId) return

    const draggedPage = pages.find((p) => p.id === draggedId)
    const targetPage = pages.find((p) => p.id === targetPageId)
    if (!draggedPage || !targetPage) return

    const fromIndex = pages.findIndex((p) => p.id === draggedId)
    let toIndex = pages.findIndex((p) => p.id === targetPageId)
    if (fromIndex === -1 || toIndex === -1) return

    // Determine above/below using the drop position at the moment of drop.
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const isBelow = e.clientY >= midY

    if (isBelow) toIndex += 1
    if (fromIndex < toIndex) toIndex -= 1
    if (fromIndex !== toIndex) reorderPages(fromIndex, toIndex)

    const targetFolderId = targetPage.folderId ?? undefined
    if ((draggedPage.folderId ?? undefined) !== targetFolderId) {
      updatePage(draggedId, { folderId: targetFolderId })
      if (targetFolderId) {
        setExpandedFolders((prev) => new Set([...prev, targetFolderId]))
      }
    }

    dragPageIdRef.current = null
    setDragPageId(null)
    setDropTargetId(null)
    setDropPosition(null)
    setDropTargetFolderId(null)
  }

  const handlePageDragEnd = () => {
    dragPageIdRef.current = null
    setDragPageId(null)
    setDropTargetId(null)
    setDropPosition(null)
    setDropTargetFolderId(null)
  }

  const handleFolderDragOver = (e: React.DragEvent, folderId: string) => {
    const draggedId = dragPageIdRef.current
    if (!draggedId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetFolderId(folderId)
    setDropTargetId(null)
    setDropPosition(null)
  }

  const handleFolderDrop = (e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    const draggedId = dragPageIdRef.current
    if (!draggedId) return
    const draggedPage = pages.find(p => p.id === draggedId)
    if (!draggedPage || draggedPage.folderId === folderId) {
      // No-op if page already in this folder
      dragPageIdRef.current = null
      setDragPageId(null)
      setDropTargetId(null)
      setDropPosition(null)
      setDropTargetFolderId(null)
      return
    }
    updatePage(draggedId, { folderId })
    // Auto-expand folder
    setExpandedFolders(prev => new Set([...prev, folderId]))
    // Reset drag state
    dragPageIdRef.current = null
    setDragPageId(null)
    setDropTargetId(null)
    setDropPosition(null)
    setDropTargetFolderId(null)
  }

  const handleFolderDragLeave = (e: React.DragEvent, folderId: string) => {
    if (dropTargetFolderId === folderId) {
      setDropTargetFolderId(null)
    }
  }

  const renderPageItem = (page: typeof pages[0], indented = false) => {
    const effectiveTags = getEffectiveTags(page)
    const ownTags = page.tags ?? []
    const folder = page.folderId ? folders.find((f) => f.id === page.folderId) : null
    const inheritedTags = folder?.tags?.filter((t) => !ownTags.includes(t)) ?? []

    const isDragOver = dropTargetId === page.id
    const dropClass = isDragOver ? (dropPosition === 'above' ? 'drop-above' : 'drop-below') : ''
    const isDragging = dragPageId === page.id

    return (
      <div
        key={page.id}
        className={`page-item ${page.id === currentPageId ? 'active' : ''} ${indented ? 'indented' : ''} ${dropClass} ${isDragging ? 'dragging' : ''}`}
        onClick={() => handleSwitchPage(page.id)}
        onContextMenu={(e) => handlePageContextMenu(e, page.id)}
        draggable
        onDragStart={(e) => handlePageDragStart(e, page.id)}
        onDragOver={(e) => handlePageDragOver(e, page.id)}
        onDrop={(e) => handlePageDrop(e, page.id)}
        onDragEnd={handlePageDragEnd}
        onDragLeave={() => { if (dropTargetId === page.id) { setDropTargetId(null); setDropPosition(null) } }}
      >
        <div className="page-info">
          <FileText size={14} className="page-icon" />
          <span className="page-name">{page.title}</span>
          {page.slug !== 'index' && <span className="page-slug">/{page.slug}</span>}
        </div>
        {effectiveTags.length > 0 && (
          <div className="page-tags">
            {ownTags.map((tag) => (
              <span key={tag} className="page-tag">{tag}</span>
            ))}
            {inheritedTags.map((tag) => (
              <span key={`i-${tag}`} className="page-tag inherited">{tag}</span>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────

  const handleModalSave = (name: string, tags: string[], path?: string) => {
    if (!pageModal) return
    switch (pageModal.mode) {
      case 'create': handleCreatePage(name, tags, path); break
      case 'edit': handleEditPage(name, tags, path); break
      case 'create-folder': handleCreateFolder(name, tags); break
      case 'edit-folder': handleEditFolder(name, tags); break
    }
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
        <div
          className={`sidebar-tab ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          AI
        </div>
      </div>
      <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'pages' && (
          <div className="pages-panel">
            <div className="pages-list">
              {/* Folders */}
              {folders.map((folder) => {
                const isExpanded = expandedFolders.has(folder.id)
                const folderPages = pagesByFolder(folder.id)
                return (
                  <div key={folder.id} className="folder-group">
                    <div
                      className={`folder-header${dropTargetFolderId === folder.id ? ' folder-drop-target' : ''}`}
                      onClick={() => toggleFolder(folder.id)}
                      onContextMenu={(e) => handleFolderContextMenu(e, folder.id)}
                      onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                      onDrop={(e) => handleFolderDrop(e, folder.id)}
                      onDragLeave={(e) => handleFolderDragLeave(e, folder.id)}
                    >
                      <div className="folder-info">
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
                        <span className="folder-name">{folder.name}</span>
                        <span className="folder-count">{folderPages.length}</span>
                      </div>
                      {folder.tags && folder.tags.length > 0 && (
                        <div className="page-tags">
                          {folder.tags.map((tag) => (
                            <span key={tag} className="page-tag folder-tag">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="folder-children">
                        {folderPages.map((page) => renderPageItem(page, true))}
                        {folderPages.length === 0 && (
                          <div className="folder-empty">No pages in this folder</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Ungrouped pages */}
              <div
                className={`ungrouped-drop-zone${dropTargetFolderId === '__root__' ? ' drop-active' : ''}`}
                onDragOver={(e) => {
                  const draggedId = dragPageIdRef.current
                  if (draggedId) {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDropTargetFolderId('__root__')
                    setDropTargetId(null)
                    setDropPosition(null)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const draggedId = dragPageIdRef.current
                  if (!draggedId) return
                  const draggedPage = pages.find(p => p.id === draggedId)
                  if (!draggedPage || draggedPage.folderId === undefined) {
                    // No-op if page already ungrouped
                    dragPageIdRef.current = null
                    setDragPageId(null)
                    setDropTargetId(null)
                    setDropPosition(null)
                    setDropTargetFolderId(null)
                    return
                  }
                  updatePage(draggedId, { folderId: undefined })
                  // Reset drag state
                  dragPageIdRef.current = null
                  setDragPageId(null)
                  setDropTargetId(null)
                  setDropPosition(null)
                  setDropTargetFolderId(null)
                }}
                onDragLeave={() => {
                  if (dropTargetFolderId === '__root__') {
                    setDropTargetFolderId(null)
                  }
                }}
              >
                {ungroupedPages.map((page) => renderPageItem(page))}
              </div>
            </div>

            <div className="page-actions">
              <button className="page-add-btn" onClick={() => setPageModal({ mode: 'create-folder' })}>
                <FolderPlus size={14} />
                <span>New Folder</span>
              </button>
              <button className="page-add-btn" onClick={() => setPageModal({ mode: 'create' })}>
                <FilePlus size={14} />
                <span>Add New Page</span>
              </button>
            </div>
          </div>
        )}
        {activeTab === 'widgets' && (
          <>
            {allCategories.map((category) => (
              <WidgetCategory
                key={category}
                title={category}
                widgets={[
                  ...componentRegistry.getByCategory(category),
                  ...userBlockDefinitions.filter((w) => w.category === category)
                ]}
                onWidgetContextMenu={handleWidgetContextMenu}
              />
            ))}
          </>
        )}
        {activeTab === 'layers' && <BlockTree />}
        {activeTab === 'ai' && <AiAssistant />}
      </div>

      {/* Widget context menu (custom blocks) */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          items={[
            {
              label: 'Remove custom block',
              danger: true,
              action: () => {
                const id = contextMenu.widget.type.replace(/^user:/, '')
                if (!id) return
                if (!confirm(`Remove "${contextMenu.widget.label}"?`)) return
                removeUserBlock(id)
                showToast(`Removed custom block: ${contextMenu.widget.label}`, 'success')

                  ; (async () => {
                    try {
                      const editorState = useEditorStore.getState()
                      const projectState = useProjectStore.getState()
                      const pageId = projectState.currentPageId
                      if (!projectState.filePath) return

                      const updatedPages = projectState.pages.map((p) =>
                        pageId && p.id === pageId ? { ...p, blocks: editorState.blocks } : p
                      )

                      if (pageId) {
                        projectState.updatePage(pageId, { blocks: editorState.blocks })
                      }

                      const content = JSON.stringify(
                        {
                          projectSettings: projectState.settings,
                          pages: updatedPages,
                          folders: projectState.folders,
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
              }
            }
          ]}
        />
      )}

      {/* Page / Folder context menu */}
      {pageContextMenu && (
        <ContextMenu
          x={pageContextMenu.x}
          y={pageContextMenu.y}
          onClose={closePageContextMenu}
          items={
            pageContextMenu.folderId
              ? [
                {
                  label: 'Edit Folder',
                  action: () => {
                    const folder = folders.find((f) => f.id === pageContextMenu.folderId)
                    if (folder) {
                      setPageModal({
                        mode: 'edit-folder',
                        folderId: folder.id,
                        initialName: folder.name,
                        initialTags: folder.tags || []
                      })
                    }
                  }
                },
                {
                  label: 'Add Page Here',
                  action: () => {
                    setPageModal({ mode: 'create', targetFolderId: pageContextMenu.folderId })
                  }
                },
                { label: '', divider: true },
                {
                  label: 'Delete Folder',
                  danger: true,
                  action: () => {
                    if (pageContextMenu.folderId) handleDeleteFolder(pageContextMenu.folderId)
                  }
                }
              ]
              : [
                {
                  label: 'Open',
                  action: () => {
                    if (pageContextMenu.pageId) handleSwitchPage(pageContextMenu.pageId)
                  }
                },
                {
                  label: 'Edit Metadata',
                  action: () => {
                    const page = pages.find((p) => p.id === pageContextMenu.pageId)
                    if (page) {
                      setPageModal({
                        mode: 'edit',
                        pageId: page.id,
                        initialName: page.title,
                        initialTags: page.tags || [],
                        initialPath: page.slug
                      })
                    }
                  }
                },
                ...(folders.length > 0
                  ? [
                    { label: '', divider: true as const },
                    ...buildMoveToItems(pageContextMenu.pageId!)
                  ]
                  : []),
                { label: '', divider: true },
                {
                  label: 'Delete',
                  danger: true,
                  disabled: pages.length <= 1,
                  action: () => {
                    if (pageContextMenu.pageId) handleDeletePage(pageContextMenu.pageId)
                  }
                }
              ]
          }
        />
      )}

      {/* Page/Folder create/edit modal */}
      {pageModal && (
        <PageModal
          mode={pageModal.mode}
          initialName={pageModal.initialName}
          initialTags={pageModal.initialTags}
          initialPath={pageModal.initialPath}
          onSave={handleModalSave}
          onCancel={() => setPageModal(null)}
        />
      )}
    </div>
  )
}

export default Sidebar
