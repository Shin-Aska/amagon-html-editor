import {useEffect, useMemo, useRef, useState} from 'react'
import {useProjectStore} from '../../store/projectStore'
import './UrlField.css'

interface UrlFieldProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
}

export default function UrlField({
    value,
    onChange,
    placeholder = 'e.g. https://... or select a page'
}: UrlFieldProps): JSX.Element {
    const [open, setOpen] = useState(false)
    const [inputValue, setInputValue] = useState(value || '')
    const wrapperRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const pages = useProjectStore((s) => s.pages)
    const folders = useProjectStore((s) => s.folders)

    // Sync external value changes
    useEffect(() => {
        setInputValue(value || '')
    }, [value])

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Build page suggestions with folder paths
    const pageSuggestions = useMemo(() => {
        return pages.map((page) => {
            const folder = page.folderId ? folders.find((f) => f.id === page.folderId) : null
            const folderPrefix = folder ? `${folder.name}/` : ''
            const url = `${folderPrefix}${page.slug}.html`
            return {
                id: page.id,
                title: page.title,
                slug: page.slug,
                url,
                folderName: folder?.name || ''
            }
        })
    }, [pages, folders])

    // Filter suggestions based on input text
    const filtered = useMemo(() => {
        const search = inputValue.toLowerCase().trim()
        if (!search) return pageSuggestions
        return pageSuggestions.filter(
            (p) =>
                p.title.toLowerCase().includes(search) ||
                p.slug.toLowerCase().includes(search) ||
                p.url.toLowerCase().includes(search)
        )
    }, [inputValue, pageSuggestions])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value
        setInputValue(v)
        onChange(v)
        setOpen(true)
    }

    const handleSelect = (url: string) => {
        setInputValue(url)
        onChange(url)
        setOpen(false)
        inputRef.current?.focus()
    }

    const handleFocus = () => {
        setOpen(true)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setOpen(false)
        }
    }

    const handleClear = () => {
        setInputValue('')
        onChange('')
        inputRef.current?.focus()
    }

    return (
        <div className="url-field-wrapper" ref={wrapperRef}>
            <div className="url-field-input-row">
                <input
                    ref={inputRef}
                    type="text"
                    className="inspector-input url-field-input"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                />
                {inputValue && (
                    <button
                        className="url-field-clear"
                        onClick={handleClear}
                        title="Clear URL"
                        type="button"
                    >
                        ×
                    </button>
                )}
            </div>
            {open && filtered.length > 0 && (
                <div className="url-field-dropdown">
                    <div className="url-field-dropdown-header">Project Pages</div>
                    {filtered.map((page) => (
                        <div
                            key={page.id}
                            className={`url-field-option ${page.url === inputValue ? 'selected' : ''}`}
                            onMouseDown={(e) => {
                                e.preventDefault()
                                handleSelect(page.url)
                            }}
                        >
                            <span className="url-field-option-title">{page.title}</span>
                            <span className="url-field-option-url">{page.url}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
