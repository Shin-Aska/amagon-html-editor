import { useState } from 'react'
import './ResponsiveOverrides.css'

interface ResponsiveOverridesProps {
  classes: string[]
  onChange: (classes: string[]) => void
}

const BREAKPOINTS = [
  { id: 'xs', label: 'Mobile', icon: '📱', prefix: '' },
  { id: 'sm', label: 'Tablet', icon: '💻', prefix: 'sm:' },
  { id: 'md', label: 'Desktop', icon: '🖥️', prefix: 'md:' },
  { id: 'lg', label: 'Large', icon: '📺', prefix: 'lg:' },
  { id: 'xl', label: 'X-Large', icon: '🖵', prefix: 'xl:' },
  { id: 'xxl', label: 'XX-Large', icon: '🖵+', prefix: 'xxl:' }
]

const BOOTSTRAP_BREAKPOINTS = [
  { id: 'xs', label: 'Mobile', icon: '📱', infix: '' },
  { id: 'sm', label: 'Tablet', icon: '💻', infix: '-sm' },
  { id: 'md', label: 'Desktop', icon: '🖥️', infix: '-md' },
  { id: 'lg', label: 'Large', icon: '📺', infix: '-lg' },
  { id: 'xl', label: 'X-Large', icon: '🖵', infix: '-xl' },
  { id: 'xxl', label: 'XX-Large', icon: '🖵+', infix: '-xxl' }
]

export default function ResponsiveOverrides({ classes, onChange }: ResponsiveOverridesProps): JSX.Element {
  const [activeBreakpoint, setActiveBreakpoint] = useState('xs')
  
  // This is a simplified version of responsive overrides that maps directly to Bootstrap utility classes.
  // A full implementation would need to parse existing classes and categorize them by breakpoint,
  // then provide UI controls to add/remove specific utility classes (like display: none -> d-none, d-md-block).
  // For Phase 7.8, we'll provide a basic UI that allows toggling visibility per breakpoint as a proof of concept.

  const bp = BOOTSTRAP_BREAKPOINTS.find(b => b.id === activeBreakpoint) || BOOTSTRAP_BREAKPOINTS[0]

  const handleVisibilityToggle = (visible: boolean) => {
    // Remove existing visibility classes for this breakpoint
    const regex = new RegExp(`^d${bp.infix}-(none|inline|inline-block|block|grid|table|table-row|table-cell|flex|inline-flex)$`)
    let newClasses = classes.filter(c => !regex.test(c))
    
    // Add new class if needed
    if (!visible) {
      newClasses.push(`d${bp.infix}-none`)
    } else if (activeBreakpoint !== 'xs') {
      // If we're making it visible on a larger breakpoint, we typically reset it to block
      // In a real app, we'd need to know its default display type (flex, inline-block, etc)
      newClasses.push(`d${bp.infix}-block`)
    }
    
    onChange(newClasses)
  }

  // Check if currently hidden at this breakpoint
  const isHidden = classes.some(c => c === `d${bp.infix}-none`)

  return (
    <div className="responsive-overrides-editor">
      <div className="breakpoint-tabs">
        {BOOTSTRAP_BREAKPOINTS.map(b => (
          <button
            key={b.id}
            className={`breakpoint-tab ${activeBreakpoint === b.id ? 'active' : ''}`}
            onClick={() => setActiveBreakpoint(b.id)}
            title={`${b.label} Breakpoint`}
          >
            {b.icon}
          </button>
        ))}
      </div>
      
      <div className="breakpoint-content">
        <div className="style-row">
          <div className="style-col">
            <label className="style-label">Visibility on {bp.label}</label>
            <div className="button-group">
              <button 
                className={`btn-toggle ${!isHidden ? 'active' : ''}`}
                onClick={() => handleVisibilityToggle(true)}
              >
                Visible
              </button>
              <button 
                className={`btn-toggle ${isHidden ? 'active' : ''}`}
                onClick={() => handleVisibilityToggle(false)}
              >
                Hidden
              </button>
            </div>
          </div>
        </div>
        
        <div className="responsive-info">
          <p>Note: Visibility changes map to Bootstrap display utility classes (e.g., <code>d-none</code>, <code>d-md-block</code>).</p>
        </div>
      </div>
    </div>
  )
}
