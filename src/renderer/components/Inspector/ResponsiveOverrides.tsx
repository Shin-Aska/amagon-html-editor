import './ResponsiveOverrides.css'
import {Eye, EyeOff, Monitor, Smartphone, Tablet} from 'lucide-react'
import type {ReactNode} from 'react'

interface ResponsiveOverridesProps {
    classes: string[]
    onChange: (classes: string[]) => void
}

// Bootstrap breakpoint mapping for 3 viewport modes:
//   Mobile  = base (no prefix, 0px+)
//   Tablet  = md   (768px+)
//   Desktop = lg   (1024px+)
//
// Bootstrap display classes are "min-width and up", so we compute the
// correct combination of d-none / d-md-block / d-lg-none / etc.
// to express exactly which viewports should be visible or hidden.

const VISIBILITY_DISPLAY_CLASSES = /^d(-sm|-md|-lg|-xl|-xxl)?-(none|inline|inline-block|block|grid|table|table-row|table-cell|flex|inline-flex)$/;

type Viewport = 'mobile' | 'tablet' | 'desktop'

interface ViewportConfig {
    id: Viewport
    label: string
    icon: ReactNode
}

const VIEWPORTS: ViewportConfig[] = [
    {id: 'desktop', label: 'Desktop', icon: <Monitor size={14}/>},
    {id: 'tablet', label: 'Tablet', icon: <Tablet size={14}/>},
    {id: 'mobile', label: 'Mobile', icon: <Smartphone size={14}/>},
];

/**
 * Parse current classes to determine visibility at each viewport.
 * Bootstrap display utilities cascade upward: d-none hides from xs+,
 * d-md-block shows from md+, etc.
 */
function parseVisibility(classes: string[]): Record<Viewport, boolean> {
    // Collect display values at each breakpoint tier
    // Tiers in order: base, sm, md, lg, xl, xxl
    const tiers = ['', '-sm', '-md', '-lg', '-xl', '-xxl'];
    const displayAtTier: Record<string, string | null> = {};
    for (const t of tiers) displayAtTier[t] = null;

    for (const cls of classes) {
        const match = cls.match(/^d(-sm|-md|-lg|-xl|-xxl)?-(none|inline|inline-block|block|grid|table|table-row|table-cell|flex|inline-flex)$/);
        if (match) {
            const infix = match[1] || '';
            displayAtTier[infix] = match[2]
        }
    }

    // Resolve effective display at each tier by cascading
    // Each tier inherits from the previous unless overridden
    const resolved: string[] = [];
    let current = 'block'; // default visible
    for (const t of tiers) {
        if (displayAtTier[t] !== null) {
            current = displayAtTier[t]!
        }
        resolved.push(current)
    }

    // Map our 3 viewports to tier indices:
    //   mobile  = tier 0 (base / xs)
    //   tablet  = tier 2 (md)
    //   desktop = tier 3 (lg)
    return {
        mobile: resolved[0] !== 'none',
        tablet: resolved[2] !== 'none',
        desktop: resolved[3] !== 'none',
    }
}

/**
 * Given desired visibility for each viewport, compute the minimal set
 * of Bootstrap display classes needed.
 */
function computeClasses(vis: Record<Viewport, boolean>): string[] {
    const result: string[] = [];

    // We set display at 3 tiers: base (mobile), md (tablet), lg (desktop)
    // Only emit a class when the value changes from the previous tier.

    // Base tier (mobile)
    if (!vis.mobile) {
        result.push('d-none')
    }
    // d-block is the default, so we only need d-none if hidden

    // md tier (tablet) — only if different from mobile
    if (vis.tablet !== vis.mobile) {
        result.push(vis.tablet ? 'd-md-block' : 'd-md-none')
    }

    // lg tier (desktop) — only if different from tablet
    if (vis.desktop !== vis.tablet) {
        result.push(vis.desktop ? 'd-lg-block' : 'd-lg-none')
    }

    return result
}

export default function ResponsiveOverrides({classes, onChange}: ResponsiveOverridesProps): JSX.Element {
    const visibility = parseVisibility(classes);

    const handleToggle = (viewport: Viewport) => {
        const newVis = {...visibility, [viewport]: !visibility[viewport]};
        // Remove all existing display utility classes
        const nonDisplayClasses = classes.filter(c => !VISIBILITY_DISPLAY_CLASSES.test(c));
        // Add new computed classes
        const newDisplayClasses = computeClasses(newVis);
        onChange([...nonDisplayClasses, ...newDisplayClasses])
    };

    return (
        <div className="responsive-overrides-editor">
            <div className="responsive-visibility-grid">
                {VIEWPORTS.map(vp => {
                    const isVisible = visibility[vp.id];
                    return (
                        <button
                            key={vp.id}
                            className={`responsive-visibility-btn ${isVisible ? 'visible' : 'hidden-state'}`}
                            onClick={() => handleToggle(vp.id)}
                            title={`${isVisible ? 'Visible' : 'Hidden'} on ${vp.label} — click to toggle`}
                        >
                            <span className="rv-icon">{isVisible ? <Eye size={14}/> : <EyeOff size={14}/>}</span>
                            <span className="rv-label">{vp.label}</span>
                            <span className={`rv-status ${isVisible ? 'status-visible' : 'status-hidden'}`}>
                {isVisible ? 'Visible' : 'Hidden'}
              </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
