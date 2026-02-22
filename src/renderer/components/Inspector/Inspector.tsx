import { useEditorStore } from '../../store/editorStore'
import { componentRegistry, type PropSchema } from '../../registry/ComponentRegistry'
import SpacingEditor from './SpacingEditor'
import { TypographyEditor, BackgroundEditor, BorderEditor, LayoutEditor } from './StyleEditors'
import CssClassesEditor from './CssClassesEditor'
import BlockActions from './BlockActions'
import ResponsiveOverrides from './ResponsiveOverrides'
import BlockIcon from '../BlockIcon/BlockIcon'
import ImageField from './ImageField'
import './Inspector.css'

function Inspector(): JSX.Element {
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
  const getBlockById = useEditorStore((s) => s.getBlockById)
  const updateBlock = useEditorStore((s) => s.updateBlock)
  
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
    const newStyles = { ...block.styles }
    if (value === undefined || value === '') {
      delete newStyles[key]
    } else {
      newStyles[key] = value
    }
    
    updateBlock(block.id, {
      styles: newStyles
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
                    <span className="inspector-help-tooltip" title={schema.description}>?</span>
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
          <h4 className="inspector-group-title">Block Actions</h4>
          <BlockActions blockId={block.id} blockType={block.type} />
        </div>
      </div>
    </div>
  )
}

export default Inspector
