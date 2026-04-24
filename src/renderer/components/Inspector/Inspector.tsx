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
import ArrayField, { type ArrayRecordField } from './ArrayField'
import InlineStylesEditor from './InlineStylesEditor'
import './Inspector.css'
import { Check, Clipboard } from 'lucide-react'

interface ArrayEditorConfig {
  itemFields: ArrayRecordField[]
  itemLabelKey?: string
}

const variantOptions = [
  { label: 'Primary', value: 'primary' },
  { label: 'Secondary', value: 'secondary' },
  { label: 'Success', value: 'success' },
  { label: 'Danger', value: 'danger' },
  { label: 'Warning', value: 'warning' },
  { label: 'Info', value: 'info' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' }
]

const socialPlatformOptions = [
  { label: 'Twitter', value: 'twitter' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'GitHub', value: 'github' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Website', value: 'website' }
]

const arrayEditorConfigs: Record<string, Record<string, ArrayEditorConfig>> = {
  breadcrumb: {
    items: {
      itemLabelKey: 'label',
      itemFields: [
        { key: 'label', label: 'Label', default: 'Item' },
        { key: 'href', label: 'URL', type: 'url', default: '#' },
        { key: 'active', label: 'Active', type: 'boolean', default: false }
      ]
    }
  },
  dropdown: {
    items: {
      itemLabelKey: 'label',
      itemFields: [
        { key: 'label', label: 'Label', default: 'Action' },
        { key: 'href', label: 'URL', type: 'url', default: '#' },
        { key: 'divider', label: 'Divider', type: 'boolean', default: false },
        { key: 'disabled', label: 'Disabled', type: 'boolean', default: false }
      ]
    }
  },
  'stats-section': {
    items: {
      itemLabelKey: 'label',
      itemFields: [
        { key: 'value', label: 'Value', default: '120' },
        { key: 'label', label: 'Label', default: 'Projects' },
        { key: 'prefix', label: 'Prefix', default: '' },
        { key: 'suffix', label: 'Suffix', default: '+' },
        { key: 'icon', label: 'Icon', type: 'icon', default: 'lucide:rocket' }
      ]
    }
  },
  'team-grid': {
    members: {
      itemLabelKey: 'name',
      itemFields: [
        { key: 'name', label: 'Name', default: 'Team Member' },
        { key: 'role', label: 'Role', default: 'Role' },
        { key: 'imageUrl', label: 'Image URL', type: 'image', default: '' },
        { key: 'bio', label: 'Bio', type: 'textarea', rows: 3, default: '' },
        { key: 'socialLinks', label: 'Social Links', type: 'social-map', default: { twitter: '', linkedin: '', github: '' } }
      ]
    }
  },
  gallery: {
    images: {
      itemLabelKey: 'caption',
      itemFields: [
        { key: 'url', label: 'Image URL', type: 'image', default: '' },
        { key: 'caption', label: 'Caption', default: 'Gallery item' },
        { key: 'category', label: 'Category', default: '' }
      ]
    }
  },
  timeline: {
    items: {
      itemLabelKey: 'title',
      itemFields: [
        { key: 'date', label: 'Date', default: '2024' },
        { key: 'title', label: 'Title', default: 'Milestone' },
        { key: 'description', label: 'Description', type: 'textarea', rows: 3, default: '' },
        { key: 'icon', label: 'Icon', type: 'icon', default: 'lucide:circle' },
        { key: 'variant', label: 'Variant', type: 'select', options: variantOptions, default: 'primary' }
      ]
    }
  },
  'logo-cloud': {
    logos: {
      itemLabelKey: 'altText',
      itemFields: [
        { key: 'imageUrl', label: 'Image URL', type: 'image', default: '' },
        { key: 'altText', label: 'Alt Text', default: 'Logo' },
        { key: 'href', label: 'URL', type: 'url', default: '#' }
      ]
    }
  },
  'process-steps': {
    steps: {
      itemLabelKey: 'title',
      itemFields: [
        { key: 'number', label: 'Number', default: '1' },
        { key: 'title', label: 'Title', default: 'Step' },
        { key: 'description', label: 'Description', type: 'textarea', rows: 3, default: '' },
        { key: 'icon', label: 'Icon', type: 'icon', default: 'lucide:circle' }
      ]
    }
  },
  'comparison-table': {
    plans: {
      itemLabelKey: 'name',
      itemFields: [
        { key: 'name', label: 'Name', default: 'Plan' },
        { key: 'price', label: 'Price', default: '$0' },
        { key: 'period', label: 'Period', default: '/mo' },
        { key: 'features', label: 'Features', type: 'feature-list', default: [{ text: 'Feature', included: true }] },
        { key: 'ctaText', label: 'CTA Text', default: 'Select' },
        { key: 'ctaHref', label: 'CTA URL', type: 'url', default: '#' },
        { key: 'highlighted', label: 'Highlighted', type: 'boolean', default: false }
      ]
    }
  },
  'social-links': {
    links: {
      itemLabelKey: 'label',
      itemFields: [
        { key: 'platform', label: 'Platform', type: 'select', options: socialPlatformOptions, default: 'twitter' },
        { key: 'url', label: 'URL', type: 'url', default: '#' },
        { key: 'label', label: 'Label', default: 'Twitter' }
      ]
    }
  },
  footer: {
    socialLinks: {
      itemLabelKey: 'platform',
      itemFields: [
        { key: 'platform', label: 'Platform', type: 'select', options: socialPlatformOptions, default: 'twitter' },
        { key: 'url', label: 'URL', type: 'url', default: '#' }
      ]
    }
  }
}

function getArrayEditorConfig(blockType: string, key: string): ArrayEditorConfig | undefined {
  return arrayEditorConfigs[blockType]?.[key]
}

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
      <div className="inspector" data-tutorial="inspector">
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

  const handleElementIdChange = (value: string) => {
    updateBlock(block.id, {
      props: {
        ...block.props,
        id: value.trim() || undefined
      }
    })
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
        const arrayConfig = getArrayEditorConfig(block.type, key)
        // Determine the item type based on the current value or block type
        const determineItemType = (): 'string' | 'tab' | 'accordion' | 'record' => {
          if (arrayConfig) return 'record'
          // Check if we have existing items to infer the type
          if (Array.isArray(val) && val.length > 0) {
            const firstItem = val[0]
            if (typeof firstItem === 'object' && firstItem !== null) {
              if (Array.isArray(firstItem)) return 'string'
              if ('label' in firstItem && 'content' in firstItem) {
                return 'tab'
              }
              if ('title' in firstItem && 'content' in firstItem) {
                return 'accordion'
              }
              return 'record'
            }
          }
          // Infer from the prop key name as fallback
          if (key === 'tabs') return 'tab'
          if (key === 'items' && block?.type === 'accordion') return 'accordion'
          return 'string'
        }

        const resolvedItemType = determineItemType()
        return (
          <ArrayField
            blockId={block.id}
            value={val || []}
            onChange={(v) => handlePropChange(key, v)}
            itemType={resolvedItemType}
            itemFields={arrayConfig?.itemFields}
            itemLabelKey={arrayConfig?.itemLabelKey}
            defaultIndex={resolvedItemType === 'tab' ? (typeof block.props.defaultTab === 'number' ? block.props.defaultTab : 0) : undefined}
            onDefaultChange={resolvedItemType === 'tab' ? (i) => handlePropChange('defaultTab', i) : undefined}
            onChangeBoth={resolvedItemType === 'tab' ? (newTabs, newDefault) => updateBlock(block.id, { props: { ...block.props, [key]: newTabs, defaultTab: newDefault } }) : undefined}
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
    if (schema.type === 'font-picker') return
    const groupName = schema.group || 'General'
    if (!groupedProps[groupName]) {
      groupedProps[groupName] = []
    }
    groupedProps[groupName].push({ key, schema })
  })

  return (
    <div className="inspector" data-tutorial="inspector">
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
                          {copiedKey === key ? <Check size={14} /> : <Clipboard size={14} />}
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
          <h4 className="inspector-group-title">Inline Styles</h4>
          <InlineStylesEditor styles={block.styles} onChange={handleStyleChange} />
        </div>

        <div className="inspector-group">
          <h4 className="inspector-group-title">Responsive</h4>
          <ResponsiveOverrides classes={block.classes} onChange={handleClassesChange} />
        </div>

        <div className="inspector-group">
          <h4 className="inspector-group-title">Element ID</h4>
          <div className="inspector-field">
            <div className="inspector-field-header">
              <label className="inspector-label">ID</label>
            </div>
            <div className="inspector-control">
              <input
                type="text"
                className="inspector-input inspector-id-input"
                value={typeof block.props.id === 'string' ? block.props.id : ''}
                onChange={(e) => handleElementIdChange(e.target.value)}
                placeholder={block.id}
              />
            </div>
            <div className="inspector-field-note">
              Defaults to generated ID: <code>{block.id}</code>
            </div>
          </div>
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
