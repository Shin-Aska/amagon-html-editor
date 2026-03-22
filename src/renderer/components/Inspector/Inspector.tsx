import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { componentRegistry, type PropSchema } from '../../registry/ComponentRegistry'
import SpacingEditor from './SpacingEditor'
import { TypographyEditor, BackgroundEditor, BorderEditor, LayoutEditor } from './StyleEditors'
import CssClassesEditor from './CssClassesEditor'
import BlockActions from './BlockActions'
import EventActionsEditor from './EventActionsEditor'
import UrlField from './UrlField'
import ResponsiveOverrides from './ResponsiveOverrides'
import BlockIcon from '../BlockIcon/BlockIcon'
import ImageField from './ImageField'
import ComboboxField from './ComboboxField'
import MultiComboboxField from './MultiComboboxField'
import SortableListField from './SortableListField'
import VideoField from './VideoField'
import CarouselField from './CarouselField'
import IconField from './IconField'
import { useProjectStore } from '../../store/projectStore'
import ArrayField from './ArrayField'
import './Inspector.css'

function Inspector(): JSX.Element {
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
  const blocks = useEditorStore((s) => s.blocks)
  const getBlockById = useEditorStore((s) => s.getBlockById)
  const updateBlock = useEditorStore((s) => s.updateBlock)

  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const uniqueMetaKeys = useProjectStore((s) => s.uniqueMetaKeys)

  const block = selectedBlockId ? getBlockById(selectedBlockId) : null
  const definition = block ? componentRegistry.get(block.type) : null

  if (!block || !definition) {
    return (
      <div className="inspector">
        <div className="inspector-header">
          <h3>Properties</h3>
        </div>
        <div className="inspector-content">
          <div className="inspector-empty">
            <div className="empty-icon">&#9881;</div>
            <p>Select an element on the canvas to edit its properties.</p>
          </div>
        </div>
      </div>
    )
  }

  const handlePropChange = (key: string, value: any) => {
    updateBlock(block.id, {
      props: {
        ...block.props,
        [key]: value
      }
    })
  }

  const handleStyleChange = (key: string, value: string | undefined) => {
    updateBlock(block.id, {
      styles: {
        [key]: (value === undefined || value === '') ? undefined : value
      }
    })
  }

  const handleClassesChange = (classes: string[]) => {
    updateBlock(block.id, { classes })
  }

  // Render different input types based on the schema
  const renderField = (key: string, schema: PropSchema, value: any) => {
    const val = value !== undefined ? value : schema.default

    switch (schema.type) {
      case 'text':
        return (
          <input
            type="text"
            className="inspector-input"
            value={val || ''}
            onChange={(e) => handlePropChange(key, e.target.value)}
          />
        )
      case 'textarea':
        return (
          <textarea
            className="inspector-input"
            value={val || ''}
            onChange={(e) => handlePropChange(key, e.target.value)}
            rows={3}
          />
        )
      case 'number':
        return (
          <input
            type="number"
            className="inspector-input"
            value={val !== undefined ? val : ''}
            min={schema.min}
            max={schema.max}
            step={schema.step}
            onChange={(e) => handlePropChange(key, e.target.value === '' ? undefined : Number(e.target.value))}
          />
        )
      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={!!val}
            onChange={(e) => handlePropChange(key, e.target.checked)}
          />
        )
      case 'select':
        return (
          <select
            className="inspector-select"
            value={val || ''}
            onChange={(e) => handlePropChange(key, e.target.value)}
          >
            {schema.options?.map((opt) => (
              <option key={String(opt.value)} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        )
      case 'color':
        return (
          <div className="color-picker-wrapper">
            <input
              type="color"
              value={val || '#000000'}
              onChange={(e) => handlePropChange(key, e.target.value)}
            />
            <input
              type="text"
              className="inspector-input color-hex-input"
              value={val || ''}
              onChange={(e) => handlePropChange(key, e.target.value)}
              placeholder="#000000"
            />
          </div>
        )
      case 'image':
        return <ImageField value={val || ''} onChange={(v) => handlePropChange(key, v)} />
      case 'video':
        return <VideoField value={val || ''} onChange={(v) => handlePropChange(key, v)} />
      case 'carousel':
        return <CarouselField value={val || []} onChange={(v) => handlePropChange(key, v)} />
      case 'icon':
        return <IconField value={val || ''} onChange={(v) => handlePropChange(key, v)} />
      case 'measurement':
        return (
          <input
            type="text"
            className="inspector-input"
            value={val || ''}
            onChange={(e) => handlePropChange(key, e.target.value)}
            placeholder="e.g. 16px, 2rem"
          />
        )
      case 'combobox': {
        let comboOptions: string[] = []
        if (schema.dataSource === 'tags') {
          const pages = useProjectStore.getState().pages
          const folders = useProjectStore.getState().folders
          const tagSet = new Set<string>()
          pages.forEach((p) => p.tags?.forEach((t) => tagSet.add(t)))
          folders.forEach((f) => f.tags?.forEach((t) => tagSet.add(t)))
          comboOptions = Array.from(tagSet).sort()
        } else if (schema.dataSource === 'metaKeys') {
          comboOptions = uniqueMetaKeys
        } else if (schema.dataSource === 'pageListSortKeys') {
          comboOptions = ['title', ...uniqueMetaKeys.filter((k) => k !== 'title')]
        } else if (schema.options) {
          comboOptions = schema.options.map((o) => String(o.value))
        }
        return (
          <ComboboxField
            value={val || ''}
            options={comboOptions}
            onChange={(v) => handlePropChange(key, v)}
            placeholder={schema.default !== undefined ? String(schema.default) : ''}
          />
        )
      }
      case 'multi-combobox': {
        let multiOptions: string[] = []
        if (schema.dataSource === 'metaKeys') {
          multiOptions = uniqueMetaKeys
        } else if (schema.dataSource === 'pageListSortKeys') {
          multiOptions = ['title', ...uniqueMetaKeys.filter((k) => k !== 'title')]
        } else if (schema.options) {
          multiOptions = schema.options.map((o) => String(o.value))
        }

        const selected = Array.isArray(val)
          ? val.map((v) => String(v)).filter(Boolean)
          : typeof val === 'string'
            ? val.split(/[,\n]+/).map((k) => k.trim()).filter(Boolean)
            : []

        return (
          <MultiComboboxField
            value={selected}
            options={multiOptions}
            onChange={(v) => handlePropChange(key, v)}
            placeholder={schema.default !== undefined ? String(schema.default) : ''}
          />
        )
      }
      case 'url':
        return (
          <UrlField
            value={val || ''}
            onChange={(v) => handlePropChange(key, v)}
          />
        )
      case 'sortable-list': {
        const normalizeList = (v: any): string[] =>
          Array.isArray(v)
            ? v.map((x) => String(x).trim()).filter(Boolean)
            : typeof v === 'string'
              ? v.split(/[,\n]+/).map((x) => x.trim()).filter(Boolean)
              : []

        const labelForKey = (k: string) =>
          k === 'title'
            ? 'Title'
            : k === 'datePublished'
              ? 'Date Published'
              : k
                .replace(/[-_]+/g, ' ')
                .replace(/^\w/, (c) => c.toUpperCase())

        if (schema.dataSource === 'pageListSortPriority') {
          const selectedMetaKeys = normalizeList(block.props.metaKeys)
          const available = ['title', ...selectedMetaKeys.filter((k) => k !== 'title')]

          const current = normalizeList(val)
          const inAvailable = new Set(available)
          const next: string[] = []
          const seen = new Set<string>()

          const push = (k: string) => {
            const keyStr = String(k || '').trim()
            if (!keyStr) return
            if (seen.has(keyStr)) return
            if (!inAvailable.has(keyStr)) return
            seen.add(keyStr)
            next.push(keyStr)
          }

          current.forEach(push)

          available.forEach(push)

          return (
            <SortableListField
              items={next}
              onChange={(items) => handlePropChange(key, items)}
              labelForItem={(item) => labelForKey(String(item))}
            />
          )
        }

        const items = normalizeList(val)
        return (
          <SortableListField
            items={items}
            onChange={(items) => handlePropChange(key, items)}
          />
        )
      }
      case 'array': {
        // Determine the item type based on the current value or block type
        const determineItemType = (): 'string' | 'tab' | 'accordion' => {
          // Check if we have existing items to infer the type
          if (Array.isArray(val) && val.length > 0) {
            const firstItem = val[0]
            if (typeof firstItem === 'object' && firstItem !== null) {
              if ('label' in firstItem && 'content' in firstItem) {
                return 'tab'
              }
              if ('title' in firstItem && 'content' in firstItem) {
                return 'accordion'
              }
            }
          }
          // Infer from the prop key name as fallback
          if (key === 'tabs') return 'tab'
          if (key === 'items' && block?.type === 'accordion') return 'accordion'
          return 'string'
        }

        return (
          <ArrayField
            blockId={block.id}
            value={val || []}
            onChange={(v) => handlePropChange(key, v)}
            itemType={determineItemType()}
          />
        )
      }
      default:
        return <span className="unsupported-prop">Unsupported type: {schema.type}</span>
    }
  }

  // Group properties by their 'group' defined in the schema
  const groupedProps: Record<string, { key: string; schema: PropSchema }[]> = {}

  Object.entries(definition.propsSchema).forEach(([key, schema]) => {
    const groupName = schema.group || 'General'
    if (!groupedProps[groupName]) {
      groupedProps[groupName] = []
    }
    groupedProps[groupName].push({ key, schema })
  })

  return (
    <div className="inspector">
      <div className="inspector-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BlockIcon name={block.type} className="inspector-icon" />
          <h3>{definition.label}</h3>
        </div>
        <span className="inspector-type-badge">{block.type}</span>
      </div>
      <div className="inspector-content">
        {Object.entries(groupedProps).map(([groupName, props]) => (
          <div key={groupName} className="inspector-group">
            <h4 className="inspector-group-title">{groupName}</h4>
            {props.map(({ key, schema }) => (
              <div key={key} className="inspector-field">
                <div className="inspector-field-header">
                  <label className="inspector-label">{schema.label}</label>
                  {schema.description && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span className="inspector-help-tooltip" title={schema.description}>?</span>
                      {schema.description.includes('bootstrap.Modal') && (
                        <button 
                          className="inspector-action-btn"
                          title="Copy trigger code"
                          onClick={() => {
                            const code = `bootstrap.Modal.getOrCreateInstance(document.getElementById("${block.props[key] || schema.default}")).show()`;
                            navigator.clipboard.writeText(code);
                            setCopiedKey(key);
                            setTimeout(() => setCopiedKey(null), 2000);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '14px',
                            padding: '0 4px',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                          }}
                        >
                          {copiedKey === key ? '✅' : '📋'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="inspector-control">
                  {renderField(key, schema, block.props[key])}
                </div>
              </div>
            ))}
          </div>
        ))}

        <div className="inspector-group">
          <h4 className="inspector-group-title">Layout</h4>
          <LayoutEditor styles={block.styles} onChange={handleStyleChange} />
        </div>

        <div className="inspector-group">
          <h4 className="inspector-group-title">Spacing</h4>
          <SpacingEditor styles={block.styles} onChange={handleStyleChange} />
        </div>

        <div className="inspector-group">
          <h4 className="inspector-group-title">Typography</h4>
          <TypographyEditor styles={block.styles} onChange={handleStyleChange} />
        </div>

        <div className="inspector-group">
          <h4 className="inspector-group-title">Background</h4>
          <BackgroundEditor styles={block.styles} onChange={handleStyleChange} />
        </div>

        <div className="inspector-group">
          <h4 className="inspector-group-title">Border</h4>
          <BorderEditor styles={block.styles} onChange={handleStyleChange} />
        </div>

        <div className="inspector-group">
          <h4 className="inspector-group-title">Responsive</h4>
          <ResponsiveOverrides classes={block.classes} onChange={handleClassesChange} />
        </div>

        <div className="inspector-group">
          <h4 className="inspector-group-title">CSS Classes</h4>
          <CssClassesEditor classes={block.classes} onChange={handleClassesChange} />
        </div>

        <div className="inspector-group">
          <h4 className="inspector-group-title">Event Actions</h4>
          <EventActionsEditor blockId={block.id} events={block.events || {}} />
        </div>

        <div className="inspector-group">
          <h4 className="inspector-group-title">Block Actions</h4>
          <BlockActions blockId={block.id} blockType={block.type} />
        </div>
      </div>
    </div>
  )
}

export default Inspector
