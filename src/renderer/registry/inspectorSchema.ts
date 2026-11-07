import type {BlockDefinition, PropSchema} from './ComponentRegistry'

export type InspectorTab = 'content' | 'design' | 'advanced'

export const sectionSearchTerms: Record<string, string> = {
    'Quick styles': 'presets reset defaults comfortable spacious soft rounded raised floating compact airy',
    'Theme colors': 'primary secondary accent background surface text border success warning danger fill inherit',
    Appearance: 'shadow opacity cursor gradient',
    'Media fit': 'image object fit cover contain focal point aspect ratio',
    Typography: 'font family size weight line height letter spacing color align',
    Layout: 'display position z-index top bottom left right width height minimum maximum flex grid columns item alignment gap overflow',
    Spacing: 'margin padding',
    Background: 'color image url size position repeat gradient',
    Border: 'radius corners width style color',
    Animations: 'motion entrance hover action effects duration delay easing',
    Responsive: 'desktop tablet mobile visibility breakpoint',
    'Inline Styles': 'css property value',
    'Element ID': 'anchor identifier',
    'Event Actions': 'javascript click hover',
    'Block Actions': 'duplicate move delete lock save custom block'
};

const designGroups = new Set(['Background', 'Appearance', 'Layout', 'Style', 'Typography', 'Spacing', 'Border']);
const designKeys = /^(alignment|align|variant|size|outline|block|fullHeight|fluid|gutters|width|colSm|colMd|colLg|colXl|offset|order|rounded|shadow|decorative|columns|horizontal|flush|position|theme|backgroundMode|backdropEffect|sticky|transparent|aspectRatio|objectFit|imageHeight|borderRadius|height|thickness|color|style|menuFontSize)$/;
const advancedKeys = /^(id|name|method|action|type|preload|loading|loadingText|disabled|readonly|required|pattern|min|max|step|autoplay|loop|muted|interval|target|newTab)$/;

export function propertyTab(key: string, schema: PropSchema): InspectorTab {
    if (schema.tab) return schema.tab;
    if (designGroups.has(schema.group || '') || designKeys.test(key)) return 'design';
    if (advancedKeys.test(key)) return 'advanced';
    return 'content'
}

/** Hide dependent controls only; hidden values are preserved when changing modes. */
export function isPropertyVisible(key: string, definition: BlockDefinition, props: Record<string, unknown>): boolean {
    const schema = definition.propsSchema[key];
    if (schema?.visibleWhen) {
        const {prop, equals} = schema.visibleWhen;
        const value = props[prop] ?? definition.propsSchema[prop]?.default ?? definition.defaultProps?.[prop];
        return equals === undefined ? Boolean(value) : value === equals
    }
    if (key === 'loadingText' && definition.propsSchema.loading) return props.loading === true;
    if ((key === 'overlayColor' || key === 'overlayOpacity') && definition.propsSchema.overlay) return props.overlay === true;
    if (key === 'backdropEffect' && definition.propsSchema.backgroundMode) return props.backgroundMode === 'backdrop';
    return true
}

export function matchesInspectorSearch(query: string, ...text: (string | undefined)[]): boolean {
    return !query.trim() || text.filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase())
}
