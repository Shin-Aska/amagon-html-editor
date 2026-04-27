import type {Block} from '../store/types'
import {IMAGE_PLACEHOLDER} from '../utils/placeholders'

import type {SectionTemplate} from './templateTypes'
import {
    buttonBlock,
    carouselBlock,
    checkboxBlock,
    columnBlock,
    containerBlock,
    ctaSectionBlock,
    footerBlock,
    formBlock,
    headingBlock,
    heroBlock,
    iconBlock,
    imageBlock,
    inputBlock,
    linkBlock,
    listBlock,
    navbarBlock,
    paragraphBlock,
    pricingTableBlock,
    rowBlock,
    sectionBlock,
    textareaBlock
} from './templateFactories'

export const builtInSectionTemplateIds = [
    'hero-centered',
    'hero-split',
    'features-3-col',
    'pricing-3-tier',
    'testimonial-slider',
    'cta-banner',
    'footer-simple',
    'footer-4-col',
    'navbar-branded',
    'stats-4-up',
    'team-3-col',
    'gallery-grid',
    'timeline-vertical',
    'contact-split',
    'newsletter-inline',
    'logo-cloud',
    'process-3-steps',
    'comparison-2-col'
] as const

export type BuiltInSectionTemplateId = typeof builtInSectionTemplateIds[number]

function featureCard(iconName: string, title: string, text: string): Block {
    return containerBlock([
        iconBlock(iconName, {size: 'xl', classes: ['mb-3', 'text-primary']}),
        headingBlock(title, {level: 4, classes: ['h5', 'mb-2']}),
        paragraphBlock(text, {classes: ['text-muted', 'mb-0']})
    ], ['card', 'h-100', 'border-0', 'shadow-sm', 'p-4'])
}

function pricingColumn(name: string, price: string, summary: string, features: string[], emphasized = false): Block {
    return columnBlock([
        containerBlock([
            containerBlock([
                headingBlock(name, {level: 4, classes: ['my-0', emphasized ? 'fw-bold' : 'fw-normal']})
            ], emphasized ? ['card-header', 'py-3', 'bg-primary', 'text-white'] : ['card-header', 'py-3']),
            containerBlock([
                headingBlock(price, {level: 1, classes: ['card-title', 'pricing-card-title']}),
                paragraphBlock(summary, {classes: ['text-muted', 'mb-4']}),
                listBlock(features, {classes: ['list-unstyled', 'mt-3', 'mb-4']}),
                buttonBlock(emphasized ? 'Start growth plan' : 'Choose plan', {
                    variant: emphasized ? 'btn-primary' : 'btn-outline-primary',
                    size: 'btn-lg',
                    classes: ['w-100', 'btn', 'btn-lg', emphasized ? 'btn-primary' : 'btn-outline-primary']
                })
            ], ['card-body'])
        ], ['card', 'mb-4', 'rounded-3', emphasized ? 'shadow' : 'shadow-sm', emphasized ? 'border-primary' : 'shadow-sm'])
    ], {classes: ['col']})
}

function teamCard(name: string, role: string, bio: string): Block {
    return containerBlock([
        imageBlock(IMAGE_PLACEHOLDER, `${name} portrait`, {
            aspectRatio: '1:1',
            objectFit: 'cover',
            classes: ['img-fluid', 'rounded-circle', 'mb-3']
        }),
        headingBlock(name, {level: 4, classes: ['h5', 'mb-1']}),
        paragraphBlock(role, {classes: ['text-primary', 'fw-semibold', 'mb-2']}),
        paragraphBlock(bio, {classes: ['text-muted', 'mb-0']})
    ], ['text-center', 'p-4', 'card', 'h-100', 'border-0', 'shadow-sm'])
}

function galleryCard(caption: string): Block {
    return containerBlock([
        imageBlock(IMAGE_PLACEHOLDER, caption, {
            aspectRatio: '4:3',
            objectFit: 'cover',
            caption,
            classes: ['img-fluid', 'rounded-3', 'shadow-sm']
        })
    ], ['h-100'])
}

function logoCell(name: string): Block {
    return columnBlock([
        containerBlock([
            headingBlock(name, {level: 5, classes: ['mb-0', 'text-uppercase', 'text-muted', 'letter-spacing-1']})
        ], ['border', 'rounded-3', 'py-4', 'text-center', 'h-100'])
    ], {classes: ['col-6', 'col-md-4', 'col-lg-2']})
}

function createHeroCenteredSectionBlocks(): Block[] {
    return [
        heroBlock([
            containerBlock([
                headingBlock('Launch polished pages faster with Amagon', {level: 1, classes: ['display-4', 'fw-bold', 'mb-3']}),
                paragraphBlock('Design responsive marketing pages visually, keep the HTML clean, and hand off production-ready output without wrestling a page builder.', {
                    lead: true,
                    classes: ['lead', 'text-muted', 'mb-4']
                }),
                containerBlock([
                    buttonBlock('Start building', {variant: 'btn-primary', size: 'btn-lg', classes: ['btn', 'btn-primary', 'btn-lg', 'px-4', 'me-sm-3']}),
                    buttonBlock('See templates', {variant: 'btn-outline-secondary', size: 'btn-lg', classes: ['btn', 'btn-outline-secondary', 'btn-lg', 'px-4']})
                ], ['d-grid', 'gap-2', 'd-sm-flex', 'justify-content-sm-center'])
            ], ['container', 'py-5', 'text-center'])
        ], ['py-5', 'bg-light'], {alignment: 'center', overlay: false, fullHeight: false, ctaButtons: []})
    ]
}

function createHeroSplitSectionBlocks(): Block[] {
    return [
        sectionBlock([
            containerBlock([
                rowBlock([
                    columnBlock([
                        headingBlock('A modern editor for teams shipping often', {level: 1, classes: ['display-5', 'fw-bold', 'mb-3']}),
                        paragraphBlock('Create launch pages, product docs, and client sites with reusable sections that stay aligned to your brand system.', {
                            lead: true,
                            classes: ['lead', 'text-muted', 'mb-4']
                        }),
                        containerBlock([
                            buttonBlock('Book a demo', {variant: 'btn-primary', classes: ['btn', 'btn-primary', 'me-2']}),
                            buttonBlock('View examples', {variant: 'btn-outline-secondary', classes: ['btn', 'btn-outline-secondary']})
                        ], ['d-flex', 'flex-wrap', 'gap-2'])
                    ], {classes: ['col-lg-6', 'd-flex', 'flex-column', 'justify-content-center']}),
                    columnBlock([
                        imageBlock(IMAGE_PLACEHOLDER, 'Editor canvas preview', {
                            aspectRatio: '16:9',
                            objectFit: 'cover',
                            classes: ['img-fluid', 'rounded-4', 'shadow-lg']
                        })
                    ], {classes: ['col-lg-6']})
                ], ['row', 'align-items-center', 'g-5'])
            ], ['container', 'py-5'])
        ], ['py-5'])
    ]
}

function createFeaturesThreeColSectionBlocks(): Block[] {
    return [
        sectionBlock([
            containerBlock([
                headingBlock('Everything you need to go from brief to publish', {level: 2, classes: ['text-center', 'mb-3']}),
                paragraphBlock('Reusable blocks, theme variables, and export-ready markup keep your site fast and your workflow simple.', {
                    alignment: 'text-center',
                    classes: ['text-muted', 'mx-auto', 'mb-5']
                }),
                rowBlock([
                    columnBlock([featureCard('lucide:sparkles', 'Theme-aware output', 'Every section respects shared typography, spacing, and color tokens so pages stay consistent.')], {classes: ['col-md-4']}),
                    columnBlock([featureCard('lucide:layout-template', 'Reusable sections', 'Start with polished heroes, pricing, galleries, and CTAs that you can remix in seconds.')], {classes: ['col-md-4']}),
                    columnBlock([featureCard('lucide:rocket', 'Clean export', 'Ship lightweight HTML and CSS that your team can host anywhere without editor lock-in.')], {classes: ['col-md-4']})
                ], ['row', 'g-4'])
            ])
        ])
    ]
}

function createPricingThreeTierSectionBlocks(): Block[] {
    return [
        sectionBlock([
            containerBlock([
                headingBlock('Simple pricing that scales with your launch cadence', {level: 2, classes: ['text-center', 'mb-3']}),
                paragraphBlock('Choose a plan that matches your site volume today and upgrade as your team grows.', {
                    alignment: 'text-center',
                    classes: ['text-muted', 'mb-5']
                }),
                pricingTableBlock([
                    pricingColumn('Starter', '$19', 'For solo builders shipping smaller sites.', ['3 active sites', 'Shared template library', 'Email support']),
                    pricingColumn('Growth', '$49', 'Best for studios and fast-moving teams.', ['Unlimited pages', 'Custom branding', 'Team collaboration', 'Priority support'], true),
                    pricingColumn('Scale', '$99', 'For organizations managing multiple launches.', ['Role-based workflows', 'Shared asset catalogs', 'Dedicated onboarding'])
                ])
            ])
        ], ['py-5', 'bg-light'])
    ]
}

function createTestimonialSliderSectionBlocks(): Block[] {
    return [
        sectionBlock([
            containerBlock([
                headingBlock('Trusted by teams launching weekly', {level: 2, classes: ['text-center', 'mb-3']}),
                paragraphBlock('Real stories from designers and marketers who needed speed without sacrificing clean code.', {
                    alignment: 'text-center',
                    classes: ['text-muted', 'mb-5']
                }),
                carouselBlock([
                    {src: IMAGE_PLACEHOLDER, alt: 'Customer story 1', caption: '“We cut page production from two days to two hours.” — Maya, Growth Lead'},
                    {src: IMAGE_PLACEHOLDER, alt: 'Customer story 2', caption: '“Our dev team finally gets exports they actually want to maintain.” — Chris, Product Designer'},
                    {src: IMAGE_PLACEHOLDER, alt: 'Customer story 3', caption: '“Template reuse made every campaign feel on-brand from day one.” — Elena, Marketing Director'}
                ])
            ])
        ])
    ]
}

function createCtaBannerSectionBlocks(): Block[] {
    return [
        ctaSectionBlock([
            imageBlock(IMAGE_PLACEHOLDER, 'Amagon mark', {classes: ['d-block', 'mx-auto', 'mb-4'], aspectRatio: '1:1', objectFit: 'contain'}),
            headingBlock('Ready to turn your next campaign into a reusable system?', {level: 1, classes: ['display-5', 'fw-bold', 'text-body-emphasis']}),
            columnBlock([
                paragraphBlock('Start with a complete page template, customize the content, and publish production-ready HTML by the end of the afternoon.', {
                    lead: true,
                    classes: ['lead', 'mb-4']
                }),
                containerBlock([
                    buttonBlock('Start free trial', {variant: 'btn-primary', size: 'btn-lg', classes: ['btn', 'btn-primary', 'btn-lg', 'px-4', 'gap-3']}),
                    buttonBlock('Talk to sales', {variant: 'btn-outline-secondary', size: 'btn-lg', classes: ['btn', 'btn-outline-secondary', 'btn-lg', 'px-4']})
                ], ['d-grid', 'gap-2', 'd-sm-flex', 'justify-content-sm-center'])
            ], {classes: ['col-lg-7', 'mx-auto']})
        ])
    ]
}

function createFooterSimpleSectionBlocks(): Block[] {
    return [
        footerBlock([
            containerBlock([
                rowBlock([
                    columnBlock([
                        paragraphBlock('© 2026 Northstar Studio. Built with Amagon.', {classes: ['text-muted', 'mb-0']})
                    ], {classes: ['col-md-6']}),
                    columnBlock([
                        containerBlock([
                            linkBlock('Privacy', '#', {classes: ['text-decoration-none']}),
                            linkBlock('Terms', '#', {classes: ['text-decoration-none']}),
                            linkBlock('Contact', '#', {classes: ['text-decoration-none']})
                        ], ['d-flex', 'justify-content-md-end', 'gap-3'])
                    ], {classes: ['col-md-6']})
                ], ['row', 'align-items-center', 'g-3'])
            ], ['container'])
        ], ['py-4', 'border-top'], {columns: 1, showSocialLinks: false, socialLinks: [], copyrightText: '© 2026 Northstar Studio', showBackToTop: false})
    ]
}

function createFooterFourColSectionBlocks(): Block[] {
    return [
        footerBlock([
            containerBlock([
                rowBlock([
                    columnBlock([
                        headingBlock('Northstar', {level: 4, classes: ['h5', 'mb-3']}),
                        paragraphBlock('Helping teams build flexible websites with a visual workflow and maintainable code output.', {classes: ['text-muted', 'mb-0']})
                    ], {classes: ['col-lg-4']}),
                    columnBlock([
                        headingBlock('Product', {level: 5, classes: ['mb-3']}),
                        listBlock(['Templates', 'Themes', 'Export', 'AI Assistant'], {classes: ['list-unstyled', 'mb-0'], listStyle: 'none'})
                    ], {classes: ['col-6', 'col-lg-2']}),
                    columnBlock([
                        headingBlock('Company', {level: 5, classes: ['mb-3']}),
                        listBlock(['About', 'Careers', 'Customers', 'Partners'], {classes: ['list-unstyled', 'mb-0'], listStyle: 'none'})
                    ], {classes: ['col-6', 'col-lg-2']}),
                    columnBlock([
                        headingBlock('Resources', {level: 5, classes: ['mb-3']}),
                        listBlock(['Documentation', 'Changelog', 'Guides', 'Support'], {classes: ['list-unstyled', 'mb-0'], listStyle: 'none'})
                    ], {classes: ['col-lg-4']})
                ], ['row', 'g-4'])
            ], ['container'])
        ], ['py-5', 'border-top', 'bg-light'], {columns: 4, showSocialLinks: false, socialLinks: [], copyrightText: '© 2026 Northstar Studio', showBackToTop: false})
    ]
}

function createNavbarBrandedSectionBlocks(): Block[] {
    return [
        navbarBlock([
            containerBlock([
                linkBlock('Northstar', '#', {classes: ['navbar-brand']}),
                containerBlock([
                    linkBlock('Features', '#features', {classes: ['nav-link']}),
                    linkBlock('Pricing', '#pricing', {classes: ['nav-link']}),
                    linkBlock('Templates', '#templates', {classes: ['nav-link']}),
                    buttonBlock('Start free', {variant: 'btn-primary', classes: ['btn', 'btn-primary', 'btn-sm']})
                ], ['d-flex', 'align-items-center', 'gap-3'])
            ], ['container', 'd-flex', 'justify-content-between', 'align-items-center'])
        ], ['navbar', 'navbar-expand-lg', 'navbar-theme-light', 'py-3'], {
            brandText: 'Northstar',
            brandImage: '',
            usePages: false,
            filterTag: '',
            hamburgerMenu: true,
            sticky: false,
            stickyOffset: '0',
            transparent: false,
            theme: 'navbar-theme-light'
        })
    ]
}

function createStatsFourUpSectionBlocks(): Block[] {
    return [
        sectionBlock([
            containerBlock([
                rowBlock([
                    columnBlock([
                        headingBlock('42%', {level: 2, classes: ['display-6', 'fw-bold', 'mb-1']}),
                        paragraphBlock('Faster page assembly for campaign teams.', {classes: ['text-muted', 'mb-0']})
                    ], {classes: ['col-6', 'col-lg-3', 'text-center']}),
                    columnBlock([
                        headingBlock('18', {level: 2, classes: ['display-6', 'fw-bold', 'mb-1']}),
                        paragraphBlock('Built-in sections ready to remix.', {classes: ['text-muted', 'mb-0']})
                    ], {classes: ['col-6', 'col-lg-3', 'text-center']}),
                    columnBlock([
                        headingBlock('7 min', {level: 2, classes: ['display-6', 'fw-bold', 'mb-1']}),
                        paragraphBlock('Average time to publish a first draft.', {classes: ['text-muted', 'mb-0']})
                    ], {classes: ['col-6', 'col-lg-3', 'text-center']}),
                    columnBlock([
                        headingBlock('99.9%', {level: 2, classes: ['display-6', 'fw-bold', 'mb-1']}),
                        paragraphBlock('HTML ownership after export.', {classes: ['text-muted', 'mb-0']})
                    ], {classes: ['col-6', 'col-lg-3', 'text-center']})
                ], ['row', 'g-4'])
            ])
        ], ['py-5', 'bg-light'])
    ]
}

function createTeamThreeColSectionBlocks(): Block[] {
    return [
        sectionBlock([
            containerBlock([
                headingBlock('Meet the launch team', {level: 2, classes: ['text-center', 'mb-3']}),
                paragraphBlock('A cross-functional crew that blends strategy, design, and technical execution.', {
                    alignment: 'text-center',
                    classes: ['text-muted', 'mb-5']
                }),
                rowBlock([
                    columnBlock([teamCard('Avery Quinn', 'Creative Director', 'Shapes the story, tone, and visual hierarchy of every launch.')], {classes: ['col-md-4']}),
                    columnBlock([teamCard('Jordan Lee', 'Frontend Lead', 'Turns reusable blocks into clean, performant experiences across breakpoints.')], {classes: ['col-md-4']}),
                    columnBlock([teamCard('Samira Patel', 'Growth Strategist', 'Maps page structure to conversion goals, experiments, and campaign velocity.')], {classes: ['col-md-4']})
                ], ['row', 'g-4'])
            ])
        ])
    ]
}

function createGalleryGridSectionBlocks(): Block[] {
    return [
        sectionBlock([
            containerBlock([
                headingBlock('Selected work from recent launches', {level: 2, classes: ['text-center', 'mb-3']}),
                paragraphBlock('A flexible gallery section for product shots, campaign screenshots, or editorial imagery.', {
                    alignment: 'text-center',
                    classes: ['text-muted', 'mb-5']
                }),
                rowBlock([
                    columnBlock([galleryCard('Mobile onboarding flow')], {classes: ['col-md-6', 'col-lg-4']}),
                    columnBlock([galleryCard('Campaign analytics dashboard')], {classes: ['col-md-6', 'col-lg-4']}),
                    columnBlock([galleryCard('Lifestyle product photography')], {classes: ['col-md-6', 'col-lg-4']}),
                    columnBlock([galleryCard('Editorial landing page')], {classes: ['col-md-6', 'col-lg-4']}),
                    columnBlock([galleryCard('Feature comparison module')], {classes: ['col-md-6', 'col-lg-4']}),
                    columnBlock([galleryCard('Conference registration page')], {classes: ['col-md-6', 'col-lg-4']})
                ], ['row', 'g-4'])
            ])
        ], ['py-5', 'bg-light'])
    ]
}

function createTimelineVerticalSectionBlocks(): Block[] {
    return [
        sectionBlock([
            containerBlock([
                headingBlock('How a launch comes together', {level: 2, classes: ['text-center', 'mb-3']}),
                paragraphBlock('Use a narrative timeline to explain onboarding, implementation, or product delivery phases.', {
                    alignment: 'text-center',
                    classes: ['text-muted', 'mb-5']
                }),
                rowBlock([
                    columnBlock([
                        containerBlock([
                            headingBlock('Week 1 · Strategy workshop', {level: 4, classes: ['h5', 'mb-2']}),
                            paragraphBlock('Define audience, message hierarchy, and content requirements with stakeholders.', {classes: ['text-muted', 'mb-0']})
                        ], ['border-start', 'ps-4', 'pb-4']),
                        containerBlock([
                            headingBlock('Week 2 · Visual system', {level: 4, classes: ['h5', 'mb-2']}),
                            paragraphBlock('Translate the brief into reusable sections, brand tokens, and content patterns.', {classes: ['text-muted', 'mb-0']})
                        ], ['border-start', 'ps-4', 'pb-4']),
                        containerBlock([
                            headingBlock('Week 3 · Review & launch', {level: 4, classes: ['h5', 'mb-2']}),
                            paragraphBlock('QA the experience, align stakeholders, and publish with confidence.', {classes: ['text-muted', 'mb-0']})
                        ], ['border-start', 'ps-4'])
                    ], {classes: ['col-lg-8', 'mx-auto']})
                ])
            ])
        ])
    ]
}

function createContactSplitSectionBlocks(): Block[] {
    return [
        sectionBlock([
            containerBlock([
                rowBlock([
                    columnBlock([
                        headingBlock('Let’s plan your next launch', {level: 2, classes: ['mb-3']}),
                        paragraphBlock('Share your timeline, team size, and goals. We’ll recommend a template system that gets your first page live quickly.', {
                            classes: ['text-muted', 'mb-4']
                        }),
                        listBlock(['Replies within one business day', 'Onboarding support for design teams', 'Export-ready HTML for developers'], {
                            classes: ['mb-0'],
                            listStyle: 'disc'
                        })
                    ], {classes: ['col-lg-5']}),
                    columnBlock([
                        containerBlock([
                            formBlock([
                                inputBlock({label: 'Name', placeholder: 'Jordan Rivera', name: 'name'}),
                                inputBlock({type: 'email', label: 'Email', placeholder: 'jordan@company.com', name: 'email'}),
                                inputBlock({label: 'Company', placeholder: 'Northstar Studio', name: 'company'}),
                                textareaBlock({rows: 4, placeholder: 'Tell us about your project, timeline, and goals.', name: 'message'}),
                                checkboxBlock({label: 'I agree to receive a follow-up email.', name: 'consent'}),
                                buttonBlock('Request proposal', {variant: 'btn-primary', classes: ['btn', 'btn-primary', 'mt-3']})
                            ], {layout: 'vertical', method: 'post'}),
                        ], ['card', 'border-0', 'shadow-sm', 'p-4'])
                    ], {classes: ['col-lg-7']})
                ], ['row', 'g-5', 'align-items-start'])
            ])
        ], ['py-5', 'bg-light'])
    ]
}

function createNewsletterInlineSectionBlocks(): Block[] {
    return [
        sectionBlock([
            containerBlock([
                rowBlock([
                    columnBlock([
                        headingBlock('Weekly tactics for shipping better pages', {level: 3, classes: ['mb-1']}),
                        paragraphBlock('Join designers, marketers, and developers getting practical launch tips every Friday.', {classes: ['text-muted', 'mb-0']})
                    ], {classes: ['col-lg-6']}),
                    columnBlock([
                        formBlock([
                            inputBlock({type: 'email', placeholder: 'Enter your work email', name: 'email', classes: ['form-control', 'mb-0']}),
                            buttonBlock('Subscribe', {variant: 'btn-primary', classes: ['btn', 'btn-primary']})
                        ], {layout: 'inline', method: 'post', classes: ['d-flex', 'flex-column', 'flex-sm-row', 'gap-2', 'justify-content-lg-end']})
                    ], {classes: ['col-lg-6']})
                ], ['row', 'g-3', 'align-items-center'])
            ], ['container', 'py-4'])
        ], ['py-4', 'border-top', 'border-bottom'])
    ]
}

function createLogoCloudSectionBlocks(): Block[] {
    return [
        sectionBlock([
            containerBlock([
                paragraphBlock('Trusted by product, education, and media teams worldwide', {
                    alignment: 'text-center',
                    classes: ['text-uppercase', 'text-muted', 'fw-semibold', 'mb-4']
                }),
                rowBlock([
                    logoCell('Northstar'),
                    logoCell('StudioGrid'),
                    logoCell('Fieldnote'),
                    logoCell('Brightpeak'),
                    logoCell('Harbor'),
                    logoCell('Signal')
                ], ['row', 'g-3', 'justify-content-center'])
            ])
        ])
    ]
}

function createProcessThreeStepsSectionBlocks(): Block[] {
    return [
        sectionBlock([
            containerBlock([
                headingBlock('A simple workflow from idea to published page', {level: 2, classes: ['text-center', 'mb-3']}),
                paragraphBlock('Use this process section to explain your service, onboarding, or setup path in three clear steps.', {
                    alignment: 'text-center',
                    classes: ['text-muted', 'mb-5']
                }),
                rowBlock([
                    columnBlock([
                        headingBlock('01', {level: 2, classes: ['display-6', 'fw-bold', 'text-primary']}),
                        headingBlock('Choose a starting point', {level: 4, classes: ['h5', 'mb-2']}),
                        paragraphBlock('Pick a page template or combine sections into a structure that matches your goal.', {classes: ['text-muted', 'mb-0']})
                    ], {classes: ['col-md-4', 'text-center']}),
                    columnBlock([
                        headingBlock('02', {level: 2, classes: ['display-6', 'fw-bold', 'text-primary']}),
                        headingBlock('Customize content fast', {level: 4, classes: ['h5', 'mb-2']}),
                        paragraphBlock('Swap headlines, imagery, and calls to action while staying aligned with the shared theme.', {classes: ['text-muted', 'mb-0']})
                    ], {classes: ['col-md-4', 'text-center']}),
                    columnBlock([
                        headingBlock('03', {level: 2, classes: ['display-6', 'fw-bold', 'text-primary']}),
                        headingBlock('Publish clean HTML', {level: 4, classes: ['h5', 'mb-2']}),
                        paragraphBlock('Export production-ready files for hosting anywhere, or hand off to engineering without cleanup.', {classes: ['text-muted', 'mb-0']})
                    ], {classes: ['col-md-4', 'text-center']})
                ], ['row', 'g-4'])
            ])
        ], ['py-5', 'bg-light'])
    ]
}

function createComparisonTwoColSectionBlocks(): Block[] {
    return [
        sectionBlock([
            containerBlock([
                headingBlock('Why teams switch from ad-hoc page building', {level: 2, classes: ['text-center', 'mb-3']}),
                paragraphBlock('A side-by-side comparison that works for product alternatives, plans, or internal process changes.', {
                    alignment: 'text-center',
                    classes: ['text-muted', 'mb-5']
                }),
                rowBlock([
                    columnBlock([
                        containerBlock([
                            headingBlock('Before', {level: 4, classes: ['h5', 'mb-3']}),
                            listBlock(['Pages start from scratch', 'Design drift across campaigns', 'Developers clean exported markup', 'No shared section library'], {
                                classes: ['mb-0']
                            })
                        ], ['card', 'h-100', 'border-0', 'shadow-sm', 'p-4'])
                    ], {classes: ['col-md-6']}),
                    columnBlock([
                        containerBlock([
                            headingBlock('After', {level: 4, classes: ['h5', 'mb-3']}),
                            listBlock(['Templates accelerate first drafts', 'Theme tokens keep pages cohesive', 'HTML stays clean and portable', 'Teams reuse proven sections'], {
                                classes: ['mb-0']
                            })
                        ], ['card', 'h-100', 'border-0', 'shadow-sm', 'p-4', 'bg-light'])
                    ], {classes: ['col-md-6']})
                ], ['row', 'g-4'])
            ])
        ])
    ]
}

const sectionTemplateBlockFactories: Record<BuiltInSectionTemplateId, () => Block[]> = {
    'hero-centered': createHeroCenteredSectionBlocks,
    'hero-split': createHeroSplitSectionBlocks,
    'features-3-col': createFeaturesThreeColSectionBlocks,
    'pricing-3-tier': createPricingThreeTierSectionBlocks,
    'testimonial-slider': createTestimonialSliderSectionBlocks,
    'cta-banner': createCtaBannerSectionBlocks,
    'footer-simple': createFooterSimpleSectionBlocks,
    'footer-4-col': createFooterFourColSectionBlocks,
    'navbar-branded': createNavbarBrandedSectionBlocks,
    'stats-4-up': createStatsFourUpSectionBlocks,
    'team-3-col': createTeamThreeColSectionBlocks,
    'gallery-grid': createGalleryGridSectionBlocks,
    'timeline-vertical': createTimelineVerticalSectionBlocks,
    'contact-split': createContactSplitSectionBlocks,
    'newsletter-inline': createNewsletterInlineSectionBlocks,
    'logo-cloud': createLogoCloudSectionBlocks,
    'process-3-steps': createProcessThreeStepsSectionBlocks,
    'comparison-2-col': createComparisonTwoColSectionBlocks
}

export function createBuiltInSectionTemplateBlocks(id: BuiltInSectionTemplateId): Block[] {
    return sectionTemplateBlockFactories[id]().map((block) => block)
}

function buildSectionTemplate(
    id: BuiltInSectionTemplateId,
    template: Omit<SectionTemplate, 'id' | 'blocks' | 'isBuiltIn' | 'isCustom'>
): SectionTemplate {
    return {
        id,
        ...template,
        blocks: sectionTemplateBlockFactories[id](),
        isBuiltIn: true,
        isCustom: false
    }
}

export const heroCenteredSectionTemplate = buildSectionTemplate('hero-centered', {
    name: 'Centered Hero',
    description: 'A focused hero with a centered message and paired call-to-action buttons.',
    category: 'hero',
    tags: ['hero', 'landing', 'cta'],
    themeAware: true,
    suggestedThemes: ['Default', 'Midnight', 'Startup Bright']
})

export const heroSplitSectionTemplate = buildSectionTemplate('hero-split', {
    name: 'Split Hero',
    description: 'A left-aligned hero with supporting image space for product or editorial storytelling.',
    category: 'hero',
    tags: ['hero', 'product', 'image'],
    themeAware: true,
    suggestedThemes: ['Default', 'Editorial', 'SaaS Dark']
})

export const featuresThreeColSectionTemplate = buildSectionTemplate('features-3-col', {
    name: 'Three Feature Columns',
    description: 'A balanced three-column feature grid for positioning product value clearly.',
    category: 'features',
    tags: ['features', 'cards', 'grid'],
    themeAware: true,
    suggestedThemes: ['Default', 'Startup Bright']
})

export const pricingThreeTierSectionTemplate = buildSectionTemplate('pricing-3-tier', {
    name: 'Three-Tier Pricing',
    description: 'A full pricing section with three plans and a highlighted growth tier.',
    category: 'pricing',
    tags: ['pricing', 'plans', 'conversion'],
    themeAware: true,
    suggestedThemes: ['Default', 'Corporate Blue']
})

export const testimonialSliderSectionTemplate = buildSectionTemplate('testimonial-slider', {
    name: 'Testimonial Slider',
    description: 'A testimonial carousel for social proof, case study quotes, or customer highlights.',
    category: 'testimonials',
    tags: ['testimonials', 'carousel', 'social-proof'],
    themeAware: true,
    suggestedThemes: ['Default', 'Warm Neutral']
})

export const ctaBannerSectionTemplate = buildSectionTemplate('cta-banner', {
    name: 'CTA Banner',
    description: 'A bold call-to-action banner with clear headline, support copy, and two buttons.',
    category: 'cta',
    tags: ['cta', 'banner', 'conversion'],
    themeAware: true,
    suggestedThemes: ['Default', 'Campaign Bright']
})

export const footerSimpleSectionTemplate = buildSectionTemplate('footer-simple', {
    name: 'Simple Footer',
    description: 'A compact footer with copyright text and essential utility links.',
    category: 'footer',
    tags: ['footer', 'minimal'],
    themeAware: true,
    suggestedThemes: ['Default', 'Minimal Light']
})

export const footerFourColSectionTemplate = buildSectionTemplate('footer-4-col', {
    name: 'Four-Column Footer',
    description: 'A broader footer with brand messaging and grouped navigation links.',
    category: 'footer',
    tags: ['footer', 'links', 'site-map'],
    themeAware: true,
    suggestedThemes: ['Default', 'Corporate Blue']
})

export const navbarBrandedSectionTemplate = buildSectionTemplate('navbar-branded', {
    name: 'Branded Navbar',
    description: 'A branded navigation bar with key links and a small primary action.',
    category: 'navigation',
    tags: ['navbar', 'navigation', 'header'],
    themeAware: true,
    suggestedThemes: ['Default', 'Corporate Blue']
})

export const statsFourUpSectionTemplate = buildSectionTemplate('stats-4-up', {
    name: 'Four-Up Stats',
    description: 'A four-metric section for outcomes, milestones, or performance snapshots.',
    category: 'stats',
    tags: ['stats', 'metrics', 'numbers'],
    themeAware: true,
    suggestedThemes: ['Default', 'Dark Contrast']
})

export const teamThreeColSectionTemplate = buildSectionTemplate('team-3-col', {
    name: 'Three-Person Team',
    description: 'A three-column team section with portraits, roles, and bios.',
    category: 'team',
    tags: ['team', 'people', 'about'],
    themeAware: true,
    suggestedThemes: ['Default', 'Editorial']
})

export const galleryGridSectionTemplate = buildSectionTemplate('gallery-grid', {
    name: 'Gallery Grid',
    description: 'A six-image gallery grid for showcasing product, portfolio, or editorial assets.',
    category: 'gallery',
    tags: ['gallery', 'portfolio', 'images'],
    themeAware: true,
    suggestedThemes: ['Default', 'Portfolio Dark']
})

export const timelineVerticalSectionTemplate = buildSectionTemplate('timeline-vertical', {
    name: 'Vertical Timeline',
    description: 'A vertical process timeline for roadmaps, onboarding, or delivery phases.',
    category: 'timeline',
    tags: ['timeline', 'process', 'roadmap'],
    themeAware: true,
    suggestedThemes: ['Default', 'Minimal Light']
})

export const contactSplitSectionTemplate = buildSectionTemplate('contact-split', {
    name: 'Split Contact Form',
    description: 'A split contact section combining context copy and a straightforward inquiry form.',
    category: 'contact',
    tags: ['contact', 'form', 'lead-gen'],
    themeAware: true,
    suggestedThemes: ['Default', 'Corporate Blue']
})

export const newsletterInlineSectionTemplate = buildSectionTemplate('newsletter-inline', {
    name: 'Inline Newsletter Signup',
    description: 'A compact opt-in band with persuasive copy and an inline email form.',
    category: 'newsletter',
    tags: ['newsletter', 'signup', 'email'],
    themeAware: true,
    suggestedThemes: ['Default', 'Minimal Light']
})

export const logoCloudSectionTemplate = buildSectionTemplate('logo-cloud', {
    name: 'Logo Cloud',
    description: 'A simple logo cloud for trust signals, partners, or press mentions.',
    category: 'logos',
    tags: ['logos', 'trust', 'brands'],
    themeAware: true,
    suggestedThemes: ['Default', 'Startup Bright']
})

export const processThreeStepsSectionTemplate = buildSectionTemplate('process-3-steps', {
    name: 'Three-Step Process',
    description: 'A concise three-step explainer section for onboarding, service, or workflow narratives.',
    category: 'process',
    tags: ['process', 'steps', 'workflow'],
    themeAware: true,
    suggestedThemes: ['Default', 'Dark Contrast']
})

export const comparisonTwoColSectionTemplate = buildSectionTemplate('comparison-2-col', {
    name: 'Two-Column Comparison',
    description: 'A before-and-after comparison section for alternatives, transformations, or plan positioning.',
    category: 'comparison',
    tags: ['comparison', 'before-after', 'value'],
    themeAware: true,
    suggestedThemes: ['Default', 'Corporate Blue']
})

export const builtInSectionTemplates: SectionTemplate[] = [
    heroCenteredSectionTemplate,
    heroSplitSectionTemplate,
    featuresThreeColSectionTemplate,
    pricingThreeTierSectionTemplate,
    testimonialSliderSectionTemplate,
    ctaBannerSectionTemplate,
    footerSimpleSectionTemplate,
    footerFourColSectionTemplate,
    navbarBrandedSectionTemplate,
    statsFourUpSectionTemplate,
    teamThreeColSectionTemplate,
    galleryGridSectionTemplate,
    timelineVerticalSectionTemplate,
    contactSplitSectionTemplate,
    newsletterInlineSectionTemplate,
    logoCloudSectionTemplate,
    processThreeStepsSectionTemplate,
    comparisonTwoColSectionTemplate
]

export const builtInSectionTemplateMap: Record<BuiltInSectionTemplateId, SectionTemplate> = {
    'hero-centered': heroCenteredSectionTemplate,
    'hero-split': heroSplitSectionTemplate,
    'features-3-col': featuresThreeColSectionTemplate,
    'pricing-3-tier': pricingThreeTierSectionTemplate,
    'testimonial-slider': testimonialSliderSectionTemplate,
    'cta-banner': ctaBannerSectionTemplate,
    'footer-simple': footerSimpleSectionTemplate,
    'footer-4-col': footerFourColSectionTemplate,
    'navbar-branded': navbarBrandedSectionTemplate,
    'stats-4-up': statsFourUpSectionTemplate,
    'team-3-col': teamThreeColSectionTemplate,
    'gallery-grid': galleryGridSectionTemplate,
    'timeline-vertical': timelineVerticalSectionTemplate,
    'contact-split': contactSplitSectionTemplate,
    'newsletter-inline': newsletterInlineSectionTemplate,
    'logo-cloud': logoCloudSectionTemplate,
    'process-3-steps': processThreeStepsSectionTemplate,
    'comparison-2-col': comparisonTwoColSectionTemplate
}
