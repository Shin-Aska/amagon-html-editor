import { describe, it, expect } from 'vitest'
import { htmlToBlocks } from '../htmlToBlocks'

describe('htmlToBlocks', () => {
  it('parses empty HTML to empty blocks', () => {
    const result = htmlToBlocks('')
    expect(result.blocks).toEqual([])
  })

  it('parses a simple heading', () => {
    const result = htmlToBlocks('<h1>Hello World</h1>')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('heading')
    expect(result.blocks[0].props.text).toBe('Hello World')
    expect(result.blocks[0].props.level).toBe(1)
  })

  it('parses heading levels', () => {
    const result = htmlToBlocks('<h3>Sub Title</h3>')
    expect(result.blocks[0].props.level).toBe(3)
  })

  it('parses a paragraph', () => {
    const result = htmlToBlocks('<p>Some text</p>')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('paragraph')
    expect(result.blocks[0].props.text).toBe('Some text')
  })

  it('parses classes', () => {
    const result = htmlToBlocks('<div class="container mt-4 bg-light"></div>')
    expect(result.blocks[0].classes).toEqual(['container', 'mt-4', 'bg-light'])
  })

  it('parses inline styles', () => {
    const result = htmlToBlocks('<div style="background-color: red; font-size: 16px"></div>')
    expect(result.blocks[0].styles.backgroundColor).toBe('red')
    expect(result.blocks[0].styles.fontSize).toBe('16px')
  })

  it('parses nested elements', () => {
    const result = htmlToBlocks('<div class="row"><div class="col"><p>Nested</p></div></div>')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('container')
    expect(result.blocks[0].children).toHaveLength(1)
    expect(result.blocks[0].children[0].children).toHaveLength(1)
    expect(result.blocks[0].children[0].children[0].type).toBe('paragraph')
  })

  it('parses an image', () => {
    const result = htmlToBlocks('<img src="photo.jpg" alt="A photo" />')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('image')
    expect(result.blocks[0].props.src).toBe('photo.jpg')
    expect(result.blocks[0].props.alt).toBe('A photo')
  })

  it('parses a link', () => {
    const result = htmlToBlocks('<a href="https://example.com" target="_blank">Visit</a>')
    expect(result.blocks[0].type).toBe('link')
    expect(result.blocks[0].props.href).toBe('https://example.com')
    expect(result.blocks[0].props.target).toBe('_blank')
    expect(result.blocks[0].props.text).toBe('Visit')
  })

  it('parses a button', () => {
    const result = htmlToBlocks('<button class="btn btn-primary">Click Me</button>')
    expect(result.blocks[0].type).toBe('button')
    expect(result.blocks[0].props.text).toBe('Click Me')
    expect(result.blocks[0].classes).toEqual(['btn', 'btn-primary'])
  })

  it('parses a list', () => {
    const result = htmlToBlocks('<ul><li>Alpha</li><li>Beta</li></ul>')
    expect(result.blocks[0].type).toBe('list')
    expect(result.blocks[0].props.items).toEqual(['Alpha', 'Beta'])
  })

  it('parses an ordered list', () => {
    const result = htmlToBlocks('<ol><li>First</li><li>Second</li></ol>')
    expect(result.blocks[0].type).toBe('list')
    expect(result.blocks[0].props.ordered).toBe(true)
  })

  it('preserves data-block-id if present', () => {
    const result = htmlToBlocks('<div data-block-id="blk_123"></div>')
    expect(result.blocks[0].id).toBe('blk_123')
  })

  it('generates new IDs when data-block-id is absent', () => {
    const result = htmlToBlocks('<div></div>')
    expect(result.blocks[0].id).toBeTruthy()
    expect(result.blocks[0].id).toMatch(/^blk_/)
  })

  it('skips script and style tags', () => {
    const result = htmlToBlocks('<script>alert("xss")</script><style>body{}</style><p>Keep</p>')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('paragraph')
  })

  it('wraps orphan text in paragraph blocks', () => {
    const result = htmlToBlocks('Just some text')
    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('paragraph')
    expect(result.blocks[0].props.text).toBe('Just some text')
  })

  it('parses multiple top-level elements', () => {
    const result = htmlToBlocks('<h1>Title</h1><p>Body</p><hr />')
    expect(result.blocks).toHaveLength(3)
    expect(result.blocks[0].type).toBe('heading')
    expect(result.blocks[1].type).toBe('paragraph')
    expect(result.blocks[2].type).toBe('hr')
  })

  it('parses semantic tags correctly', () => {
    const result = htmlToBlocks('<section><nav></nav><article></article><footer></footer></section>')
    expect(result.blocks[0].type).toBe('section')
    expect(result.blocks[0].children[0].type).toBe('navbar')
    expect(result.blocks[0].children[1].type).toBe('article')
    expect(result.blocks[0].children[2].type).toBe('footer')
  })

  it('handles malformed HTML gracefully', () => {
    const result = htmlToBlocks('<div><p>Unclosed')
    // DOMParser auto-closes tags, so this should still produce blocks
    expect(result.blocks.length).toBeGreaterThanOrEqual(1)
  })

  it('returns diagnostics array (empty for valid HTML)', () => {
    const result = htmlToBlocks('<p>Valid</p>')
    expect(result.diagnostics).toEqual([])
  })

  it('sets tag override when tag differs from default', () => {
    const result = htmlToBlocks('<section></section>')
    // section's default tag IS 'section', so tag should be undefined
    expect(result.blocks[0].tag).toBeUndefined()

    const result2 = htmlToBlocks('<main></main>')
    // 'main' isn't in TAG_TO_TYPE, so type='container', default tag='div', tag override='main'
    expect(result2.blocks[0].type).toBe('container')
    expect(result2.blocks[0].tag).toBe('main')
  })
})
