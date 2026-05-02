import type {ProjectTheme} from '../store/types'
import {createDefaultComponentTokens} from './componentTokens'
import type {ThemePack} from './themeGalleryTypes'

const createTheme = (theme: ProjectTheme): ProjectTheme => ({
    ...theme,
    colors: {...theme.colors},
    typography: {...theme.typography},
    spacing: {...theme.spacing, scale: [...theme.spacing.scale]},
    borders: {...theme.borders},
    customCssFiles: [...(theme.customCssFiles ?? [])]
})

export const modernSaasThemePack: ThemePack = {
    id: 'modern-saas',
    name: 'Modern SaaS',
    description: 'Cool product-led styling with soft surfaces, rounded UI, and bright action states.',
    accentColor: '#7c3aed',
    theme: createTheme({
        name: 'Modern SaaS',
        colors: {
            primary: '#2563eb',
            secondary: '#64748b',
            accent: '#7c3aed',
            background: '#f8fbff',
            surface: '#ffffff',
            text: '#0f172a',
            textMuted: '#64748b',
            border: '#dbe7f5',
            success: '#16a34a',
            warning: '#f59e0b',
            danger: '#ef4444'
        },
        typography: {
            fontFamily: '"Inter", system-ui, sans-serif',
            headingFontFamily: '"Inter", system-ui, sans-serif',
            baseFontSize: '16px',
            lineHeight: '1.65',
            headingLineHeight: '1.1'
        },
        spacing: {
            baseUnit: '8px',
            scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 7]
        },
        borders: {
            radius: '18px',
            width: '1px',
            color: '#dbe7f5'
        },
        customCss: '',
        customCssFiles: []
    }),
    darkTheme: createTheme({
        name: 'Modern SaaS Dark',
        colors: {
            primary: '#60a5fa',
            secondary: '#94a3b8',
            accent: '#a78bfa',
            background: '#020617',
            surface: '#0f172a',
            text: '#e2e8f0',
            textMuted: '#94a3b8',
            border: '#1e293b',
            success: '#4ade80',
            warning: '#fbbf24',
            danger: '#f87171'
        },
        typography: {
            fontFamily: '"Inter", system-ui, sans-serif',
            headingFontFamily: '"Inter", system-ui, sans-serif',
            baseFontSize: '16px',
            lineHeight: '1.65',
            headingLineHeight: '1.1'
        },
        spacing: {
            baseUnit: '8px',
            scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 7]
        },
        borders: {
            radius: '18px',
            width: '1px',
            color: '#1e293b'
        },
        customCss: '',
        customCssFiles: []
    }),
    componentTokens: createDefaultComponentTokens({
        button: {
            borderRadius: '999px',
            padding: '0.82rem 1.4rem',
            fontWeight: '700',
            textTransform: 'none',
            shadow: '0 10px 25px rgba(37, 99, 235, 0.18)'
        },
        card: {
            borderRadius: '24px',
            padding: '1.75rem',
            shadow: '0 20px 50px rgba(15, 23, 42, 0.08)'
        },
        headings: {
            fontWeight: '800',
            letterSpacing: '-0.035em'
        },
        form: {
            inputBorderRadius: '16px',
            inputPadding: '0.9rem 1rem',
            focusRingColor: 'rgba(37, 99, 235, 0.22)'
        }
    }),
    suggestedSections: ['hero', 'logo-cloud', 'feature-grid', 'pricing', 'cta'],
    suggestedPages: ['landing-page', 'product', 'changelog', 'docs-home'],
    tags: ['saas', 'product', 'clean', 'rounded', 'marketing'],
    categories: ['business', 'landing-page', 'saas', 'startup']
}

export const editorialClassicThemePack: ThemePack = {
    id: 'editorial-classic',
    name: 'Editorial Classic',
    description: 'Refined serif headlines, quiet paper tones, and elegant long-form rhythm.',
    accentColor: '#8b5e34',
    theme: createTheme({
        name: 'Editorial Classic',
        colors: {
            primary: '#1f3a5f',
            secondary: '#6b7280',
            accent: '#8b5e34',
            background: '#f6f1e8',
            surface: '#fffdf8',
            text: '#1f2937',
            textMuted: '#6b7280',
            border: '#ded4c4',
            success: '#2f855a',
            warning: '#c88a12',
            danger: '#c2410c'
        },
        typography: {
            fontFamily: '"Source Sans 3", system-ui, sans-serif',
            headingFontFamily: '"Cormorant Garamond", Georgia, serif',
            baseFontSize: '18px',
            lineHeight: '1.8',
            headingLineHeight: '1.05'
        },
        spacing: {
            baseUnit: '10px',
            scale: [0.25, 0.5, 1, 1.5, 2, 2.5, 4, 6, 8]
        },
        borders: {
            radius: '4px',
            width: '1px',
            color: '#ded4c4'
        },
        customCss: '',
        customCssFiles: []
    }),
    darkTheme: createTheme({
        name: 'Editorial Classic Night',
        colors: {
            primary: '#cbd5e1',
            secondary: '#9ca3af',
            accent: '#d4a373',
            background: '#111111',
            surface: '#1a1a1a',
            text: '#f3efe6',
            textMuted: '#b3ab9d',
            border: '#333333',
            success: '#68d391',
            warning: '#f6ad55',
            danger: '#fc8181'
        },
        typography: {
            fontFamily: '"Source Sans 3", system-ui, sans-serif',
            headingFontFamily: '"Cormorant Garamond", Georgia, serif',
            baseFontSize: '18px',
            lineHeight: '1.8',
            headingLineHeight: '1.05'
        },
        spacing: {
            baseUnit: '10px',
            scale: [0.25, 0.5, 1, 1.5, 2, 2.5, 4, 6, 8]
        },
        borders: {
            radius: '4px',
            width: '1px',
            color: '#333333'
        },
        customCss: '',
        customCssFiles: []
    }),
    componentTokens: createDefaultComponentTokens({
        button: {
            borderRadius: '4px',
            padding: '0.72rem 1.1rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            shadow: 'none'
        },
        card: {
            borderRadius: '6px',
            padding: '1.6rem',
            shadow: '0 12px 30px rgba(101, 83, 66, 0.08)'
        },
        headings: {
            fontWeight: '700',
            letterSpacing: '-0.03em'
        },
        form: {
            inputBorderRadius: '4px',
            inputPadding: '0.8rem 0.9rem',
            focusRingColor: 'rgba(139, 94, 52, 0.18)'
        }
    }),
    suggestedSections: ['masthead', 'article-grid', 'quote-strip', 'newsletter'],
    suggestedPages: ['magazine-home', 'story', 'about-the-editor', 'journal'],
    tags: ['editorial', 'serif', 'storytelling', 'luxury', 'classic'],
    categories: ['creative', 'editorial', 'portfolio']
}

export const darkCyberThemePack: ThemePack = {
    id: 'dark-cyber',
    name: 'Dark Cyber',
    description: 'Electric contrast, terminal-inspired darkness, and dramatic neon callouts.',
    accentColor: '#22d3ee',
    theme: createTheme({
        name: 'Dark Cyber',
        colors: {
            primary: '#8b5cf6',
            secondary: '#64748b',
            accent: '#22d3ee',
            background: '#060816',
            surface: '#111827',
            text: '#ecfeff',
            textMuted: '#94a3b8',
            border: '#1f2937',
            success: '#22c55e',
            warning: '#f59e0b',
            danger: '#fb7185'
        },
        typography: {
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            headingFontFamily: '"Space Grotesk", system-ui, sans-serif',
            baseFontSize: '16px',
            lineHeight: '1.6',
            headingLineHeight: '1.05'
        },
        spacing: {
            baseUnit: '8px',
            scale: [0.25, 0.5, 1, 1.25, 2, 3, 4, 5, 6]
        },
        borders: {
            radius: '14px',
            width: '1px',
            color: '#1f2937'
        },
        customCss: '',
        customCssFiles: []
    }),
    darkTheme: createTheme({
        name: 'Dark Cyber Alt',
        colors: {
            primary: '#c084fc',
            secondary: '#a5b4fc',
            accent: '#67e8f9',
            background: '#030712',
            surface: '#0f172a',
            text: '#f8fafc',
            textMuted: '#cbd5e1',
            border: '#334155',
            success: '#4ade80',
            warning: '#fbbf24',
            danger: '#fda4af'
        },
        typography: {
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            headingFontFamily: '"Space Grotesk", system-ui, sans-serif',
            baseFontSize: '16px',
            lineHeight: '1.6',
            headingLineHeight: '1.05'
        },
        spacing: {
            baseUnit: '8px',
            scale: [0.25, 0.5, 1, 1.25, 2, 3, 4, 5, 6]
        },
        borders: {
            radius: '14px',
            width: '1px',
            color: '#334155'
        },
        customCss: '',
        customCssFiles: []
    }),
    componentTokens: createDefaultComponentTokens({
        button: {
            borderRadius: '12px',
            padding: '0.82rem 1.25rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            shadow: '0 0 0 rgba(0, 0, 0, 0)'
        },
        card: {
            borderRadius: '18px',
            padding: '1.5rem',
            shadow: '0 14px 40px rgba(2, 8, 23, 0.45)'
        },
        headings: {
            fontWeight: '700',
            letterSpacing: '-0.03em'
        },
        form: {
            inputBorderRadius: '12px',
            inputPadding: '0.85rem 1rem',
            focusRingColor: 'rgba(34, 211, 238, 0.22)'
        },
        shadows: {
            sm: '0 8px 20px rgba(2, 8, 23, 0.25)',
            md: '0 14px 36px rgba(2, 8, 23, 0.35)',
            lg: '0 20px 50px rgba(2, 8, 23, 0.45)',
            xl: '0 0 40px rgba(34, 211, 238, 0.22)'
        }
    }),
    suggestedSections: ['hero', 'stats-grid', 'integration-strip', 'faq', 'terminal-cta'],
    suggestedPages: ['launch-page', 'tool-home', 'pricing', 'docs'],
    tags: ['dark', 'cyber', 'neon', 'tech', 'futuristic'],
    categories: ['dark', 'landing-page', 'saas', 'startup']
}

export const warmBoutiqueThemePack: ThemePack = {
    id: 'warm-boutique',
    name: 'Warm Boutique',
    description: 'Inviting neutrals, artisan contrast, and boutique storefront softness.',
    accentColor: '#b45309',
    theme: createTheme({
        name: 'Warm Boutique',
        colors: {
            primary: '#9a3412',
            secondary: '#78716c',
            accent: '#b45309',
            background: '#fdf6ef',
            surface: '#fffaf5',
            text: '#292524',
            textMuted: '#78716c',
            border: '#e7d8c7',
            success: '#15803d',
            warning: '#ca8a04',
            danger: '#b91c1c'
        },
        typography: {
            fontFamily: '"DM Sans", system-ui, sans-serif',
            headingFontFamily: '"Playfair Display", Georgia, serif',
            baseFontSize: '17px',
            lineHeight: '1.75',
            headingLineHeight: '1.1'
        },
        spacing: {
            baseUnit: '8px',
            scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 9]
        },
        borders: {
            radius: '10px',
            width: '1px',
            color: '#e7d8c7'
        },
        customCss: '',
        customCssFiles: []
    }),
    darkTheme: createTheme({
        name: 'Warm Boutique Dark',
        colors: {
            primary: '#fdba74',
            secondary: '#cbd5e1',
            accent: '#f59e0b',
            background: '#1c1917',
            surface: '#292524',
            text: '#fafaf9',
            textMuted: '#d6d3d1',
            border: '#44403c',
            success: '#4ade80',
            warning: '#facc15',
            danger: '#fb7185'
        },
        typography: {
            fontFamily: '"DM Sans", system-ui, sans-serif',
            headingFontFamily: '"Playfair Display", Georgia, serif',
            baseFontSize: '17px',
            lineHeight: '1.75',
            headingLineHeight: '1.1'
        },
        spacing: {
            baseUnit: '8px',
            scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 9]
        },
        borders: {
            radius: '10px',
            width: '1px',
            color: '#44403c'
        },
        customCss: '',
        customCssFiles: []
    }),
    componentTokens: createDefaultComponentTokens({
        button: {
            borderRadius: '999px',
            padding: '0.78rem 1.35rem',
            fontWeight: '600',
            textTransform: 'none',
            shadow: '0 12px 24px rgba(180, 83, 9, 0.12)'
        },
        card: {
            borderRadius: '18px',
            padding: '1.5rem',
            shadow: '0 15px 35px rgba(120, 74, 43, 0.08)'
        },
        headings: {
            fontWeight: '700',
            letterSpacing: '-0.02em'
        },
        form: {
            inputBorderRadius: '14px',
            inputPadding: '0.85rem 1rem',
            focusRingColor: 'rgba(180, 83, 9, 0.18)'
        }
    }),
    suggestedSections: ['collection-hero', 'product-grid', 'testimonial', 'newsletter'],
    suggestedPages: ['shop-home', 'lookbook', 'about-brand', 'contact'],
    tags: ['warm', 'boutique', 'ecommerce', 'artisan', 'lifestyle'],
    categories: ['creative', 'ecommerce', 'landing-page']
}

export const minimalZenThemePack: ThemePack = {
    id: 'minimal-zen',
    name: 'Minimal Zen',
    description: 'Quiet monochrome balance with airy spacing and restrained contrast.',
    accentColor: '#0f766e',
    theme: createTheme({
        name: 'Minimal Zen',
        colors: {
            primary: '#0f766e',
            secondary: '#64748b',
            accent: '#14b8a6',
            background: '#fbfcfb',
            surface: '#f2f5f3',
            text: '#1f2937',
            textMuted: '#6b7280',
            border: '#d8e1dc',
            success: '#16a34a',
            warning: '#d97706',
            danger: '#dc2626'
        },
        typography: {
            fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
            headingFontFamily: '"IBM Plex Sans", system-ui, sans-serif',
            baseFontSize: '16px',
            lineHeight: '1.75',
            headingLineHeight: '1.12'
        },
        spacing: {
            baseUnit: '10px',
            scale: [0.2, 0.4, 1, 1.6, 2.4, 3.2, 4.8, 6.4, 8]
        },
        borders: {
            radius: '12px',
            width: '1px',
            color: '#d8e1dc'
        },
        customCss: '',
        customCssFiles: []
    }),
    darkTheme: createTheme({
        name: 'Minimal Zen Dark',
        colors: {
            primary: '#5eead4',
            secondary: '#cbd5e1',
            accent: '#2dd4bf',
            background: '#0f172a',
            surface: '#111827',
            text: '#e5e7eb',
            textMuted: '#94a3b8',
            border: '#334155',
            success: '#4ade80',
            warning: '#fb923c',
            danger: '#f87171'
        },
        typography: {
            fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
            headingFontFamily: '"IBM Plex Sans", system-ui, sans-serif',
            baseFontSize: '16px',
            lineHeight: '1.75',
            headingLineHeight: '1.12'
        },
        spacing: {
            baseUnit: '10px',
            scale: [0.2, 0.4, 1, 1.6, 2.4, 3.2, 4.8, 6.4, 8]
        },
        borders: {
            radius: '12px',
            width: '1px',
            color: '#334155'
        },
        customCss: '',
        customCssFiles: []
    }),
    componentTokens: createDefaultComponentTokens({
        button: {
            borderRadius: '999px',
            padding: '0.72rem 1.2rem',
            fontWeight: '600',
            textTransform: 'none',
            shadow: 'none'
        },
        card: {
            borderRadius: '20px',
            padding: '1.75rem',
            shadow: '0 10px 24px rgba(31, 41, 55, 0.05)'
        },
        headings: {
            fontWeight: '650',
            letterSpacing: '-0.025em'
        },
        form: {
            inputBorderRadius: '16px',
            inputPadding: '0.88rem 1rem',
            focusRingColor: 'rgba(20, 184, 166, 0.18)'
        }
    }),
    suggestedSections: ['split-hero', 'feature-list', 'testimonial-stack', 'faq'],
    suggestedPages: ['studio-home', 'services', 'about', 'contact'],
    tags: ['minimal', 'zen', 'wellness', 'clean', 'airy'],
    categories: ['business', 'minimal', 'portfolio', 'wellness']
}

export const boldStartupThemePack: ThemePack = {
    id: 'bold-startup',
    name: 'Bold Startup',
    description: 'High-energy gradients, chunky spacing, and confident launch-day contrast.',
    accentColor: '#fb7185',
    theme: createTheme({
        name: 'Bold Startup',
        colors: {
            primary: '#7c3aed',
            secondary: '#334155',
            accent: '#fb7185',
            background: '#fff7ed',
            surface: '#ffffff',
            text: '#1e1b4b',
            textMuted: '#475569',
            border: '#f5d0c5',
            success: '#16a34a',
            warning: '#f59e0b',
            danger: '#ef4444'
        },
        typography: {
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            headingFontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            baseFontSize: '17px',
            lineHeight: '1.68',
            headingLineHeight: '1.02'
        },
        spacing: {
            baseUnit: '9px',
            scale: [0.25, 0.5, 1, 1.4, 2, 3, 4.5, 6, 8]
        },
        borders: {
            radius: '22px',
            width: '1px',
            color: '#f5d0c5'
        },
        customCss: '',
        customCssFiles: []
    }),
    darkTheme: createTheme({
        name: 'Bold Startup Dark',
        colors: {
            primary: '#a78bfa',
            secondary: '#cbd5e1',
            accent: '#fb7185',
            background: '#140f2d',
            surface: '#221b42',
            text: '#f8fafc',
            textMuted: '#cbd5e1',
            border: '#3b305f',
            success: '#4ade80',
            warning: '#fbbf24',
            danger: '#f87171'
        },
        typography: {
            fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            headingFontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
            baseFontSize: '17px',
            lineHeight: '1.68',
            headingLineHeight: '1.02'
        },
        spacing: {
            baseUnit: '9px',
            scale: [0.25, 0.5, 1, 1.4, 2, 3, 4.5, 6, 8]
        },
        borders: {
            radius: '22px',
            width: '1px',
            color: '#3b305f'
        },
        customCss: '',
        customCssFiles: []
    }),
    componentTokens: createDefaultComponentTokens({
        button: {
            borderRadius: '999px',
            padding: '0.85rem 1.45rem',
            fontWeight: '800',
            textTransform: 'none',
            shadow: '0 14px 28px rgba(124, 58, 237, 0.16)'
        },
        card: {
            borderRadius: '24px',
            padding: '1.75rem',
            shadow: '0 18px 40px rgba(30, 27, 75, 0.08)'
        },
        headings: {
            fontWeight: '800',
            letterSpacing: '-0.045em'
        },
        form: {
            inputBorderRadius: '18px',
            inputPadding: '0.9rem 1rem',
            focusRingColor: 'rgba(251, 113, 133, 0.2)'
        }
    }),
    suggestedSections: ['launch-hero', 'social-proof', 'feature-comparison', 'pricing', 'faq'],
    suggestedPages: ['startup-home', 'product', 'waitlist', 'investors'],
    tags: ['startup', 'bold', 'gradient', 'launch', 'marketing'],
    categories: ['business', 'landing-page', 'startup']
}

export const builtInThemePacks: ThemePack[] = [
    modernSaasThemePack,
    editorialClassicThemePack,
    darkCyberThemePack,
    warmBoutiqueThemePack,
    minimalZenThemePack,
    boldStartupThemePack
]
