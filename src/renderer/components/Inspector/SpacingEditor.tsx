import {useEffect, useState} from 'react'
import './SpacingEditor.css'

interface SpacingEditorProps {
    styles: Record<string, string>
    onChange: (key: string, value: string | undefined) => void
}

const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const;
const SPACING_PROPS = {
    margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
    padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']
};

function parseValue(val?: string) {
    if (!val) return '';
    return val.replace(/px|pt|rem|em|%/g, '').trim()
}

export default function SpacingEditor({styles, onChange}: SpacingEditorProps): JSX.Element {
    const [activeSide, setActiveSide] = useState<{
        type: 'margin' | 'padding',
        side: typeof SIDES[number]
    } | null>(null);
    const [unit, setUnit] = useState('px');
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        if (activeSide) {
            const propKey = activeSide.type === 'margin'
                ? SPACING_PROPS.margin[SIDES.indexOf(activeSide.side)]
                : SPACING_PROPS.padding[SIDES.indexOf(activeSide.side)];

            const val = styles[propKey];
            if (val) {
                setInputValue(parseValue(val));
                const match = val.match(/(px|pt|rem|em|%)$/);
                if (match) setUnit(match[0])
            } else {
                setInputValue('')
            }
        } else {
            setInputValue('')
        }
    }, [activeSide, styles]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        applyChange(e.target.value, unit)
    };

    const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setUnit(e.target.value);
        if (inputValue) {
            applyChange(inputValue, e.target.value)
        }
    };

    const applyChange = (val: string, currentUnit: string) => {
        if (!activeSide) return;

        const propKey = activeSide.type === 'margin'
            ? SPACING_PROPS.margin[SIDES.indexOf(activeSide.side)]
            : SPACING_PROPS.padding[SIDES.indexOf(activeSide.side)];

        if (!val.trim()) {
            onChange(propKey, undefined)
        } else {
            onChange(propKey, `${val}${currentUnit}`)
        }
    };

    const renderSideBox = (type: 'margin' | 'padding', side: typeof SIDES[number], label: string) => {
        const propKey = type === 'margin'
            ? SPACING_PROPS.margin[SIDES.indexOf(side)]
            : SPACING_PROPS.padding[SIDES.indexOf(side)];
        const value = parseValue(styles[propKey]);

        const isActive = activeSide?.type === type && activeSide?.side === side;

        return (
            <div
                className={`box-side box-${type}-${side.toLowerCase()} ${isActive ? 'active' : ''}`}
                onClick={() => setActiveSide({type, side})}
            >
                <span className="box-value">{value || '-'}</span>
            </div>
        )
    };

    return (
        <div className="spacing-editor">
            <div className="box-model-container">
                <div className="box-margin">
                    <div className="box-label">Margin</div>
                    {renderSideBox('margin', 'Top', 'T')}
                    {renderSideBox('margin', 'Right', 'R')}
                    {renderSideBox('margin', 'Bottom', 'B')}
                    {renderSideBox('margin', 'Left', 'L')}

                    <div className="box-padding">
                        <div className="box-label">Padding</div>
                        {renderSideBox('padding', 'Top', 'T')}
                        {renderSideBox('padding', 'Right', 'R')}
                        {renderSideBox('padding', 'Bottom', 'B')}
                        {renderSideBox('padding', 'Left', 'L')}

                        <div className="box-content">
                            <span>Auto</span>
                        </div>
                    </div>
                </div>
            </div>

            {activeSide && (
                <div className="spacing-controls">
                    <label className="inspector-label">
                        {activeSide.type.charAt(0).toUpperCase() + activeSide.type.slice(1)} {activeSide.side}
                    </label>
                    <div className="spacing-input-group">
                        <input
                            type="number"
                            className="inspector-input"
                            value={inputValue}
                            onChange={handleInputChange}
                            placeholder="0"
                        />
                        <select className="inspector-select" value={unit} onChange={handleUnitChange}>
                            <option value="px">px</option>
                            <option value="pt">pt</option>
                            <option value="rem">rem</option>
                            <option value="em">em</option>
                            <option value="%">%</option>
                        </select>
                    </div>
                </div>
            )}
        </div>
    )
}
