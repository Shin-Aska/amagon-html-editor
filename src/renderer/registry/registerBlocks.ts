import { IMAGE_PLACEHOLDER, ICON_PLACEHOLDER } from '../utils/placeholders'

import { componentRegistry } from './ComponentRegistry'

export function registerBlocks(): void {
  // ─── Layout ──────────────────────────────────────────────────────────────────
  componentRegistry.register({
    type: 'container',
    label: 'Container',
    category: 'Layout',
    icon: '▢',
    defaultClasses: ['container', 'py-4'],
    propsSchema: {
      fluid: { type: 'boolean', label: 'Fluid Width', default: false },
      isForm: { type: 'boolean', label: 'Treat as Form', default: false, group: 'Form' },
      action: { type: 'text', label: 'Action URL', default: '', group: 'Form' },
      method: {
        type: 'select',
        label: 'Method',
        options: [
          { label: 'GET', value: 'get' },
          { label: 'POST', value: 'post' }
        ],
        group: 'Form'
      }
    }
  })

  componentRegistry.register({
    type: 'row',
    label: 'Row',
    category: 'Layout',
    icon: '≡',
    defaultClasses: ['row'],
    propsSchema: {
      gutters: { type: 'boolean', label: 'Gutters', default: true }
    }
  })

  componentRegistry.register({
    type: 'column',
    label: 'Column',
    category: 'Layout',
    icon: '▣',
    defaultClasses: ['col'],
    propsSchema: {
      width: {
        type: 'select',
        label: 'Width',
        options: [
          { label: 'Auto', value: 'col' },
          { label: '1', value: 'col-1' },
          { label: '2', value: 'col-2' },
          { label: '3', value: 'col-3' },
          { label: '4', value: 'col-4' },
          { label: '5', value: 'col-5' },
          { label: '6', value: 'col-6' },
          { label: '7', value: 'col-7' },
          { label: '8', value: 'col-8' },
          { label: '9', value: 'col-9' },
          { label: '10', value: 'col-10' },
          { label: '11', value: 'col-11' },
          { label: '12', value: 'col-12' }
        ]
      }
    }
  })

  componentRegistry.register({
    type: 'divider',
    label: 'Divider',
    category: 'Layout',
    icon: '—',
    defaultClasses: [],
    propsSchema: {}
  })

  // ─── Typography ──────────────────────────────────────────────────────────────
  componentRegistry.register({
    type: 'heading',
    label: 'Heading',
    category: 'Typography',
    icon: 'H',
    defaultProps: { text: 'Heading', level: 2 },
    propsSchema: {
      text: { type: 'text', label: 'Text', default: 'Heading' },
      level: {
        type: 'select',
        label: 'Level',
        options: [
          { label: 'H1', value: 1 },
          { label: 'H2', value: 2 },
          { label: 'H3', value: 3 },
          { label: 'H4', value: 4 },
          { label: 'H5', value: 5 },
          { label: 'H6', value: 6 }
        ]
      },
      alignment: {
        type: 'select',
        label: 'Alignment',
        options: [
          { label: 'Left', value: 'text-start' },
          { label: 'Center', value: 'text-center' },
          { label: 'Right', value: 'text-end' }
        ]
      }
    }
  })

  componentRegistry.register({
    type: 'paragraph',
    label: 'Paragraph',
    category: 'Typography',
    icon: 'P',
    defaultProps: { text: 'Paragraph text' },
    propsSchema: {
      text: { type: 'textarea', label: 'Content', default: 'Paragraph text' },
      lead: { type: 'boolean', label: 'Lead Text', default: false },
      alignment: {
        type: 'select',
        label: 'Alignment',
        options: [
          { label: 'Left', value: 'text-start' },
          { label: 'Center', value: 'text-center' },
          { label: 'Right', value: 'text-end' }
        ]
      }
    }
  })

  // ─── Media ───────────────────────────────────────────────────────────────────
  componentRegistry.register({
    type: 'image',
    label: 'Image',
    category: 'Media',
    icon: '📷',
    defaultProps: { src: IMAGE_PLACEHOLDER, alt: 'Image' },
    defaultClasses: ['img-fluid'],
    propsSchema: {
      src: { type: 'image', label: 'Source URL', default: IMAGE_PLACEHOLDER },
      alt: { type: 'text', label: 'Alt Text', default: 'Image' }
    }
  })

  componentRegistry.register({
    type: 'video',
    label: 'Video',
    category: 'Media',
    icon: '▶',
    defaultProps: { src: '', controls: true },
    defaultClasses: ['w-100'],
    propsSchema: {
      src: { type: 'video', label: 'Video URL', default: '' },
      controls: { type: 'boolean', label: 'Show Controls', default: true },
      autoplay: { type: 'boolean', label: 'Autoplay', default: false },
      loop: { type: 'boolean', label: 'Loop', default: false }
    }
  })

  componentRegistry.register({
    type: 'icon',
    label: 'Icon',
    category: 'Media',
    icon: '★',
    propsSchema: {
      iconClass: { type: 'icon', label: 'Icon', default: 'lucide:star' },
      size: { type: 'measurement', label: 'Font Size', default: '2rem' },
      color: { type: 'color', label: 'Color', default: 'currentColor' }
    }
  })

  componentRegistry.register({
    type: 'carousel',
    label: 'Carousel',
    category: 'Media',
    icon: '🎠',
    defaultClasses: ['carousel', 'slide'],
    defaultProps: {
      id: 'carousel-' + Math.random().toString(36).substr(2, 9),
      slides: [
        { src: IMAGE_PLACEHOLDER, alt: 'Slide 1', caption: 'First Slide' },
        { src: IMAGE_PLACEHOLDER, alt: 'Slide 2', caption: 'Second Slide' },
        { src: IMAGE_PLACEHOLDER, alt: 'Slide 3', caption: 'Third Slide' }
      ]
    },
    propsSchema: {
      slides: {
        type: 'carousel',
        label: 'Slides',
        default: []
      }
    }
  })

  // ─── Interactive ─────────────────────────────────────────────────────────────
  componentRegistry.register({
    type: 'button',
    label: 'Button',
    category: 'Interactive',
    icon: '☐',
    defaultProps: { text: 'Button', type: 'button' },
    defaultClasses: ['btn', 'btn-primary', 'mt-3'],
    propsSchema: {
      text: { type: 'text', label: 'Label', default: 'Button' },
      href: { type: 'url', label: 'Link URL', default: '', group: 'Link' },
      target: {
        type: 'select',
        label: 'Target',
        options: [
          { label: 'Same Tab', value: '_self' },
          { label: 'New Tab', value: '_blank' }
        ],
        group: 'Link'
      },
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Primary', value: 'btn-primary' },
          { label: 'Secondary', value: 'btn-secondary' },
          { label: 'Success', value: 'btn-success' },
          { label: 'Danger', value: 'btn-danger' },
          { label: 'Warning', value: 'btn-warning' },
          { label: 'Info', value: 'btn-info' },
          { label: 'Light', value: 'btn-light' },
          { label: 'Dark', value: 'btn-dark' },
          { label: 'Link', value: 'btn-link' }
        ]
      },
      size: {
        type: 'select',
        label: 'Size',
        options: [
          { label: 'Small', value: 'btn-sm' },
          { label: 'Default', value: '' },
          { label: 'Large', value: 'btn-lg' }
        ]
      }
    }
  })

  componentRegistry.register({
    type: 'link',
    label: 'Link',
    category: 'Interactive',
    icon: '🔗',
    defaultProps: { text: 'Link', href: '#' },
    propsSchema: {
      text: { type: 'text', label: 'Text', default: 'Link' },
      href: { type: 'url', label: 'URL', default: '#' },
      target: {
        type: 'select',
        label: 'Target',
        options: [
          { label: 'Same Tab', value: '_self' },
          { label: 'New Tab', value: '_blank' }
        ]
      }
    }
  })

  componentRegistry.register({
    type: 'form',
    label: 'Form',
    category: 'Interactive',
    icon: '📝',
    defaultClasses: [],
    propsSchema: {
      action: { type: 'text', label: 'Action URL', default: '' },
      method: {
        type: 'select',
        label: 'Method',
        options: [
          { label: 'GET', value: 'get' },
          { label: 'POST', value: 'post' }
        ]
      }
    }
  })

  componentRegistry.register({
    type: 'input',
    label: 'Input',
    category: 'Interactive',
    icon: 'I',
    defaultClasses: ['form-control', 'mb-3'],
    propsSchema: {
      type: {
        type: 'select',
        label: 'Type',
        options: [
          { label: 'Text', value: 'text' },
          { label: 'Email', value: 'email' },
          { label: 'Password', value: 'password' },
          { label: 'Number', value: 'number' }
        ]
      },
      placeholder: { type: 'text', label: 'Placeholder', default: '' },
      name: { type: 'text', label: 'Name', default: '' },
      label: { type: 'text', label: 'Label', default: '' }
    }
  })

  componentRegistry.register({
    type: 'textarea',
    label: 'Textarea',
    category: 'Interactive',
    icon: 'T',
    defaultClasses: ['form-control', 'mb-3'],
    propsSchema: {
      rows: { type: 'number', label: 'Rows', default: 3 },
      placeholder: { type: 'text', label: 'Placeholder', default: '' },
      name: { type: 'text', label: 'Name', default: '' }
    }
  })

  componentRegistry.register({
    type: 'checkbox',
    label: 'Checkbox',
    category: 'Interactive',
    icon: '☑',
    defaultClasses: ['form-check-input'],
    propsSchema: {
      label: { type: 'text', label: 'Label', default: 'Check me' },
      name: { type: 'text', label: 'Name', default: '' },
      checked: { type: 'boolean', label: 'Checked', default: false }
    }
  })

  componentRegistry.register({
    type: 'select',
    label: 'Select',
    category: 'Interactive',
    icon: '▼',
    defaultClasses: ['form-select', 'mb-3'],
    propsSchema: {
      name: { type: 'text', label: 'Name', default: '' },
      options: {
        type: 'array',
        label: 'Options',
        default: ['Option 1', 'Option 2', 'Option 3']
      }
    }
  })

  // ─── Components ──────────────────────────────────────────────────────────────
  componentRegistry.register({
    type: 'navbar',
    label: 'Navbar',
    category: 'Components',
    icon: '≡',
    defaultClasses: ['navbar', 'navbar-expand-lg', 'navbar-theme-light'],
    defaultProps: {
      brandText: 'Brand',
      brandImage: '',
      usePages: true,
      filterTag: ''
    },
    defaultChildren: [
      {
        type: 'container',
        classes: ['container'],
        children: [
          { type: 'link', props: { text: 'Brand', href: '#' }, classes: ['navbar-brand'] }
        ]
      }
    ],
    propsSchema: {
      brandText: { type: 'text', label: 'Brand Text', default: 'Brand' },
      brandImage: { type: 'text', label: 'Brand Image URL (optional)', default: '' },
      usePages: { type: 'boolean', label: 'Use Pages as Links', default: true },
      filterTag: { type: 'combobox', label: 'Filter by Tag (optional)', default: '', dataSource: 'tags' },
      theme: {
        type: 'select',
        label: 'Theme',
        options: [
          { label: 'Light', value: 'navbar-theme-light' },
          { label: 'Dark', value: 'navbar-theme-dark' },
          { label: 'Primary', value: 'navbar-theme-primary' }
        ]
      }
    }
  })

  componentRegistry.register({
    type: 'hero',
    label: 'Hero',
    category: 'Components',
    icon: '★',
    // Hero is technically a section
    defaultClasses: ['py-5', 'bg-light'],
    defaultChildren: [
      {
        type: 'container',
        classes: ['container'],
        children: [
          { type: 'heading', props: { text: 'Hero Title', level: 1 }, classes: ['mb-3'] },
          { type: 'paragraph', props: { text: 'A short hero description goes here.' }, classes: ['text-muted', 'mb-4'] },
          { type: 'button', props: { text: 'Primary action', type: 'button' }, classes: ['btn', 'btn-primary'] }
        ]
      }
    ],
    propsSchema: {}
  })

  componentRegistry.register({
    type: 'feature-card',
    label: 'Feature Card',
    category: 'Components',
    icon: '🗃',
    defaultClasses: ['card', 'mb-3'],
    defaultChildren: [
      {
        type: 'image',
        props: { src: IMAGE_PLACEHOLDER, alt: 'Feature' },
        classes: ['card-img-top']
      },
      {
        type: 'container', // Using container as card-body
        classes: ['card-body'],
        children: [
          { type: 'heading', props: { text: 'Feature Title', level: 5 }, classes: ['card-title'] },
          { type: 'paragraph', props: { text: 'Some quick example text to build on the card title.' }, classes: ['card-text'] },
          { type: 'button', props: { text: 'Go somewhere', type: 'button' }, classes: ['btn', 'btn-primary'] }
        ]
      }
    ],
    propsSchema: {}
  })

  componentRegistry.register({
    type: 'footer',
    label: 'Footer',
    category: 'Components',
    icon: '⚙',
    defaultClasses: ['py-4', 'border-top'],
    defaultChildren: [
      {
        type: 'container',
        classes: ['container'],
        children: [
          { type: 'paragraph', props: { text: '© Your Company' }, classes: ['text-muted', 'mb-0'] }
        ]
      }
    ],
    propsSchema: {}
  })

  componentRegistry.register({
    type: 'accordion',
    label: 'Accordion',
    category: 'Components',
    icon: '☰',
    defaultClasses: ['accordion'],
    defaultProps: {
      id: 'accordion-' + Math.random().toString(36).substr(2, 9),
      items: [
        { title: 'Accordion Item #1', content: 'This is the first item\'s accordion body.' },
        { title: 'Accordion Item #2', content: 'This is the second item\'s accordion body.' },
        { title: 'Accordion Item #3', content: 'This is the third item\'s accordion body.' }
      ]
    },
    propsSchema: {
      items: { type: 'array', label: 'Items', default: [] }
    }
  })

  componentRegistry.register({
    type: 'tabs',
    label: 'Tabs',
    category: 'Components',
    icon: '📑',
    defaultClasses: [],
    defaultProps: {
      id: 'tabs-' + Math.random().toString(36).substr(2, 9),
      tabs: [
        { label: 'Home', content: 'Home tab content.' },
        { label: 'Profile', content: 'Profile tab content.' },
        { label: 'Contact', content: 'Contact tab content.' }
      ]
    },
    propsSchema: {
      tabs: { type: 'array', label: 'Tabs', default: [] }
    }
  })

  componentRegistry.register({
    type: 'pricing-table',
    label: 'Pricing Table',
    category: 'Components',
    icon: '💲',
    defaultClasses: ['row', 'row-cols-1', 'row-cols-md-3', 'mb-3', 'text-center'],
    defaultChildren: [
      {
        type: 'column',
        classes: ['col'],
        children: [
          {
            type: 'container', // card
            classes: ['card', 'mb-4', 'rounded-3', 'shadow-sm'],
            children: [
              {
                type: 'container', // header
                classes: ['card-header', 'py-3'],
                children: [{ type: 'heading', props: { text: 'Free', level: 4 }, classes: ['my-0', 'fw-normal'] }]
              },
              {
                type: 'container', // body
                classes: ['card-body'],
                children: [
                  { type: 'heading', props: { text: '$0', level: 1 }, classes: ['card-title', 'pricing-card-title'] },
                  { type: 'list', props: { items: ['10 users included', '2 GB of storage', 'Email support', 'Help center access'] }, classes: ['list-unstyled', 'mt-3', 'mb-4'] },
                  { type: 'button', props: { text: 'Sign up for free', type: 'button' }, classes: ['w-100', 'btn', 'btn-lg', 'btn-outline-primary'] }
                ]
              }
            ]
          }
        ]
      },
      // ... Duplicate for other plans if needed, but user can duplicate the column
    ],
    propsSchema: {}
  })

  componentRegistry.register({
    type: 'testimonial',
    label: 'Testimonial',
    category: 'Components',
    icon: '💬',
    defaultClasses: ['card', 'text-center'],
    defaultChildren: [
      {
        type: 'container',
        classes: ['card-header'],
        children: [{ type: 'paragraph', props: { text: 'Testimonial' }, classes: ['mb-0'] }]
      },
      {
        type: 'container',
        classes: ['card-body'],
        children: [
          { type: 'blockquote', props: { text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante.', footer: 'Someone famous in Source Title' }, classes: ['blockquote', 'mb-0'] }
        ]
      }
    ],
    propsSchema: {}
  })

  componentRegistry.register({
    type: 'cta-section',
    label: 'Call to Action',
    category: 'Components',
    icon: '📣',
    defaultClasses: ['px-4', 'py-5', 'my-5', 'text-center'],
    defaultChildren: [
      { type: 'image', props: { src: IMAGE_PLACEHOLDER, alt: 'Logo' }, classes: ['d-block', 'mx-auto', 'mb-4'] },
      { type: 'heading', props: { text: 'Centered hero', level: 1 }, classes: ['display-5', 'fw-bold', 'text-body-emphasis'] },
      {
        type: 'column',
        classes: ['col-lg-6', 'mx-auto'],
        children: [
          { type: 'paragraph', props: { text: 'Quickly design and customize responsive mobile-first sites with Bootstrap, the world’s most popular front-end open source toolkit.', lead: true }, classes: ['lead', 'mb-4'] },
          {
            type: 'container',
            classes: ['d-grid', 'gap-2', 'd-sm-flex', 'justify-content-sm-center'],
            children: [
              { type: 'button', props: { text: 'Primary button', type: 'button' }, classes: ['btn', 'btn-primary', 'btn-lg', 'px-4', 'gap-3'] },
              { type: 'button', props: { text: 'Secondary', type: 'button' }, classes: ['btn', 'btn-outline-secondary', 'btn-lg', 'px-4'] }
            ]
          }
        ]
      }
    ],
    propsSchema: {}
  })

  componentRegistry.register({
    type: 'modal',
    label: 'Modal',
    category: 'Components',
    icon: '🔲',
    defaultClasses: [], // Wrapper handling in blockToHtml
    defaultProps: {
      id: 'modal-' + Math.random().toString(36).substr(2, 9),
      buttonText: 'Launch Modal',
      title: 'Modal Title',
      closeButton: true,
      footerButtons: true,
      size: 'default'
    },
    defaultChildren: [
      {
        type: 'paragraph',
        props: { text: 'Modal body text goes here.' },
        classes: ['mb-0']
      }
    ],
    propsSchema: {
      id: { type: 'text', label: 'Modal ID', default: 'modal-example', description: 'To trigger programmatically: bootstrap.Modal.getOrCreateInstance(document.getElementById("your-modal-id")).show()' },
      buttonText: { type: 'text', label: 'Button Text', default: 'Launch Modal' },
      title: { type: 'text', label: 'Title', default: 'Modal Title' },
      closeButton: { type: 'boolean', label: 'Show Close Button', default: true },
      footerButtons: { type: 'boolean', label: 'Show Footer Buttons', default: true },
      size: {
        type: 'select',
        label: 'Size',
        default: 'default',
        options: [
          { label: 'Small', value: 'modal-sm' },
          { label: 'Default', value: 'default' },
          { label: 'Large', value: 'modal-lg' },
          { label: 'Extra Large', value: 'modal-xl' }
        ]
      }
    }
  })

  componentRegistry.register({
    type: 'page-list',
    label: 'Page List',
    category: 'Components',
    icon: '📰',
    defaultClasses: [],
    defaultProps: {
      filterTag: '',
      itemsPerPage: 6,
      columns: 3,
      showSearch: false,
      showSort: false,
      sortLayout: 'inline',
      sortPriority: ['title', 'datePublished'],
      sortDefaultDir: 'asc',
      detailsMode: 'description',
      metaKeys: ['datePublished']
    },
    propsSchema: {
      filterTag: { type: 'combobox', label: 'Filter by Tag', default: '', dataSource: 'tags', group: 'Filter' },
      itemsPerPage: { type: 'number', label: 'Items per Page', default: 6, min: 1, max: 50, group: 'Layout' },
      columns: {
        type: 'select',
        label: 'Columns',
        group: 'Layout',
        options: [
          { label: '1 Column', value: 1 },
          { label: '2 Columns', value: 2 },
          { label: '3 Columns', value: 3 }
        ]
      },
      showSearch: {
        type: 'boolean',
        label: 'Show Search',
        group: 'Controls',
        default: false
      },
      showSort: {
        type: 'boolean',
        label: 'Show Sort',
        group: 'Controls',
        default: false
      },
      sortLayout: {
        type: 'select',
        label: 'Sort Layout',
        group: 'Controls',
        default: 'inline',
        options: [
          { label: 'Inline with Search (wrap)', value: 'inline' },
          { label: 'New Row (centered)', value: 'new-row' }
        ]
      },
      sortPriority: {
        type: 'sortable-list',
        label: 'Sort Priority',
        group: 'Controls',
        default: ['title', 'datePublished'],
        description: 'Reorder sort keys. The first item is the default sort key. Sort options come from Meta fields + Title.',
        dataSource: 'pageListSortPriority'
      },
      sortDefaultDir: {
        type: 'select',
        label: 'Default Sort Direction',
        group: 'Controls',
        default: 'asc',
        options: [
          { label: 'Ascending', value: 'asc' },
          { label: 'Descending', value: 'desc' }
        ]
      },
      detailsMode: {
        type: 'select',
        label: 'Details',
        group: 'Content',
        options: [
          { label: 'Title only', value: 'none' },
          { label: 'Description', value: 'description' },
          { label: 'Meta fields', value: 'meta' },
          { label: 'Meta fields + Description', value: 'description+meta' }
        ],
        default: 'description'
      },
      metaKeys: {
        type: 'multi-combobox',
        label: 'Meta fields',
        group: 'Content',
        description: 'Select meta keys to display, e.g. author, keywords, robots.',
        default: ['datePublished'],
        dataSource: 'metaKeys'
      }
    }
  })

  // ─── Embed ───────────────────────────────────────────────────────────────────
  componentRegistry.register({
    type: 'raw-html',
    label: 'Raw HTML',
    category: 'Embed',
    icon: '</>',
    propsSchema: {
      content: { type: 'textarea', label: 'HTML Code', default: '<div>Raw HTML content</div>' }
    }
  })

  componentRegistry.register({
    type: 'iframe',
    label: 'Iframe',
    category: 'Embed',
    icon: '🌐',
    defaultClasses: ['w-100', 'border'],
    defaultStyles: { height: '300px' },
    propsSchema: {
      src: { type: 'text', label: 'Source URL', default: 'https://example.com' },
      title: { type: 'text', label: 'Title', default: 'Embedded Content' }
    }
  })

  // ─── Missing Typography/Layout ───────────────────────────────────────────────
  componentRegistry.register({
    type: 'section',
    label: 'Section',
    category: 'Layout',
    icon: '▭',
    defaultClasses: ['py-5'],
    propsSchema: {}
  })

  componentRegistry.register({
    type: 'blockquote',
    label: 'Blockquote',
    category: 'Typography',
    icon: '❝',
    defaultClasses: ['blockquote'],
    defaultProps: {
      text: 'A well-known quote, contained in a blockquote element.',
      footer: 'Someone famous'
    },
    propsSchema: {
      text: { type: 'textarea', label: 'Quote', default: 'A well-known quote, contained in a blockquote element.' },
      footer: { type: 'text', label: 'Source', default: 'Someone famous' }
    }
  })

  componentRegistry.register({
    type: 'list',
    label: 'List',
    category: 'Typography',
    icon: '☰',
    defaultProps: { ordered: false, items: ['Item 1', 'Item 2', 'Item 3'] },
    propsSchema: {
      ordered: { type: 'boolean', label: 'Ordered', default: false },
      items: { type: 'array', label: 'Items', default: ['Item 1', 'Item 2', 'Item 3'] }
    }
  })

  componentRegistry.register({
    type: 'code-block',
    label: 'Code Block',
    category: 'Typography',
    icon: '{ }',
    defaultClasses: ['bg-dark', 'text-light', 'p-3', 'rounded', 'position-relative'],
    defaultProps: {
      code: 'console.log("Hello world");',
      language: 'javascript'
    },
    propsSchema: {
      code: { type: 'textarea', label: 'Code', default: 'console.log("Hello world");' },
      language: {
        type: 'select',
        label: 'Language',
        options: [
          { label: 'Auto (Detect)', value: '' },
          { label: 'JavaScript', value: 'javascript' },
          { label: 'TypeScript', value: 'typescript' },
          { label: 'HTML', value: 'html' },
          { label: 'CSS', value: 'css' },
          { label: 'Python', value: 'python' }
        ]
      }
    }
  })
}
