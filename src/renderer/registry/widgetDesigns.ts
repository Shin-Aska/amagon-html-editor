import type {Block} from '../store/types'

export type DesignProfile = 'layout' | 'spacer' | 'divider' | 'choice' | 'progress' | 'spinner' | 'text' | 'media' | 'icon' | 'action' | 'field' | 'surface' | 'section' | 'indicator' | 'embed'
export interface WidgetDesignPreset {id: string; label: string; description: string; styles: Record<string, string>}

/** Explicit coverage: adding a widget requires choosing its customization profile. */
export const widgetDesignProfiles: Record<string, DesignProfile> = {
    container: 'layout', row: 'layout', column: 'layout', divider: 'divider', spacer: 'spacer', section: 'section',
    heading: 'text', paragraph: 'text', blockquote: 'text', list: 'text', 'code-block': 'surface',
    image: 'media', video: 'media', icon: 'icon', carousel: 'media',
    button: 'action', link: 'action', form: 'surface', input: 'field', textarea: 'field', checkbox: 'choice',
    select: 'field', radio: 'choice', range: 'field', 'file-input': 'field', countdown: 'layout',
    'before-after': 'media', 'map-embed': 'embed',
    navbar: 'surface', hero: 'section', 'feature-card': 'surface', footer: 'section', accordion: 'surface',
    tabs: 'surface', 'pricing-table': 'surface', testimonial: 'surface', 'cta-section': 'section',
    modal: 'surface', 'page-list': 'surface', alert: 'surface', badge: 'indicator', progress: 'progress',
    spinner: 'spinner', breadcrumb: 'text', pagination: 'action', table: 'surface', dropdown: 'action',
    offcanvas: 'surface', card: 'surface', 'social-links': 'action', 'cookie-banner': 'surface', 'back-to-top': 'action',
    'stats-section': 'section', 'team-grid': 'section', gallery: 'section', timeline: 'section',
    'logo-cloud': 'section', 'process-steps': 'section', newsletter: 'section', 'comparison-table': 'section',
    'contact-card': 'surface', 'raw-html': 'embed', iframe: 'embed'
};

const profiles: Record<DesignProfile, WidgetDesignPreset[]> = {
    spacer: [
        {id: 'small', label: 'Small', description: 'A small half-rem gap.', styles: {height: '.5rem'}},
        {id: 'medium', label: 'Medium', description: 'A two-rem gap.', styles: {height: '2rem'}},
        {id: 'large', label: 'Large', description: 'A four-rem gap.', styles: {height: '4rem'}}
    ],
    divider: [
        {id: 'thin', label: 'Thin', description: 'A subtle one-pixel rule.', styles: {borderTopWidth: '1px', opacity: '.35'}},
        {id: 'medium', label: 'Medium', description: 'A two-pixel rule.', styles: {borderTopWidth: '2px', opacity: '.65'}},
        {id: 'bold', label: 'Bold', description: 'A strong four-pixel rule.', styles: {borderTopWidth: '4px', opacity: '1'}}
    ],
    choice: [
        {id: 'compact', label: 'Compact', description: 'A smaller choice label.', styles: {fontSize: '.875rem', lineHeight: '1.5'}},
        {id: 'comfortable', label: 'Comfortable', description: 'A standard choice label.', styles: {fontSize: '1rem', lineHeight: '1.5'}},
        {id: 'large', label: 'Large', description: 'A larger choice label.', styles: {fontSize: '1.125rem', lineHeight: '1.6'}}
    ],
    progress: [
        {id: 'slim', label: 'Slim', description: 'A slim progress track.', styles: {height: '.5rem'}},
        {id: 'standard', label: 'Standard', description: 'A standard progress track.', styles: {height: '1rem'}},
        {id: 'large', label: 'Large', description: 'A larger track for visible labels.', styles: {height: '1.5rem'}}
    ],
    spinner: [
        {id: 'small', label: 'Small', description: 'A small loading indicator.', styles: {width: '1rem', height: '1rem'}},
        {id: 'medium', label: 'Medium', description: 'A standard loading indicator.', styles: {width: '2rem', height: '2rem'}},
        {id: 'large', label: 'Large', description: 'A larger loading indicator.', styles: {width: '3rem', height: '3rem'}}
    ],
    layout: [
        {id: 'compact', label: 'Compact', description: 'Tighter padding and spacing.', styles: {padding: '.75rem', gap: '.5rem'}},
        {id: 'comfortable', label: 'Comfortable', description: 'Room for content to breathe.', styles: {padding: '1.5rem', gap: '1rem'}},
        {id: 'spacious', label: 'Spacious', description: 'Generous padding and spacing.', styles: {padding: '3rem', gap: '2rem'}}
    ],
    text: [
        {id: 'readable', label: 'Readable', description: 'A comfortable reading measure and line height.', styles: {maxWidth: '65ch', lineHeight: '1.65', letterSpacing: 'normal'}},
        {id: 'editorial', label: 'Editorial', description: 'A narrower reading measure with generous leading.', styles: {maxWidth: '52ch', lineHeight: '1.8', letterSpacing: '.01em'}},
        {id: 'compact', label: 'Compact', description: 'Tight leading for shorter text.', styles: {maxWidth: 'none', lineHeight: '1.3', letterSpacing: '-.01em'}}
    ],
    media: [
        {id: 'clean', label: 'Clean', description: 'Square corners and no shadow.', styles: {borderRadius: '0', boxShadow: 'none'}},
        {id: 'rounded', label: 'Rounded', description: 'Soft rounded corners with clipped media.', styles: {borderRadius: '1rem', boxShadow: 'none', overflow: 'hidden'}},
        {id: 'lifted', label: 'Lifted', description: 'Rounded corners with a soft shadow.', styles: {borderRadius: '1rem', boxShadow: '0 12px 32px rgb(0 0 0 / .16)', overflow: 'hidden'}}
    ],
    icon: [
        {id: 'subtle', label: 'Subtle', description: 'Use the theme muted text color.', styles: {color: 'var(--theme-text-muted)', fontSize: '1.25rem'}},
        {id: 'accent', label: 'Accent', description: 'Use the theme primary color.', styles: {color: 'var(--theme-primary)', fontSize: '2rem'}},
        {id: 'statement', label: 'Statement', description: 'A large theme accent icon.', styles: {color: 'var(--theme-accent)', fontSize: '3rem'}}
    ],
    action: [
        {id: 'square', label: 'Square', description: 'Crisp corners without a shadow.', styles: {borderRadius: '0', boxShadow: 'none', letterSpacing: 'normal'}},
        {id: 'soft', label: 'Soft', description: 'Soft corners with a subtle shadow.', styles: {borderRadius: '.75rem', boxShadow: '0 2px 8px rgb(0 0 0 / .12)', letterSpacing: 'normal'}},
        {id: 'pill', label: 'Pill', description: 'Fully rounded with a little letter spacing.', styles: {borderRadius: '999px', boxShadow: 'none', letterSpacing: '.02em'}}
    ],
    field: [
        {id: 'square', label: 'Square', description: 'Crisp field edges.', styles: {borderRadius: '0', boxShadow: 'none'}},
        {id: 'soft', label: 'Soft', description: 'Soft field edges.', styles: {borderRadius: '.5rem', boxShadow: 'none'}},
        {id: 'inset', label: 'Inset', description: 'A subtle inset shadow.', styles: {borderRadius: '.5rem', boxShadow: 'inset 0 1px 4px rgb(0 0 0 / .12)'}}
    ],
    surface: [
        {id: 'flat', label: 'Flat', description: 'A flat surface with gentle corners.', styles: {borderRadius: '.5rem', boxShadow: 'none'}},
        {id: 'raised', label: 'Raised', description: 'Soft corners and a light shadow.', styles: {borderRadius: '1rem', boxShadow: '0 4px 20px rgb(0 0 0 / .10)'}},
        {id: 'floating', label: 'Floating', description: 'Larger corners and a deeper shadow.', styles: {borderRadius: '1.5rem', boxShadow: '0 16px 48px rgb(0 0 0 / .16)'}}
    ],
    section: [
        {id: 'compact', label: 'Compact', description: 'Less vertical space around this section.', styles: {paddingTop: '1.5rem', paddingBottom: '1.5rem'}},
        {id: 'balanced', label: 'Balanced', description: 'Comfortable vertical section spacing.', styles: {paddingTop: '3rem', paddingBottom: '3rem'}},
        {id: 'airy', label: 'Airy', description: 'Responsive, generous vertical section spacing.', styles: {paddingTop: 'clamp(3rem, 8vw, 6rem)', paddingBottom: 'clamp(3rem, 8vw, 6rem)'}}
    ],
    indicator: [
        {id: 'crisp', label: 'Crisp', description: 'Square corners.', styles: {borderRadius: '0'}},
        {id: 'soft', label: 'Soft', description: 'Gently rounded corners.', styles: {borderRadius: '.5rem'}},
        {id: 'round', label: 'Round', description: 'Fully rounded corners.', styles: {borderRadius: '999px'}}
    ],
    embed: [
        {id: 'plain', label: 'Plain', description: 'No frame or shadow.', styles: {borderRadius: '0', boxShadow: 'none', border: '0'}},
        {id: 'framed', label: 'Framed', description: 'A rounded frame using the theme border color.', styles: {borderRadius: '1rem', boxShadow: 'none', border: '1px solid var(--theme-border)'}},
        {id: 'raised', label: 'Raised', description: 'A framed embed with a soft shadow.', styles: {borderRadius: '1rem', boxShadow: '0 8px 24px rgb(0 0 0 / .12)', border: '1px solid var(--theme-border)'}}
    ]
};

export function getWidgetDesignPresets(type: string): WidgetDesignPreset[] {
    return profiles[widgetDesignProfiles[type] ?? 'surface']
}

/** Switch only preset-owned styles, keeping all content, classes, and unrelated styles. */
export function widgetPresetStyles(type: string, preset: WidgetDesignPreset): Record<string, string | undefined> {
    const keys = new Set(getWidgetDesignPresets(type).flatMap(item => Object.keys(item.styles)));
    return {...Object.fromEntries([...keys].map(key => [key, undefined])), ...preset.styles}
}

export function resetWidgetStyles(block: Block, defaults: Record<string, string> = {}): Record<string, string | undefined> {
    return {...Object.fromEntries(Object.keys(block.styles).map(key => [key, undefined])), ...defaults}
}
