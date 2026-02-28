import { useState, useRef, useEffect } from 'react'

interface ComboboxFieldProps {
  value: string
  options: string[]
  onChange: (value: string) => void
  placeholder?: string
}

export default function ComboboxField({
  value,
  options,
  onChange,
  placeholder
}: ComboboxFieldProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value || '')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const filtered = options.filter(
    (opt) => opt.toLowerCase().includes(inputValue.toLowerCase())
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setInputValue(v)
    onChange(v)
    setOpen(true)
  }

  const handleSelect = (opt: string) => {
    setInputValue(opt)
    onChange(opt)
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

  return (
    <div className="combobox-wrapper" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        className="inspector-input"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {open && filtered.length > 0 && (
        <div className="combobox-dropdown">
          {filtered.map((opt) => (
            <div
              key={opt}
              className={`combobox-option ${opt === inputValue ? 'selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault() // prevent blur
                handleSelect(opt)
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
