import {useMemo, useState} from 'react'

interface InlineStylesEditorProps {
    styles: Record<string, string>
    onChange: (key: string, value: string | undefined) => void
}

const camelToKebab = (value: string): string =>
    value
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/_/g, '-')
        .toLowerCase();

const kebabToCamel = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .replace(/^-+/, '')
        .replace(/-+([a-z0-9])/g, (_, char: string) => char.toUpperCase());

function InlineStylesEditor({styles, onChange}: InlineStylesEditorProps): JSX.Element {
    const [newProp, setNewProp] = useState('');
    const [newValue, setNewValue] = useState('');

    const entries = useMemo(
        () => Object.entries(styles || {}).sort(([a], [b]) => a.localeCompare(b)),
        [styles]
    );

    const handleAdd = () => {
        const normalizedProp = kebabToCamel(newProp);
        const normalizedValue = newValue.trim();
        if (!normalizedProp || !normalizedValue) return;

        onChange(normalizedProp, normalizedValue);
        setNewProp('');
        setNewValue('')
    };

    return (
        <div className="inline-styles-editor">
            {entries.length === 0 ? (
                <div className="inline-styles-empty">No inline styles</div>
            ) : (
                <table className="inline-styles-table">
                    <thead>
                    <tr>
                        <th>Property</th>
                        <th>Value</th>
                        <th>Remove</th>
                    </tr>
                    </thead>
                    <tbody>
                    {entries.map(([key, value]) => (
                        <tr key={key}>
                            <td className="inline-style-prop">{camelToKebab(key)}</td>
                            <td className="inline-style-value">
                                <input
                                    type="text"
                                    className="inspector-input"
                                    value={value}
                                    onChange={(e) => {
                                        const nextValue = e.target.value;
                                        onChange(key, nextValue === '' ? undefined : nextValue)
                                    }}
                                />
                            </td>
                            <td>
                                <button
                                    type="button"
                                    className="inline-style-remove"
                                    onClick={() => onChange(key, undefined)}
                                    aria-label={`Remove ${camelToKebab(key)}`}
                                    title="Remove style"
                                >
                                    ×
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}

            <div className="inline-styles-add">
                <input
                    type="text"
                    className="inspector-input"
                    placeholder="property (e.g. background-color)"
                    value={newProp}
                    onChange={(e) => setNewProp(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAdd()
                    }}
                />
                <input
                    type="text"
                    className="inspector-input"
                    placeholder="value (e.g. yellow)"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAdd()
                    }}
                />
                <button
                    type="button"
                    className="inline-styles-add-btn"
                    onClick={handleAdd}
                    disabled={!newProp.trim() || !newValue.trim()}
                    aria-label="Add inline style"
                    title="Add style"
                >
                    +
                </button>
            </div>
        </div>
    )
}

export default InlineStylesEditor
