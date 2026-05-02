import type {Block} from '../store/types'

import {createBuiltInSectionTemplateBlocks, type BuiltInSectionTemplateId} from './sectionTemplates'
import type {PageTemplate} from './templateTypes'

export const builtInPageTemplateIds = [
    'saas-landing',
    'portfolio-single',
    'agency-home',
    'restaurant-menu',
    'blog-index',
    'event-landing',
    'product-launch',
    'docs-page'
] as const

export type BuiltInPageTemplateId = typeof builtInPageTemplateIds[number]

function composeSections(sectionIds: BuiltInSectionTemplateId[]): Block[] {
    return sectionIds.flatMap((sectionId) => createBuiltInSectionTemplateBlocks(sectionId))
}

function buildPageTemplate(template: PageTemplate): PageTemplate {
    return template
}

export const saasLandingPageTemplate = buildPageTemplate({
    id: 'saas-landing',
    name: 'SaaS Landing',
    description: 'A conversion-focused landing page for software products with navigation, features, pricing, proof, and CTA.',
    page: {
        title: 'SaaS Landing',
        slug: 'saas-landing',
        blocks: composeSections([
            'navbar-branded',
            'hero-centered',
            'logo-cloud',
            'features-3-col',
            'stats-4-up',
            'pricing-3-tier',
            'testimonial-slider',
            'cta-banner',
            'footer-4-col'
        ]),
        meta: {
            description: 'A polished software landing page template with built-in proof, pricing, and calls to action.',
            keywords: 'saas, startup, software, landing page'
        }
    },
    category: 'landing',
    tags: ['saas', 'landing', 'marketing'],
    suggestedThemes: ['Startup Bright', 'SaaS Dark'],
    isBuiltIn: true
})

export const portfolioSinglePageTemplate = buildPageTemplate({
    id: 'portfolio-single',
    name: 'Portfolio Single',
    description: 'A clean portfolio page for showcasing one person or studio through work, process, and contact.',
    page: {
        title: 'Portfolio Single',
        slug: 'portfolio-single',
        blocks: composeSections([
            'navbar-branded',
            'hero-split',
            'gallery-grid',
            'process-3-steps',
            'testimonial-slider',
            'contact-split',
            'footer-simple'
        ]),
        meta: {
            description: 'A portfolio template for creative professionals featuring selected work and a lead form.',
            keywords: 'portfolio, designer, agency, creative'
        }
    },
    category: 'portfolio',
    tags: ['portfolio', 'creative', 'work'],
    suggestedThemes: ['Portfolio Dark', 'Editorial'],
    isBuiltIn: true
})

export const agencyHomePageTemplate = buildPageTemplate({
    id: 'agency-home',
    name: 'Agency Home',
    description: 'A service-oriented homepage for agencies with process, team, results, and contact coverage.',
    page: {
        title: 'Agency Home',
        slug: 'agency-home',
        blocks: composeSections([
            'navbar-branded',
            'hero-split',
            'comparison-2-col',
            'process-3-steps',
            'team-3-col',
            'stats-4-up',
            'contact-split',
            'footer-4-col'
        ]),
        meta: {
            description: 'An agency homepage template built around service clarity, team credibility, and lead capture.',
            keywords: 'agency, studio, services, lead generation'
        }
    },
    category: 'agency',
    tags: ['agency', 'services', 'home'],
    suggestedThemes: ['Corporate Blue', 'Minimal Light'],
    isBuiltIn: true
})

export const restaurantMenuPageTemplate = buildPageTemplate({
    id: 'restaurant-menu',
    name: 'Restaurant Menu',
    description: 'A hospitality-focused page for menus, atmosphere, and reservation inquiries.',
    page: {
        title: 'Restaurant Menu',
        slug: 'restaurant-menu',
        blocks: composeSections([
            'navbar-branded',
            'hero-split',
            'gallery-grid',
            'comparison-2-col',
            'testimonial-slider',
            'newsletter-inline',
            'contact-split',
            'footer-simple'
        ]),
        meta: {
            description: 'A restaurant landing page template with space for menu highlights, imagery, and reservations.',
            keywords: 'restaurant, menu, hospitality, dining'
        }
    },
    category: 'restaurant',
    tags: ['restaurant', 'menu', 'food'],
    suggestedThemes: ['Warm Neutral', 'Editorial'],
    isBuiltIn: true
})

export const blogIndexPageTemplate = buildPageTemplate({
    id: 'blog-index',
    name: 'Blog Index',
    description: 'A content-led blog homepage with navigation, intro, article listing support, and newsletter signup.',
    page: {
        title: 'Blog Index',
        slug: 'blog-index',
        blocks: composeSections([
            'navbar-branded',
            'hero-centered',
            'logo-cloud',
            'timeline-vertical',
            'newsletter-inline',
            'footer-simple'
        ]),
        meta: {
            description: 'A blog index template designed for editorial teams publishing a steady stream of articles.',
            keywords: 'blog, editorial, articles, publishing'
        }
    },
    category: 'blog',
    tags: ['blog', 'editorial', 'content'],
    suggestedThemes: ['Editorial', 'Minimal Light'],
    isBuiltIn: true
})

export const eventLandingPageTemplate = buildPageTemplate({
    id: 'event-landing',
    name: 'Event Landing',
    description: 'A launch page for conferences or events with agenda framing, trust, and registration prompts.',
    page: {
        title: 'Event Landing',
        slug: 'event-landing',
        blocks: composeSections([
            'navbar-branded',
            'hero-centered',
            'logo-cloud',
            'timeline-vertical',
            'stats-4-up',
            'testimonial-slider',
            'cta-banner',
            'footer-simple'
        ]),
        meta: {
            description: 'An event landing page template that supports keynotes, schedule highlights, and registration.',
            keywords: 'event, conference, summit, landing page'
        }
    },
    category: 'event',
    tags: ['event', 'conference', 'registration'],
    suggestedThemes: ['Campaign Bright', 'Dark Contrast'],
    isBuiltIn: true
})

export const productLaunchPageTemplate = buildPageTemplate({
    id: 'product-launch',
    name: 'Product Launch',
    description: 'A launch sequence for announcing a product with benefits, proof, process, and final conversion.',
    page: {
        title: 'Product Launch',
        slug: 'product-launch',
        blocks: composeSections([
            'navbar-branded',
            'hero-split',
            'features-3-col',
            'comparison-2-col',
            'stats-4-up',
            'pricing-3-tier',
            'cta-banner',
            'footer-4-col'
        ]),
        meta: {
            description: 'A product launch template that balances storytelling, differentiation, and sign-up intent.',
            keywords: 'product, launch, startup, release'
        }
    },
    category: 'product',
    tags: ['product', 'launch', 'release'],
    suggestedThemes: ['Startup Bright', 'Corporate Blue'],
    isBuiltIn: true
})

export const docsPagePageTemplate = buildPageTemplate({
    id: 'docs-page',
    name: 'Docs Page',
    description: 'A documentation-style page for onboarding readers into features, workflow, and support pathways.',
    page: {
        title: 'Docs Page',
        slug: 'docs-page',
        blocks: composeSections([
            'navbar-branded',
            'hero-centered',
            'process-3-steps',
            'comparison-2-col',
            'timeline-vertical',
            'newsletter-inline',
            'footer-simple'
        ]),
        meta: {
            description: 'A documentation template for feature overviews, onboarding steps, and product guidance.',
            keywords: 'docs, documentation, help center, onboarding'
        }
    },
    category: 'documentation',
    tags: ['documentation', 'help', 'guide'],
    suggestedThemes: ['Minimal Light', 'Dark Contrast'],
    isBuiltIn: true
})

export const builtInPageTemplates: PageTemplate[] = [
    saasLandingPageTemplate,
    portfolioSinglePageTemplate,
    agencyHomePageTemplate,
    restaurantMenuPageTemplate,
    blogIndexPageTemplate,
    eventLandingPageTemplate,
    productLaunchPageTemplate,
    docsPagePageTemplate
]

export const builtInPageTemplateMap: Record<BuiltInPageTemplateId, PageTemplate> = {
    'saas-landing': saasLandingPageTemplate,
    'portfolio-single': portfolioSinglePageTemplate,
    'agency-home': agencyHomePageTemplate,
    'restaurant-menu': restaurantMenuPageTemplate,
    'blog-index': blogIndexPageTemplate,
    'event-landing': eventLandingPageTemplate,
    'product-launch': productLaunchPageTemplate,
    'docs-page': docsPagePageTemplate
}
