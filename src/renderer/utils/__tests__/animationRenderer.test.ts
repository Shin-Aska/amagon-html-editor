import {describe, expect, it} from 'vitest'
import {blockToHtml, pageToHtml} from '../blockToHtml'
import type {Block} from '../../store/types'
import {createBlock} from '../../store/types'

const animation: Block['animation'] = {preset: 'fade', durationMs: 600, delayMs: 0, easing: 'ease-out'}

function parseRootElement(html: string): Element {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) throw new Error('No root element found in rendered HTML');
    return root
}

    function parseRootElements(html: string): Element[] {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return Array.from(doc.body.children)
    }

function expectNoAnimation(html: string): void {
    expect(html).not.toContain('amagon-enter');
    expect(html).not.toContain('--amagon-enter-duration');
    expect(html).not.toContain('--amagon-enter-delay');
    expect(html).not.toContain('--amagon-enter-easing')
}

function getCssVariableOccurrences(element: Element, variable: string): number {
    const style = element.getAttribute('style') || '';
    const matches = style.match(new RegExp(`${variable}:\\s*[^;]+`, 'g')) || [];
    return matches.length
}

function expectRootAnimation(root: Element): void {
    const animationClasses = Array.from(root.classList).filter((cls) => cls.includes('amagon-enter'));
    expect(animationClasses).toContain('amagon-enter-fade');
    expect(animationClasses).toContain('amagon-enter');
    expect(animationClasses.length).toBe(2);

    expect(getCssVariableOccurrences(root, '--amagon-enter-duration')).toBe(1);
    expect(getCssVariableOccurrences(root, '--amagon-enter-delay')).toBe(1);
    expect(getCssVariableOccurrences(root, '--amagon-enter-easing')).toBe(1);

    for (const child of root.querySelectorAll('*')) {
        const childClasses = Array.from(child.classList).filter((cls) => cls.includes('amagon-enter'));
        expect(childClasses).toEqual([]);
        expect(getCssVariableOccurrences(child, '--amagon-enter-duration')).toBe(0);
        expect(getCssVariableOccurrences(child, '--amagon-enter-delay')).toBe(0);
        expect(getCssVariableOccurrences(child, '--amagon-enter-easing')).toBe(0)
    }
}

describe('blockToHtml animation rendering', () => {
    it('applies animation classes and variables to a generic container root', () => {
        const blocks: Block[] = [
            createBlock('container', {
                classes: ['mt-4'],
                animation
            })
        ];
        const root = parseRootElement(blockToHtml(blocks));
        expectRootAnimation(root)
    });

    it('applies animation to a button root', () => {
        const blocks: Block[] = [
            createBlock('button', {
                props: {text: 'Go'},
                animation
            })
        ];
        const root = parseRootElement(blockToHtml(blocks));
        expect(root.tagName.toLowerCase()).toBe('button');
        expectRootAnimation(root)
    });

    it('applies animation to a link root', () => {
        const blocks: Block[] = [
            createBlock('link', {
                props: {text: 'Click', href: '#'},
                animation
            })
        ];
        const root = parseRootElement(blockToHtml(blocks));
        expect(root.tagName.toLowerCase()).toBe('a');
        expectRootAnimation(root)
    });

    it('applies animation to a card root', () => {
        const blocks: Block[] = [
            createBlock('card', {
                props: {title: 'Card'},
                animation
            })
        ];
        const root = parseRootElement(blockToHtml(blocks));
        expect(root.tagName.toLowerCase()).toBe('div');
        expectRootAnimation(root)
    });

    it('applies animation to a plain image root and not to a caption inner image', () => {
        const plain = createBlock('image', {
            props: {src: 'a.jpg', alt: 'A'},
            animation
        });
        const captioned = createBlock('image', {
            props: {src: 'b.jpg', alt: 'B', caption: 'Photo'},
            animation
        });

        expectRootAnimation(parseRootElement(blockToHtml([plain])));

        const figure = parseRootElement(blockToHtml([captioned]));
        expect(figure.tagName.toLowerCase()).toBe('figure');
        expectRootAnimation(figure)
    });

    it('applies animation to video/iframe wrappers and not inner elements', () => {
        const video = createBlock('video', {
            props: {src: 'v.mp4'},
            animation
        });
        const iframe = createBlock('iframe', {
            props: {src: 'https://example.com'},
            animation
        });

        const videoRoot = parseRootElement(blockToHtml([video]));
        expect(videoRoot.querySelector('video')).toBeTruthy();
        expectRootAnimation(videoRoot);

        const iframeRoot = parseRootElement(blockToHtml([iframe]));
        expect(iframeRoot.querySelector('iframe')).toBeTruthy();
        expectRootAnimation(iframeRoot)
    });

    it('applies animation to a responsive table root', () => {
        const table = createBlock('table', {
            props: {headers: ['A'], rows: [['1']]},
            animation
        });
        const root = parseRootElement(blockToHtml([table]));
        expect(root.querySelector('table')).toBeTruthy();
        expectRootAnimation(root)
    });

    it('never applies animation to excluded types', () => {
        const excludedTypes: Block['type'][] = [
            'raw-html',
            'spacer',
            'divider',
            'modal',
            'offcanvas',
            'carousel',
            'spinner',
            'progress',
            'icon',
            'input',
            'textarea',
            'select',
            'checkbox',
            'radio',
            'range',
            'file-input',
            'breadcrumb',
            'pagination'
        ];
        for (const type of excludedTypes) {
            const block = createBlock(type, {
                ...(type === 'raw-html' ? {content: '<span>x</span>'} : {}),
                ...(type === 'spacer' ? {props: {height: '2rem'}} : {}),
                ...(type === 'input' ? {props: {label: 'Name'}} : {}),
                ...(type === 'textarea' ? {props: {label: 'Message'}} : {}),
                ...(type === 'select' ? {props: {label: 'Choice', options: ['One']}} : {}),
                ...(type === 'checkbox' ? {props: {label: 'Agree'}} : {}),
                ...(type === 'radio' ? {props: {label: 'Opt'}} : {}),
                ...(type === 'range' ? {props: {label: 'Vol'}} : {}),
                ...(type === 'file-input' ? {props: {label: 'File'}} : {}),
                ...(type === 'breadcrumb' ? {props: {items: [{label: 'Home', href: '#', active: true}]}} : {}),
                ...(type === 'pagination' ? {props: {pages: 3}} : {}),
                animation
            });
            expectNoAnimation(blockToHtml([block]))
        }
    });

    it('omits animation when includeAnimation is false', () => {
        const blocks: Block[] = [
            createBlock('heading', {
                props: {text: 'Hi'},
                animation
            })
        ];
        const html = blockToHtml(blocks, {includeAnimation: false});
        expect(html).not.toContain('amagon-enter');
        expect(html).not.toContain('--amagon-enter-duration')
    });

    it('does not apply animation to compact form and navigation controls', () => {
        const blocks: Block[] = [
            createBlock('input', {props: {label: 'Name'}, animation}),
            createBlock('textarea', {props: {label: 'Message'}, animation}),
            createBlock('select', {props: {label: 'Choice', options: ['One']}, animation}),
            createBlock('checkbox', {props: {label: 'Agree'}, animation}),
            createBlock('radio', {props: {label: 'Opt'}, animation}),
            createBlock('range', {props: {label: 'Vol'}, animation}),
            createBlock('file-input', {props: {label: 'File'}, animation}),
            createBlock('breadcrumb', {props: {items: [{label: 'Home', href: '#', active: true}]}, animation}),
            createBlock('pagination', {props: {pages: 3}, animation})
        ];
        const html = blockToHtml(blocks);
        const roots = parseRootElements(html);
        expect(roots).toHaveLength(9);
        expectNoAnimation(html)
    });

    it('omits checkbox animation from both the wrapper and the inner input', () => {
        const block = createBlock('checkbox', {
            props: {label: 'Agree'},
            animation
        });
        const root = parseRootElement(blockToHtml([block]));
        const input = root.querySelector('input[type="checkbox"]');
        expect(input).toBeTruthy();
        expect(Array.from(root.classList).filter((cls) => cls.includes('amagon-enter'))).toEqual([]);
        expect(input ? Array.from(input.classList).filter((cls) => cls.includes('amagon-enter')) : []).toEqual([]);
        expectNoAnimation(root.outerHTML)
    });

    it('applies responsive-table animation only to the wrapper, not the inner table', () => {
        const table = createBlock('table', {
            props: {headers: ['A'], rows: [['1']], responsive: true},
            animation
        });
        const root = parseRootElement(blockToHtml([table]));
        const innerTable = root.querySelector('table');
        expect(innerTable).toBeTruthy();
        expect(Array.from(innerTable!.classList).some((cls) => cls.includes('amagon-enter'))).toBe(false);
        expectRootAnimation(root)
    });

    it('applies animation to a non-responsive table root', () => {
        const table = createBlock('table', {
            props: {headers: ['A'], rows: [['1']], responsive: false},
            animation
        });
        const root = parseRootElement(blockToHtml([table]));
        expect(root.tagName.toLowerCase()).toBe('table');
        expectRootAnimation(root)
    });

    it('applies animation to a page-backed navbar root', () => {
        const pageList = createBlock('navbar', {
            props: {usePages: true, brandText: 'Site'},
            animation
        });
        const html = pageToHtml([pageList], {
            framework: 'bootstrap-5',
            pages: [{id: 'p1', title: 'Home', slug: 'index', tags: [], blocks: [], meta: {}}],
            customCss: ''
        });
        const root = parseRootElement(html);
        expectRootAnimation(root)
    });

    it('honors includeAnimation=false in card and composite branches', () => {
        const blocks: Block[] = [
            createBlock('card', {props: {title: 'Card'}, animation}),
            createBlock('checkbox', {props: {label: 'Agree'}, animation}),
            createBlock('radio', {props: {label: 'Opt'}, animation}),
            createBlock('table', {props: {headers: ['A'], rows: [['1']], responsive: true}, animation})
        ];
        const html = blockToHtml(blocks, {includeAnimation: false});
        expect(html).not.toContain('amagon-enter');
        expect(html).not.toContain('--amagon-enter-duration')
    });

    it.each([
        ['stats-section', createBlock('stats-section', {
            props: {items: [{value: '120', label: 'Projects', prefix: '', suffix: '+', icon: ''}]},
            animation
        })],
        ['team-grid', createBlock('team-grid', {
            props: {members: [{name: 'A', role: 'R', imageUrl: '', bio: '', socialLinks: {}}]},
            animation
        })],
        ['gallery', createBlock('gallery', {
            props: {images: [{url: '', caption: '', category: 'General'}]},
            animation
        })],
        ['timeline', createBlock('timeline', {
            props: {items: [{date: '2024', title: 'T', description: 'D', icon: '', variant: 'primary'}]},
            animation
        })],
        ['logo-cloud', createBlock('logo-cloud', {
            props: {logos: [{imageUrl: '', altText: '', href: ''}]},
            animation
        })],
        ['process-steps', createBlock('process-steps', {
            props: {steps: [{number: '1', title: 'S', description: '', icon: ''}]},
            animation
        })],
        ['newsletter', createBlock('newsletter', {animation})],
        ['comparison-table', createBlock('comparison-table', {
            props: {plans: [{name: 'P', price: '$0', period: '/mo', features: [], highlighted: false, ctaText: 'S', ctaHref: '#'}], columns: 2},
            animation
        })],
        ['contact-card', createBlock('contact-card', {
            props: {name: 'N', title: 'T', email: '', phone: '', address: '', imageUrl: '', layout: 'vertical'},
            animation
        })],
        ['social-links', createBlock('social-links', {
            props: {links: [{platform: 'X', url: '#', label: 'X'}], style: 'icons-only', size: 'md'},
            animation
        })],
        ['cookie-banner', createBlock('cookie-banner', {
            props: {message: 'M', acceptText: 'A', declineText: 'D', position: 'bottom'},
            animation
        })],
        ['back-to-top', createBlock('back-to-top', {
            props: {style: 'circle', position: 'bottom-right'},
            animation
        })],
        ['countdown', createBlock('countdown', {
            props: {labels: {days: 'D', hours: 'H', minutes: 'M', seconds: 'S'}},
            animation
        })],
        ['before-after', createBlock('before-after', {
            props: {beforeImage: '', afterImage: ''},
            animation
        })],
        ['map-embed', createBlock('map-embed', {
            props: {embedUrl: '', height: '25rem', grayscale: false, title: 'Map'},
            animation
        })],
        ['table', createBlock('table', {
            props: {headers: ['A'], rows: [['1']], responsive: false},
            animation
        })]
    ] as [string, Block][])('applies exactly one root animation class and all variables to the %s root', (_type, block) => {
        const root = parseRootElement(blockToHtml([block]));
        expectRootAnimation(root)
    });

    it('keeps timeline line color while adding animation variables', () => {
        const block = createBlock('timeline', {
            props: {items: [{date: '2024', title: 'T', description: 'D', icon: '', variant: 'primary'}], lineColor: '#ff0000'},
            animation
        });
        const root = parseRootElement(blockToHtml([block]));
        expect(root.getAttribute('style')).toContain('--timeline-line-color: #ff0000');
        expectRootAnimation(root)
    });

    it('preserves existing inline styles when adding animation variables to phase-6 widgets', () => {
        const contactCard = createBlock('contact-card', {
            props: {name: 'N', title: 'T', email: '', phone: '', address: '', imageUrl: '', layout: 'vertical'},
            animation
        });
        const backToTop = createBlock('back-to-top', {
            props: {style: 'circle', position: 'bottom-right'},
            animation
        });
        const beforeAfter = createBlock('before-after', {
            props: {beforeImage: '', afterImage: ''},
            animation
        });

        const contactRoot = parseRootElement(blockToHtml([contactCard]));
        expect(contactRoot.getAttribute('style')).toContain('max-width: 600px');
        expectRootAnimation(contactRoot);

        const backToTopRoot = parseRootElement(blockToHtml([backToTop]));
        expect(backToTopRoot.getAttribute('style')).toContain('bottom: 1.5rem');
        expectRootAnimation(backToTopRoot);

        const beforeAfterRoot = parseRootElement(blockToHtml([beforeAfter]));
        expect(beforeAfterRoot.getAttribute('style')).toContain('aspect-ratio: 16/9');
        expectRootAnimation(beforeAfterRoot)
    });

    it('honors includeAnimation=false for newly fixed widget roots', () => {
        const blocks: Block[] = [
            createBlock('stats-section', {props: {items: [{value: '1', label: 'L', prefix: '', suffix: '', icon: ''}]}, animation}),
            createBlock('team-grid', {props: {members: [{name: 'A', role: 'R', imageUrl: '', bio: '', socialLinks: {}}]}, animation}),
            createBlock('gallery', {props: {images: [{url: '', caption: '', category: 'General'}]}, animation}),
            createBlock('timeline', {props: {items: [{date: '2024', title: 'T', description: 'D', icon: '', variant: 'primary'}]}, animation}),
            createBlock('logo-cloud', {props: {logos: [{imageUrl: '', altText: '', href: ''}]}, animation}),
            createBlock('process-steps', {props: {steps: [{number: '1', title: 'S', description: '', icon: ''}]}, animation}),
            createBlock('newsletter', {animation}),
            createBlock('table', {props: {headers: ['A'], rows: [['1']], responsive: false}, animation})
        ];
        const html = blockToHtml(blocks, {includeAnimation: false});
        expect(html).not.toContain('amagon-enter');
        expect(html).not.toContain('--amagon-enter-duration')
    });

    it('does not duplicate animation variables on captioned or lightbox images', () => {
        const captioned = createBlock('image', {
            props: {src: 'b.jpg', alt: 'B', caption: 'Photo'},
            animation
        });
        const lightbox = createBlock('image', {
            props: {src: 'c.jpg', alt: 'C', lightbox: true},
            animation
        });

        const captionRoot = parseRootElement(blockToHtml([captioned]));
        expect(getCssVariableOccurrences(captionRoot, '--amagon-enter-duration')).toBe(1);
        expect(getCssVariableOccurrences(captionRoot, '--amagon-enter-delay')).toBe(1);
        expect(getCssVariableOccurrences(captionRoot, '--amagon-enter-easing')).toBe(1);

        const lightboxRoot = parseRootElement(blockToHtml([lightbox]));
        expect(getCssVariableOccurrences(lightboxRoot, '--amagon-enter-duration')).toBe(1);
        expect(getCssVariableOccurrences(lightboxRoot, '--amagon-enter-delay')).toBe(1);
        expect(getCssVariableOccurrences(lightboxRoot, '--amagon-enter-easing')).toBe(1)
    })
});

describe('pageToHtml animation CSS', () => {
    it('injects the animation stylesheet before custom CSS', () => {
        const html = pageToHtml([], {
            customCss: '.my-class { color: red; }'
        });
        const animationIndex = html.indexOf('amagon-enter-animations');
        const customCssIndex = html.indexOf('html-editor-custom-css');
        expect(animationIndex).toBeGreaterThan(0);
        expect(customCssIndex).toBeGreaterThan(animationIndex);
        expect(html).toContain('@keyframes amagon-enter-fade')
    });

    it('can omit animation CSS', () => {
        const html = pageToHtml([], {includeAnimationCss: false});
        expect(html).not.toContain('amagon-enter-animations');
        expect(html).not.toContain('@keyframes amagon-enter-fade')
    });

    it('injects reduced-motion CSS inside the animation stylesheet', () => {
        const html = pageToHtml([], {
            customCss: '.my-class { color: red; }'
        });
        const animationStyleStart = html.indexOf('amagon-enter-animations');
        const animationStyleEnd = html.indexOf('</style>', animationStyleStart);
        const animationStyle = html.slice(animationStyleStart, animationStyleEnd);
        expect(animationStyle).toContain('@media (prefers-reduced-motion: reduce)');
        expect(animationStyle).toContain('animation: none !important');
        expect(animationStyle).toContain('opacity: 1 !important');

        const animationIndex = html.indexOf('amagon-enter-animations');
        const customCssIndex = html.indexOf('html-editor-custom-css');
        expect(animationIndex).toBeGreaterThan(0);
        expect(customCssIndex).toBeGreaterThan(animationIndex)
    })
});
