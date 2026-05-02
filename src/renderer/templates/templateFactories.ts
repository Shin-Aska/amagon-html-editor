import {IMAGE_PLACEHOLDER} from '../utils/placeholders'
import {createBlock, type Block} from '../store/types'

export interface TemplateBlockInit {
    tag?: string
    props?: Record<string, unknown>
    styles?: Record<string, string>
    classes?: string[]
    events?: Record<string, string>
    content?: string
    children?: Block[]
    locked?: boolean
}

export function createTemplateBlock(type: string, init: TemplateBlockInit = {}): Block {
    return createBlock(type, {
        ...(init.tag ? {tag: init.tag} : {}),
        props: init.props ?? {},
        styles: init.styles ?? {},
        classes: init.classes ?? [],
        events: init.events ?? {},
        ...(init.content !== undefined ? {content: init.content} : {}),
        children: init.children ?? [],
        ...(init.locked !== undefined ? {locked: init.locked} : {})
    })
}

export function cloneBlockTree(block: Block): Block {
    return createTemplateBlock(block.type, {
        ...(block.tag ? {tag: block.tag} : {}),
        props: {...block.props},
        styles: {...block.styles},
        classes: [...block.classes],
        events: block.events ? {...block.events} : {},
        ...(block.content !== undefined ? {content: block.content} : {}),
        children: block.children.map(cloneBlockTree),
        ...(block.locked !== undefined ? {locked: block.locked} : {})
    })
}

export function cloneBlockTrees(blocks: Block[]): Block[] {
    return blocks.map(cloneBlockTree)
}

export function sectionBlock(children: Block[], classes: string[] = ['py-5']): Block {
    return createTemplateBlock('section', {classes, children})
}

export function containerBlock(children: Block[], classes: string[] = ['container', 'py-4']): Block {
    return createTemplateBlock('container', {classes, children})
}

export function rowBlock(children: Block[], classes: string[] = ['row'], gutters = true): Block {
    return createTemplateBlock('row', {classes, props: {gutters}, children})
}

export function columnBlock(
    children: Block[],
    options: {
        classes?: string[]
        width?: string
        colSm?: number
        colMd?: number
        colLg?: number
        colXl?: number
        offset?: number
        order?: number
    } = {}
): Block {
    return createTemplateBlock('column', {
        classes: options.classes ?? ['col'],
        props: {
            ...(options.width ? {width: options.width} : {}),
            ...(options.colSm !== undefined ? {colSm: options.colSm} : {}),
            ...(options.colMd !== undefined ? {colMd: options.colMd} : {}),
            ...(options.colLg !== undefined ? {colLg: options.colLg} : {}),
            ...(options.colXl !== undefined ? {colXl: options.colXl} : {}),
            ...(options.offset !== undefined ? {offset: options.offset} : {}),
            ...(options.order !== undefined ? {order: options.order} : {})
        },
        children
    })
}

export function headingBlock(
    text: string,
    options: {
        level?: number
        alignment?: 'text-start' | 'text-center' | 'text-end'
        decorative?: 'none' | 'underline' | 'gradient-underline'
        anchorId?: string
        fontFamily?: string
        classes?: string[]
    } = {}
): Block {
    return createTemplateBlock('heading', {
        classes: options.classes ?? [],
        props: {
            text,
            level: options.level ?? 2,
            ...(options.alignment ? {alignment: options.alignment} : {}),
            ...(options.decorative ? {decorative: options.decorative} : {}),
            ...(options.anchorId ? {anchorId: options.anchorId} : {}),
            ...(options.fontFamily ? {fontFamily: options.fontFamily} : {})
        }
    })
}

export function paragraphBlock(
    text: string,
    options: {
        lead?: boolean
        alignment?: 'text-start' | 'text-center' | 'text-end'
        dropCap?: boolean
        columns?: '1' | '2' | '3'
        fontFamily?: string
        classes?: string[]
    } = {}
): Block {
    return createTemplateBlock('paragraph', {
        classes: options.classes ?? [],
        props: {
            text,
            ...(options.lead !== undefined ? {lead: options.lead} : {}),
            ...(options.alignment ? {alignment: options.alignment} : {}),
            ...(options.dropCap !== undefined ? {dropCap: options.dropCap} : {}),
            ...(options.columns ? {columns: options.columns} : {}),
            ...(options.fontFamily ? {fontFamily: options.fontFamily} : {})
        }
    })
}

export function imageBlock(
    src: string = IMAGE_PLACEHOLDER,
    alt: string,
    options: {
        caption?: string
        captionPosition?: 'below' | 'overlay-bottom'
        objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
        aspectRatio?: 'auto' | '1:1' | '4:3' | '16:9' | '21:9'
        lazyLoad?: boolean
        lightbox?: boolean
        classes?: string[]
    } = {}
): Block {
    return createTemplateBlock('image', {
        classes: options.classes ?? ['img-fluid'],
        props: {
            src,
            alt,
            ...(options.caption !== undefined ? {caption: options.caption} : {}),
            ...(options.captionPosition ? {captionPosition: options.captionPosition} : {}),
            ...(options.objectFit ? {objectFit: options.objectFit} : {}),
            ...(options.aspectRatio ? {aspectRatio: options.aspectRatio} : {}),
            ...(options.lazyLoad !== undefined ? {lazyLoad: options.lazyLoad} : {}),
            ...(options.lightbox !== undefined ? {lightbox: options.lightbox} : {})
        }
    })
}

export function iconBlock(
    iconClass: string,
    options: {
        size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
        color?: string
        spin?: boolean
        fixedWidth?: boolean
        classes?: string[]
    } = {}
): Block {
    return createTemplateBlock('icon', {
        classes: options.classes ?? [],
        props: {
            iconClass,
            ...(options.size ? {size: options.size} : {}),
            ...(options.color ? {color: options.color} : {}),
            ...(options.spin !== undefined ? {spin: options.spin} : {}),
            ...(options.fixedWidth !== undefined ? {fixedWidth: options.fixedWidth} : {})
        }
    })
}

export function buttonBlock(
    text: string,
    options: {
        href?: string
        target?: '_self' | '_blank'
        variant?: string
        size?: '' | 'btn-sm' | 'btn-lg'
        iconLeft?: string
        iconRight?: string
        outline?: boolean
        block?: boolean
        loading?: boolean
        loadingText?: string
        disabled?: boolean
        fontFamily?: string
        classes?: string[]
    } = {}
): Block {
    return createTemplateBlock('button', {
        classes: options.classes ?? ['btn', options.variant ?? 'btn-primary'],
        props: {
            text,
            type: 'button',
            ...(options.href ? {href: options.href} : {}),
            ...(options.target ? {target: options.target} : {}),
            ...(options.variant ? {variant: options.variant} : {}),
            ...(options.size !== undefined ? {size: options.size} : {}),
            ...(options.iconLeft ? {iconLeft: options.iconLeft} : {}),
            ...(options.iconRight ? {iconRight: options.iconRight} : {}),
            ...(options.outline !== undefined ? {outline: options.outline} : {}),
            ...(options.block !== undefined ? {block: options.block} : {}),
            ...(options.loading !== undefined ? {loading: options.loading} : {}),
            ...(options.loadingText ? {loadingText: options.loadingText} : {}),
            ...(options.disabled !== undefined ? {disabled: options.disabled} : {}),
            ...(options.fontFamily ? {fontFamily: options.fontFamily} : {})
        }
    })
}

export function linkBlock(
    text: string,
    href: string,
    options: {
        target?: '_self' | '_blank'
        newTab?: boolean
        button?: boolean
        variant?: string
        iconLeft?: string
        iconRight?: string
        classes?: string[]
    } = {}
): Block {
    return createTemplateBlock('link', {
        classes: options.classes ?? [],
        props: {
            text,
            href,
            ...(options.target ? {target: options.target} : {}),
            ...(options.newTab !== undefined ? {newTab: options.newTab} : {}),
            ...(options.button !== undefined ? {button: options.button} : {}),
            ...(options.variant ? {variant: options.variant} : {}),
            ...(options.iconLeft ? {iconLeft: options.iconLeft} : {}),
            ...(options.iconRight ? {iconRight: options.iconRight} : {})
        }
    })
}

export function listBlock(
    items: string[],
    options: {
        ordered?: boolean
        listStyle?: 'disc' | 'circle' | 'square' | 'none'
        horizontal?: boolean
        fontFamily?: string
        classes?: string[]
    } = {}
): Block {
    return createTemplateBlock('list', {
        classes: options.classes ?? [],
        props: {
            items,
            ...(options.ordered !== undefined ? {ordered: options.ordered} : {}),
            ...(options.listStyle ? {listStyle: options.listStyle} : {}),
            ...(options.horizontal !== undefined ? {horizontal: options.horizontal} : {}),
            ...(options.fontFamily ? {fontFamily: options.fontFamily} : {})
        }
    })
}

export function blockquoteBlock(
    text: string,
    options: {
        footer?: string
        author?: string
        source?: string
        decorative?: 'none' | 'border-left' | 'large-quote'
        fontFamily?: string
        classes?: string[]
    } = {}
): Block {
    return createTemplateBlock('blockquote', {
        classes: options.classes ?? ['blockquote'],
        props: {
            text,
            ...(options.footer ? {footer: options.footer} : {}),
            ...(options.author ? {author: options.author} : {}),
            ...(options.source ? {source: options.source} : {}),
            ...(options.decorative ? {decorative: options.decorative} : {}),
            ...(options.fontFamily ? {fontFamily: options.fontFamily} : {})
        }
    })
}

export function navbarBlock(children: Block[], classes: string[], props: Record<string, unknown>): Block {
    return createTemplateBlock('navbar', {classes, props, children})
}

export function heroBlock(children: Block[], classes: string[], props: Record<string, unknown>): Block {
    return createTemplateBlock('hero', {classes, props, children})
}

export function footerBlock(children: Block[], classes: string[], props: Record<string, unknown> = {}): Block {
    return createTemplateBlock('footer', {tag: 'footer', classes, props, children})
}

export function testimonialBlock(children: Block[], classes: string[] = ['card', 'text-center']): Block {
    return createTemplateBlock('testimonial', {classes, children})
}

export function ctaSectionBlock(children: Block[], classes: string[] = ['px-4', 'py-5', 'my-5', 'text-center']): Block {
    return createTemplateBlock('cta-section', {classes, children})
}

export function pricingTableBlock(children: Block[], classes: string[] = ['row', 'row-cols-1', 'row-cols-md-3', 'mb-3', 'text-center']): Block {
    return createTemplateBlock('pricing-table', {classes, children})
}

export function carouselBlock(slides: Array<Record<string, unknown>>, classes: string[] = ['carousel', 'slide']): Block {
    return createTemplateBlock('carousel', {
        classes,
        props: {
            id: `template-carousel-${Math.random().toString(36).slice(2, 9)}`,
            slides,
            transition: 'slide',
            imageHeightMode: 'fixed',
            imageHeight: '20rem',
            fade: false,
            thumbnails: true,
            interval: 5500
        }
    })
}

export function formBlock(children: Block[], options: {layout?: 'vertical' | 'horizontal' | 'inline'; validated?: boolean; action?: string; method?: 'get' | 'post'; classes?: string[]} = {}): Block {
    return createTemplateBlock('form', {
        classes: options.classes ?? [],
        props: {
            ...(options.action ? {action: options.action} : {}),
            ...(options.method ? {method: options.method} : {}),
            ...(options.layout ? {layout: options.layout} : {}),
            ...(options.validated !== undefined ? {validated: options.validated} : {})
        },
        children
    })
}

export function inputBlock(options: {
    type?: 'text' | 'email' | 'password' | 'number'
    placeholder?: string
    name?: string
    label?: string
    prepend?: string
    append?: string
    floatingLabel?: boolean
    validationState?: 'none' | 'valid' | 'invalid'
    validationMessage?: string
    helpText?: string
    classes?: string[]
} = {}): Block {
    return createTemplateBlock('input', {
        classes: options.classes ?? ['form-control', 'mb-3'],
        props: {
            ...(options.type ? {type: options.type} : {}),
            ...(options.placeholder ? {placeholder: options.placeholder} : {}),
            ...(options.name ? {name: options.name} : {}),
            ...(options.label ? {label: options.label} : {}),
            ...(options.prepend ? {prepend: options.prepend} : {}),
            ...(options.append ? {append: options.append} : {}),
            ...(options.floatingLabel !== undefined ? {floatingLabel: options.floatingLabel} : {}),
            ...(options.validationState ? {validationState: options.validationState} : {}),
            ...(options.validationMessage ? {validationMessage: options.validationMessage} : {}),
            ...(options.helpText ? {helpText: options.helpText} : {})
        }
    })
}

export function textareaBlock(options: {rows?: number; placeholder?: string; name?: string; classes?: string[]} = {}): Block {
    return createTemplateBlock('textarea', {
        classes: options.classes ?? ['form-control', 'mb-3'],
        props: {
            ...(options.rows !== undefined ? {rows: options.rows} : {}),
            ...(options.placeholder ? {placeholder: options.placeholder} : {}),
            ...(options.name ? {name: options.name} : {})
        }
    })
}

export function checkboxBlock(options: {label?: string; name?: string; checked?: boolean; switch?: boolean; inline?: boolean; classes?: string[]} = {}): Block {
    return createTemplateBlock('checkbox', {
        classes: options.classes ?? ['form-check-input'],
        props: {
            ...(options.label ? {label: options.label} : {}),
            ...(options.name ? {name: options.name} : {}),
            ...(options.checked !== undefined ? {checked: options.checked} : {}),
            ...(options.switch !== undefined ? {switch: options.switch} : {}),
            ...(options.inline !== undefined ? {inline: options.inline} : {})
        }
    })
}

export function pageListBlock(props: Record<string, unknown>, classes: string[] = []): Block {
    return createTemplateBlock('page-list', {classes, props})
}

export function accordionBlock(props: Record<string, unknown>, classes: string[] = ['accordion']): Block {
    return createTemplateBlock('accordion', {classes, props})
}

export function tableBlock(props: Record<string, unknown>, classes: string[] = []): Block {
    return createTemplateBlock('table', {classes, props})
}

export function codeBlock(props: Record<string, unknown>, classes: string[] = ['bg-dark', 'text-light', 'p-3', 'rounded', 'position-relative']): Block {
    return createTemplateBlock('code-block', {classes, props})
}
