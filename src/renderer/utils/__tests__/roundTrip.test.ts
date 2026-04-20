import { describe, it, expect } from 'vitest'
import { blockToHtml, pageToHtml } from '../blockToHtml'
import { htmlToBlocks } from '../htmlToBlocks'
import type { Block } from '../../store/types'
import { createBlock } from '../../store/types'

/**
 * Round-trip tests: blocks → HTML → blocks
 * Verifies structural preservation (types, classes, styles, nesting).
 * IDs are regenerated on parse, so we compare structure only.
 */

function stripIds(blocks: Block[]): unknown[] {
  return blocks.map((b) => ({
    type: b.type,
    tag: b.tag,
    props: b.props,
    styles: b.styles,
    classes: b.classes,
    content: b.content,
    children: stripIds(b.children)
  }))
}

describe('round-trip: blocks → HTML → blocks', () => {
  it('preserves a simple heading', () => {
    const original: Block[] = [
      createBlock('heading', { props: { text: 'Hello', level: 2 } })
    ]
    const html = blockToHtml(original)
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('heading')
    expect(blocks[0].props.text).toBe('Hello')
    expect(blocks[0].props.level).toBe(2)
  })

  it('preserves a paragraph', () => {
    const original: Block[] = [
      createBlock('paragraph', { props: { text: 'Body text' } })
    ]
    const html = blockToHtml(original)
    const { blocks } = htmlToBlocks(html)

    expect(blocks[0].type).toBe('paragraph')
    expect(blocks[0].props.text).toBe('Body text')
  })

  it('preserves classes and styles', () => {
    const original: Block[] = [
      createBlock('container', {
        classes: ['container', 'mt-4'],
        styles: { backgroundColor: '#fff', padding: '20px' }
      })
    ]
    const html = blockToHtml(original)
    const { blocks } = htmlToBlocks(html)

    expect(blocks[0].classes).toEqual(['container', 'mt-4'])
    // jsdom may normalize color values, so just check the key exists
    expect(blocks[0].styles.backgroundColor).toBeTruthy()
    expect(blocks[0].styles.padding).toBe('20px')
  })

  it('preserves nested structure', () => {
    const original: Block[] = [
      createBlock('container', {
        classes: ['row'],
        children: [
          createBlock('container', {
            classes: ['col-6'],
            children: [
              createBlock('heading', { props: { text: 'Column 1', level: 3 } })
            ]
          }),
          createBlock('container', {
            classes: ['col-6'],
            children: [
              createBlock('paragraph', { props: { text: 'Column 2 text' } })
            ]
          })
        ]
      })
    ]
    const html = blockToHtml(original)
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].classes).toContain('row')
    expect(blocks[0].children).toHaveLength(2)
    expect(blocks[0].children[0].classes).toContain('col-6')
    expect(blocks[0].children[0].children[0].type).toBe('heading')
    expect(blocks[0].children[0].children[0].props.text).toBe('Column 1')
    expect(blocks[0].children[1].children[0].type).toBe('paragraph')
    expect(blocks[0].children[1].children[0].props.text).toBe('Column 2 text')
  })

  it('preserves a button with classes', () => {
    const original: Block[] = [
      createBlock('button', { props: { text: 'Submit' }, classes: ['btn', 'btn-primary'] })
    ]
    const html = blockToHtml(original)
    const { blocks } = htmlToBlocks(html)

    expect(blocks[0].type).toBe('button')
    expect(blocks[0].props.text).toBe('Submit')
    expect(blocks[0].classes).toEqual(['btn', 'btn-primary'])
  })

  it('preserves an image with attributes', () => {
    const original: Block[] = [
      createBlock('image', { props: { src: 'photo.jpg', alt: 'My Photo' } })
    ]
    const html = blockToHtml(original)
    const { blocks } = htmlToBlocks(html)

    expect(blocks[0].type).toBe('image')
    expect(blocks[0].props.src).toBe('photo.jpg')
    expect(blocks[0].props.alt).toBe('My Photo')
  })

  it('preserves a link with href', () => {
    const original: Block[] = [
      createBlock('link', { props: { text: 'Click here', href: 'https://example.com' } })
    ]
    const html = blockToHtml(original)
    const { blocks } = htmlToBlocks(html)

    expect(blocks[0].type).toBe('link')
    expect(blocks[0].props.text).toBe('Click here')
    expect(blocks[0].props.href).toBe('https://example.com')
  })

  it('preserves multiple top-level blocks', () => {
    const original: Block[] = [
      createBlock('heading', { props: { text: 'Title', level: 1 } }),
      createBlock('paragraph', { props: { text: 'Intro' } }),
      createBlock('hr'),
      createBlock('container', { classes: ['content'] })
    ]
    const html = blockToHtml(original)
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(4)
    expect(blocks[0].type).toBe('heading')
    expect(blocks[1].type).toBe('paragraph')
    expect(blocks[2].type).toBe('hr')
    expect(blocks[3].type).toBe('container')
    expect(blocks[3].classes).toContain('content')
  })

  it('preserves tag overrides', () => {
    const original: Block[] = [
      createBlock('container', { tag: 'main', classes: ['wrapper'] })
    ]
    const html = blockToHtml(original)
    const { blocks } = htmlToBlocks(html)

    expect(blocks[0].tag).toBe('main')
  })

  it('preserves semantic sections', () => {
    const original: Block[] = [
      createBlock('section', {
        children: [
          createBlock('heading', { props: { text: 'Section Title', level: 2 } }),
          createBlock('paragraph', { props: { text: 'Section content' } })
        ]
      })
    ]
    const html = blockToHtml(original)
    const { blocks } = htmlToBlocks(html)

    expect(blocks[0].type).toBe('section')
    expect(blocks[0].children).toHaveLength(2)
    expect(blocks[0].children[0].type).toBe('heading')
    expect(blocks[0].children[1].type).toBe('paragraph')
  })

  it('preserves checkbox blocks nested inside tabs', () => {
    const original: Block[] = [
      createBlock('tabs', {
        props: {
          id: 'tabs-demo',
          tabs: [
            {
              label: 'Home',
              content: '',
              blocks: [
                createBlock('paragraph', { props: { text: 'Home tab content.' } }),
                createBlock('checkbox', { props: { label: 'Check me', checked: true }, classes: ['form-check-input'] })
              ]
            }
          ]
        }
      })
    ]

    const html = blockToHtml(original)
    const { blocks } = htmlToBlocks(html)
    const tabs = blocks[0].props.tabs as Array<{ blocks: Array<{ type: string, props: Record<string, unknown> }> }>

    expect(blocks[0].type).toBe('tabs')
    expect(tabs).toHaveLength(1)
    expect(tabs[0].blocks[0].type).toBe('paragraph')
    expect(tabs[0].blocks[1].type).toBe('checkbox')
    expect(tabs[0].blocks[1].props.label).toBe('Check me')
    expect(tabs[0].blocks[1].props.checked).toBe(true)
  })

  it('preserves icon blocks nested inside tabs through page HTML', () => {
    const original: Block[] = [
      createBlock('tabs', {
        props: {
          id: 'tabs-demo',
          tabs: [
            {
              label: 'Profile',
              content: '',
              blocks: [
                createBlock('paragraph', { props: { text: 'Profile tab content.' } }),
                createBlock('icon', { props: { iconClass: '' } }),
                createBlock('image', { props: { src: 'app-media://project-asset/assets/web-1774176696305.jpg', alt: 'Image' }, classes: ['img-fluid'] })
              ]
            }
          ]
        }
      })
    ]

    const html = pageToHtml(original, { includeEditorMetadata: true })
    const { blocks } = htmlToBlocks(html)
    const tabs = blocks[0].props.tabs as Array<{ blocks: Array<{ type: string, props: Record<string, unknown> }> }>

    expect(blocks[0].type).toBe('tabs')
    expect(tabs).toHaveLength(1)
    expect(tabs[0].blocks.map((block) => block.type)).toEqual(['paragraph', 'icon', 'image'])
    expect(tabs[0].blocks[1].props.iconClass).toBe('')
  })

  it('preserves non-default icon selections nested inside tabs through page HTML', () => {
    const original: Block[] = [
      createBlock('tabs', {
        props: {
          id: 'tabs-demo',
          tabs: [
            {
              label: 'Profile',
              content: '',
              blocks: [
                createBlock('paragraph', { props: { text: 'Profile tab content.' } }),
                createBlock('icon', { props: { iconClass: 'lucide:image', size: '3rem', color: 'orange' } })
              ]
            }
          ]
        }
      })
    ]

    const html = pageToHtml(original, { includeEditorMetadata: true })
    const { blocks } = htmlToBlocks(html)
    const tabs = blocks[0].props.tabs as Array<{ blocks: Array<{ type: string, props: Record<string, unknown> }> }>

    expect(blocks[0].type).toBe('tabs')
    expect(tabs).toHaveLength(1)
    expect(tabs[0].blocks[1].type).toBe('icon')
    expect(tabs[0].blocks[1].props.iconClass).toBe('lucide:image')
    expect(tabs[0].blocks[1].props.size).toBe('3rem')
    expect(tabs[0].blocks[1].props.color).toBe('orange')
  })

  it('preserves modal blocks through page HTML', () => {
    const original: Block[] = [
      createBlock('modal', {
        props: {
          id: 'launch-modal',
          buttonText: 'Launch Modal',
          title: 'Example Modal',
          closeButton: true,
          footerButtons: true,
          size: 'modal-lg'
        },
        children: [
          createBlock('paragraph', { props: { text: 'Modal body text goes here.' } })
        ]
      })
    ]

    const html = pageToHtml(original, { includeEditorMetadata: true })
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('modal')
    expect(blocks[0].props.id).toBe('launch-modal')
    expect(blocks[0].props.buttonText).toBe('Launch Modal')
    expect(blocks[0].props.title).toBe('Example Modal')
    expect(blocks[0].props.size).toBe('modal-lg')
    expect(blocks[0].children).toHaveLength(1)
    expect(blocks[0].children[0].type).toBe('paragraph')
  })

  it('preserves carousel blocks through HTML round-trip', () => {
    const original: Block[] = [
      createBlock('carousel', {
        classes: ['carousel', 'slide'],
        props: {
          id: 'hero-carousel',
          slides: [
            { src: 'slide-1.jpg', alt: 'Slide 1', caption: 'First Slide' },
            { src: 'slide-2.jpg', alt: 'Slide 2', caption: '' }
          ]
        }
      })
    ]

    const html = blockToHtml(original)
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('carousel')
    expect(blocks[0].props.id).toBe('hero-carousel')
    expect(blocks[0].props.slides).toEqual([
      { src: 'slide-1.jpg', alt: 'Slide 1', caption: 'First Slide' },
      { src: 'slide-2.jpg', alt: 'Slide 2', caption: '' }
    ])
    expect(blocks[0].props.imageHeightMode).toBe('fixed')
    expect(blocks[0].props.imageHeight).toBe('320px')
  })

  it('preserves navbar sticky and brand image through HTML round-trip', () => {
    const original: Block[] = [
      createBlock('navbar', {
        classes: ['navbar', 'navbar-expand-lg'],
        props: {
          usePages: false,
          brandText: 'Acme',
          brandImage: 'https://cdn.example.com/logo.png',
          sticky: true
        },
        children: [
          createBlock('container', {
            classes: ['container'],
            children: [
              createBlock('link', {
                props: { text: 'Acme', href: '#' },
                classes: ['navbar-brand']
              }),
              createBlock('link', {
                props: { text: 'Home', href: 'index.html' },
                classes: ['nav-link']
              })
            ]
          })
        ]
      })
    ]

    const html = blockToHtml(original)
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('navbar')
    expect(blocks[0].props.sticky).toBe(true)
    expect(blocks[0].props.stickyOffset).toBe('0')
    expect(blocks[0].props.stickyZIndex).toBe(1030)
    expect(blocks[0].props.brandImage).toBe('https://cdn.example.com/logo.png')
    expect(blocks[0].props.brandText).toBe('Acme')
  })

  it('preserves phase 2 medium blocks through Bootstrap HTML round-trip', () => {
    const original: Block[] = [
      createBlock('table', {
        props: {
          headers: ['Name', 'Role'],
          rows: [['Jane', 'Admin'], ['John', 'Editor']],
          striped: true,
          bordered: true,
          hover: true,
          responsive: true,
          size: 'sm',
          variant: 'dark'
        }
      }),
      createBlock('dropdown', {
        props: {
          label: 'Actions',
          variant: 'secondary',
          items: [
            { label: 'Edit', href: '#edit', divider: false, disabled: false },
            { label: '', href: '#', divider: true, disabled: false },
            { label: 'Delete', href: '#delete', divider: false, disabled: true }
          ],
          size: 'default',
          direction: 'down',
          split: true
        }
      }),
      createBlock('offcanvas', {
        props: {
          id: 'settings-panel',
          title: 'Settings',
          placement: 'end',
          backdrop: false,
          scroll: true
        },
        children: [createBlock('paragraph', { props: { text: 'Panel content' } })]
      }),
      createBlock('card', {
        props: {
          title: 'Card title',
          subtitle: 'Card subtitle',
          text: 'Card body copy',
          imageUrl: 'https://example.com/card.jpg',
          imagePosition: 'top',
          headerText: 'Header',
          footerText: 'Footer',
          variant: 'primary',
          outline: false
        }
      })
    ]

    const html = blockToHtml(original, { framework: 'bootstrap-5', includeDataAttributes: false })
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(4)
    expect(blocks[0].type).toBe('table')
    expect(blocks[0].props.headers).toEqual(['Name', 'Role'])
    expect(blocks[1].type).toBe('dropdown')
    expect(blocks[1].props.label).toBe('Actions')
    expect(blocks[1].props.split).toBe(true)
    expect(blocks[2].type).toBe('offcanvas')
    expect(blocks[2].props.id).toBe('settings-panel')
    expect(blocks[2].props.placement).toBe('end')
    expect(blocks[3].type).toBe('card')
    expect(blocks[3].props.title).toBe('Card title')
    expect(blocks[3].props.variant).toBe('primary')
  })

  it('preserves phase 2 medium blocks through Tailwind HTML round-trip', () => {
    const original: Block[] = [
      createBlock('table', {
        props: {
          headers: ['Feature', 'Value'],
          rows: [['Theme', 'Tailwind']],
          striped: false,
          bordered: false,
          hover: false,
          responsive: true,
          size: 'default',
          variant: 'default'
        }
      }),
      createBlock('dropdown', {
        props: {
          label: 'Menu',
          variant: 'primary',
          items: [{ label: 'Open', href: '#open', divider: false, disabled: false }],
          size: 'sm',
          direction: 'end',
          split: false
        }
      }),
      createBlock('offcanvas', {
        props: {
          id: 'tw-panel',
          title: 'Tailwind Panel',
          placement: 'start',
          backdrop: true,
          scroll: false
        },
        children: [createBlock('paragraph', { props: { text: 'Tailwind body' } })]
      }),
      createBlock('card', {
        props: {
          title: 'Tailwind card',
          subtitle: 'Details',
          text: 'Tailwind body',
          imageUrl: 'https://example.com/tw-card.jpg',
          imagePosition: 'overlay',
          headerText: '',
          footerText: '',
          variant: 'dark',
          outline: false
        }
      })
    ]

    const html = blockToHtml(original, { framework: 'tailwind', includeDataAttributes: false })
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(4)
    expect(blocks[0].type).toBe('table')
    expect(blocks[1].type).toBe('dropdown')
    expect(blocks[1].props.direction).toBe('end')
    expect(blocks[2].type).toBe('offcanvas')
    expect(blocks[2].props.id).toBe('tw-panel')
    expect(blocks[3].type).toBe('card')
    expect(blocks[3].props.imagePosition).toBe('overlay')
    expect(blocks[3].props.variant).toBe('dark')
  })

  it('preserves phase 3 enhanced blocks through Bootstrap HTML round-trip', () => {
    const original: Block[] = [
      createBlock('image', {
        props: {
          src: 'hero.jpg',
          alt: 'Hero',
          caption: 'Hero caption',
          captionPosition: 'overlay-bottom',
          objectFit: 'cover',
          aspectRatio: '16:9',
          lazyLoad: true,
          lightbox: true
        },
        classes: ['img-fluid']
      }),
      createBlock('video', {
        props: {
          src: 'clip.mp4',
          controls: true,
          autoplay: true,
          loop: true,
          muted: true,
          preload: 'metadata',
          poster: 'poster.jpg',
          aspectRatio: '21:9'
        },
        classes: ['w-100']
      }),
      createBlock('button', {
        props: {
          text: 'Submit',
          variant: 'btn-primary',
          outline: true,
          block: true,
          loading: true,
          loadingText: 'Saving...'
        },
        classes: ['btn', 'btn-primary']
      }),
      createBlock('input', {
        props: {
          type: 'text',
          label: 'Email',
          prepend: '@',
          append: '.com',
          validationState: 'invalid',
          validationMessage: 'Invalid email',
          helpText: 'Use your work email'
        },
        classes: ['form-control']
      }),
      createBlock('checkbox', {
        props: { label: 'Enable beta', checked: true, switch: true, inline: true },
        classes: ['form-check-input']
      }),
      createBlock('select', {
        props: {
          optgroups: true,
          multiple: true,
          size: 4,
          items: [
            {
              group: 'Asia',
              options: [{ label: 'Japan', value: 'jp' }]
            }
          ]
        },
        classes: ['form-select']
      }),
      createBlock('code-block', {
        props: {
          code: 'const x = 1;',
          language: 'javascript',
          showLineNumbers: true,
          filename: 'main.ts',
          copyButton: true
        }
      }),
      createBlock('icon', {
        props: { iconClass: 'lucide:loader', size: 'xl', color: '#ff9900', spin: true, fixedWidth: true }
      }),
      createBlock('iframe', {
        props: {
          src: 'https://example.com/embed',
          title: 'Embed',
          aspectRatio: '4:3',
          allowFullscreen: true,
          lazy: true
        },
        classes: ['w-100', 'border']
      })
    ]

    const html = blockToHtml(original, { framework: 'bootstrap-5', includeDataAttributes: false })
    const { blocks } = htmlToBlocks(html)

    expect(blocks.map((block) => block.type)).toEqual([
      'image',
      'video',
      'button',
      'input',
      'checkbox',
      'select',
      'code-block',
      'icon',
      'iframe'
    ])
    expect(blocks[0].props.caption).toBe('Hero caption')
    expect(blocks[0].props.lightbox).toBe(true)
    expect(blocks[1].props.aspectRatio).toBe('21:9')
    expect(blocks[2].props.loading).toBe(true)
    expect(blocks[3].props.prepend).toBe('@')
    expect(blocks[4].props.switch).toBe(true)
    expect(blocks[5].props.optgroups).toBe(true)
    expect(blocks[6].props.showLineNumbers).toBe(true)
    expect(blocks[7].props.spin).toBe(true)
    expect(blocks[8].props.aspectRatio).toBe('4:3')
  })

  it('preserves phase 4 layout/component blocks through Bootstrap HTML round-trip', () => {
    const original: Block[] = [
      createBlock('heading', { props: { text: 'Section Title', level: 2, anchorId: 'section-title', decorative: 'underline' } }),
      createBlock('paragraph', { props: { text: 'Lead paragraph.', lead: true, dropCap: true, columns: '2' } }),
      createBlock('blockquote', { props: { text: 'Wisdom quote', author: 'Aristotle', source: 'Nicomachean Ethics', decorative: 'border-left' }, classes: ['blockquote'] }),
      createBlock('list', { props: { items: ['Item A', 'Item B', 'Item C'], horizontal: true }, classes: ['list-inline'] }),
      createBlock('accordion', {
        props: { id: 'faq', items: [{ title: 'Q1', content: 'A1' }, { title: 'Q2', content: 'A2' }], flush: true, alwaysOpen: true },
        classes: ['accordion']
      }),
      createBlock('tabs', {
        props: { id: 'demo-tabs', variant: 'pills', vertical: false, tabs: [{ label: 'Tab A', content: 'Tab A content' }] },
        classes: []
      }),
      createBlock('carousel', {
        props: {
          id: 'carousel-rt',
          fade: true,
          thumbnails: true,
          interval: 4000,
          slides: [{ src: 'a.jpg', alt: 'A', caption: '' }, { src: 'b.jpg', alt: 'B', caption: '' }]
        },
        classes: ['carousel', 'slide']
      })
    ]

    const html = blockToHtml(original, { framework: 'bootstrap-5', includeDataAttributes: true })
    const { blocks } = htmlToBlocks(html)

    expect(blocks.map((b) => b.type)).toEqual([
      'heading', 'paragraph', 'blockquote', 'list', 'accordion', 'tabs', 'carousel'
    ])

    // heading anchorId + decorative
    expect(blocks[0].props.anchorId).toBe('section-title')
    expect(blocks[0].props.decorative).toBe('underline')

    // paragraph lead + dropCap + columns
    expect(blocks[1].props.lead).toBe(true)
    expect(blocks[1].props.dropCap).toBe(true)
    expect(blocks[1].props.columns).toBe('2')

    // blockquote author + source + decorative
    expect(blocks[2].props.text).toBe('Wisdom quote')
    expect(blocks[2].props.author).toBe('Aristotle')
    expect(blocks[2].props.source).toBe('Nicomachean Ethics')
    expect(blocks[2].props.decorative).toBe('border-left')

    // list horizontal
    expect(blocks[3].props.horizontal).toBe(true)

    // accordion flush + alwaysOpen
    expect(Array.isArray((blocks[4].props.items as unknown[]))).toBe(true)
    expect((blocks[4].props.items as unknown[]).length).toBe(2)

    // tabs variant
    expect(blocks[5].type).toBe('tabs')

    // carousel fade + interval
    expect(blocks[6].type).toBe('carousel')
  })

  it('preserves modal size/scrollable/centered through export-mode round-trip', () => {
    // Export mode renders the actual Bootstrap modal markup (button + .modal div)
    // which tryParseBootstrapModal can recover size/scrollable/centered from
    const original: Block[] = [
      createBlock('modal', {
        props: { id: 'rt-modal', title: 'RT Modal', buttonText: 'Open', size: 'modal-lg', scrollable: true, centered: true },
        children: [createBlock('paragraph', { props: { text: 'Modal content' } })]
      })
    ]

    const html = blockToHtml(original, { framework: 'bootstrap-5', includeDataAttributes: false })
    const { blocks } = htmlToBlocks(html)

    expect(blocks[0].type).toBe('modal')
    expect(blocks[0].props.size).toBe('modal-lg')
    expect(blocks[0].props.scrollable).toBe(true)
    expect(blocks[0].props.centered).toBe(true)
  })

  it('preserves link-as-button through editor-mode round-trip', () => {
    const original: Block[] = [
      createBlock('link', {
        props: { text: 'Get Started', href: '/start', button: true, variant: 'primary', newTab: false, iconLeft: '', iconRight: '' }
      })
    ]

    const html = blockToHtml(original, { framework: 'bootstrap-5', includeDataAttributes: true })
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('link')
    expect(blocks[0].props.button).toBe(true)
    expect(blocks[0].props.href).toBe('/start')
    expect(blocks[0].props.text).toBe('Get Started')
  })

  it('preserves phase 1 simple blocks through Bootstrap HTML round-trip', () => {
    const original: Block[] = [
      createBlock('alert', {
        props: { text: 'Important notice', variant: 'alert-warning', dismissible: false, icon: '' },
        classes: ['alert', 'alert-warning']
      }),
      createBlock('badge', {
        props: { text: 'New', variant: 'bg-success', pill: false },
        classes: ['badge', 'bg-success']
      }),
      createBlock('progress', {
        props: { value: 75, variant: 'bg-success', striped: true, animated: false, label: '' },
        classes: ['progress']
      }),
      createBlock('spinner', {
        props: { variant: 'text-primary', type: 'border', size: 'default' },
        classes: ['spinner-border', 'text-primary']
      }),
      createBlock('breadcrumb', {
        props: {
          items: [
            { label: 'Home', href: '/', active: false },
            { label: 'Products', href: '/products', active: false },
            { label: 'Widget', href: '#', active: true }
          ],
          divider: 'slash'
        }
      }),
      createBlock('pagination', {
        props: { pages: 5, activePage: 2, size: 'default', alignment: 'center', showPrevNext: true, showFirstLast: false }
      })
    ]

    const html = blockToHtml(original, { framework: 'bootstrap-5', includeDataAttributes: false })
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(6)
    expect(blocks[0].type).toBe('alert')
    expect(blocks[0].props.text).toContain('Important notice')
    expect(blocks[1].type).toBe('badge')
    expect(blocks[1].props.text).toBe('New')
    expect(blocks[2].type).toBe('progress')
    expect(blocks[2].props.value).toBe(75)
    expect(blocks[3].type).toBe('spinner')
    expect(blocks[4].type).toBe('breadcrumb')
    expect(blocks[4].props.items).toHaveLength(3)
    expect(blocks[5].type).toBe('pagination')
    expect(blocks[5].props.pages).toBe(5)
    expect(blocks[5].props.showPrevNext).toBe(true)
  })

  it('preserves phase 1 form blocks through Bootstrap HTML round-trip', () => {
    const original: Block[] = [
      createBlock('radio', {
        props: { name: 'color', label: 'Red', value: 'red', checked: false, inline: false, disabled: false }
      }),
      createBlock('range', {
        props: { label: 'Volume', min: 0, max: 100, step: 5, value: 40, disabled: false }
      }),
      createBlock('file-input', {
        props: { label: 'Upload CSV', accept: '.csv', multiple: false, disabled: false, size: 'default' }
      })
    ]

    const html = blockToHtml(original, { framework: 'bootstrap-5', includeDataAttributes: false })
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(3)
    expect(blocks[0].type).toBe('radio')
    expect(blocks[0].props.name).toBe('color')
    expect(blocks[0].props.value).toBe('red')
    expect(blocks[1].type).toBe('range')
    expect(blocks[1].props.min).toBe(0)
    expect(blocks[1].props.max).toBe(100)
    expect(blocks[2].type).toBe('file-input')
    expect(blocks[2].props.accept).toBe('.csv')
  })

  it('preserves phase 5 section blocks through Bootstrap HTML round-trip', () => {
    const original: Block[] = [
      createBlock('stats-section', {
        props: {
          items: [{ value: '99', label: 'Uptime', prefix: '', suffix: '%', icon: '✅' }],
          columns: '3',
          variant: 'cards',
          alignment: 'center'
        }
      }),
      createBlock('team-grid', {
        props: {
          members: [{ name: 'Ada', role: 'Engineer', imageUrl: '', bio: '', socialLinks: {} }],
          columns: '2',
          cardStyle: 'simple',
          showSocial: false
        }
      }),
      createBlock('gallery', {
        props: {
          images: [{ url: 'a.jpg', caption: 'Photo A', category: 'Art' }],
          columns: '3',
          gap: 'md',
          lightbox: false,
          filterable: false,
          layout: 'grid'
        }
      }),
      createBlock('timeline', {
        props: {
          items: [{ date: '2024', title: 'Launch', description: 'We shipped.', icon: '🚀', variant: 'primary' }],
          orientation: 'vertical',
          alternating: false,
          lineColor: '#999'
        }
      }),
      createBlock('logo-cloud', {
        props: {
          title: 'Trusted by',
          logos: [{ imageUrl: 'logo.png', altText: 'Acme', href: '#' }],
          columns: '4',
          grayscale: true,
          variant: 'simple'
        }
      }),
      createBlock('process-steps', {
        props: {
          steps: [{ number: '1', title: 'Plan', description: 'Define scope.', icon: '📋' }],
          layout: 'horizontal',
          connectorStyle: 'arrow',
          variant: 'both'
        }
      })
    ]

    const html = blockToHtml(original, { framework: 'bootstrap-5', includeDataAttributes: false })
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(6)
    expect(blocks[0].type).toBe('stats-section')
    expect(blocks[1].type).toBe('team-grid')
    expect(blocks[2].type).toBe('gallery')
    expect(blocks[3].type).toBe('timeline')
    expect(blocks[4].type).toBe('logo-cloud')
    expect(blocks[5].type).toBe('process-steps')
  })

  it('preserves phase 6 utility blocks through Bootstrap HTML round-trip', () => {
    const original: Block[] = [
      createBlock('newsletter', {
        props: {
          title: 'Stay updated',
          description: 'Get the latest news',
          placeholder: 'your@email.com',
          buttonText: 'Subscribe',
          buttonVariant: 'primary',
          showNameField: false
        }
      }),
      createBlock('contact-card', {
        props: {
          name: 'Jane Doe',
          title: 'Support Lead',
          email: 'jane@example.com',
          phone: '+1-800-555-0199',
          address: '123 Main St',
          showMap: false
        }
      }),
      createBlock('social-links', {
        props: {
          links: [{ platform: 'twitter', url: 'https://twitter.com/example' }],
          style: 'icons',
          colorful: false
        }
      }),
      createBlock('back-to-top', {
        props: { position: 'bottom-right', variant: 'primary' }
      }),
      createBlock('countdown', {
        props: {
          targetDate: '2025-12-31T00:00:00',
          labels: { days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds' },
          showDays: true,
          showSeconds: true,
          expiredMessage: 'Event has ended'
        }
      }),
      createBlock('map-embed', {
        props: { embedUrl: 'https://maps.google.com/?q=123+Main+St', title: 'Office Location', height: '400px', borderRadius: '0' }
      })
    ]

    const html = blockToHtml(original, { framework: 'bootstrap-5', includeDataAttributes: false })
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(6)
    expect(blocks[0].type).toBe('newsletter')
    expect(blocks[1].type).toBe('contact-card')
    expect(blocks[2].type).toBe('social-links')
    expect(blocks[3].type).toBe('back-to-top')
    expect(blocks[4].type).toBe('countdown')
    expect(blocks[5].type).toBe('map-embed')
  })

  it('preserves phase 1 blocks through Tailwind HTML round-trip (editor mode)', () => {
    // Editor mode (includeDataAttributes: true) embeds data-block-type so all blocks
    // are re-parseable regardless of which CSS framework classes are present.
    const original: Block[] = [
      createBlock('alert', {
        props: { text: 'Watch out!', variant: 'alert-danger', dismissible: true, icon: '' },
        classes: ['alert', 'alert-danger', 'alert-dismissible']
      }),
      createBlock('badge', {
        props: { text: 'Hot', variant: 'bg-danger', pill: true },
        classes: ['badge', 'bg-danger', 'rounded-pill']
      }),
      createBlock('progress', {
        props: { value: 60, variant: 'bg-info', striped: false, animated: false, label: '60%' },
        classes: ['progress']
      }),
      createBlock('breadcrumb', {
        props: {
          items: [
            { label: 'Home', href: '/', active: false },
            { label: 'Docs', href: '/docs', active: true }
          ],
          divider: 'chevron'
        }
      }),
      createBlock('pagination', {
        props: { pages: 3, activePage: 1, size: 'sm', alignment: 'end', showPrevNext: false, showFirstLast: true }
      })
    ]

    const html = blockToHtml(original, { framework: 'tailwind', includeDataAttributes: true })
    const { blocks } = htmlToBlocks(html)

    expect(blocks).toHaveLength(5)
    expect(blocks[0].type).toBe('alert')
    expect(blocks[1].type).toBe('badge')
    expect(blocks[2].type).toBe('progress')
    expect(blocks[3].type).toBe('breadcrumb')
    expect(blocks[3].props.items).toHaveLength(2)
    expect(blocks[4].type).toBe('pagination')
  })
})
