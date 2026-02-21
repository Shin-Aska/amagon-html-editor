import { describe, expect, it } from 'vitest'
import { parse } from 'parse5'
import { exportProject } from '../exportEngine'
import { createBlock } from '../../store/types'
import type { ProjectData } from '../../store/types'

describe('exportEngine', () => {
  it('consolidates app-media assets into assets/ and rewrites HTML refs to ./assets/...', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Test',
        framework: 'vanilla',
        theme: 'default',
        globalStyles: {}
      },
      pages: [
        {
          id: 'p1',
          title: 'Index',
          slug: 'index',
          meta: {},
          blocks: [
            createBlock('image', {
              props: { src: 'app-media://project/photos/my-photo.png', alt: 'A' }
            }),
            createBlock('image', {
              props: { src: 'app-media://project/other/my-photo.png', alt: 'B' }
            })
          ]
        }
      ],
      userBlocks: []
    }

    const files = await exportProject(project, {
      resolveAsset: async (url) => {
        if (url.includes('photos/')) {
          return { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' }
        }
        return { bytes: new Uint8Array([4, 5, 6]), mimeType: 'image/png' }
      }
    })

    const html = files.find((f) => f.path === 'index.html')
    expect(html && typeof html.content === 'string' ? html.content : '').toContain(
      'src="./assets/my-photo.png"'
    )
    expect(html && typeof html.content === 'string' ? html.content : '').toContain(
      'src="./assets/my-photo-1.png"'
    )
    expect(html && typeof html.content === 'string' ? html.content : '').not.toContain('app-media://')

    expect(files.some((f) => f.path === 'assets/my-photo.png')).toBe(true)
    expect(files.some((f) => f.path === 'assets/my-photo-1.png')).toBe(true)
  })

  it('rewrites asset references inside raw-html block content', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Test',
        framework: 'vanilla',
        theme: 'default',
        globalStyles: {}
      },
      pages: [
        {
          id: 'p1',
          title: 'Index',
          slug: 'index',
          meta: {},
          blocks: [
            createBlock('raw-html', {
              content:
                '<div style="background-image: url(app-media://project/bg.png)">' +
                '<img src="app-media://project/inner.png" />' +
                '</div>'
            })
          ]
        }
      ],
      userBlocks: []
    }

    const files = await exportProject(project, {
      resolveAsset: async () => ({ bytes: new Uint8Array([1]), mimeType: 'image/png' })
    })

    const html = files.find((f) => f.path === 'index.html')
    const htmlText = html && typeof html.content === 'string' ? html.content : ''

    expect(htmlText).toContain('./assets/bg.png')
    expect(htmlText).toContain('./assets/inner.png')
    expect(htmlText).not.toContain('app-media://')
  })

  it('strips editor-only classes from exported HTML', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Test',
        framework: 'vanilla',
        theme: 'default',
        globalStyles: {}
      },
      pages: [
        {
          id: 'p1',
          title: 'Index',
          slug: 'index',
          meta: {},
          blocks: [
            createBlock('container', {
              classes: ['html-editor-selected', 'canvas-outline', 'editor-hover', 'container']
            })
          ]
        }
      ],
      userBlocks: []
    }

    const files = await exportProject(project, {
      resolveAsset: async () => null
    })

    const html = files.find((f) => f.path === 'index.html')
    const htmlText = html && typeof html.content === 'string' ? html.content : ''

    expect(htmlText).toContain('class="container"')
    expect(htmlText).not.toContain('html-editor-')
    expect(htmlText).not.toContain('canvas-')
    expect(htmlText).not.toContain('editor-')
  })

  it('rewrites internal multi-page links to correct .html files', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Test',
        framework: 'vanilla',
        theme: 'default',
        globalStyles: {}
      },
      pages: [
        {
          id: 'home',
          title: 'Home',
          slug: 'index',
          meta: {},
          blocks: [
            createBlock('link', {
              props: { text: 'About', href: 'about#team' }
            }),
            createBlock('link', {
              props: { text: 'Contact', href: 'page:contact?x=1' }
            })
          ]
        },
        {
          id: 'about',
          title: 'About',
          slug: 'about',
          meta: {},
          blocks: []
        },
        {
          id: 'contact',
          title: 'Contact',
          slug: 'contact',
          meta: {},
          blocks: []
        }
      ],
      userBlocks: []
    }

    const files = await exportProject(project, {
      resolveAsset: async () => null
    })

    const html = files.find((f) => f.path === 'index.html')
    const htmlText = html && typeof html.content === 'string' ? html.content : ''
    expect(htmlText).toContain('href="./about.html#team"')
    expect(htmlText).toContain('href="./contact.html?x=1"')
  })

  it('supports includeJs=false (omits framework scripts but keeps CSS)', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Test',
        framework: 'bootstrap-5',
        theme: 'default',
        globalStyles: {}
      },
      pages: [
        {
          id: 'p1',
          title: 'Index',
          slug: 'index',
          meta: {},
          blocks: []
        }
      ],
      userBlocks: []
    }

    const files = await exportProject(project, {
      includeJs: false,
      resolveAsset: async () => null
    })

    const html = files.find((f) => f.path === 'index.html')
    const htmlText = html && typeof html.content === 'string' ? html.content : ''
    expect(htmlText).toContain('bootstrap.min.css')
    expect(htmlText).not.toContain('bootstrap.bundle.min.js')
  })

  it('minifies HTML when minify=true', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Test',
        framework: 'vanilla',
        theme: 'default',
        globalStyles: {}
      },
      pages: [
        {
          id: 'p1',
          title: 'Index',
          slug: 'index',
          meta: {},
          blocks: [createBlock('paragraph', { props: { text: 'Hello' } })]
        }
      ],
      userBlocks: []
    }

    const files = await exportProject(project, {
      minify: true,
      resolveAsset: async () => null
    })

    const html = files.find((f) => f.path === 'index.html')
    const htmlText = html && typeof html.content === 'string' ? html.content : ''
    expect(htmlText).toContain('</head><body>')
  })

  it('single-page inline export can inline assets as data URLs', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Test',
        framework: 'vanilla',
        theme: 'default',
        globalStyles: {}
      },
      pages: [
        {
          id: 'p1',
          title: 'Index',
          slug: 'index',
          meta: {},
          blocks: [
            createBlock('image', { props: { src: 'app-media://project/a.png', alt: 'A' } })
          ]
        }
      ],
      userBlocks: []
    }

    const files = await exportProject(project, {
      onlyPageId: 'p1',
      inlineCss: true,
      inlineAssets: true,
      resolveAsset: async () => ({ bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' })
    })

    expect(files.some((f) => f.path.startsWith('assets/'))).toBe(false)
    const html = files.find((f) => f.path === 'index.html')
    const htmlText = html && typeof html.content === 'string' ? html.content : ''
    expect(htmlText).toContain('data:image/png;base64,')
  })

  it('outputs parseable HTML and contains no editor artifacts', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Test',
        framework: 'vanilla',
        theme: 'default',
        globalStyles: {}
      },
      pages: [
        {
          id: 'p1',
          title: 'Index',
          slug: 'index',
          meta: {},
          blocks: [
            createBlock('container', {
              props: { 'data-block-id': 'x', dataBlockId: 'y', 'data-editor-foo': 'z' },
              classes: ['container', 'editor-x', 'html-editor-y']
            })
          ]
        }
      ],
      userBlocks: []
    }

    const files = await exportProject(project, { resolveAsset: async () => null })
    const html = files.find((f) => f.path === 'index.html')
    const htmlText = html && typeof html.content === 'string' ? html.content : ''

    const doc = parse(htmlText)
    expect(doc).toBeTruthy()

    expect(htmlText).not.toContain('data-block-id')
    expect(htmlText).not.toContain('data-editor')
    expect(htmlText).not.toContain('html-editor-')
    expect(htmlText).not.toContain('editor-')
    expect(htmlText).not.toContain('canvas-')
  })
})
