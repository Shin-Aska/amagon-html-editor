import {useCallback, useEffect, useState} from 'react'
import './ArrayField.css'
import {useEditorStore} from '../../store/editorStore'
import {ArrowDown, ArrowUp, ChevronDown, ChevronRight, Palette, Plus, Star, Trash2} from 'lucide-react'
import IconField from './IconField'
import ImageField from './ImageField'
import UrlField from './UrlField'

export interface TabItem {
    label: string
    content: string
}

export interface AccordionItem {
    title: string
    content: string
}

export type ArrayRecordItem = Record<string, unknown>

export type ArrayItem = string | TabItem | AccordionItem | ArrayRecordItem

export interface ArrayRecordField {
    key: string
    label: string
    type?: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'image' | 'url' | 'icon' | 'json' | 'social-map' | 'feature-list'
    default?: unknown
    placeholder?: string
    rows?: number
    options?: { label: string; value: string | number | boolean }[]
}

interface ArrayFieldProps {
    blockId?: string
    value: ArrayItem[]
    onChange: (value: ArrayItem[]) => void
    itemType?: 'string' | 'tab' | 'accordion' | 'record'
    itemFields?: ArrayRecordField[]
    itemLabelKey?: string
    defaultIndex?: number
    onDefaultChange?: (index: number) => void
    onChangeBoth?: (value: ArrayItem[], defaultIndex: number) => void
}

function isRecordItem(item: unknown): item is ArrayRecordItem {
    return typeof item === 'object' && item !== null && !Array.isArray(item)
}

function cloneDefault(value: unknown): unknown {
    if (Array.isArray(value) || isRecordItem(value)) {
        return JSON.parse(JSON.stringify(value))
    }
    return value
}

function createRecordItem(fields: ArrayRecordField[] | undefined): ArrayRecordItem {
    if (!fields || fields.length === 0) return {label: 'New Item'};

    return fields.reduce<ArrayRecordItem>((acc, field) => {
        if (field.default !== undefined) {
            acc[field.key] = cloneDefault(field.default)
        } else if (field.type === 'boolean') {
            acc[field.key] = false
        } else if (field.type === 'number') {
            acc[field.key] = 0
        } else if (field.type === 'json' || field.type === 'social-map') {
            acc[field.key] = {}
        } else if (field.type === 'feature-list') {
            acc[field.key] = []
        } else {
            acc[field.key] = ''
        }
        return acc
    }, {})
}

function formatRecordSummary(item: ArrayRecordItem, index: number, labelKey?: string): string {
    const preferredKeys = [
        labelKey,
        'label',
        'title',
        'name',
        'platform',
        'caption',
        'altText',
        'value',
        'date',
        'number'
    ].filter(Boolean) as string[];

    for (const key of preferredKeys) {
        const value = item[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    }

    return `Item ${index + 1}`
}

function labelizeKey(key: string): string {
    return key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[-_]+/g, ' ')
        .replace(/^\w/, (c) => c.toUpperCase())
}

function JsonField({
                       value,
                       fallback,
                       onChange
                   }: {
    value: unknown
    fallback: unknown
    onChange: (value: unknown) => void
}): JSX.Element {
    const stringify = useCallback((nextValue: unknown) => {
        try {
            return JSON.stringify(nextValue ?? fallback ?? {}, null, 2)
        } catch {
            return ''
        }
    }, [fallback]);

    const [draft, setDraft] = useState(() => stringify(value));
    const [error, setError] = useState('');

    useEffect(() => {
        setDraft(stringify(value));
        setError('')
    }, [stringify, value]);

    return (
        <div className="array-json-field">
      <textarea
          className={`array-textarea ${error ? 'has-error' : ''}`}
          value={draft}
          rows={4}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
              try {
                  onChange(draft.trim() ? JSON.parse(draft) : cloneDefault(fallback ?? {}));
                  setError('')
              } catch {
                  setError('Invalid JSON')
              }
          }}
      />
            {error && <div className="array-field-error">{error}</div>}
        </div>
    )
}

function normalizeSocialMap(value: unknown): Record<string, string> {
    if (!isRecordItem(value)) return {};

    return Object.fromEntries(
        Object.entries(value)
            .map(([key, nextValue]) => [key, String(nextValue ?? '')])
            .filter(([key]) => key.trim().length > 0)
    )
}

function SocialMapField({
                            value,
                            onChange
                        }: {
    value: unknown
    onChange: (value: Record<string, string>) => void
}): JSX.Element {
    const current = normalizeSocialMap(value);
    const keys = Array.from(new Set(['twitter', 'linkedin', 'github', ...Object.keys(current)]));

    const updatePlatform = (platform: string, url: string) => {
        onChange({...current, [platform]: url})
    };

    return (
        <div className="array-nested-field">
            {keys.map((platform) => (
                <label key={platform} className="array-nested-row">
                    <span>{labelizeKey(platform)}</span>
                    <input
                        type="text"
                        className="array-input"
                        value={current[platform] || ''}
                        onChange={(e) => updatePlatform(platform, e.target.value)}
                        placeholder="#"
                    />
                </label>
            ))}
        </div>
    )
}

interface FeatureItem {
    text: string
    included: boolean
}

function normalizeFeatures(value: unknown): FeatureItem[] {
    if (!Array.isArray(value)) return [];

    return value.map((feature) => {
        if (isRecordItem(feature)) {
            return {
                text: String(feature.text ?? ''),
                included: Boolean(feature.included)
            }
        }

        return {
            text: String(feature ?? ''),
            included: true
        }
    })
}

function FeatureListField({
                              value,
                              onChange
                          }: {
    value: unknown
    onChange: (value: FeatureItem[]) => void
}): JSX.Element {
    const features = normalizeFeatures(value);

    const updateFeature = (index: number, updates: Partial<FeatureItem>) => {
        const next = [...features];
        next[index] = {...next[index], ...updates};
        onChange(next)
    };

    const removeFeature = (index: number) => {
        const next = [...features];
        next.splice(index, 1);
        onChange(next)
    };

    return (
        <div className="array-nested-field">
            {features.map((feature, index) => (
                <div key={index} className="array-feature-row">
                    <input
                        type="text"
                        className="array-input"
                        value={feature.text}
                        onChange={(e) => updateFeature(index, {text: e.target.value})}
                        placeholder="Feature"
                    />
                    <label className="array-inline-check">
                        <input
                            type="checkbox"
                            checked={feature.included}
                            onChange={(e) => updateFeature(index, {included: e.target.checked})}
                        />
                        Included
                    </label>
                    <button type="button" className="array-action-btn delete" onClick={() => removeFeature(index)}
                            title="Remove feature">
                        x
                    </button>
                </div>
            ))}
            <button
                type="button"
                className="array-add-btn secondary"
                onClick={() => onChange([...features, {text: 'New feature', included: true}])}
            >
                + Add Feature
            </button>
        </div>
    )
}

function ArrayField({
                        blockId,
                        value = [],
                        onChange,
                        itemType = 'string',
                        itemFields,
                        itemLabelKey,
                        defaultIndex = 0,
                        onDefaultChange,
                        onChangeBoth
                    }: ArrayFieldProps): JSX.Element {
    const [newItemText, setNewItemText] = useState('');
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    const normalizeValue = useCallback((): ArrayItem[] => {
        if (!Array.isArray(value)) return [];
        return value
    }, [value]);

    const handleAddStringItem = useCallback(() => {
        if (!newItemText.trim()) return;
        const current = normalizeValue();
        onChange([...current, newItemText.trim()]);
        setNewItemText('')
    }, [newItemText, normalizeValue, onChange]);

    const handleAddObjectItem = useCallback(() => {
        const current = normalizeValue();
        let newItem;
        if (itemType === 'tab') {
            newItem = {label: 'New Tab', content: ''}
        } else if (itemType === 'accordion') {
            newItem = {title: 'New Item', content: ''}
        } else if (itemType === 'record') {
            newItem = createRecordItem(itemFields)
        }
        if (newItem) {
            onChange([...current, newItem]);
            setExpandedIndex(current.length)
        }
    }, [itemFields, itemType, normalizeValue, onChange]);

    const updateItem = (index: number, updates: Partial<TabItem | AccordionItem>) => {
        const next = [...normalizeValue()];
        const item = next[index];
        if (isRecordItem(item)) {
            next[index] = {...item, ...updates};
            onChange(next)
        }
    };

    const updateRecordField = (index: number, fieldKey: string, fieldValue: unknown) => {
        const next = [...normalizeValue()];
        const item = next[index];
        next[index] = {
            ...(isRecordItem(item) ? item : {}),
            [fieldKey]: fieldValue
        };
        onChange(next)
    };

    const updateStringItem = (index: number, newValue: string) => {
        const next = [...normalizeValue()];
        next[index] = newValue;
        onChange(next)
    };

    const moveItem = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        const current = normalizeValue();
        if (newIndex < 0 || newIndex >= current.length) return;

        const next = [...current];
        const [item] = next.splice(index, 1);
        next.splice(newIndex, 0, item);

        let newDefault = defaultIndex;
        if (defaultIndex === index) newDefault = newIndex;
        else if (defaultIndex === newIndex) newDefault = index;

        if (expandedIndex === index) {
            setExpandedIndex(newIndex)
        } else if (expandedIndex === newIndex) {
            setExpandedIndex(index)
        }

        if (onChangeBoth && newDefault !== defaultIndex) {
            onChangeBoth(next, newDefault)
        } else {
            onChange(next);
            if (onDefaultChange && newDefault !== defaultIndex) {
                onDefaultChange(newDefault)
            }
        }
    };

    const removeItem = (index: number) => {
        const next = [...normalizeValue()];
        next.splice(index, 1);
        onChange(next);

        if (expandedIndex === index) {
            setExpandedIndex(null)
        } else if (expandedIndex !== null && expandedIndex > index) {
            setExpandedIndex(expandedIndex - 1)
        }

        if (onDefaultChange) {
            if (defaultIndex === index) {
                onDefaultChange(Math.max(0, index - 1))
            } else if (defaultIndex > index) {
                onDefaultChange(defaultIndex - 1)
            }
        }
    };

    const renderRecordField = (item: ArrayItem, index: number, field: ArrayRecordField) => {
        const record = isRecordItem(item) ? item : {};
        const fieldValue = record[field.key] ?? field.default;
        const fieldType = field.type || 'text';

        if (fieldType === 'boolean') {
            return (
                <label key={field.key} className="array-record-check">
                    <input
                        type="checkbox"
                        checked={Boolean(fieldValue)}
                        onChange={(e) => updateRecordField(index, field.key, e.target.checked)}
                    />
                    <span>{field.label}</span>
                </label>
            )
        }

        if (fieldType === 'textarea') {
            return (
                <label key={field.key} className="array-record-field full">
                    <span>{field.label}</span>
                    <textarea
                        className="array-textarea"
                        value={String(fieldValue ?? '')}
                        rows={field.rows || 2}
                        onChange={(e) => updateRecordField(index, field.key, e.target.value)}
                        placeholder={field.placeholder}
                    />
                </label>
            )
        }

        if (fieldType === 'select') {
            return (
                <label key={field.key} className="array-record-field">
                    <span>{field.label}</span>
                    <select
                        className="array-input"
                        value={String(fieldValue ?? '')}
                        onChange={(e) => updateRecordField(index, field.key, e.target.value)}
                    >
                        {field.options?.map((option) => (
                            <option key={String(option.value)} value={String(option.value)}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            )
        }

        if (fieldType === 'json') {
            return (
                <label key={field.key} className="array-record-field full">
                    <span>{field.label}</span>
                    <JsonField
                        value={fieldValue}
                        fallback={field.default}
                        onChange={(nextValue) => updateRecordField(index, field.key, nextValue)}
                    />
                </label>
            )
        }

        if (fieldType === 'social-map') {
            return (
                <label key={field.key} className="array-record-field full">
                    <span>{field.label}</span>
                    <SocialMapField
                        value={fieldValue}
                        onChange={(nextValue) => updateRecordField(index, field.key, nextValue)}
                    />
                </label>
            )
        }

        if (fieldType === 'feature-list') {
            return (
                <label key={field.key} className="array-record-field full">
                    <span>{field.label}</span>
                    <FeatureListField
                        value={fieldValue}
                        onChange={(nextValue) => updateRecordField(index, field.key, nextValue)}
                    />
                </label>
            )
        }

        if (fieldType === 'image') {
            return (
                <div key={field.key} className="array-record-field full">
                    <span>{field.label}</span>
                    <ImageField
                        value={String(fieldValue ?? '')}
                        onChange={(nextValue) => updateRecordField(index, field.key, nextValue)}
                    />
                </div>
            )
        }

        if (fieldType === 'icon') {
            return (
                <div key={field.key} className="array-record-field full">
                    <span>{field.label}</span>
                    <IconField
                        value={String(fieldValue ?? '')}
                        onChange={(nextValue) => updateRecordField(index, field.key, nextValue)}
                    />
                </div>
            )
        }

        if (fieldType === 'url') {
            return (
                <div key={field.key} className="array-record-field full">
                    <span>{field.label}</span>
                    <UrlField
                        value={String(fieldValue ?? '')}
                        onChange={(nextValue) => updateRecordField(index, field.key, nextValue)}
                    />
                </div>
            )
        }

        const inputType = fieldType === 'number' ? 'number' : 'text';
        return (
            <label key={field.key} className="array-record-field">
                <span>{field.label}</span>
                <input
                    type={inputType}
                    className="array-input"
                    value={fieldValue === undefined || fieldValue === null ? '' : String(fieldValue)}
                    onChange={(e) => {
                        const nextValue = fieldType === 'number'
                            ? (e.target.value === '' ? undefined : Number(e.target.value))
                            : e.target.value;
                        updateRecordField(index, field.key, nextValue)
                    }}
                    placeholder={field.placeholder}
                />
            </label>
        )
    };

    const items = normalizeValue();

    const isStringArray = itemType === 'string';
    const isTabArray = itemType === 'tab';
    const isAccordionArray = itemType === 'accordion';
    const isRecordArray = itemType === 'record';
    const addLabel = isTabArray ? 'Tab' : 'Item';

    return (
        <div className="array-field">
            <div className="array-field-header">
                {isStringArray ? (
                    <div className="array-add-row">
                        <input
                            type="text"
                            className="array-input"
                            placeholder="Add new item..."
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddStringItem()
                                }
                            }}
                        />
                        <button
                            className="array-add-btn"
                            onClick={handleAddStringItem}
                            disabled={!newItemText.trim()}
                        >
                            <Plus size={14}/> Add
                        </button>
                    </div>
                ) : (
                    <button className="array-add-btn" onClick={handleAddObjectItem}>
                        <Plus size={14}/> Add {addLabel}
                    </button>
                )}
            </div>

            <div className="array-items-list">
                {items.length === 0 ? (
                    <div className="array-empty">No items added.</div>
                ) : (
                    items.map((item, index) => {
                        const isExpanded = expandedIndex === index;
                        return (
                            <div key={index} className={`array-item ${isExpanded ? 'expanded' : ''}`}>
                                {isStringArray ? (
                                    <div className="array-item-string">
                                        <input
                                            type="text"
                                            className="array-input"
                                            value={String(item)}
                                            onChange={(e) => updateStringItem(index, e.target.value)}
                                        />
                                        <div className="array-item-actions">
                                            <button
                                                className="array-action-btn"
                                                onClick={() => moveItem(index, 'up')}
                                                disabled={index === 0}
                                                title="Move up"
                                            >
                                                <ArrowUp size={14}/>
                                            </button>
                                            <button
                                                className="array-action-btn"
                                                onClick={() => moveItem(index, 'down')}
                                                disabled={index === items.length - 1}
                                                title="Move down"
                                            >
                                                <ArrowDown size={14}/>
                                            </button>
                                            <button
                                                className="array-action-btn delete"
                                                onClick={() => removeItem(index)}
                                                title="Remove"
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="array-item-object">
                                        <div
                                            className="array-item-header"
                                            onClick={() => setExpandedIndex(isExpanded ? null : index)}
                                        >
                                            <div className="array-item-title">
                                                {isExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                                                <span>{formatRecordSummary(isRecordItem(item) ? item : {}, index, itemLabelKey)}</span>
                                            </div>
                                            <div className="array-item-actions" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    className="array-action-btn"
                                                    onClick={() => moveItem(index, 'up')}
                                                    disabled={index === 0}
                                                    title="Move up"
                                                >
                                                    <ArrowUp size={14}/>
                                                </button>
                                                <button
                                                    className="array-action-btn"
                                                    onClick={() => moveItem(index, 'down')}
                                                    disabled={index === items.length - 1}
                                                    title="Move down"
                                                >
                                                    <ArrowDown size={14}/>
                                                </button>
                                                <button
                                                    className="array-action-btn delete"
                                                    onClick={() => removeItem(index)}
                                                    title="Remove"
                                                >
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="array-item-body">
                                                {isTabArray && (
                                                    <>
                                                        <div className="array-tab-label-row">
                                                            <input
                                                                type="text"
                                                                className="array-input"
                                                                placeholder="Tab label"
                                                                value={(item as TabItem).label || ''}
                                                                onChange={(e) => updateItem(index, {label: e.target.value})}
                                                            />
                                                            {onDefaultChange && (
                                                                <button
                                                                    className={`array-default-btn${index === defaultIndex ? ' active' : ''}`}
                                                                    onClick={() => onDefaultChange(index)}
                                                                    title={index === defaultIndex ? 'Default tab' : 'Set as default tab'}
                                                                >
                                                                    <Star size={12}
                                                                          fill={index === defaultIndex ? 'currentColor' : 'none'}/>
                                                                </button>
                                                            )}
                                                        </div>
                                                        {blockId && (
                                                            <button
                                                                className="array-edit-canvas-btn"
                                                                onClick={() => useEditorStore.getState().enterTabEditMode(blockId, index)}
                                                                title="Edit tab content visually in the canvas"
                                                            >
                                                                <Palette size={12}/> Edit tab content in Canvas
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                {isAccordionArray && (
                                                    <>
                                                        <input
                                                            type="text"
                                                            className="array-input"
                                                            placeholder="Item title"
                                                            value={(item as AccordionItem).title || ''}
                                                            onChange={(e) => updateItem(index, {title: e.target.value})}
                                                        />
                                                        <textarea
                                                            className="array-textarea"
                                                            placeholder="Item content"
                                                            value={(item as AccordionItem).content || ''}
                                                            onChange={(e) => updateItem(index, {content: e.target.value})}
                                                            rows={2}
                                                        />
                                                    </>
                                                )}
                                                {isRecordArray && (
                                                    <div className="array-record-grid">
                                                        {(itemFields || Object.keys(isRecordItem(item) ? item : {}).map((fieldKey) => ({
                                                            key: fieldKey,
                                                            label: labelizeKey(fieldKey),
                                                            type: isRecordItem(item) && typeof item[fieldKey] === 'boolean'
                                                                ? 'boolean'
                                                                : isRecordItem(item) && (Array.isArray(item[fieldKey]) || isRecordItem(item[fieldKey]))
                                                                    ? 'json'
                                                                    : 'text'
                                                        } satisfies ArrayRecordField))).map((field) => renderRecordField(item, index, field))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}

export default ArrayField
