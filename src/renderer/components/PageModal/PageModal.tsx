import {useEffect, useRef, useState} from 'react'
import './PageModal.css'

type PageModalMode = 'create' | 'edit' | 'create-folder' | 'edit-folder'

interface PageModalProps {
    mode: PageModalMode
    initialName?: string
    initialPageTitle?: string
    initialTags?: string[]
    initialPath?: string
    initialDescription?: string
    initialMeta?: Record<string, string>
    initialFullWidthFormControls?: boolean
    onSave: (name: string, tags: string[], path?: string, description?: string, meta?: Record<string, string>, pageTitle?: string, fullWidth?: boolean) => void
    onCancel: () => void
}

const DEFAULT_META_KEYS = ['description', 'charset', 'viewport', 'author', 'keywords', 'robots', 'datePublished']

function formatDateYYYYMMDD(d: Date): string {
    return d.toISOString().slice(0, 10)
}

export default function PageModal({
    mode,
    initialName = '',
    initialPageTitle = '',
    initialTags = [],
    initialPath = '',
    initialDescription = '',
    initialMeta = {},
    initialFullWidthFormControls = true,
    onSave,
    onCancel
}: PageModalProps): JSX.Element {
    const [name, setName] = useState(initialName)
    const [pageTitleInput, setPageTitleInput] = useState(initialPageTitle)
    const [tagsInput, setTagsInput] = useState(initialTags.join(', '))
    const [pathInput, setPathInput] = useState(initialPath)
    const [description, setDescription] = useState(initialDescription)
    const [fullWidthFormControls, setFullWidthFormControls] = useState(initialFullWidthFormControls !== false)
    const [metaEntries, setMetaEntries] = useState<Array<{ key: string; value: string }>>(() => {
        const entries = Object.entries(initialMeta)
            .filter(([k]) => k !== 'description') // description has its own field
            .map(([key, value]) => ({ key, value }))

        if (entries.length > 0) return entries

        if (mode === 'create') {
            return [{ key: 'datePublished', value: formatDateYYYYMMDD(new Date()) }]
        }

        return []
    })
    const nameRef = useRef<HTMLInputElement>(null)

    const isFolder = mode === 'create-folder' || mode === 'edit-folder'
    const isCreate = mode === 'create' || mode === 'create-folder'

    useEffect(() => {
        nameRef.current?.focus()
        nameRef.current?.select()
    }, [])

    const parseTags = (input: string): string[] => {
        return input
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
    }

    const handleSave = () => {
        const trimmed = name.trim()
        if (!trimmed) return
        const trimmedPath = pathInput.trim()

        // Build meta from entries
        const meta: Record<string, string> = {}
        if (description.trim()) {
            meta.description = description.trim()
        }
        for (const entry of metaEntries) {
            const k = entry.key.trim()
            const v = entry.value.trim()
            if (k && v) meta[k] = v
        }

        onSave(trimmed, parseTags(tagsInput), trimmedPath || undefined, description.trim() || undefined, Object.keys(meta).length > 0 ? meta : undefined, pageTitleInput.trim() || undefined, fullWidthFormControls)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) handleSave()
        if (e.key === 'Escape') onCancel()
    }

    const addMetaEntry = () => {
        setMetaEntries((prev) => [...prev, { key: '', value: '' }])
    }

    const removeMetaEntry = (index: number) => {
        setMetaEntries((prev) => prev.filter((_, i) => i !== index))
    }

    const updateMetaEntry = (index: number, field: 'key' | 'value', value: string) => {
        setMetaEntries((prev) =>
            prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
        )
    }

    const title = isCreate
        ? isFolder ? 'New Folder' : 'New Page'
        : isFolder ? 'Edit Folder' : 'Page Properties'

    const namePlaceholder = isFolder ? 'e.g. Navigation Pages' : 'e.g. About Us'
    const tagsPlaceholder = isFolder ? 'e.g. nav' : 'e.g. nav, footer'

    return (
        <div className="page-modal-overlay" onClick={onCancel}>
            <div className="page-modal" onClick={(e) => e.stopPropagation()}>
                <div className="page-modal-header">
                    <h3>{title}</h3>
                    <button className="page-modal-close" onClick={onCancel}>
                        &times;
                    </button>
                </div>

                <div className="page-modal-body">
                    <div className="page-modal-field">
                        <label>{isFolder ? 'Folder Name' : 'Page Name'}</label>
                        <input
                            ref={nameRef}
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={namePlaceholder}
                        />
                    </div>

                    <div className="page-modal-field">
                        <label>Tags</label>
                        <input
                            type="text"
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={tagsPlaceholder}
                        />
                        <span className="field-hint">
                            {isFolder
                                ? 'Comma-separated. Tags on folders are inherited by all pages inside. Moving a page out of the folder removes the inherited tags automatically.'
                                : 'Comma-separated. Used to filter pages in components like the Navbar.'}
                        </span>
                    </div>

                    {!isFolder && (
                        <div className="page-modal-field">
                            <label>Path (optional)</label>
                            <input
                                type="text"
                                value={pathInput}
                                onChange={(e) => setPathInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="e.g. about-us"
                            />
                            <span className="field-hint">
                                Sets the page slug / output filename. Leave empty to auto-generate from the page name.
                            </span>
                        </div>
                    )}

                    {!isFolder && (
                        <div className="page-modal-field">
                            <label>Description</label>
                            <textarea
                                className="page-modal-textarea"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="A short description of this page for SEO and page lists."
                                rows={3}
                            />
                        </div>
                    )}

                    {!isFolder && (
                        <div className="page-modal-field">
                            <label>Page Title (Doc Title)</label>
                            <input
                                type="text"
                                value={pageTitleInput}
                                onChange={(e) => setPageTitleInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="e.g. Welcome to Our Website"
                            />
                            <span className="field-hint">
                                The HTML &lt;title&gt; tag. If empty, it defaults to the Page Name.
                            </span>
                        </div>
                    )}

                    {!isFolder && (
                        <div className="page-modal-field">
                            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={fullWidthFormControls}
                                    onChange={(e) => setFullWidthFormControls(e.target.checked)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                                />
                                Full-Width Form Controls
                            </label>
                            <span className="field-hint" style={{ marginTop: 4, display: 'block' }}>
                                Stretches inputs, textareas, and selects to 100% width by default.
                            </span>
                        </div>
                    )}

                    {!isFolder && (
                        <div className="page-modal-field">
                            <label>Meta Tags</label>
                            <span className="field-hint" style={{ marginBottom: 6 }}>
                                Custom &lt;meta&gt; tags for this page. Common tags like charset and viewport are set automatically.
                            </span>
                            {metaEntries.map((entry, index) => (
                                <div key={index} className="meta-tag-row">
                                    <input
                                        type="text"
                                        className="meta-tag-key"
                                        value={entry.key}
                                        onChange={(e) => updateMetaEntry(index, 'key', e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="name"
                                    />
                                    <input
                                        type="text"
                                        className="meta-tag-value"
                                        value={entry.value}
                                        onChange={(e) => updateMetaEntry(index, 'value', e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="content"
                                    />
                                    <button
                                        className="meta-tag-remove"
                                        onClick={() => removeMetaEntry(index)}
                                        title="Remove"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                            <button className="meta-tag-add-btn" onClick={addMetaEntry}>
                                + Add Meta Tag
                            </button>
                        </div>
                    )}
                </div>

                <div className="page-modal-footer">
                    <button className="page-modal-btn page-modal-btn-cancel" onClick={onCancel}>
                        Cancel
                    </button>
                    <button
                        className="page-modal-btn page-modal-btn-save"
                        onClick={handleSave}
                        disabled={!name.trim()}
                    >
                        {isCreate ? (isFolder ? 'Create Folder' : 'Create Page') : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    )
}
