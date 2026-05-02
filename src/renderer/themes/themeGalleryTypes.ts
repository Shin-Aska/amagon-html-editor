import type {Block, ProjectTheme, ComponentTokens} from '../store/types'

export type ThemeGalleryCategory = string

export interface ThemeGalleryItem {
    id: string
    name: string
    description: string
    thumbnail?: string
    previewBlocks?: Block[]
    categories: ThemeGalleryCategory[]
    tags: string[]
    theme: ProjectTheme
    darkTheme?: ProjectTheme
    isBuiltIn: boolean
    isCustom: boolean
}

export interface ThemePack {
    id: string
    name: string
    description: string
    previewImage?: string
    accentColor: string
    theme: ProjectTheme
    darkTheme?: ProjectTheme
    componentTokens?: ComponentTokens
    suggestedSections?: string[]
    suggestedPages?: string[]
    tags: string[]
    categories: ThemeGalleryCategory[]
}

export interface ThemeGalleryFilters {
    search: string
    categories: ThemeGalleryCategory[]
    tags: string[]
    includeBuiltIn: boolean
    includeCustom: boolean
    includeDarkVariants: boolean
}

export const THEME_GALLERY_CATEGORIES: ThemeGalleryCategory[] = [
    'business',
    'creative',
    'dark',
    'editorial',
    'ecommerce',
    'landing-page',
    'minimal',
    'portfolio',
    'saas',
    'startup',
    'wellness'
]

export const DEFAULT_THEME_GALLERY_FILTERS: ThemeGalleryFilters = {
    search: '',
    categories: [],
    tags: [],
    includeBuiltIn: true,
    includeCustom: true,
    includeDarkVariants: true
}
