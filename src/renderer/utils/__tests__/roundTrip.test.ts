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
  })
})
