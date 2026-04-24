// ─── Shared Block Templates ────────────────────────────────────────────────
// Used by both Electron main process and the renderer mock API.
// No framework-specific imports — only plain data.

interface WelcomeBlock {
    id: string
    type: string
    tag?: string
    props: Record<string, unknown>
    styles: Record<string, string>
    classes: string[]
    children: WelcomeBlock[]
}

let _counter = 0;
function genId(): string {
    _counter++;
    return `blk_${Date.now().toString(36)}_w${_counter.toString(36)}`
}

function block(
    type: string,
    opts: {
        props?: Record<string, unknown>
        classes?: string[]
        styles?: Record<string, string>
        children?: WelcomeBlock[]
        tag?: string
    } = {}
): WelcomeBlock {
    return {
        id: genId(),
        type,
        ...(opts.tag ? { tag: opts.tag } : {}),
        props: opts.props ?? {},
        styles: opts.styles ?? {},
        classes: opts.classes ?? [],
        children: opts.children ?? []
    }
}

// ─── Welcome blocks for a brand-new project ────────────────────────────────

export function createWelcomeBlocks(projectName: string): WelcomeBlock[] {
    return [
        // Hero section
        block('section', {
            classes: ['py-5', 'bg-light'],
            children: [
                block('container', {
                    classes: ['container', 'text-center'],
                    children: [
                        block('heading', {
                            props: { text: `Welcome to ${projectName}`, level: 1 },
                            classes: ['display-5', 'fw-bold', 'mb-3']
                        }),
                        block('paragraph', {
                            props: {
                                text: 'Your new website project is ready! Start building by dragging widgets from the left panel onto your page.'
                            },
                            classes: ['lead', 'text-muted', 'mb-0']
                        })
                    ]
                })
            ]
        }),

        // Getting started tips
        block('section', {
            classes: ['py-5'],
            children: [
                block('container', {
                    classes: ['container'],
                    children: [
                        block('heading', {
                            props: { text: 'Getting Started', level: 2 },
                            classes: ['mb-4', 'text-center']
                        }),
                        block('row', {
                            classes: ['row', 'g-4'],
                            children: [
                                block('column', {
                                    classes: ['col-md-4'],
                                    children: [
                                        block('container', {
                                            classes: ['card', 'h-100'],
                                            children: [
                                                block('container', {
                                                    classes: ['card-body', 'text-center'],
                                                    children: [
                                                        block('heading', {
                                                            props: { text: 'Widgets', level: 4 },
                                                            classes: ['card-title']
                                                        }),
                                                        block('paragraph', {
                                                            props: {
                                                                text: 'Use the Widgets panel on the left to drag headings, images, buttons, and more onto your page.'
                                                            },
                                                            classes: ['card-text', 'text-muted']
                                                        })
                                                    ]
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                block('column', {
                                    classes: ['col-md-4'],
                                    children: [
                                        block('container', {
                                            classes: ['card', 'h-100'],
                                            children: [
                                                block('container', {
                                                    classes: ['card-body', 'text-center'],
                                                    children: [
                                                        block('heading', {
                                                            props: { text: 'Inspector', level: 4 },
                                                            classes: ['card-title']
                                                        }),
                                                        block('paragraph', {
                                                            props: {
                                                                text: 'Select any element and use the Inspector on the right to customize its text, colors, spacing, and styles.'
                                                            },
                                                            classes: ['card-text', 'text-muted']
                                                        })
                                                    ]
                                                })
                                            ]
                                        })
                                    ]
                                }),
                                block('column', {
                                    classes: ['col-md-4'],
                                    children: [
                                        block('container', {
                                            classes: ['card', 'h-100'],
                                            children: [
                                                block('container', {
                                                    classes: ['card-body', 'text-center'],
                                                    children: [
                                                        block('heading', {
                                                            props: { text: 'Preview & Export', level: 4 },
                                                            classes: ['card-title']
                                                        }),
                                                        block('paragraph', {
                                                            props: {
                                                                text: 'Preview your site at any time, then export it as clean HTML ready to deploy anywhere.'
                                                            },
                                                            classes: ['card-text', 'text-muted']
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
            ]
        }),

        // Footer
        block('footer', {
            tag: 'footer',
            classes: ['py-4', 'border-top'],
            children: [
                block('container', {
                    classes: ['container'],
                    children: [
                        block('paragraph', {
                            props: { text: `© ${new Date().getFullYear()} ${projectName}` },
                            classes: ['text-muted', 'text-center', 'mb-0']
                        })
                    ]
                })
            ]
        })
    ]
}

// ─── Default header block for subsequently added pages ──────────────────────

export function createPageHeaderBlock(pageTitle: string): WelcomeBlock[] {
    return [
        block('heading', {
            props: { text: pageTitle, level: 1, alignment: 'text-center' },
            classes: ['text-center', 'py-4']
        })
    ]
}
