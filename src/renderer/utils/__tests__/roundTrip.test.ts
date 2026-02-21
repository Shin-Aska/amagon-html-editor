import { describe, it, expect } from 'vitest'
import { blockToHtml } from '../blockToHtml'
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
})
