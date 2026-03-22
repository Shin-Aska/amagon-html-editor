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

  it('parses bootstrap checkbox markup as a checkbox block', () => {
    const result = htmlToBlocks(`
      <div class="form-check" data-block-id="blk_check_1">
        <input class="form-check-input" type="checkbox" id="blk_check_1" name="consent" checked>
        <label class="form-check-label" for="blk_check_1">
          Check me
        </label>
      </div>
    `)

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].id).toBe('blk_check_1')
    expect(result.blocks[0].type).toBe('checkbox')
    expect(result.blocks[0].classes).toEqual(['form-check-input'])
    expect(result.blocks[0].props.label).toBe('Check me')
    expect(result.blocks[0].props.name).toBe('consent')
    expect(result.blocks[0].props.checked).toBe(true)
  })

  it('preserves checkbox blocks inside bootstrap tab panes', () => {
    const result = htmlToBlocks(`
      <div id="tabs-demo">
        <ul class="nav nav-tabs" id="tabs-demo" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="tabs-demo-tab-0" data-bs-toggle="tab" data-bs-target="#tabs-demo-content-0" type="button" role="tab">
              Home
            </button>
          </li>
        </ul>
        <div class="tab-content" id="tabs-demoContent">
          <div class="tab-pane fade show active" id="tabs-demo-content-0" role="tabpanel">
            <p>Home tab content.</p>
            <div class="form-check">
              <input class="form-check-input" type="checkbox" id="blk_check_2">
              <label class="form-check-label" for="blk_check_2">Check me</label>
            </div>
          </div>
        </div>
      </div>
    `)

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('tabs')
    const tabs = result.blocks[0].props.tabs as Array<{ blocks: Array<{ type: string }> }>
    expect(tabs).toHaveLength(1)
    expect(tabs[0].blocks.map((block) => block.type)).toEqual(['paragraph', 'checkbox'])
  })

  it('parses empty icon placeholders as icon blocks', () => {
    const result = htmlToBlocks(`
      <span
        data-amagon-component="icon"
        data-amagon-icon-class=""
        style="display: inline-flex; align-items: center; justify-content: center; line-height: 1; min-width: 2rem; min-height: 2rem; border: 2px dashed #dee2e6; border-radius: 0.375rem; color: #6c757d"
        title="No icon selected"
      >☆</span>
    `)

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('icon')
    expect(result.blocks[0].props.iconClass).toBe('')
  })

  it('preserves icon blocks inside bootstrap tab panes', () => {
    const result = htmlToBlocks(`
      <div id="tabs-demo">
        <ul class="nav nav-tabs" id="tabs-demo" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="tabs-demo-tab-0" data-bs-toggle="tab" data-bs-target="#tabs-demo-content-0" type="button" role="tab">
              Home
            </button>
          </li>
        </ul>
        <div class="tab-content" id="tabs-demoContent">
          <div class="tab-pane fade show active" id="tabs-demo-content-0" role="tabpanel">
            <p>Profile tab content.</p>
            <span
              data-amagon-component="icon"
              data-amagon-icon-class=""
              style="display: inline-flex; align-items: center; justify-content: center; line-height: 1; min-width: 2rem; min-height: 2rem; border: 2px dashed #dee2e6; border-radius: 0.375rem; color: #6c757d"
              title="No icon selected"
            >☆</span>
            <img class="img-fluid" src="app-media://project-asset/assets/web-1774176696305.jpg" alt="Image" />
          </div>
        </div>
      </div>
    `)

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('tabs')
    const tabs = result.blocks[0].props.tabs as Array<{ blocks: Array<{ type: string }> }>
    expect(tabs).toHaveLength(1)
    expect(tabs[0].blocks.map((block) => block.type)).toEqual(['paragraph', 'icon', 'image'])
  })

  it('parses wrapped bootstrap input controls as input blocks', () => {
    const result = htmlToBlocks(`
      <div class="mb-3">
        <label for="email-field" class="form-label">Email Address</label>
        <input class="form-control mb-3" id="email-field" type="email" name="email" placeholder="name@example.com">
      </div>
    `)

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('input')
    expect(result.blocks[0].classes).toEqual(['form-control', 'mb-3'])
    expect(result.blocks[0].props.type).toBe('email')
    expect(result.blocks[0].props.name).toBe('email')
    expect(result.blocks[0].props.placeholder).toBe('name@example.com')
    expect(result.blocks[0].props.label).toBe('Email Address')
  })

  it('parses bootstrap carousel markup as a carousel block', () => {
    const result = htmlToBlocks(`
      <div id="hero-carousel" class="carousel slide">
        <div class="carousel-indicators">
          <button type="button" data-bs-target="#hero-carousel" data-bs-slide-to="0" class="active"></button>
        </div>
        <div class="carousel-inner">
          <div class="carousel-item active">
            <img src="slide-1.jpg" class="d-block w-100" alt="Slide 1">
            <div class="carousel-caption d-none d-md-block"><h5>First Slide</h5></div>
          </div>
          <div class="carousel-item">
            <img src="slide-2.jpg" class="d-block w-100" alt="Slide 2">
          </div>
        </div>
      </div>
    `)

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('carousel')
    expect(result.blocks[0].props.id).toBe('hero-carousel')
    expect(result.blocks[0].props.slides).toEqual([
      { src: 'slide-1.jpg', alt: 'Slide 1', caption: 'First Slide' },
      { src: 'slide-2.jpg', alt: 'Slide 2', caption: '' }
    ])
  })

  it('parses bootstrap modal trigger and dialog as a single modal block', () => {
    const result = htmlToBlocks(`
      <button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#launch-modal">
        Launch Modal
      </button>
      <div class="modal fade" id="launch-modal" tabindex="-1" aria-labelledby="launch-modalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h1 class="modal-title fs-5" id="launch-modalLabel">Example Modal</h1>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p>Modal body text goes here.</p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
              <button type="button" class="btn btn-primary">Save changes</button>
            </div>
          </div>
        </div>
      </div>
    `)

    expect(result.blocks).toHaveLength(1)
    expect(result.blocks[0].type).toBe('modal')
    expect(result.blocks[0].props.id).toBe('launch-modal')
    expect(result.blocks[0].props.buttonText).toBe('Launch Modal')
    expect(result.blocks[0].props.title).toBe('Example Modal')
    expect(result.blocks[0].props.closeButton).toBe(true)
    expect(result.blocks[0].props.footerButtons).toBe(true)
    expect(result.blocks[0].props.size).toBe('modal-lg')
    expect(result.blocks[0].children).toHaveLength(1)
    expect(result.blocks[0].children[0].type).toBe('paragraph')
  })
})
