import { describe, expect, it } from 'vitest'
import { parse } from 'parse5'
import { exportProject } from '../exportEngine'
import { createBlock, createDefaultTheme } from '../../store/types'
import type { ProjectData } from '../../store/types'

describe('exportEngine', () => {
  it('consolidates app-media assets into assets/ and rewrites HTML refs to ./assets/...', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Test',
        framework: 'vanilla',
        theme: createDefaultTheme(),
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
        theme: createDefaultTheme(),
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
        theme: createDefaultTheme(),
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
        theme: createDefaultTheme(),
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
        theme: createDefaultTheme(),
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

  it('tailwind export includes only tailwind resources', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Test',
        framework: 'tailwind',
        theme: createDefaultTheme(),
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
      resolveAsset: async () => null
    })

    const html = files.find((f) => f.path === 'index.html')
    const htmlText = html && typeof html.content === 'string' ? html.content : ''
    expect(htmlText).toContain('tailwindcss.com')
    expect(htmlText).not.toContain('bootstrap.min.css')
    expect(htmlText).not.toContain('bootstrap.bundle.min.js')
  })

  it('tailwind export renders tailwind-native markup for framework-sensitive blocks', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Test',
        framework: 'tailwind',
        theme: createDefaultTheme(),
        globalStyles: {}
      },
      pages: [
        {
          id: 'p1',
          title: 'Index',
          slug: 'index',
          meta: {},
          blocks: [
            createBlock('navbar', {
              props: { usePages: true, brandText: 'Brand', theme: 'navbar-theme-light' },
              classes: ['navbar', 'navbar-expand-lg']
            }),
            createBlock('button', {
              props: { text: 'CTA', variant: 'btn-primary', size: 'btn-lg' },
              classes: ['btn']
            }),
            createBlock('heading', {
              props: { text: 'Hero', level: 1, alignment: 'text-center' },
              classes: ['display-3', 'fw-bold']
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
    expect(htmlText).toContain('max-w-6xl')
    expect(htmlText).toContain('inline-flex items-center justify-center rounded-md')
    expect(htmlText).toContain('md:text-5xl')
    expect(htmlText).not.toContain('navbar-expand-lg')
    expect(htmlText).not.toContain('data-bs-toggle=')
    expect(htmlText).not.toContain('class="btn btn-primary"')
  })

  it('rewrites navbar brandImage app-media assets in pages-based navbars', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Test',
        framework: 'bootstrap-5',
        theme: createDefaultTheme(),
        globalStyles: {}
      },
      pages: [
        {
          id: 'p1',
          title: 'Index',
          slug: 'index',
          meta: {},
          blocks: [
            createBlock('navbar', {
              props: {
                usePages: true,
                brandText: 'Brand',
                brandImage: 'app-media://project-asset/assets/nav-logo.png',
                sticky: true
              },
              classes: ['navbar', 'navbar-expand-lg', 'navbar-theme-light']
            })
          ]
        },
        {
          id: 'p2',
          title: 'About',
          slug: 'about',
          meta: {},
          blocks: []
        }
      ],
      userBlocks: []
    }

    const files = await exportProject(project, {
      resolveAsset: async (url) => {
        if (url === 'app-media://project-asset/assets/nav-logo.png') {
          return { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/png' }
        }
        return null
      }
    })

    const html = files.find((f) => f.path === 'index.html')
    const htmlText = html && typeof html.content === 'string' ? html.content : ''
    expect(htmlText).toContain('src="./assets/nav-logo.png"')
    expect(htmlText).toContain('position-sticky')
    expect(htmlText).toContain('position: sticky')
    expect(htmlText).toContain('z-index: 1030')
    expect(htmlText).not.toContain('app-media://')
    expect(files.some((f) => f.path === 'assets/nav-logo.png')).toBe(true)
  })

  it('minifies HTML when minify=true', async () => {
    const project: ProjectData = {
      projectSettings: {
        name: 'Test',
        framework: 'vanilla',
        theme: createDefaultTheme(),
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
        theme: createDefaultTheme(),
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
        theme: createDefaultTheme(),
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
