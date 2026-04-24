import {useEffect, useMemo, useRef, useState} from 'react'
import {X} from 'lucide-react'
import {getApi} from '../../utils/api'
import {dispatchAiAvailabilityChanged} from '../../hooks/useAiAvailability'
import './CredentialEditModal.css'

interface Props {
    open: boolean
    mode: 'create' | 'edit'
    credential: CredentialRecordInfo | null
    definitions: CredentialDefinitionInfo[]
    onClose: () => void
    onSaved: () => void
}

const CATEGORY_OPTIONS: Array<{ value: CredentialCategory; label: string }> = [
    {value: 'ai', label: 'AI'},
    {value: 'multimedia', label: 'Multimedia'},
    {value: 'publisher', label: 'Publisher'}
];

export default function CredentialEditModal({
                                                open,
                                                mode,
                                                credential,
                                                definitions,
                                                onClose,
                                                onSaved
                                            }: Props): JSX.Element | null {
    const overlayRef = useRef<HTMLDivElement>(null);
    const [selectedCategory, setSelectedCategory] = useState<CredentialCategory>('ai');
    const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
    const [values, setValues] = useState<Record<string, string>>({});
    const [hints, setHints] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const definitionsForCategory = useMemo(
        () => definitions.filter((d) => d.category === selectedCategory),
        [definitions, selectedCategory]
    );

    const selectedDefinition = useMemo(
        () => definitions.find((d) => d.id === selectedDefinitionId) ?? null,
        [definitions, selectedDefinitionId]
    );

    useEffect(() => {
        if (!open) return;

        setError(null);
        setSaving(false);

        if (mode === 'edit' && credential) {
            setSelectedCategory(credential.category);
            setSelectedDefinitionId(credential.id);
            const api = getApi();
            api.app.getCredentialValues(credential.id).then((result) => {
                const rawValues = result.success ? (result.values ?? {}) : {};
                const nextValues: Record<string, string> = {};
                const nextHints: Record<string, string> = {};
                for (const field of credential.fields) {
                    const v = rawValues[field.key] ?? '';
                    nextValues[field.key] = field.sensitive ? '' : v;
                    nextHints[field.key] = v
                }
                setValues(nextValues);
                setHints(nextHints)
            })
        } else {
            const fallback = definitions.find((d) => d.category === 'ai') ?? definitions[0];
            setSelectedCategory('ai');
            setSelectedDefinitionId(fallback?.id ?? '');
            setValues({});
            setHints({})
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler)
    }, [open, onClose]);

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === overlayRef.current) onClose()
    };

    const handleSave = async () => {
        if (!selectedDefinition) return;
        setSaving(true);
        setError(null);

        const payload = selectedDefinition.fields.reduce<Record<string, string>>((acc, field) => {
            const value = values[field.key] ?? '';
            const hint = hints[field.key] ?? '';
            if (field.sensitive && value === '' && hint) return acc;
            acc[field.key] = value;
            return acc
        }, {});

        const api = getApi();
        const result = await api.app.saveCredential(selectedDefinition.id, payload);
        setSaving(false);
        if (!result.success) {
            setError(result.error || 'Could not save credential.');
            return
        }

        dispatchAiAvailabilityChanged();
        onSaved();
        onClose()
    };

    if (!open) return null;

    return (
        <div className="cred-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
            <div className="cred-modal" role="dialog" aria-modal="true">
                <div className="cred-modal-header">
                    <h3 className="cred-modal-title">{mode === 'create' ? 'Add Credential' : 'Edit Credential'}</h3>
                    <button className="settings-dialog-close" onClick={onClose} title="Close">
                        <X size={16}/>
                    </button>
                </div>

                <div className="cred-modal-body">
                    {mode === 'create' && (
                        <>
                            <div className="settings-field">
                                <label>Credential Type</label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        const cat = e.target.value as CredentialCategory;
                                        const fallback = definitions.find((d) => d.category === cat);
                                        setSelectedCategory(cat);
                                        setSelectedDefinitionId(fallback?.id ?? '');
                                        setValues({});
                                        setHints({})
                                    }}
                                    className="settings-input"
                                >
                                    {CATEGORY_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="settings-field">
                                <label>Provider</label>
                                <select
                                    value={selectedDefinitionId}
                                    onChange={(e) => {
                                        setSelectedDefinitionId(e.target.value);
                                        setValues({});
                                        setHints({})
                                    }}
                                    className="settings-input"
                                >
                                    {definitionsForCategory.map((d) => (
                                        <option key={d.id} value={d.id}>{d.label}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    {selectedDefinition?.fields.map((field) => (
                        <div key={field.key} className="settings-field">
                            <label>{field.label}</label>
                            <input
                                type={field.sensitive ? 'password' : 'text'}
                                className="settings-input"
                                placeholder={
                                    field.sensitive && hints[field.key]
                                        ? `Saved ${hints[field.key]}`
                                        : (field.placeholder ?? '')
                                }
                                value={values[field.key] ?? ''}
                                onChange={(e) => setValues((prev) => ({...prev, [field.key]: e.target.value}))}
                            />
                        </div>
                    ))}

                    {error && <div className="settings-error">{error}</div>}
                </div>

                <div className="cred-modal-footer">
                    <button className="settings-btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="settings-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save Credential'}
                    </button>
                </div>
            </div>
        </div>
    )
}
