import type {ProjectTheme} from '../../store/types'

const defaultSpacing = {
    baseUnit: '8px',
    scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8]
};

export const themePresets: ProjectTheme[] = [
    {
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
        spacing: {...defaultSpacing},
        borders: {radius: '6px', width: '1px', color: '#dee2e6'},
        customCss: '',
        customCssFiles: []
    },
    {
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
        spacing: {...defaultSpacing},
        borders: {radius: '8px', width: '1px', color: '#334155'},
        customCss: '',
        customCssFiles: []
    },
    {
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
        spacing: {...defaultSpacing},
        borders: {radius: '4px', width: '1px', color: '#d1d5db'},
        customCss: '',
        customCssFiles: []
    },
    {
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
        spacing: {...defaultSpacing},
        borders: {radius: '8px', width: '1px', color: '#bae6fd'},
        customCss: '',
        customCssFiles: []
    },
    {
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
        spacing: {...defaultSpacing},
        borders: {radius: '2px', width: '1px', color: '#d6d3d1'},
        customCss: '',
        customCssFiles: []
    }
];
