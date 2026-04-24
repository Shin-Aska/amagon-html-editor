import {describe, expect, it} from 'vitest'
import {blockToHtml, pageToHtml} from '../blockToHtml'
import type {Block} from '../../store/types'
import {createBlock} from '../../store/types'

describe('blockToHtml', () => {
  it('renders an empty block array as empty string', () => {
    expect(blockToHtml([])).toBe('')
  });

  it('renders a simple heading', () => {
    const blocks: Block[] = [
      createBlock('heading', { props: { text: 'Hello World', level: 1 }, classes: [] })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('<h1');
    expect(html).toContain('Hello World');
    expect(html).toContain('</h1>')
  });

  it('renders heading levels correctly', () => {
    const blocks: Block[] = [
      createBlock('heading', { props: { text: 'Title', level: 3 } })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('<h3');
    expect(html).toContain('</h3>')
  });

  it('renders a paragraph', () => {
    const blocks: Block[] = [
      createBlock('paragraph', { props: { text: 'Some text here' } })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('<p');
    expect(html).toContain('Some text here')
  });

  it('renders a fallback HTML id for generic blocks', () => {
    const block = createBlock('paragraph', { props: { text: 'Some text here' } });
    const html = blockToHtml([block]);
    expect(html).toContain(`id="${block.id}"`)
  });

  it('prefers a custom HTML id for checkbox blocks', () => {
    const block = createBlock('checkbox', { props: { id: 'newsletter-optin', label: 'Join newsletter' } });
    const html = blockToHtml([block]);
    expect(html).toContain('id="newsletter-optin"');
    expect(html).toContain('for="newsletter-optin"')
  });

  it('renders classes', () => {
    const blocks: Block[] = [
      createBlock('container', { classes: ['container', 'mt-4', 'bg-light'] })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('class="container mt-4 bg-light"')
  });

  it('renders inline styles', () => {
    const blocks: Block[] = [
      createBlock('container', { styles: { backgroundColor: 'red', fontSize: '16px' } })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('style="background-color: red; font-size: 16px"')
  });

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
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('class="row"');
    expect(html).toContain('class="col"');
    expect(html).toContain('Nested content')
  });

  it('renders void elements self-closing', () => {
    const blocks: Block[] = [
      createBlock('image', { props: { src: 'photo.jpg', alt: 'A photo' } })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('<img');
    expect(html).toContain('src="photo.jpg"');
    expect(html).toContain('alt="A photo"');
    expect(html).toContain('/>');
    expect(html).not.toContain('</img>')
  });

  it('renders a horizontal rule', () => {
    const blocks: Block[] = [createBlock('hr')];
    const html = blockToHtml(blocks);
    expect(html).toContain('<hr');
    expect(html).toContain('/>')
  });

  it('renders a list with items', () => {
    const blocks: Block[] = [
      createBlock('list', { props: { items: ['Alpha', 'Beta', 'Gamma'] } })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('<ul');
    expect(html).toContain('<li>Alpha</li>');
    expect(html).toContain('<li>Beta</li>');
    expect(html).toContain('<li>Gamma</li>')
  });

  it('renders button with text', () => {
    const blocks: Block[] = [
      createBlock('button', { props: { text: 'Click Me' }, classes: ['btn', 'btn-primary'] })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('<button');
    expect(html).toContain('class="btn btn-primary"');
    expect(html).toContain('>Click Me</button>')
  });

  it('renders prop-driven Tailwind classes without leaking inspector props as attributes', () => {
    const blocks: Block[] = [
      createBlock('heading', {
        props: { text: 'Hero', level: 1, alignment: 'text-center' },
        classes: ['display-3', 'fw-bold']
      }),
      createBlock('paragraph', {
        props: { text: 'Body', alignment: 'text-center', lead: true },
        classes: ['mb-4']
      }),
      createBlock('button', {
        props: { text: 'CTA', variant: 'btn-secondary', size: 'btn-lg' },
        classes: ['btn']
      }),
      createBlock('column', {
        props: { width: 'col-lg-6' },
        classes: ['col']
      })
    ];

    const html = blockToHtml(blocks, { framework: 'tailwind' });
    expect(html).toContain('text-center');
    expect(html).toContain('md:text-5xl');
    expect(html).toContain('leading-8');
    expect(html).toContain('bg-[var(--theme-secondary)]');
    expect(html).toContain('lg:w-6/12');
    expect(html).not.toContain('alignment=');
    expect(html).not.toContain('lead ');
    expect(html).not.toContain('width=')
  });

  it('keeps Tailwind rows with non-column children as normal block containers', () => {
    const blocks: Block[] = [
      createBlock('row', {
        classes: ['row', 'g-4'],
        children: [
          createBlock('container', { classes: ['container'] }),
          createBlock('section', { classes: ['py-5'] })
        ]
      })
    ];

    const html = blockToHtml(blocks, { framework: 'tailwind', includeDataAttributes: true });
    expect(html).toMatch(/data-block-type="row"[^>]*class="[^"]*\bw-full\b[^"]*"/);
    expect(html).not.toMatch(/data-block-type="row"[^>]*class="[^"]*\bflex\b[^"]*"/)
  });

  it('renders Tailwind rows with column children as horizontal layouts', () => {
    const blocks: Block[] = [
      createBlock('row', {
        classes: ['row'],
        children: [
          createBlock('column', { classes: ['col'] }),
          createBlock('column', { classes: ['col'] })
        ]
      })
    ];

    const html = blockToHtml(blocks, { framework: 'tailwind', includeDataAttributes: true });
    expect(html).toMatch(/data-block-type="row"[^>]*class="[^"]*\bflex\b[^"]*\bflex-wrap\b[^"]*"/);
    expect(html).toMatch(/data-block-type="column"[^>]*class="[^"]*\bw-full\b[^"]*\bmd:flex-1\b[^"]*"/)
  });

  it('maps Tailwind containers to full-width constrained wrappers', () => {
    const blocks: Block[] = [
      createBlock('container', { classes: ['container'] })
    ];

    const html = blockToHtml(blocks, { framework: 'tailwind', includeDataAttributes: true });
    expect(html).toMatch(/data-block-type="container"[^>]*class="[^"]*\bw-full\b[^"]*\bmax-w-6xl\b[^"]*\bmx-auto\b[^"]*"/)
  });

  it('elides empty wrapper divs in Tailwind export so flex sections do not get shrinking children', () => {
    const blocks: Block[] = [
      createBlock('section', {
        classes: ['py-12', 'd-flex', 'align-items-center'],
        children: [
          createBlock('container', {
            classes: [],
            children: [
              createBlock('row', {
                classes: ['row', 'justify-content-center', 'text-center'],
                children: [
                  createBlock('column', {
                    classes: ['col-lg-8', 'col-10'],
                    children: [
                      createBlock('heading', {
                        props: { text: 'Hero', level: 1 },
                        classes: ['text-center']
                      })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      })
    ];

    const html = blockToHtml(blocks, { framework: 'tailwind' });
    expect(html).toContain('<section');
    expect(html).toContain('class="py-12 flex items-center"');
    expect(html).toContain('<div');
    expect(html).toContain('class="flex w-full justify-center text-center flex-wrap -mx-2"');
    expect(html).not.toContain('class="py-12 flex items-center">\n  <div>\n')
  });

  it('renders a link with href', () => {
    const blocks: Block[] = [
      createBlock('link', { props: { text: 'Visit', href: 'https://example.com', target: '_blank' } })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('<a');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('Visit')
  });

  it('renders lucide icons inline for icon blocks', () => {
    const blocks: Block[] = [
      createBlock('icon', { props: { iconClass: 'lucide:star', size: '2rem', color: 'red' } })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('<svg');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('font-size: 2rem');
    expect(html).toContain('color: red')
  });

  it('renders a visible placeholder for empty icon blocks', () => {
    const block = createBlock('icon', { props: { iconClass: '' } });
    const html = blockToHtml([block], { includeDataAttributes: true });
    expect(html).toContain('No icon selected');
    expect(html).toContain(`data-block-id="${block.id}"`);
    expect(html).toContain('☆')
  });

  it('includes editor metadata for icon blocks when requested', () => {
    const html = pageToHtml([
      createBlock('icon', { props: { iconClass: 'lucide:star', size: '2rem', color: 'orange' } })
    ], { includeEditorMetadata: true });

    expect(html).toContain('data-amagon-component="icon"');
    expect(html).toContain('data-amagon-icon-class="lucide:star"')
  });

  it('maps legacy bootstrap icon classes to a visible icon', () => {
    const blocks: Block[] = [
      createBlock('icon', { props: { iconClass: 'bi-star' }, classes: ['bi', 'bi-star'] })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('<svg');
    expect(html).not.toContain('No icon selected')
  });

  it('includes data-block-id when includeDataAttributes is true', () => {
    const block = createBlock('paragraph', { props: { text: 'Test' } });
    const html = blockToHtml([block], { includeDataAttributes: true });
    expect(html).toContain(`data-block-id="${block.id}"`)
  });

  it('excludes data-block-id by default', () => {
    const block = createBlock('paragraph', { props: { text: 'Test' } });
    const html = blockToHtml([block]);
    expect(html).not.toContain('data-block-id')
  });

  it('respects tag override', () => {
    const blocks: Block[] = [
      createBlock('container', { tag: 'main' })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('<main');
    expect(html).toContain('</main>')
  });

  it('renders raw-html block content', () => {
    const blocks: Block[] = [
      createBlock('raw-html', { content: '<custom-element>Raw</custom-element>' })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('<custom-element>Raw</custom-element>')
  });

  it('escapes attribute values', () => {
    const blocks: Block[] = [
      createBlock('image', { props: { src: 'image.jpg', alt: 'Photo "test" <>&' } })
    ];
    const html = blockToHtml(blocks);
    expect(html).toContain('alt="Photo &quot;test&quot; &lt;&gt;&amp;"')
  });

  it('handles multiple top-level blocks', () => {
    const blocks: Block[] = [
      createBlock('heading', { props: { text: 'Title', level: 1 } }),
      createBlock('paragraph', { props: { text: 'Body' } }),
      createBlock('hr')
    ];
    const html = blockToHtml(blocks);
    const lines = html.split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(3)
  });

  it('renders phase 2 medium blocks with composite Bootstrap markup', () => {
    const blocks: Block[] = [
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
          direction: 'down',
          split: true
        }
      }),
      createBlock('offcanvas', {
        props: { id: 'settings-panel', title: 'Settings', placement: 'end', backdrop: false, scroll: true },
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
    ];

    const html = blockToHtml(blocks, { includeDataAttributes: false, framework: 'bootstrap-5' });

    expect(html).toContain('<table class="table table-striped table-bordered table-hover table-sm table-dark"');
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('data-amagon-dropdown="true"');
    expect(html).toContain('dropdown-menu');
    expect(html).toContain('data-bs-toggle="offcanvas"');
    expect(html).toContain('offcanvas offcanvas-end');
    expect(html).toContain('data-amagon-card="true"');
    expect(html).toContain('card-header');
    expect(html).toContain('card-body');
    expect(html).toContain('card-footer')
  });

  it('renders phase 2 medium blocks with composite Tailwind markup', () => {
    const blocks: Block[] = [
      createBlock('dropdown', {
        props: {
          label: 'Menu',
          variant: 'primary',
          items: [{ label: 'Open', href: '#', divider: false, disabled: false }],
          direction: 'end',
          split: false
        }
      }),
      createBlock('offcanvas', {
        props: { id: 'tw-panel', title: 'Tailwind Panel', placement: 'start', backdrop: true, scroll: false },
        children: [createBlock('paragraph', { props: { text: 'Tailwind body' } })]
      }),
      createBlock('card', {
        props: {
          title: 'Tailwind card',
          subtitle: 'Details',
          text: 'Tailwind text',
          imageUrl: 'https://example.com/tw-card.jpg',
          imagePosition: 'overlay',
          variant: 'dark',
          outline: false
        }
      })
    ];

    const html = blockToHtml(blocks, { includeDataAttributes: false, framework: 'tailwind' });

    expect(html).toContain('data-tw-dropdown-menu');
    expect(html).toContain('data-tw-offcanvas-panel="true"');
    expect(html).toContain('data-amagon-card="true"');
    expect(html).toContain('data-card-overlay="true"')
  });

  it('renders phase 3 enhanced media/form/interactive blocks', () => {
    const blocks: Block[] = [
      createBlock('image', {
        props: {
          src: 'hero.jpg',
          alt: 'Hero',
          caption: 'Hero caption',
          captionPosition: 'overlay-bottom',
          objectFit: 'contain',
          aspectRatio: '16:9',
          lazyLoad: true,
          lightbox: true
        }
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
        }
      }),
      createBlock('button', {
        props: {
          text: 'Submit',
          variant: 'btn-primary',
          iconLeft: 'lucide:check',
          outline: true,
          block: true,
          loading: true,
          loadingText: 'Saving...'
        },
        classes: ['btn']
      }),
      createBlock('input', {
        props: {
          type: 'text',
          label: 'Email',
          prepend: '@',
          append: '.com',
          floatingLabel: true,
          validationState: 'invalid',
          validationMessage: 'Invalid email',
          helpText: 'Use your work email'
        },
        classes: ['form-control']
      }),
      createBlock('checkbox', {
        props: { label: 'Enable beta', switch: true, inline: true },
        classes: ['form-check-input']
      }),
      createBlock('select', {
        props: {
          name: 'country',
          multiple: true,
          size: 5,
          optgroups: true,
          items: [
            {
              group: 'Asia',
              options: [
                { label: 'Japan', value: 'jp' },
                { label: 'Philippines', value: 'ph' }
              ]
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
        }
      })
    ];

    const html = blockToHtml(blocks, { framework: 'bootstrap-5', includeDataAttributes: false });

    expect(html).toContain('<figure');
    expect(html).toContain('<figcaption');
    expect(html).toContain('data-amagon-lightbox="true"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('data-amagon-media-ratio="21:9"');
    expect(html).toContain('poster="poster.jpg"');
    expect(html).toContain('data-amagon-button-loading="true"');
    expect(html).toContain('input-group');
    expect(html).toContain('form-floating');
    expect(html).toContain('invalid-feedback');
    expect(html).toContain('form-switch');
    expect(html).toContain('<optgroup label="Asia">');
    expect(html).toContain('data-amagon-code-block="true"');
    expect(html).toContain('data-code-show-line-numbers="true"');
    expect(html).toContain('fa-spin');
    expect(html).toContain('fa-fw');
    expect(html).toContain('data-amagon-embed-ratio="4:3"');
    expect(html).toContain('allowfullscreen')
  })
});

describe('pageToHtml', () => {
  it('generates a full HTML document', () => {
    const blocks: Block[] = [
      createBlock('heading', { props: { text: 'Hello', level: 1 } })
    ];
    const html = pageToHtml(blocks, { title: 'Test Page' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Test Page</title>');
    expect(html).toContain('<h1');
    expect(html).toContain('>Hello</h1>');
    expect(html).toContain('</body>');
    expect(html).toContain('</html>')
  });

  it('includes Bootstrap 5 CDN for bootstrap-5 framework', () => {
    const html = pageToHtml([], { framework: 'bootstrap-5' });
    expect(html).toContain('bootstrap@5.3.3');
    expect(html).toContain('bootstrap.min.css')
  });

  it('includes Tailwind CDN for tailwind framework', () => {
    const html = pageToHtml([], { framework: 'tailwind' });
    expect(html).toContain('tailwindcss.com');
    expect(html).not.toContain('bootstrap.min.css');
    expect(html).not.toContain('bootstrap.bundle.min.js')
  });

  it('includes no framework CSS for vanilla', () => {
    const html = pageToHtml([], { framework: 'vanilla' });
    expect(html).not.toContain('bootstrap');
    expect(html).not.toContain('tailwind')
  });

  it('includes meta tags', () => {
    const html = pageToHtml([], { meta: { description: 'A test page', author: 'Test' } });
    expect(html).toContain('name="description" content="A test page"');
    expect(html).toContain('name="author" content="Test"')
  })
});

describe('page-list block', () => {
  const makePages = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      title: `Post ${i + 1}`,
      slug: `post-${i + 1}`,
      tags: [],
      blocks: [],
      meta: { description: `Description for post ${i + 1}` }
    }));

  it('renders blog post cards from pages', () => {
    const block = createBlock('page-list', {
      props: { filterTag: '', itemsPerPage: 6, columns: 3, showDescription: true }
    });
    const pages = makePages(3);
    const html = blockToHtml([block], { pages });
    expect(html).toContain('Post 1');
    expect(html).toContain('Post 2');
    expect(html).toContain('Post 3');
    expect(html).toContain('card-title');
    expect(html).toContain('href="post-1.html"');
    expect(html).toContain('Description for post 1')
  });

  it('filters pages by tag', () => {
    const block = createBlock('page-list', {
      props: { filterTag: 'news', itemsPerPage: 6, columns: 3, showDescription: true }
    });
    const pages = [
      { id: 'p1', title: 'Tagged', slug: 'tagged', tags: ['news'], blocks: [], meta: {} },
      { id: 'p2', title: 'Not Tagged', slug: 'not-tagged', tags: [], blocks: [], meta: {} }
    ];
    const html = blockToHtml([block], { pages });
    expect(html).toContain('Tagged');
    expect(html).not.toContain('Not Tagged')
  });

  it('renders pagination when pages exceed itemsPerPage', () => {
    const block = createBlock('page-list', {
      props: { filterTag: '', itemsPerPage: 2, columns: 3, showDescription: false }
    });
    const pages = makePages(5);
    const html = blockToHtml([block], { pages });
    // 5 pages / 2 per page = 3 pagination pages
    expect(html).toContain('data-page-list-page="0"');
    expect(html).toContain('data-page-list-page="1"');
    expect(html).toContain('data-page-list-page="2"');
    expect(html).toContain('pagination');
    expect(html).toContain('data-page-list-target="0"');
    expect(html).toContain('data-page-list-target="2"')
  });

  it('does not render pagination when items fit on one page', () => {
    const block = createBlock('page-list', {
      props: { filterTag: '', itemsPerPage: 10, columns: 3, showDescription: true }
    });
    const pages = makePages(3);
    const html = blockToHtml([block], { pages });
    expect(html).not.toContain('pagination')
  });

  it('renders nothing meaningful without pages', () => {
    const block = createBlock('page-list', {
      props: { filterTag: '', itemsPerPage: 6, columns: 3, showDescription: true }
    });
    const html = blockToHtml([block]);
    // Without pages, falls through to default rendering (empty div)
    expect(html).toContain('<div');
    expect(html).not.toContain('card-title')
  })
});

describe('container as form', () => {
  it('renders container with isForm as <form> tag', () => {
    const block = createBlock('container', {
      props: { isForm: true },
      classes: ['container']
    });
    const html = blockToHtml([block]);
    expect(html).toContain('<form');
    expect(html).toContain('</form>');
    expect(html).not.toContain('<div')
  });

  it('renders form action and method attributes', () => {
    const block = createBlock('container', {
      props: { isForm: true, action: '/submit', method: 'post' },
      classes: ['container']
    });
    const html = blockToHtml([block]);
    expect(html).toContain('action="/submit"');
    expect(html).toContain('method="post"');
    expect(html).toContain('<form')
  });

  it('renders container without isForm as normal div', () => {
    const block = createBlock('container', {
      classes: ['container']
    });
    const html = blockToHtml([block]);
    expect(html).toContain('<div');
    expect(html).not.toContain('<form')
  });

  it('renders a placeholder for empty forms in editor mode', () => {
    const block = createBlock('form');
    const html = blockToHtml([block], { includeDataAttributes: true });
    expect(html).toContain('editor-placeholder');
    expect(html).toContain('Form — drop elements here');
    expect(html).toContain('📝')
  });

  it('does not render placeholder for empty forms in export mode', () => {
    const block = createBlock('form');
    const html = blockToHtml([block], { includeDataAttributes: false });
    expect(html).not.toContain('editor-placeholder');
    expect(html).not.toContain('Form — drop elements here')
  });

  it('does not render placeholder for forms with children', () => {
    const block = createBlock('form', {
      children: [createBlock('paragraph', { props: { text: 'Input' } })]
    });
    const html = blockToHtml([block], { includeDataAttributes: true });
    expect(html).not.toContain('editor-placeholder');
    expect(html).toContain('Input')
  })
});

describe('event actions', () => {
  it('renders events as inline attributes', () => {
    const block = createBlock('button', {
      props: { text: 'Click' },
      classes: ['btn'],
      events: { onclick: "alert('hello')" }
    });
    const html = blockToHtml([block]);
    expect(html).toContain('onclick=');
    expect(html).toContain('Click')
  });

  it('renders multiple events', () => {
    const block = createBlock('container', {
      events: { onclick: 'handleClick()', onmouseover: 'highlight()' }
    });
    const html = blockToHtml([block]);
    expect(html).toContain('onclick="handleClick()"');
    expect(html).toContain('onmouseover="highlight()"')
  });

  it('does not render events when empty', () => {
    const block = createBlock('button', {
      props: { text: 'Click' },
      classes: ['btn'],
      events: {}
    });
    const html = blockToHtml([block]);
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('onchange')
  });

  it('skips events with empty string values', () => {
    const block = createBlock('button', {
      props: { text: 'Click' },
      classes: ['btn'],
      events: { onclick: '', onchange: '  ' }
    });
    const html = blockToHtml([block]);
    expect(html).not.toContain('onclick=');
    expect(html).not.toContain('onchange=')
  })
});

describe('Phase 4 — layout and component block enhancements', () => {
  it('renders heading with anchorId as id attribute', () => {
    const block = createBlock('heading', { props: { text: 'About Us', level: 2, anchorId: 'about-us' } });
    const html = blockToHtml([block]);
    expect(html).toContain('id="about-us"');
    expect(html).toContain('About Us')
  });

  it('renders heading with decorative underline class', () => {
    const block = createBlock('heading', { props: { text: 'Title', level: 1, decorative: 'underline' } });
    const html = blockToHtml([block]);
    expect(html).toContain('amagon-heading-underline')
  });

  it('renders heading with gradient-underline class', () => {
    const block = createBlock('heading', { props: { text: 'Title', level: 2, decorative: 'gradient-underline' } });
    const html = blockToHtml([block]);
    expect(html).toContain('amagon-heading-gradient-underline')
  });

  it('renders paragraph with dropCap attribute', () => {
    const block = createBlock('paragraph', { props: { text: 'Once upon a time.', dropCap: true } });
    const html = blockToHtml([block]);
    expect(html).toContain('data-drop-cap="true"');
    expect(html).toContain('amagon-drop-cap')
  });

  it('renders paragraph with 2-column layout', () => {
    const block = createBlock('paragraph', { props: { text: 'Long text.', columns: '2' } });
    const html = blockToHtml([block]);
    expect(html).toContain('column-count: 2')
  });

  it('renders link with button=true as styled anchor', () => {
    const block = createBlock('link', { props: { text: 'Get Started', href: '/start', button: true, variant: 'primary' } });
    const html = blockToHtml([block]);
    expect(html).toContain('<a');
    expect(html).toContain('btn btn-primary');
    expect(html).toContain('href="/start"');
    expect(html).toContain('Get Started')
  });

  it('renders link with newTab adds target and rel', () => {
    const block = createBlock('link', { props: { text: 'External', href: 'https://example.com', newTab: true } });
    const html = blockToHtml([block]);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"')
  });

  it('renders blockquote with author and source as footer', () => {
    const block = createBlock('blockquote', { props: { text: 'Quote text', author: 'Jane Doe', source: 'Famous Book' } });
    const html = blockToHtml([block]);
    expect(html).toContain('Quote text');
    expect(html).toContain('blockquote-footer');
    expect(html).toContain('Jane Doe');
    expect(html).toContain('<cite>Famous Book</cite>')
  });

  it('renders list with horizontal prop as list-inline', () => {
    const block = createBlock('list', { props: { items: ['A', 'B', 'C'], horizontal: true } });
    const html = blockToHtml([block]);
    expect(html).toContain('list-inline-item')
  });

  it('renders divider with center text', () => {
    const block = createBlock('divider', { props: { withText: 'OR', style: 'solid' } });
    const html = blockToHtml([block]);
    expect(html).toContain('OR');
    expect(html).toContain('flex')
  });

  it('renders container with bgColor as inline style', () => {
    const block = createBlock('container', { props: { bgColor: '#ff0000' }, classes: ['container'] });
    const html = blockToHtml([block]);
    expect(html).toContain('background-color: #ff0000')
  });

  it('renders container with bgImage as background-image style', () => {
    const block = createBlock('container', { props: { bgImage: 'hero.jpg' }, classes: ['container'] });
    const html = blockToHtml([block]);
    expect(html).toContain("background-image: url('hero.jpg')");
    expect(html).toContain('background-size: cover')
  });

  it('renders column with responsive breakpoint classes', () => {
    const block = createBlock('column', { props: { colSm: 12, colMd: 6, colLg: 4, offset: 1 }, classes: ['col'] });
    const html = blockToHtml([block]);
    expect(html).toContain('col-sm-12');
    expect(html).toContain('col-md-6');
    expect(html).toContain('col-lg-4');
    expect(html).toContain('offset-1')
  });

  it('renders hero with background image and overlay', () => {
    const block = createBlock('hero', {
      props: { bgImage: 'bg.jpg', overlay: true, overlayColor: '#000', overlayOpacity: 50, alignment: 'center', fullHeight: true },
      classes: ['hero']
    });
    const html = blockToHtml([block]);
    expect(html).toContain("url('bg.jpg')");
    expect(html).toContain('position-absolute');
    expect(html).toContain('min-height: 100vh')
  });

  it('renders hero with CTA buttons', () => {
    const block = createBlock('hero', {
      props: {
        ctaButtons: [
          { label: 'Learn More', href: '/learn', variant: 'primary' },
          { label: 'Contact', href: '/contact', variant: 'outline-light' }
        ]
      },
      classes: ['hero']
    });
    const html = blockToHtml([block]);
    expect(html).toContain('Learn More');
    expect(html).toContain('/learn');
    expect(html).toContain('Contact')
  });

  it('renders navbar with sticky class', () => {
    const block = createBlock('navbar', { props: { sticky: true }, classes: ['navbar', 'navbar-expand-lg'] });
    const html = blockToHtml([block]);
    expect(html).toContain('position-sticky');
    expect(html).toContain('top-0');
    expect(html).toContain('position: sticky');
    expect(html).toContain('top: 0');
    expect(html).toContain('z-index: 1030')
  });

  it('renders navbar with transparent class', () => {
    const block = createBlock('navbar', { props: { transparent: true }, classes: ['navbar', 'navbar-expand-lg'] });
    const html = blockToHtml([block]);
    expect(html).toContain('navbar-transparent')
  });

  it('renders non-pages navbar brand image and sticky classes', () => {
    const block = createBlock('navbar', {
      props: {
        usePages: false,
        brandText: 'Acme',
        brandImage: 'https://cdn.example.com/logo.png',
        sticky: true
      },
      classes: ['navbar', 'navbar-expand-lg'],
      children: [
        createBlock('container', {
          classes: ['container'],
          children: [
            createBlock('link', { props: { text: 'Acme', href: '#' }, classes: ['navbar-brand'] }),
            createBlock('link', { props: { text: 'Home', href: 'index.html' }, classes: ['nav-link'] })
          ]
        })
      ]
    });

    const html = blockToHtml([block]);
    expect(html).toContain('src="https://cdn.example.com/logo.png"');
    expect(html).toContain('position-sticky');
    expect(html).toContain('top-0');
    expect(html).toContain('z-3');
    expect(html).toContain('position: sticky');
    expect(html).toContain('z-index: 1030')
  });

  it('renders pages-based navbar brand image and sticky classes', () => {
    const block = createBlock('navbar', {
      props: {
        usePages: true,
        brandText: 'Acme',
        brandImage: 'app-media://project-asset/assets/logo.png',
        sticky: true
      },
      classes: ['navbar', 'navbar-expand-lg']
    });

    const html = blockToHtml([block], {
      pages: [
        { id: 'p1', title: 'Home', slug: 'index', blocks: [], meta: {} },
        { id: 'p2', title: 'About', slug: 'about', blocks: [], meta: {} }
      ]
    });

    expect(html).toContain('src="app-media://project-asset/assets/logo.png"');
    expect(html).toContain('position-sticky');
    expect(html).toContain('top-0');
    expect(html).toContain('z-3');
    expect(html).toContain('position: sticky');
    expect(html).toContain('z-index: 1030');
    expect(html).toContain('href="about.html"')
  });

  it('renders footer with copyright and back-to-top', () => {
    const block = createBlock('footer', {
      props: {
        copyrightText: '© 2024 Acme Corp',
        showBackToTop: true,
        showSocialLinks: false
      },
      classes: ['footer', 'py-5']
    });
    const html = blockToHtml([block]);
    expect(html).toContain('© 2024 Acme Corp');
    expect(html).toContain('Back to top')
  });

  it('renders footer with social links', () => {
    const block = createBlock('footer', {
      props: {
        showSocialLinks: true,
        socialLinks: [
          { platform: 'twitter', url: 'https://x.com/test' },
          { platform: 'github', url: 'https://github.com/test' }
        ]
      },
      classes: ['footer', 'py-5']
    });
    const html = blockToHtml([block]);
    expect(html).toContain('https://x.com/test');
    expect(html).toContain('https://github.com/test')
  });

  it('renders modal with size class', () => {
    const block = createBlock('modal', {
      props: { id: 'test-modal', title: 'Big Modal', buttonText: 'Open', size: 'modal-lg' }
    });
    const html = blockToHtml([block], { includeDataAttributes: false });
    expect(html).toContain('modal-lg')
  });

  it('renders modal with scrollable and centered', () => {
    const block = createBlock('modal', {
      props: { id: 'test-modal2', title: 'Centered Modal', buttonText: 'Open', scrollable: true, centered: true }
    });
    const html = blockToHtml([block], { includeDataAttributes: false });
    expect(html).toContain('modal-dialog-scrollable');
    expect(html).toContain('modal-dialog-centered')
  });

  it('renders accordion with flush class', () => {
    const block = createBlock('accordion', {
      props: {
        id: 'acc-1',
        items: [{ title: 'Q1', content: 'A1' }],
        flush: true,
        alwaysOpen: false
      },
      classes: ['accordion']
    });
    const html = blockToHtml([block]);
    expect(html).toContain('accordion-flush')
  });

  it('renders accordion with alwaysOpen removes data-bs-parent', () => {
    const block = createBlock('accordion', {
      props: {
        id: 'acc-2',
        items: [{ title: 'Q1', content: 'A1' }, { title: 'Q2', content: 'A2' }],
        flush: false,
        alwaysOpen: true
      },
      classes: ['accordion']
    });
    const html = blockToHtml([block]);
    expect(html).not.toContain('data-bs-parent')
  });

  it('renders tabs with pills variant', () => {
    const block = createBlock('tabs', {
      props: {
        id: 'tabs-pills',
        variant: 'pills',
        tabs: [{ label: 'Tab1', content: 'Content 1' }]
      },
      classes: []
    });
    const html = blockToHtml([block]);
    expect(html).toContain('nav-pills')
  });

  it('renders tabs with vertical layout', () => {
    const block = createBlock('tabs', {
      props: {
        id: 'tabs-vert',
        vertical: true,
        tabs: [{ label: 'Item', content: 'Body' }]
      },
      classes: []
    });
    const html = blockToHtml([block]);
    expect(html).toContain('flex-column')
  });

  it('renders carousel with fade transition and thumbnails', () => {
    const block = createBlock('carousel', {
      props: {
        id: 'carousel-test',
        transition: 'fade',
        thumbnails: true,
        interval: 3000,
        slides: [
          { src: 'img1.jpg', alt: 'Slide 1', caption: '' },
          { src: 'img2.jpg', alt: 'Slide 2', caption: '' }
        ]
      },
      classes: ['carousel', 'slide']
    });
    const html = blockToHtml([block]);
    expect(html).toContain('carousel-fade');
    expect(html).toContain('data-bs-interval="3000"');
    // thumbnails: should include a thumbnail button row
    expect(html).toContain('img1.jpg');
    expect(html).toContain('img2.jpg')
  });

  it('renders carousel fade class from legacy fade prop when transition is missing', () => {
    const block = createBlock('carousel', {
      props: {
        id: 'carousel-legacy-fade',
        fade: true,
        slides: [
          { src: 'img1.jpg', alt: 'Slide 1', caption: '' },
          { src: 'img2.jpg', alt: 'Slide 2', caption: '' }
        ]
      },
      classes: ['carousel', 'slide']
    });
    const html = blockToHtml([block]);
    expect(html).toContain('carousel-fade')
  });

  it('renders tailwind carousel with transition mode and animated slide markup', () => {
    const block = createBlock('carousel', {
      props: {
        id: 'tw-carousel',
        transition: 'fade',
        slides: [
          { src: 'img1.jpg', alt: 'Slide 1', caption: 'One' },
          { src: 'img2.jpg', alt: 'Slide 2', caption: 'Two' }
        ]
      },
      classes: ['carousel', 'slide']
    });

    const html = blockToHtml([block], { framework: 'tailwind' });
    expect(html).toContain('data-tw-carousel-transition="fade"');
    expect(html).toContain('data-tw-active="true"');
    expect(html).toContain('transition-opacity');
    expect(html).not.toContain('class="hidden"')
  });

  it('renders carousel images at a fixed height when configured', () => {
    const block = createBlock('carousel', {
      props: {
        id: 'carousel-fixed-height',
        imageHeightMode: 'fixed',
        imageHeight: '320px',
        slides: [
          { src: 'img1.jpg', alt: 'Slide 1', caption: '' },
          { src: 'img2.jpg', alt: 'Slide 2', caption: '' }
        ]
      },
      classes: ['carousel', 'slide']
    });

    const html = blockToHtml([block]);
    expect(html).toContain('height: 320px');
    expect(html).toContain('object-fit: cover')
  });

  it('renders carousel images following the first image height when configured', () => {
    const block = createBlock('carousel', {
      props: {
        id: 'carousel-follow-first',
        imageHeightMode: 'follow-first',
        slides: [
          { src: 'img1.jpg', alt: 'Slide 1', caption: '' },
          { src: 'img2.jpg', alt: 'Slide 2', caption: '' }
        ]
      },
      classes: ['carousel', 'slide']
    });

    const html = blockToHtml([block]);
    expect(html).toContain('height: var(--amagon-carousel-image-height, auto)');
    expect(html).toContain('onload="(function(img)')
  });

  it('renders form with horizontal layout', () => {
    const block = createBlock('form', { props: { layout: 'horizontal', validated: false }, classes: [] });
    const html = blockToHtml([block]);
    expect(html).toContain('class="row"')
  });

  it('renders form with was-validated class when validated=true', () => {
    const block = createBlock('form', { props: { layout: 'vertical', validated: true }, classes: [] });
    const html = blockToHtml([block]);
    expect(html).toContain('was-validated')
  })
});
