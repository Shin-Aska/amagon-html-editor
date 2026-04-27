import type {Block} from '../store/types'
import {createBlock} from '../store/types'

const createPreviewNavbar = (): Block => createBlock('container', {
    tag: 'section',
    classes: ['container', 'py-3'],
    children: [
        createBlock('row', {
            classes: ['row', 'align-items-center', 'g-3'],
            children: [
                createBlock('column', {
                    classes: ['col-md-4'],
                    children: [
                        createBlock('heading', {
                            props: {text: 'Amagon', level: 4},
                            classes: ['mb-0', 'fw-bold']
                        })
                    ]
                }),
                createBlock('column', {
                    classes: ['col-md-5'],
                    children: [
                        createBlock('paragraph', {
                            props: {text: 'Product • Pricing • Templates'},
                            classes: ['mb-0', 'text-muted']
                        })
                    ]
                }),
                createBlock('column', {
                    classes: ['col-md-3', 'text-md-end'],
                    children: [
                        createBlock('button', {
                            props: {text: 'Get Started', href: '#'},
                            classes: ['btn', 'btn-primary']
                        })
                    ]
                })
            ]
        })
    ]
})

const createPreviewHero = (): Block => createBlock('container', {
    tag: 'section',
    classes: ['container', 'py-5'],
    children: [
        createBlock('row', {
            classes: ['row', 'align-items-center', 'g-4'],
            children: [
                createBlock('column', {
                    classes: ['col-lg-7'],
                    children: [
                        createBlock('paragraph', {
                            props: {text: 'Theme preview'},
                            classes: ['text-uppercase', 'fw-semibold', 'small', 'mb-2']
                        }),
                        createBlock('heading', {
                            props: {text: 'Build polished pages with a cohesive design system.', level: 1},
                            classes: ['display-6', 'fw-bold', 'mb-3']
                        }),
                        createBlock('paragraph', {
                            props: {
                                text: 'Mix clear hierarchy, consistent spacing, and ready-made sections for landing pages, marketing sites, and portfolios.'
                            },
                            classes: ['lead', 'text-muted', 'mb-4']
                        }),
                        createBlock('container', {
                            classes: ['d-flex', 'flex-wrap', 'gap-2'],
                            children: [
                                createBlock('button', {
                                    props: {text: 'Start Free', href: '#'},
                                    classes: ['btn', 'btn-primary']
                                }),
                                createBlock('button', {
                                    props: {text: 'Preview Style', href: '#'},
                                    classes: ['btn', 'btn-outline-secondary']
                                })
                            ]
                        })
                    ]
                }),
                createBlock('column', {
                    classes: ['col-lg-5'],
                    children: [
                        createBlock('container', {
                            classes: ['card', 'border-0', 'shadow-sm'],
                            children: [
                                createBlock('container', {
                                    classes: ['card-body', 'p-4'],
                                    children: [
                                        createBlock('heading', {
                                            props: {text: 'Metrics snapshot', level: 4},
                                            classes: ['card-title', 'mb-3']
                                        }),
                                        createBlock('paragraph', {
                                            props: {text: '83% faster concept-to-layout workflow'},
                                            classes: ['mb-2', 'fw-semibold']
                                        }),
                                        createBlock('paragraph', {
                                            props: {text: 'Reusable sections, dark variants, and tuned typography tokens.'},
                                            classes: ['mb-0', 'text-muted']
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                })
            ]
        })
    ]
})

const createPreviewCards = (): Block => createBlock('container', {
    tag: 'section',
    classes: ['container', 'py-4'],
    children: [
        createBlock('heading', {
            props: {text: 'Key sections', level: 3},
            classes: ['mb-4']
        }),
        createBlock('row', {
            classes: ['row', 'g-3'],
            children: [
                createBlock('column', {
                    classes: ['col-md-4'],
                    children: [
                        createBlock('container', {
                            classes: ['card', 'h-100'],
                            children: [
                                createBlock('container', {
                                    classes: ['card-body'],
                                    children: [
                                        createBlock('heading', {
                                            props: {text: 'Hero layouts', level: 5},
                                            classes: ['card-title']
                                        }),
                                        createBlock('paragraph', {
                                            props: {text: 'Confident headlines with a clear call to action.'},
                                            classes: ['card-text', 'text-muted', 'mb-0']
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                }),
                createBlock('column', {
                    classes: ['col-md-4'],
                    children: [
                        createBlock('container', {
                            classes: ['card', 'h-100'],
                            children: [
                                createBlock('container', {
                                    classes: ['card-body'],
                                    children: [
                                        createBlock('heading', {
                                            props: {text: 'Feature grids', level: 5},
                                            classes: ['card-title']
                                        }),
                                        createBlock('paragraph', {
                                            props: {text: 'Structured content blocks that stay balanced at every breakpoint.'},
                                            classes: ['card-text', 'text-muted', 'mb-0']
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                }),
                createBlock('column', {
                    classes: ['col-md-4'],
                    children: [
                        createBlock('container', {
                            classes: ['card', 'h-100'],
                            children: [
                                createBlock('container', {
                                    classes: ['card-body'],
                                    children: [
                                        createBlock('heading', {
                                            props: {text: 'CTA banners', level: 5},
                                            classes: ['card-title']
                                        }),
                                        createBlock('paragraph', {
                                            props: {text: 'High-contrast conversion moments with room for proof and trust.'},
                                            classes: ['card-text', 'text-muted', 'mb-0']
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                })
            ]
        })
    ]
})

const createPreviewForm = (): Block => createBlock('container', {
    tag: 'section',
    classes: ['container', 'py-4'],
    children: [
        createBlock('row', {
            classes: ['row', 'g-4'],
            children: [
                createBlock('column', {
                    classes: ['col-lg-6'],
                    children: [
                        createBlock('heading', {
                            props: {text: 'Capture leads elegantly', level: 3},
                            classes: ['mb-3']
                        }),
                        createBlock('paragraph', {
                            props: {text: 'Simple forms should feel native to the same system as your hero, cards, and buttons.'},
                            classes: ['text-muted', 'mb-0']
                        })
                    ]
                }),
                createBlock('column', {
                    classes: ['col-lg-6'],
                    children: [
                        createBlock('container', {
                            classes: ['card'],
                            children: [
                                createBlock('container', {
                                    classes: ['card-body', 'p-4'],
                                    children: [
                                        createBlock('paragraph', {
                                            props: {text: 'Email address'},
                                            classes: ['fw-semibold', 'mb-2']
                                        }),
                                        createBlock('input', {
                                            props: {type: 'email', placeholder: 'you@company.com'},
                                            classes: ['form-control', 'mb-3']
                                        }),
                                        createBlock('paragraph', {
                                            props: {text: 'What are you building?'},
                                            classes: ['fw-semibold', 'mb-2']
                                        }),
                                        createBlock('textarea', {
                                            props: {placeholder: 'A new landing page for our product launch'},
                                            classes: ['form-control', 'mb-3']
                                        }),
                                        createBlock('button', {
                                            props: {text: 'Request early access', href: '#'},
                                            classes: ['btn', 'btn-primary', 'w-100']
                                        })
                                    ]
                                })
                            ]
                        })
                    ]
                })
            ]
        })
    ]
})

export const previewSampleBlocks: Block[] = [
    createPreviewNavbar(),
    createPreviewHero(),
    createPreviewCards(),
    createPreviewForm()
]
