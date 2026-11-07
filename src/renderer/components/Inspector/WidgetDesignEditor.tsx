import type {Block} from '../../store/types'
import {getWidgetDesignPresets, resetWidgetStyles, widgetPresetStyles} from '../../registry/widgetDesigns'
import {componentRegistry} from '../../registry/ComponentRegistry'

export default function WidgetDesignEditor({block, onChange}: {
    block: Block
    onChange: (styles: Record<string, string | undefined>) => void
}): JSX.Element {
    return <div>
        <p className="inspector-field-note">Choose a starting style, then fine-tune it below. Your content stays in place.</p>
        <div className="widget-design-presets" role="group" aria-label="Widget design presets">
            {getWidgetDesignPresets(block.type).map(preset => <button key={preset.id} type="button"
                title={preset.description} data-preset-id={preset.id}
                aria-pressed={Object.entries(preset.styles).every(([key, value]) => block.styles[key] === value)}
                onClick={() => onChange(widgetPresetStyles(block.type, preset))}>
                <span className={`widget-design-sample sample-${preset.id}`} aria-hidden="true"><span/><span/></span>
                <span>{preset.label}</span>
            </button>)}
        </div>
        <button type="button" className="inspector-reset-design" disabled={Object.keys(block.styles).length === 0}
            onClick={() => onChange(resetWidgetStyles(block, componentRegistry.get(block.type)?.defaultStyles))}>
            Reset style overrides
        </button>
        <p className="inspector-field-note">Reset restores widget styling while keeping content, classes, and interactions. You can undo it.</p>
    </div>
}
