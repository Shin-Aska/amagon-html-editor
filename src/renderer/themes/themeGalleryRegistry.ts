import type {ProjectTheme} from '../store/types'
import {previewSampleBlocks} from './previewSampleBlocks'
import {
    boldStartupThemePack,
    darkCyberThemePack,
    editorialClassicThemePack,
    minimalZenThemePack,
    modernSaasThemePack,
    warmBoutiqueThemePack
} from './themePacks'
import type {ThemeGalleryItem} from './themeGalleryTypes'

const createTheme = (theme: ProjectTheme): ProjectTheme => ({
    ...theme,
    colors: {...theme.colors},
    typography: {...theme.typography},
    spacing: {...theme.spacing, scale: [...theme.spacing.scale]},
    borders: {...theme.borders},
    customCssFiles: [...(theme.customCssFiles ?? [])]
})

const createGalleryItem = (item: ThemeGalleryItem): ThemeGalleryItem => ({
    ...item,
    theme: createTheme(item.theme),
    darkTheme: item.darkTheme ? createTheme(item.darkTheme) : undefined,
    previewBlocks: item.previewBlocks ? [...item.previewBlocks] : undefined,
    categories: [...item.categories],
    tags: [...item.tags]
})

export const builtInThemeGalleryItems: ThemeGalleryItem[] = [
    createGalleryItem({
        id: 'default',
        name: 'Default',
        description: 'Balanced Bootstrap-friendly default with bright blue actions and familiar spacing.',
        previewBlocks: previewSampleBlocks,
        categories: ['business', 'landing-page'],
        tags: ['default', 'balanced', 'bootstrap'],
        theme: {
            name: 'Default',
            colors: {
                primary: '#1e66f5',
                secondary: '#6c757d',
                accent: '#7c3aed',
                background: '#ffffff',
                surface: '#f8f9fa',
                text: '#212529',
                textMuted: '#6c757d',
                border: '#dee2e6',
                success: '#198754',
                warning: '#ffc107',
                danger: '#dc3545'
            },
            typography: {
                fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                headingFontFamily: 'inherit',
                baseFontSize: '16px',
                lineHeight: '1.6',
                headingLineHeight: '1.2'
            },
            spacing: {
                baseUnit: '8px',
                scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8]
            },
            borders: {
                radius: '6px',
                width: '1px',
                color: '#dee2e6'
            },
            customCss: '',
            customCssFiles: []
        },
        darkTheme: {
            name: 'Default Dark',
            colors: {
                primary: '#7fb2ff',
                secondary: '#94a3b8',
                accent: '#f59e0b',
                background: '#0f172a',
                surface: '#111827',
                text: '#e5e7eb',
                textMuted: '#94a3b8',
                border: '#334155',
                success: '#34d399',
                warning: '#fbbf24',
                danger: '#f87171'
            },
            typography: {
                fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                headingFontFamily: 'inherit',
                baseFontSize: '16px',
                lineHeight: '1.6',
                headingLineHeight: '1.2'
            },
            spacing: {
                baseUnit: '8px',
                scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8]
            },
            borders: {
                radius: '6px',
                width: '1px',
                color: '#334155'
            },
            customCss: '',
            customCssFiles: []
        },
        isBuiltIn: true,
        isCustom: false
    }),
    createGalleryItem({
        id: 'midnight',
        name: 'Midnight',
        description: 'Deep slate surfaces with indigo highlights for dashboards and dark-first marketing pages.',
        previewBlocks: previewSampleBlocks,
        categories: ['dark', 'saas'],
        tags: ['dark', 'midnight', 'dashboard'],
        theme: {
            name: 'Midnight',
            colors: {
                primary: '#818cf8',
                secondary: '#94a3b8',
                accent: '#f472b6',
                background: '#0f172a',
                surface: '#1e293b',
                text: '#e2e8f0',
                textMuted: '#94a3b8',
                border: '#334155',
                success: '#34d399',
                warning: '#fbbf24',
                danger: '#f87171'
            },
            typography: {
                fontFamily: '"Inter", system-ui, sans-serif',
                headingFontFamily: 'inherit',
                baseFontSize: '16px',
                lineHeight: '1.6',
                headingLineHeight: '1.25'
            },
            spacing: {
                baseUnit: '8px',
                scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8]
            },
            borders: {
                radius: '8px',
                width: '1px',
                color: '#334155'
            },
            customCss: '',
            customCssFiles: []
        },
        darkTheme: createTheme(darkCyberThemePack.darkTheme ?? darkCyberThemePack.theme),
        isBuiltIn: true,
        isCustom: false
    }),
    createGalleryItem({
        id: 'forest',
        name: 'Forest',
        description: 'Organic greens and warm neutrals suited to eco brands, retreats, and service sites.',
        previewBlocks: previewSampleBlocks,
        categories: ['wellness', 'business'],
        tags: ['forest', 'nature', 'organic'],
        theme: {
            name: 'Forest',
            colors: {
                primary: '#059669',
                secondary: '#6b7280',
                accent: '#d97706',
                background: '#fefce8',
                surface: '#f0fdf4',
                text: '#1a2e05',
                textMuted: '#6b7280',
                border: '#d1d5db',
                success: '#16a34a',
                warning: '#eab308',
                danger: '#dc2626'
            },
            typography: {
                fontFamily: '"Merriweather Sans", system-ui, sans-serif',
                headingFontFamily: '"Merriweather", Georgia, serif',
                baseFontSize: '16px',
                lineHeight: '1.7',
                headingLineHeight: '1.3'
            },
            spacing: {
                baseUnit: '8px',
                scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8]
            },
            borders: {
                radius: '4px',
                width: '1px',
                color: '#d1d5db'
            },
            customCss: '',
            customCssFiles: []
        },
        darkTheme: createTheme(warmBoutiqueThemePack.darkTheme ?? warmBoutiqueThemePack.theme),
        isBuiltIn: true,
        isCustom: false
    }),
    createGalleryItem({
        id: 'ocean',
        name: 'Ocean',
        description: 'Fresh aqua surfaces with crisp blue hierarchy for apps, agencies, and product sites.',
        previewBlocks: previewSampleBlocks,
        categories: ['business', 'saas'],
        tags: ['ocean', 'fresh', 'clean'],
        theme: {
            name: 'Ocean',
            colors: {
                primary: '#0ea5e9',
                secondary: '#64748b',
                accent: '#a78bfa',
                background: '#f0f9ff',
                surface: '#e0f2fe',
                text: '#0c4a6e',
                textMuted: '#64748b',
                border: '#bae6fd',
                success: '#22c55e',
                warning: '#f59e0b',
                danger: '#ef4444'
            },
            typography: {
                fontFamily: '"Source Sans 3", system-ui, sans-serif',
                headingFontFamily: 'inherit',
                baseFontSize: '16px',
                lineHeight: '1.6',
                headingLineHeight: '1.2'
            },
            spacing: {
                baseUnit: '8px',
                scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8]
            },
            borders: {
                radius: '8px',
                width: '1px',
                color: '#bae6fd'
            },
            customCss: '',
            customCssFiles: []
        },
        darkTheme: createTheme(modernSaasThemePack.darkTheme ?? modernSaasThemePack.theme),
        isBuiltIn: true,
        isCustom: false
    }),
    createGalleryItem({
        id: 'warm-minimal',
        name: 'Warm Minimal',
        description: 'Soft terracotta tones with editorial typography for calm premium pages.',
        previewBlocks: previewSampleBlocks,
        categories: ['minimal', 'creative'],
        tags: ['warm', 'minimal', 'editorial'],
        theme: {
            name: 'Warm Minimal',
            colors: {
                primary: '#c2410c',
                secondary: '#78716c',
                accent: '#b45309',
                background: '#faf5f0',
                surface: '#f5ebe0',
                text: '#292524',
                textMuted: '#78716c',
                border: '#d6d3d1',
                success: '#15803d',
                warning: '#ca8a04',
                danger: '#b91c1c'
            },
            typography: {
                fontFamily: '"DM Sans", system-ui, sans-serif',
                headingFontFamily: '"Playfair Display", Georgia, serif',
                baseFontSize: '17px',
                lineHeight: '1.7',
                headingLineHeight: '1.15'
            },
            spacing: {
                baseUnit: '8px',
                scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8]
            },
            borders: {
                radius: '2px',
                width: '1px',
                color: '#d6d3d1'
            },
            customCss: '',
            customCssFiles: []
        },
        darkTheme: createTheme(editorialClassicThemePack.darkTheme ?? editorialClassicThemePack.theme),
        isBuiltIn: true,
        isCustom: false
    }),
    createGalleryItem({
        id: 'slate',
        name: 'Slate',
        description: 'A softened productivity palette pulled from the Modern SaaS pack for neutral app shells.',
        previewBlocks: previewSampleBlocks,
        categories: ['business', 'saas'],
        tags: ['slate', 'neutral', 'app'],
        theme: createTheme(modernSaasThemePack.theme),
        darkTheme: createTheme(modernSaasThemePack.darkTheme ?? modernSaasThemePack.theme),
        isBuiltIn: true,
        isCustom: false
    }),
    createGalleryItem({
        id: 'sunset',
        name: 'Sunset',
        description: 'Punchy launch-day colors with saturated purple and coral energy.',
        previewBlocks: previewSampleBlocks,
        categories: ['startup', 'landing-page'],
        tags: ['sunset', 'bold', 'launch'],
        theme: createTheme(boldStartupThemePack.theme),
        darkTheme: createTheme(boldStartupThemePack.darkTheme ?? boldStartupThemePack.theme),
        isBuiltIn: true,
        isCustom: false
    }),
    createGalleryItem({
        id: 'ink',
        name: 'Ink',
        description: 'Dark editorial contrast for portfolio stories, essays, and moody brand systems.',
        previewBlocks: previewSampleBlocks,
        categories: ['dark', 'editorial'],
        tags: ['ink', 'editorial', 'moody'],
        theme: createTheme(editorialClassicThemePack.darkTheme ?? editorialClassicThemePack.theme),
        darkTheme: createTheme(darkCyberThemePack.darkTheme ?? darkCyberThemePack.theme),
        isBuiltIn: true,
        isCustom: false
    }),
    createGalleryItem({
        id: 'paper',
        name: 'Paper',
        description: 'Warm parchment and serif hierarchy derived from the Editorial Classic pack.',
        previewBlocks: previewSampleBlocks,
        categories: ['editorial', 'creative'],
        tags: ['paper', 'serif', 'journal'],
        theme: createTheme(editorialClassicThemePack.theme),
        darkTheme: createTheme(editorialClassicThemePack.darkTheme ?? editorialClassicThemePack.theme),
        isBuiltIn: true,
        isCustom: false
    }),
    createGalleryItem({
        id: 'neon',
        name: 'Neon',
        description: 'Full-fidelity futuristic mode with electric cyan accents and black-glass depth.',
        previewBlocks: previewSampleBlocks,
        categories: ['dark', 'startup'],
        tags: ['neon', 'cyber', 'tech'],
        theme: createTheme(darkCyberThemePack.theme),
        darkTheme: createTheme(darkCyberThemePack.darkTheme ?? darkCyberThemePack.theme),
        isBuiltIn: true,
        isCustom: false
    }),
    createGalleryItem({
        id: 'earth',
        name: 'Earth',
        description: 'Grounded terracotta-and-stone palette for boutiques, food brands, and studios.',
        previewBlocks: previewSampleBlocks,
        categories: ['ecommerce', 'creative'],
        tags: ['earth', 'artisan', 'warm'],
        theme: createTheme(warmBoutiqueThemePack.theme),
        darkTheme: createTheme(warmBoutiqueThemePack.darkTheme ?? warmBoutiqueThemePack.theme),
        isBuiltIn: true,
        isCustom: false
    }),
    createGalleryItem({
        id: 'frost',
        name: 'Frost',
        description: 'Breathable cool neutrals from the Minimal Zen pack for studios and wellness brands.',
        previewBlocks: previewSampleBlocks,
        categories: ['minimal', 'wellness'],
        tags: ['frost', 'airy', 'wellness'],
        theme: createTheme(minimalZenThemePack.theme),
        darkTheme: createTheme(minimalZenThemePack.darkTheme ?? minimalZenThemePack.theme),
        isBuiltIn: true,
        isCustom: false
    })
]

export const builtInThemeGalleryItemMap: Record<string, ThemeGalleryItem> = builtInThemeGalleryItems.reduce<Record<string, ThemeGalleryItem>>(
    (accumulator, item) => {
        accumulator[item.id] = item
        return accumulator
    },
    {}
)

export const builtInGalleryThemes: Array<{
    name: string
    theme: ProjectTheme
    category: string
    tags: string[]
    mode: 'light' | 'dark'
}> = builtInThemeGalleryItems.flatMap((item) => {
    const primaryCategory = item.categories[0] ?? 'business'
    const lightTheme: ProjectTheme = {
        ...createTheme(item.theme),
        name: item.theme.name,
        isCustom: false
    }
    const darkSourceTheme = item.darkTheme ?? item.theme
    const darkTheme: ProjectTheme = {
        ...createTheme(darkSourceTheme),
        name: darkSourceTheme.name,
        isCustom: false
    }

    return [
        {
            name: item.name,
            theme: lightTheme,
            category: primaryCategory,
            tags: [...item.tags],
            mode: 'light' as const
        },
        {
            name: item.name,
            theme: darkTheme,
            category: primaryCategory,
            tags: [...item.tags],
            mode: 'dark' as const
        }
    ]
})
