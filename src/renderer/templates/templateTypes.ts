import type {Block} from '../store/types'

export const sectionTemplateCategories = [
    'hero',
    'navigation',
    'features',
    'pricing',
    'testimonials',
    'cta',
    'footer',
    'stats',
    'team',
    'gallery',
    'timeline',
    'contact',
    'newsletter',
    'logos',
    'process',
    'comparison'
] as const

export type SectionTemplateCategory = typeof sectionTemplateCategories[number]

export const pageTemplateCategories = [
    'landing',
    'portfolio',
    'agency',
    'restaurant',
    'blog',
    'event',
    'product',
    'documentation'
] as const

export type PageTemplateCategory = typeof pageTemplateCategories[number]

export type TemplateCategory = SectionTemplateCategory | PageTemplateCategory

export type TemplateGalleryFilter = 'all' | TemplateCategory

export interface SectionTemplate {
    id: string
    name: string
    description: string
    thumbnail?: string
    previewBlocks?: Block[]
    blocks: Block[]
    category: SectionTemplateCategory
    tags: string[]
    themeAware: boolean
    suggestedThemes?: string[]
    isBuiltIn: boolean
    isCustom: boolean
}

export interface PageTemplate {
    id: string
    name: string
    description: string
    thumbnail?: string
    page: {
        title: string
        slug: string
        blocks: Block[]
        meta?: Record<string, string>
    }
    category: PageTemplateCategory
    tags: string[]
    suggestedThemes?: string[]
    isBuiltIn: boolean
}
