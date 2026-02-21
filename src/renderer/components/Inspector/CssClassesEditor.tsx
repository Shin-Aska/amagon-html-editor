import { useState } from 'react'
import './CssClassesEditor.css'

interface CssClassesEditorProps {
  classes: string[]
  onChange: (classes: string[]) => void
}

export default function CssClassesEditor({ classes, onChange }: CssClassesEditorProps): JSX.Element {
  const [inputValue, setInputValue] = useState('')

  const handleAddClass = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault()
      
      // Split by space to allow adding multiple classes at once
      const newClasses = inputValue.trim().split(/\s+/)
      const uniqueNewClasses = newClasses.filter(c => !classes.includes(c))
      
      if (uniqueNewClasses.length > 0) {
        onChange([...classes, ...uniqueNewClasses])
      }
      
      setInputValue('')
    }
  }

  const handleRemoveClass = (classToRemove: string) => {
    onChange(classes.filter(c => c !== classToRemove))
  }

  return (
    <div className="css-classes-editor">
      <div className="classes-input-container">
        <input
          type="text"
          className="inspector-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleAddClass}
          placeholder="Add class (press Enter)"
        />
      </div>
      
      <div className="classes-list">
        {classes.map(className => (
          <div key={className} className="class-chip">
            <span className="class-name">{className}</span>
            <button 
              className="class-remove-btn"
              onClick={() => handleRemoveClass(className)}
              title={`Remove ${className}`}
            >
              &times;
            </button>
          </div>
        ))}
        {classes.length === 0 && (
          <div className="no-classes">No custom classes</div>
        )}
      </div>
    </div>
  )
}
