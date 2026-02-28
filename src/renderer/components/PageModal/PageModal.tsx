import { useState, useEffect, useRef } from 'react'
import './PageModal.css'

type PageModalMode = 'create' | 'edit' | 'create-folder' | 'edit-folder'

interface PageModalProps {
    mode: PageModalMode
    initialName?: string
    initialTags?: string[]
    onSave: (name: string, tags: string[]) => void
    onCancel: () => void
}

export default function PageModal({
    mode,
    initialName = '',
    initialTags = [],
    onSave,
    onCancel
}: PageModalProps): JSX.Element {
    const [name, setName] = useState(initialName)
    const [tagsInput, setTagsInput] = useState(initialTags.join(', '))
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
        onSave(trimmed, parseTags(tagsInput))
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave()
        if (e.key === 'Escape') onCancel()
    }

    const title = isCreate
        ? isFolder ? 'New Folder' : 'New Page'
        : isFolder ? 'Edit Folder' : 'Edit Page'

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
