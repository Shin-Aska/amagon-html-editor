import { describe, it, expect } from 'vitest'
import { blockToHtml, pageToHtml } from '../blockToHtml'
import type { Block } from '../../store/types'
import { createBlock } from '../../store/types'

describe('blockToHtml', () => {
  it('renders an empty block array as empty string', () => {
    expect(blockToHtml([])).toBe('')
  })

  it('renders a simple heading', () => {
    const blocks: Block[] = [
      createBlock('heading', { props: { text: 'Hello World', level: 1 }, classes: [] })
    ]
    const html = blockToHtml(blocks)
    expect(html).toContain('<h1>')
    expect(html).toContain('Hello World')
    expect(html).toContain('</h1>')
  })

  it('renders heading levels correctly', () => {
    const blocks: Block[] = [
      createBlock('heading', { props: { text: 'Title', level: 3 } })
    ]
    const html = blockToHtml(blocks)
    expect(html).toContain('<h3>')
    expect(html).toContain('</h3>')
  })

  it('renders a paragraph', () => {
    const blocks: Block[] = [
      createBlock('paragraph', { props: { text: 'Some text here' } })
    ]
    const html = blockToHtml(blocks)
    expect(html).toContain('<p>')
    expect(html).toContain('Some text here')
  })

  it('renders classes', () => {
    const blocks: Block[] = [
      createBlock('container', { classes: ['container', 'mt-4', 'bg-light'] })
    ]
    const html = blockToHtml(blocks)
    expect(html).toContain('class="container mt-4 bg-light"')
  })

  it('renders inline styles', () => {
    const blocks: Block[] = [
      createBlock('container', { styles: { backgroundColor: 'red', fontSize: '16px' } })
    ]
    const html = blockToHtml(blocks)
    expect(html).toContain('style="background-color: red; font-size: 16px"')
  })

  it('renders nested children', () => {
    const blocks: Block[] = [
      createBlock('container', {
        classes: ['row'],
        children: [
          createBlock('container', {
            classes: ['col'],
            children: [
              createBlock('paragraph', { props: { text: 'Nested content' } })
            ]
          })
        ]
      })
    ]
    const html = blockToHtml(blocks)
    expect(html).toContain('class="row"')
    expect(html).toContain('class="col"')
    expect(html).toContain('Nested content')
  })

  it('renders void elements self-closing', () => {
    const blocks: Block[] = [
      createBlock('image', { props: { src: 'photo.jpg', alt: 'A photo' } })
    ]
    const html = blockToHtml(blocks)
    expect(html).toContain('<img')
    expect(html).toContain('src="photo.jpg"')
    expect(html).toContain('alt="A photo"')
    expect(html).toContain('/>')
    expect(html).not.toContain('</img>')
  })

  it('renders a horizontal rule', () => {
    const blocks: Block[] = [createBlock('hr')]
    const html = blockToHtml(blocks)
    expect(html).toContain('<hr')
    expect(html).toContain('/>')
  })

  it('renders a list with items', () => {
    const blocks: Block[] = [
      createBlock('list', { props: { items: ['Alpha', 'Beta', 'Gamma'] } })
    ]
    const html = blockToHtml(blocks)
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>Alpha</li>')
    expect(html).toContain('<li>Beta</li>')
    expect(html).toContain('<li>Gamma</li>')
  })

  it('renders button with text', () => {
    const blocks: Block[] = [
      createBlock('button', { props: { text: 'Click Me' }, classes: ['btn', 'btn-primary'] })
    ]
    const html = blockToHtml(blocks)
    expect(html).toContain('<button class="btn btn-primary">Click Me</button>')
  })

  it('renders a link with href', () => {
    const blocks: Block[] = [
      createBlock('link', { props: { text: 'Visit', href: 'https://example.com', target: '_blank' } })
    ]
    const html = blockToHtml(blocks)
    expect(html).toContain('<a')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('Visit')
  })

  it('includes data-block-id when includeDataAttributes is true', () => {
    const block = createBlock('paragraph', { props: { text: 'Test' } })
    const html = blockToHtml([block], { includeDataAttributes: true })
    expect(html).toContain(`data-block-id="${block.id}"`)
  })

  it('excludes data-block-id by default', () => {
    const block = createBlock('paragraph', { props: { text: 'Test' } })
    const html = blockToHtml([block])
    expect(html).not.toContain('data-block-id')
  })

  it('respects tag override', () => {
    const blocks: Block[] = [
      createBlock('container', { tag: 'main' })
    ]
    const html = blockToHtml(blocks)
    expect(html).toContain('<main>')
    expect(html).toContain('</main>')
  })

  it('renders raw-html block content', () => {
    const blocks: Block[] = [
      createBlock('raw-html', { content: '<custom-element>Raw</custom-element>' })
    ]
    const html = blockToHtml(blocks)
    expect(html).toContain('<custom-element>Raw</custom-element>')
  })

  it('escapes attribute values', () => {
    const blocks: Block[] = [
      createBlock('image', { props: { src: 'image.jpg', alt: 'Photo "test" <>&' } })
    ]
    const html = blockToHtml(blocks)
    expect(html).toContain('alt="Photo &quot;test&quot; &lt;&gt;&amp;"')
  })

  it('handles multiple top-level blocks', () => {
    const blocks: Block[] = [
      createBlock('heading', { props: { text: 'Title', level: 1 } }),
      createBlock('paragraph', { props: { text: 'Body' } }),
      createBlock('hr')
    ]
    const html = blockToHtml(blocks)
    const lines = html.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(3)
  })
})

describe('pageToHtml', () => {
  it('generates a full HTML document', () => {
    const blocks: Block[] = [
      createBlock('heading', { props: { text: 'Hello', level: 1 } })
    ]
    const html = pageToHtml(blocks, { title: 'Test Page' })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('<title>Test Page</title>')
    expect(html).toContain('<h1>Hello</h1>')
    expect(html).toContain('</body>')
    expect(html).toContain('</html>')
  })

  it('includes Bootstrap 5 CDN for bootstrap-5 framework', () => {
    const html = pageToHtml([], { framework: 'bootstrap-5' })
    expect(html).toContain('bootstrap@5.3.3')
    expect(html).toContain('bootstrap.min.css')
  })

  it('includes Tailwind CDN for tailwind framework', () => {
    const html = pageToHtml([], { framework: 'tailwind' })
    expect(html).toContain('tailwindcss.com')
  })

  it('includes no framework CSS for vanilla', () => {
    const html = pageToHtml([], { framework: 'vanilla' })
    expect(html).not.toContain('bootstrap')
    expect(html).not.toContain('tailwind')
  })

  it('includes meta tags', () => {
    const html = pageToHtml([], { meta: { description: 'A test page', author: 'Test' } })
    expect(html).toContain('name="description" content="A test page"')
    expect(html).toContain('name="author" content="Test"')
  })
})

describe('page-list block', () => {
  const makePages = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      title: `Post ${i + 1}`,
      slug: `post-${i + 1}`,
      tags: [],
      blocks: [],
      meta: { description: `Description for post ${i + 1}` }
    }))

  it('renders blog post cards from pages', () => {
    const block = createBlock('page-list', {
      props: { filterTag: '', itemsPerPage: 6, columns: 3, showDescription: true }
    })
    const pages = makePages(3)
    const html = blockToHtml([block], { pages })
    expect(html).toContain('Post 1')
    expect(html).toContain('Post 2')
    expect(html).toContain('Post 3')
    expect(html).toContain('card-title')
    expect(html).toContain('href="post-1.html"')
    expect(html).toContain('Description for post 1')
  })

  it('filters pages by tag', () => {
    const block = createBlock('page-list', {
      props: { filterTag: 'news', itemsPerPage: 6, columns: 3, showDescription: true }
    })
    const pages = [
      { id: 'p1', title: 'Tagged', slug: 'tagged', tags: ['news'], blocks: [], meta: {} },
      { id: 'p2', title: 'Not Tagged', slug: 'not-tagged', tags: [], blocks: [], meta: {} }
    ]
    const html = blockToHtml([block], { pages })
    expect(html).toContain('Tagged')
    expect(html).not.toContain('Not Tagged')
  })

  it('renders pagination when pages exceed itemsPerPage', () => {
    const block = createBlock('page-list', {
      props: { filterTag: '', itemsPerPage: 2, columns: 3, showDescription: false }
    })
    const pages = makePages(5)
    const html = blockToHtml([block], { pages })
    // 5 pages / 2 per page = 3 pagination pages
    expect(html).toContain('data-page-list-page="0"')
    expect(html).toContain('data-page-list-page="1"')
    expect(html).toContain('data-page-list-page="2"')
    expect(html).toContain('pagination')
    expect(html).toContain('data-page-list-target="0"')
    expect(html).toContain('data-page-list-target="2"')
  })

  it('does not render pagination when items fit on one page', () => {
    const block = createBlock('page-list', {
      props: { filterTag: '', itemsPerPage: 10, columns: 3, showDescription: true }
    })
    const pages = makePages(3)
    const html = blockToHtml([block], { pages })
    expect(html).not.toContain('pagination')
  })

  it('renders nothing meaningful without pages', () => {
    const block = createBlock('page-list', {
      props: { filterTag: '', itemsPerPage: 6, columns: 3, showDescription: true }
    })
    const html = blockToHtml([block])
    // Without pages, falls through to default rendering (empty div)
    expect(html).toContain('<div')
    expect(html).not.toContain('card-title')
  })
})

describe('container as form', () => {
  it('renders container with isForm as <form> tag', () => {
    const block = createBlock('container', {
      props: { isForm: true },
      classes: ['container']
    })
    const html = blockToHtml([block])
    expect(html).toContain('<form')
    expect(html).toContain('</form>')
    expect(html).not.toContain('<div')
  })

  it('renders form action and method attributes', () => {
    const block = createBlock('container', {
      props: { isForm: true, action: '/submit', method: 'post' },
      classes: ['container']
    })
    const html = blockToHtml([block])
    expect(html).toContain('action="/submit"')
    expect(html).toContain('method="post"')
    expect(html).toContain('<form')
  })

  it('renders container without isForm as normal div', () => {
    const block = createBlock('container', {
      classes: ['container']
    })
    const html = blockToHtml([block])
    expect(html).toContain('<div')
    expect(html).not.toContain('<form')
  })
})

describe('event actions', () => {
  it('renders events as inline attributes', () => {
    const block = createBlock('button', {
      props: { text: 'Click' },
      classes: ['btn'],
      events: { onclick: "alert('hello')" }
    })
    const html = blockToHtml([block])
    expect(html).toContain('onclick=')
    expect(html).toContain('Click')
  })

  it('renders multiple events', () => {
    const block = createBlock('container', {
      events: { onclick: 'handleClick()', onmouseover: 'highlight()' }
    })
    const html = blockToHtml([block])
    expect(html).toContain('onclick="handleClick()"')
    expect(html).toContain('onmouseover="highlight()"')
  })

  it('does not render events when empty', () => {
    const block = createBlock('button', {
      props: { text: 'Click' },
      classes: ['btn'],
      events: {}
    })
    const html = blockToHtml([block])
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('onchange')
  })

  it('skips events with empty string values', () => {
    const block = createBlock('button', {
      props: { text: 'Click' },
      classes: ['btn'],
      events: { onclick: '', onchange: '  ' }
    })
    const html = blockToHtml([block])
    expect(html).not.toContain('onclick=')
    expect(html).not.toContain('onchange=')
  })
})
