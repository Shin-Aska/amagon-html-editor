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
      section: { type: 'boolean', label: 'Use Section Tag', default: false },
      id: { type: 'text', label: 'Section ID', default: '' },
      bgColor: { type: 'color', label: 'Background Color', default: '', group: 'Background' },
      bgImage: { type: 'image', label: 'Background Image', default: '', group: 'Background' },
      bgOverlay: { type: 'color', label: 'Overlay Color', default: '', group: 'Background' },
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
      },
      colSm: { type: 'number', label: 'SM Cols (1-12)', default: 0, min: 0, max: 12 },
      colMd: { type: 'number', label: 'MD Cols (1-12)', default: 0, min: 0, max: 12 },
      colLg: { type: 'number', label: 'LG Cols (1-12)', default: 0, min: 0, max: 12 },
      colXl: { type: 'number', label: 'XL Cols (1-12)', default: 0, min: 0, max: 12 },
      offset: { type: 'number', label: 'Offset (0-11)', default: 0, min: 0, max: 11 },
      order: { type: 'number', label: 'Order (0-12)', default: 0, min: 0, max: 12 }
    }
  })

  componentRegistry.register({
    type: 'divider',
    label: 'Divider',
    category: 'Layout',
    icon: '—',
    defaultClasses: [],
    defaultProps: { style: 'solid', thickness: '1px', color: '', withText: '', withIcon: '' },
    propsSchema: {
      style: {
        type: 'select',
        label: 'Style',
        options: [
          { label: 'Solid', value: 'solid' },
          { label: 'Dashed', value: 'dashed' },
          { label: 'Dotted', value: 'dotted' },
          { label: 'Double', value: 'double' },
          { label: 'Gradient', value: 'gradient' }
        ],
        default: 'solid'
      },
      thickness: { type: 'text', label: 'Thickness', default: '1px' },
      color: { type: 'color', label: 'Color', default: '' },
      withText: { type: 'text', label: 'Center Text', default: '' },
      withIcon: { type: 'icon', label: 'Center Icon', default: '' }
    }
  })

  componentRegistry.register({
    type: 'spacer',
    label: 'Spacer',
    category: 'Layout',
    icon: '↕',
    defaultClasses: [],
    defaultProps: { height: '2rem', responsiveSm: '', responsiveMd: '', responsiveLg: '', responsiveXl: '' },
    propsSchema: {
      height: { type: 'text', label: 'Height', default: '2rem' },
      responsiveSm: { type: 'text', label: 'SM Height', default: '', description: 'Override height at sm breakpoint' },
      responsiveMd: { type: 'text', label: 'MD Height', default: '', description: 'Override height at md breakpoint' },
      responsiveLg: { type: 'text', label: 'LG Height', default: '', description: 'Override height at lg breakpoint' },
      responsiveXl: { type: 'text', label: 'XL Height', default: '', description: 'Override height at xl breakpoint' }
    }
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
      },
      anchorId: { type: 'text', label: 'Anchor ID', default: '', description: 'Adds id attribute for scroll anchors' },
      decorative: {
        type: 'select',
        label: 'Decoration',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Underline', value: 'underline' },
          { label: 'Gradient Underline', value: 'gradient-underline' }
        ],
        default: 'none'
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
      },
      dropCap: { type: 'boolean', label: 'Drop Cap', default: false },
      columns: {
        type: 'select',
        label: 'Columns',
        options: [
          { label: '1 Column', value: '1' },
          { label: '2 Columns', value: '2' },
          { label: '3 Columns', value: '3' }
        ],
        default: '1'
      }
    }
  })

  // ─── Media ───────────────────────────────────────────────────────────────────
  componentRegistry.register({
    type: 'image',
    label: 'Image',
    category: 'Media',
    icon: '📷',
    defaultProps: {
      src: IMAGE_PLACEHOLDER,
      alt: 'Image',
      caption: '',
      captionPosition: 'below',
      objectFit: 'cover',
      aspectRatio: 'auto',
      lazyLoad: true,
      lightbox: false
    },
    defaultClasses: ['img-fluid'],
    propsSchema: {
      src: { type: 'image', label: 'Source URL', default: IMAGE_PLACEHOLDER },
      alt: { type: 'text', label: 'Alt Text', default: 'Image' },
      caption: { type: 'text', label: 'Caption', default: '' },
      captionPosition: {
        type: 'select',
        label: 'Caption Position',
        options: [
          { label: 'Below Image', value: 'below' },
          { label: 'Overlay Bottom', value: 'overlay-bottom' }
        ],
        default: 'below'
      },
      objectFit: {
        type: 'select',
        label: 'Object Fit',
        options: [
          { label: 'Cover', value: 'cover' },
          { label: 'Contain', value: 'contain' },
          { label: 'Fill', value: 'fill' },
          { label: 'None', value: 'none' },
          { label: 'Scale Down', value: 'scale-down' }
        ],
        default: 'cover'
      },
      aspectRatio: {
        type: 'select',
        label: 'Aspect Ratio',
        options: [
          { label: 'Auto', value: 'auto' },
          { label: '1:1', value: '1:1' },
          { label: '4:3', value: '4:3' },
          { label: '16:9', value: '16:9' },
          { label: '21:9', value: '21:9' }
        ],
        default: 'auto'
      },
      lazyLoad: { type: 'boolean', label: 'Lazy Load', default: true },
      lightbox: { type: 'boolean', label: 'Lightbox Link', default: false }
    }
  })

  componentRegistry.register({
    type: 'video',
    label: 'Video',
    category: 'Media',
    icon: '▶',
    defaultProps: {
      src: '',
      controls: true,
      autoplay: false,
      loop: false,
      muted: false,
      preload: 'metadata',
      poster: '',
      aspectRatio: '16:9'
    },
    defaultClasses: ['w-100'],
    propsSchema: {
      src: { type: 'video', label: 'Video URL', default: '' },
      controls: { type: 'boolean', label: 'Show Controls', default: true },
      autoplay: { type: 'boolean', label: 'Autoplay', default: false },
      loop: { type: 'boolean', label: 'Loop', default: false },
      muted: { type: 'boolean', label: 'Muted', default: false },
      poster: { type: 'image', label: 'Poster Image', default: '' },
      preload: {
        type: 'select',
        label: 'Preload',
        options: [
          { label: 'Auto', value: 'auto' },
          { label: 'Metadata', value: 'metadata' },
          { label: 'None', value: 'none' }
        ],
        default: 'metadata'
      },
      aspectRatio: {
        type: 'select',
        label: 'Aspect Ratio',
        options: [
          { label: '16:9', value: '16:9' },
          { label: '4:3', value: '4:3' },
          { label: '1:1', value: '1:1' },
          { label: '21:9', value: '21:9' }
        ],
        default: '16:9'
      }
    }
  })

  componentRegistry.register({
    type: 'icon',
    label: 'Icon',
    category: 'Media',
    icon: '★',
    propsSchema: {
      iconClass: { type: 'icon', label: 'Icon', default: 'lucide:star' },
      size: {
        type: 'select',
        label: 'Size',
        options: [
          { label: 'XS', value: 'xs' },
          { label: 'SM', value: 'sm' },
          { label: 'MD', value: 'md' },
          { label: 'LG', value: 'lg' },
          { label: 'XL', value: 'xl' },
          { label: '2XL', value: '2xl' }
        ],
        default: 'md'
      },
      color: { type: 'color', label: 'Color', default: 'currentColor' },
      spin: { type: 'boolean', label: 'Spin', default: false },
      fixedWidth: { type: 'boolean', label: 'Fixed Width', default: false }
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
      ],
      transition: 'slide',
      imageHeightMode: 'auto',
      imageHeight: '400px',
      fade: false,
      thumbnails: false,
      interval: 5000
    },
    propsSchema: {
      slides: {
        type: 'carousel',
        label: 'Slides',
        default: []
      },
      transition: {
        type: 'select',
        label: 'Transition',
        options: [
          { label: 'Slide', value: 'slide' },
          { label: 'Fade', value: 'fade' }
        ],
        default: 'slide'
      },
      imageHeightMode: {
        type: 'select',
        label: 'Image Height',
        options: [
          { label: 'Auto', value: 'auto' },
          { label: 'Fixed', value: 'fixed' },
          { label: 'Follow First Image', value: 'follow-first' }
        ],
        default: 'auto'
      },
      imageHeight: { type: 'measurement', label: 'Fixed Height', default: '400px' },
      thumbnails: { type: 'boolean', label: 'Show Thumbnails', default: false },
      interval: { type: 'number', label: 'Interval (ms)', default: 5000, min: 1000, max: 30000 }
    }
  })

  // ─── Interactive ─────────────────────────────────────────────────────────────
  componentRegistry.register({
    type: 'button',
    label: 'Button',
    category: 'Interactive',
    icon: '☐',
    defaultProps: {
      text: 'Button',
      type: 'button',
      iconLeft: '',
      iconRight: '',
      outline: false,
      block: false,
      loading: false,
      loadingText: 'Loading...',
      disabled: false
    },
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
      },
      iconLeft: { type: 'icon', label: 'Left Icon', default: '' },
      iconRight: { type: 'icon', label: 'Right Icon', default: '' },
      outline: { type: 'boolean', label: 'Outline Style', default: false },
      block: { type: 'boolean', label: 'Block Width', default: false },
      loading: { type: 'boolean', label: 'Loading State', default: false },
      loadingText: { type: 'text', label: 'Loading Text', default: 'Loading...' },
      disabled: { type: 'boolean', label: 'Disabled', default: false }
    }
  })

  componentRegistry.register({
    type: 'link',
    label: 'Link',
    category: 'Interactive',
    icon: '🔗',
    defaultProps: { text: 'Link', href: '#', button: false, newTab: false, iconLeft: '', iconRight: '' },
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
      },
      newTab: { type: 'boolean', label: 'Open in New Tab', default: false },
      button: { type: 'boolean', label: 'Render as Button', default: false },
      variant: {
        type: 'select',
        label: 'Button Variant',
        options: [
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary', value: 'secondary' },
          { label: 'Success', value: 'success' },
          { label: 'Danger', value: 'danger' },
          { label: 'Warning', value: 'warning' },
          { label: 'Info', value: 'info' },
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' },
          { label: 'Outline Primary', value: 'outline-primary' }
        ],
        default: 'primary'
      },
      iconLeft: { type: 'icon', label: 'Left Icon', default: '' },
      iconRight: { type: 'icon', label: 'Right Icon', default: '' }
    }
  })

  componentRegistry.register({
    type: 'form',
    label: 'Form',
    category: 'Interactive',
    icon: '📝',
    defaultClasses: [],
    defaultProps: { layout: 'vertical', validated: false },
    propsSchema: {
      action: { type: 'text', label: 'Action URL', default: '' },
      method: {
        type: 'select',
        label: 'Method',
        options: [
          { label: 'GET', value: 'get' },
          { label: 'POST', value: 'post' }
        ]
      },
      layout: {
        type: 'select',
        label: 'Layout',
        options: [
          { label: 'Vertical', value: 'vertical' },
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Inline', value: 'inline' }
        ],
        default: 'vertical'
      },
      validated: { type: 'boolean', label: 'Mark as Validated', default: false }
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
      label: { type: 'text', label: 'Label', default: '' },
      prepend: { type: 'text', label: 'Prepend Text', default: '' },
      append: { type: 'text', label: 'Append Text', default: '' },
      floatingLabel: { type: 'boolean', label: 'Floating Label', default: false },
      validationState: {
        type: 'select',
        label: 'Validation State',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Valid', value: 'valid' },
          { label: 'Invalid', value: 'invalid' }
        ],
        default: 'none'
      },
      validationMessage: { type: 'text', label: 'Validation Message', default: '' },
      helpText: { type: 'text', label: 'Help Text', default: '' }
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
      checked: { type: 'boolean', label: 'Checked', default: false },
      switch: { type: 'boolean', label: 'Switch Style', default: false },
      inline: { type: 'boolean', label: 'Inline', default: false }
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
      },
      items: {
        type: 'array',
        label: 'Grouped Options',
        default: []
      },
      multiple: { type: 'boolean', label: 'Multiple Select', default: false },
      size: { type: 'number', label: 'Visible Rows', default: 4, min: 2, max: 20 },
      optgroups: { type: 'boolean', label: 'Use Option Groups', default: false }
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
      filterTag: '',
      hamburgerMenu: true,
      stickyOffset: '0'
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
      brandImage: { type: 'image', label: 'Brand Image', default: '' },
      usePages: { type: 'boolean', label: 'Use Pages as Links', default: true },
      filterTag: { type: 'combobox', label: 'Filter by Tag (optional)', default: '', dataSource: 'tags' },
      hamburgerMenu: { type: 'boolean', label: 'Hamburger Menu (Mobile)', default: true },
      sticky: { type: 'boolean', label: 'Sticky (top)', default: false },
      stickyOffset: {
        type: 'select',
        label: 'Sticky Offset',
        options: [
          { label: 'Flush to top', value: '0' },
          { label: 'Small gap', value: '0.5rem' },
          { label: 'Medium gap', value: '1rem' },
          { label: 'Large gap', value: '2rem' }
        ],
        default: '0'
      },
      transparent: { type: 'boolean', label: 'Transparent Background', default: false },
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
    defaultProps: {
      bgImage: '',
      bgVideo: '',
      overlay: false,
      overlayColor: '#000000',
      overlayOpacity: 50,
      alignment: 'center',
      fullHeight: false,
      ctaButtons: []
    },
    propsSchema: {
      bgImage: { type: 'image', label: 'Background Image', default: '', group: 'Background' },
      bgVideo: { type: 'text', label: 'Background Video URL', default: '', group: 'Background' },
      overlay: { type: 'boolean', label: 'Show Overlay', default: false, group: 'Background' },
      overlayColor: { type: 'color', label: 'Overlay Color', default: '#000000', group: 'Background' },
      overlayOpacity: { type: 'number', label: 'Overlay Opacity (0-100)', default: 50, min: 0, max: 100, group: 'Background' },
      alignment: {
        type: 'select',
        label: 'Alignment',
        options: [
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' }
        ],
        default: 'center',
        group: 'Layout'
      },
      fullHeight: { type: 'boolean', label: 'Full Viewport Height', default: false, group: 'Layout' },
      ctaButtons: { type: 'array', label: 'CTA Buttons', default: [], group: 'Content' }
    }
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
    defaultProps: {
      columns: 1,
      showSocialLinks: false,
      socialLinks: [],
      copyrightText: '',
      showBackToTop: false
    },
    propsSchema: {
      columns: {
        type: 'select',
        label: 'Columns',
        options: [
          { label: '1 Column', value: 1 },
          { label: '2 Columns', value: 2 },
          { label: '3 Columns', value: 3 },
          { label: '4 Columns', value: 4 }
        ],
        default: 1
      },
      showSocialLinks: { type: 'boolean', label: 'Show Social Links', default: false },
      socialLinks: { type: 'array', label: 'Social Links', default: [] },
      copyrightText: { type: 'text', label: 'Copyright Text', default: '' },
      showBackToTop: { type: 'boolean', label: 'Show Back to Top', default: false }
    }
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
      ],
      flush: false,
      alwaysOpen: false
    },
    propsSchema: {
      items: { type: 'array', label: 'Items', default: [] },
      flush: { type: 'boolean', label: 'Flush (no borders/rounded)', default: false },
      alwaysOpen: { type: 'boolean', label: 'Always Open (multiple)', default: false }
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
      defaultTab: 0,
      tabs: [
        { label: 'Home', content: 'Home tab content.', blocks: [] },
        { label: 'Profile', content: 'Profile tab content.', blocks: [] },
        { label: 'Contact', content: 'Contact tab content.', blocks: [] }
      ],
      variant: 'tabs',
      vertical: false,
      justified: false,
      fill: false
    },
    propsSchema: {
      tabs: { type: 'array', label: 'Tabs', default: [] },
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Tabs', value: 'tabs' },
          { label: 'Pills', value: 'pills' },
          { label: 'Underline', value: 'underline' }
        ],
        default: 'tabs'
      },
      vertical: { type: 'boolean', label: 'Vertical Layout', default: false },
      justified: { type: 'boolean', label: 'Justified', default: false },
      fill: { type: 'boolean', label: 'Fill Width', default: false }
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
          { label: 'Extra Large', value: 'modal-xl' },
          { label: 'Fullscreen', value: 'modal-fullscreen' }
        ]
      },
      scrollable: { type: 'boolean', label: 'Scrollable Body', default: false },
      centered: { type: 'boolean', label: 'Vertically Centered', default: false }
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
    defaultProps: { aspectRatio: '16:9', allowFullscreen: true, lazy: false },
    defaultClasses: ['w-100', 'border'],
    defaultStyles: { height: '300px' },
    propsSchema: {
      src: { type: 'text', label: 'Source URL', default: 'https://example.com' },
      title: { type: 'text', label: 'Title', default: 'Embedded Content' },
      aspectRatio: {
        type: 'select',
        label: 'Aspect Ratio',
        options: [
          { label: '16:9', value: '16:9' },
          { label: '4:3', value: '4:3' },
          { label: '1:1', value: '1:1' },
          { label: '21:9', value: '21:9' }
        ],
        default: '16:9'
      },
      allowFullscreen: { type: 'boolean', label: 'Allow Fullscreen', default: true },
      lazy: { type: 'boolean', label: 'Lazy Load', default: false }
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
      footer: 'Someone famous',
      author: '',
      source: '',
      decorative: 'none'
    },
    propsSchema: {
      text: { type: 'textarea', label: 'Quote', default: 'A well-known quote, contained in a blockquote element.' },
      footer: { type: 'text', label: 'Footer (legacy)', default: 'Someone famous' },
      author: { type: 'text', label: 'Author', default: '' },
      source: { type: 'text', label: 'Source', default: '' },
      decorative: {
        type: 'select',
        label: 'Decoration',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Left Border', value: 'border-left' },
          { label: 'Large Quote', value: 'large-quote' }
        ],
        default: 'none'
      }
    }
  })

  componentRegistry.register({
    type: 'list',
    label: 'List',
    category: 'Typography',
    icon: '☰',
    defaultProps: { ordered: false, items: ['Item 1', 'Item 2', 'Item 3'], listStyle: 'disc', horizontal: false },
    propsSchema: {
      ordered: { type: 'boolean', label: 'Ordered', default: false },
      items: { type: 'array', label: 'Items', default: ['Item 1', 'Item 2', 'Item 3'] },
      listStyle: {
        type: 'select',
        label: 'List Style',
        options: [
          { label: 'Disc', value: 'disc' },
          { label: 'Circle', value: 'circle' },
          { label: 'Square', value: 'square' },
          { label: 'None', value: 'none' }
        ],
        default: 'disc'
      },
      horizontal: { type: 'boolean', label: 'Horizontal (Inline)', default: false }
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
      language: 'javascript',
      showLineNumbers: false,
      filename: '',
      copyButton: false
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
      },
      showLineNumbers: { type: 'boolean', label: 'Show Line Numbers', default: false },
      filename: { type: 'text', label: 'Filename', default: '' },
      copyButton: { type: 'boolean', label: 'Show Copy Button', default: false }
    }
  })

  componentRegistry.register({
    type: 'alert',
    label: 'Alert',
    category: 'Components',
    icon: '⚠',
    defaultClasses: ['alert', 'alert-primary'],
    defaultProps: { text: 'A simple alert check it out!', variant: 'alert-primary', dismissible: false, icon: '' },
    propsSchema: {
      text: { type: 'textarea', label: 'Message', default: 'A simple alert check it out!' },
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Primary', value: 'alert-primary' },
          { label: 'Secondary', value: 'alert-secondary' },
          { label: 'Success', value: 'alert-success' },
          { label: 'Danger', value: 'alert-danger' },
          { label: 'Warning', value: 'alert-warning' },
          { label: 'Info', value: 'alert-info' },
          { label: 'Light', value: 'alert-light' },
          { label: 'Dark', value: 'alert-dark' }
        ],
        default: 'alert-primary'
      },
      dismissible: { type: 'boolean', label: 'Dismissible', default: false },
      icon: { type: 'icon', label: 'Icon', default: '' }
    }
  })

  componentRegistry.register({
    type: 'badge',
    label: 'Badge',
    category: 'Components',
    icon: '🏷',
    defaultClasses: ['badge', 'bg-primary'],
    defaultProps: { text: 'New', variant: 'bg-primary', pill: false },
    propsSchema: {
      text: { type: 'text', label: 'Text', default: 'New' },
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Primary', value: 'bg-primary' },
          { label: 'Secondary', value: 'bg-secondary' },
          { label: 'Success', value: 'bg-success' },
          { label: 'Danger', value: 'bg-danger' },
          { label: 'Warning', value: 'bg-warning' },
          { label: 'Info', value: 'bg-info' },
          { label: 'Light', value: 'bg-light' },
          { label: 'Dark', value: 'bg-dark' }
        ],
        default: 'bg-primary'
      },
      pill: { type: 'boolean', label: 'Pill Shape', default: false }
    }
  })

  componentRegistry.register({
    type: 'progress',
    label: 'Progress',
    category: 'Components',
    icon: '▬',
    defaultClasses: ['progress'],
    defaultProps: { value: 50, variant: 'bg-primary', striped: false, animated: false, label: '' },
    propsSchema: {
      value: { type: 'number', label: 'Value (0-100)', default: 50, min: 0, max: 100 },
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Primary', value: 'bg-primary' },
          { label: 'Secondary', value: 'bg-secondary' },
          { label: 'Success', value: 'bg-success' },
          { label: 'Danger', value: 'bg-danger' },
          { label: 'Warning', value: 'bg-warning' },
          { label: 'Info', value: 'bg-info' },
          { label: 'Light', value: 'bg-light' },
          { label: 'Dark', value: 'bg-dark' }
        ],
        default: 'bg-primary'
      },
      striped: { type: 'boolean', label: 'Striped', default: false },
      animated: { type: 'boolean', label: 'Animated', default: false },
      label: { type: 'text', label: 'Label', default: '' }
    }
  })

  componentRegistry.register({
    type: 'spinner',
    label: 'Spinner',
    category: 'Components',
    icon: '⟳',
    defaultClasses: ['spinner-border', 'text-primary'],
    defaultProps: { variant: 'text-primary', type: 'border', size: 'default' },
    propsSchema: {
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Primary', value: 'text-primary' },
          { label: 'Secondary', value: 'text-secondary' },
          { label: 'Success', value: 'text-success' },
          { label: 'Danger', value: 'text-danger' },
          { label: 'Warning', value: 'text-warning' },
          { label: 'Info', value: 'text-info' },
          { label: 'Light', value: 'text-light' },
          { label: 'Dark', value: 'text-dark' }
        ],
        default: 'text-primary'
      },
      type: {
        type: 'select',
        label: 'Type',
        options: [
          { label: 'Border', value: 'border' },
          { label: 'Grow', value: 'grow' }
        ],
        default: 'border'
      },
      size: {
        type: 'select',
        label: 'Size',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Default', value: 'default' }
        ],
        default: 'default'
      }
    }
  })

  componentRegistry.register({
    type: 'radio',
    label: 'Radio',
    category: 'Interactive',
    icon: '⦿',
    defaultClasses: ['form-check'],
    defaultProps: { name: 'radio-group', label: 'Radio option', value: 'option1', checked: false, inline: false, disabled: false },
    propsSchema: {
      name: { type: 'text', label: 'Name', default: 'radio-group' },
      label: { type: 'text', label: 'Label', default: 'Radio option' },
      value: { type: 'text', label: 'Value', default: 'option1' },
      checked: { type: 'boolean', label: 'Checked', default: false },
      inline: { type: 'boolean', label: 'Inline', default: false },
      disabled: { type: 'boolean', label: 'Disabled', default: false }
    }
  })

  componentRegistry.register({
    type: 'range',
    label: 'Range',
    category: 'Interactive',
    icon: '━',
    defaultClasses: ['form-range'],
    defaultProps: { label: 'Example range', min: 0, max: 100, step: 1, value: 50, disabled: false },
    propsSchema: {
      label: { type: 'text', label: 'Label', default: 'Example range' },
      min: { type: 'number', label: 'Min', default: 0 },
      max: { type: 'number', label: 'Max', default: 100 },
      step: { type: 'number', label: 'Step', default: 1 },
      value: { type: 'number', label: 'Value', default: 50 },
      disabled: { type: 'boolean', label: 'Disabled', default: false }
    }
  })

  componentRegistry.register({
    type: 'file-input',
    label: 'File Input',
    category: 'Interactive',
    icon: '📁',
    defaultClasses: ['form-control'],
    defaultProps: { label: 'Upload file', accept: '', multiple: false, disabled: false, size: 'default' },
    propsSchema: {
      label: { type: 'text', label: 'Label', default: 'Upload file' },
      accept: { type: 'text', label: 'Accept (e.g. .jpg, .png)', default: '' },
      multiple: { type: 'boolean', label: 'Multiple', default: false },
      disabled: { type: 'boolean', label: 'Disabled', default: false },
      size: {
        type: 'select',
        label: 'Size',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Default', value: 'default' },
          { label: 'Large', value: 'lg' }
        ],
        default: 'default'
      }
    }
  })

  componentRegistry.register({
    type: 'breadcrumb',
    label: 'Breadcrumb',
    category: 'Components',
    icon: '❯',
    defaultClasses: ['breadcrumb'],
    defaultProps: {
      items: [
        { label: 'Home', href: '#', active: false },
        { label: 'Library', href: '#', active: false },
        { label: 'Data', href: '#', active: true }
      ],
      divider: 'slash'
    },
    propsSchema: {
      items: { type: 'array', label: 'Items', default: [] },
      divider: {
        type: 'select',
        label: 'Divider',
        options: [
          { label: 'Slash (/)', value: 'slash' },
          { label: 'Chevron (>)', value: 'chevron' },
          { label: 'Dot (·)', value: 'dot' }
        ],
        default: 'slash'
      }
    }
  })

  componentRegistry.register({
    type: 'pagination',
    label: 'Pagination',
    category: 'Components',
    icon: '⋯',
    defaultClasses: ['pagination'],
    defaultProps: { pages: 3, activePage: 1, size: 'default', alignment: 'start', showPrevNext: true, showFirstLast: false },
    propsSchema: {
      pages: { type: 'number', label: 'Total Pages', default: 3, min: 1 },
      activePage: { type: 'number', label: 'Active Page', default: 1, min: 1 },
      size: {
        type: 'select',
        label: 'Size',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Default', value: 'default' },
          { label: 'Large', value: 'lg' }
        ],
        default: 'default'
      },
      alignment: {
        type: 'select',
        label: 'Alignment',
        options: [
          { label: 'Start', value: 'start' },
          { label: 'Center', value: 'center' },
          { label: 'End', value: 'end' }
        ],
        default: 'start'
      },
      showPrevNext: { type: 'boolean', label: 'Show Prev/Next', default: true },
      showFirstLast: { type: 'boolean', label: 'Show First/Last', default: false }
    }
  })

  componentRegistry.register({
    type: 'table',
    label: 'Table',
    category: 'Components',
    icon: '▦',
    defaultProps: {
      headers: ['Name', 'Email', 'Role'],
      rows: [
        ['Jane Doe', 'jane@example.com', 'Admin'],
        ['John Smith', 'john@example.com', 'Editor'],
        ['Alex Kim', 'alex@example.com', 'Author']
      ],
      striped: false,
      bordered: false,
      hover: true,
      responsive: true,
      size: 'default',
      variant: 'default'
    },
    propsSchema: {
      headers: { type: 'array', label: 'Headers', default: [] },
      rows: { type: 'array', label: 'Rows', default: [] },
      striped: { type: 'boolean', label: 'Striped', default: false },
      bordered: { type: 'boolean', label: 'Bordered', default: false },
      hover: { type: 'boolean', label: 'Hover Rows', default: true },
      responsive: { type: 'boolean', label: 'Responsive Wrapper', default: true },
      size: {
        type: 'select',
        label: 'Size',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Default', value: 'default' }
        ],
        default: 'default'
      },
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Dark', value: 'dark' }
        ],
        default: 'default'
      }
    }
  })

  componentRegistry.register({
    type: 'dropdown',
    label: 'Dropdown',
    category: 'Components',
    icon: '▾',
    defaultProps: {
      label: 'Dropdown',
      variant: 'primary',
      items: [
        { label: 'Action', href: '#', divider: false, disabled: false },
        { label: 'Another action', href: '#', divider: false, disabled: false },
        { label: '', href: '#', divider: true, disabled: false },
        { label: 'Something else', href: '#', divider: false, disabled: false }
      ],
      size: 'default',
      direction: 'down',
      split: false
    },
    propsSchema: {
      label: { type: 'text', label: 'Label', default: 'Dropdown' },
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary', value: 'secondary' },
          { label: 'Success', value: 'success' },
          { label: 'Danger', value: 'danger' },
          { label: 'Warning', value: 'warning' },
          { label: 'Info', value: 'info' },
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' }
        ],
        default: 'primary'
      },
      items: { type: 'array', label: 'Items', default: [] },
      size: {
        type: 'select',
        label: 'Size',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Default', value: 'default' },
          { label: 'Large', value: 'lg' }
        ],
        default: 'default'
      },
      direction: {
        type: 'select',
        label: 'Direction',
        options: [
          { label: 'Down', value: 'down' },
          { label: 'Up', value: 'up' },
          { label: 'Start', value: 'start' },
          { label: 'End', value: 'end' }
        ],
        default: 'down'
      },
      split: { type: 'boolean', label: 'Split Button', default: false }
    }
  })

  componentRegistry.register({
    type: 'offcanvas',
    label: 'Offcanvas',
    category: 'Components',
    icon: '☰',
    defaultProps: {
      title: 'Offcanvas',
      placement: 'start',
      backdrop: true,
      scroll: false,
      id: 'offcanvas-' + Math.random().toString(36).substr(2, 9)
    },
    defaultChildren: [
      { type: 'paragraph', props: { text: 'Some placeholder content in the offcanvas.' }, classes: ['mb-0'] }
    ],
    propsSchema: {
      title: { type: 'text', label: 'Title', default: 'Offcanvas' },
      placement: {
        type: 'select',
        label: 'Placement',
        options: [
          { label: 'Start', value: 'start' },
          { label: 'End', value: 'end' },
          { label: 'Top', value: 'top' },
          { label: 'Bottom', value: 'bottom' }
        ],
        default: 'start'
      },
      backdrop: { type: 'boolean', label: 'Backdrop', default: true },
      scroll: { type: 'boolean', label: 'Allow Body Scroll', default: false },
      id: { type: 'text', label: 'Offcanvas ID', default: 'offcanvas-example' }
    }
  })

  componentRegistry.register({
    type: 'card',
    label: 'Card',
    category: 'Components',
    icon: '🗂',
    defaultProps: {
      title: 'Card title',
      subtitle: 'Card subtitle',
      text: 'Some quick example text to build on the card title.',
      imageUrl: '',
      imagePosition: 'top',
      headerText: '',
      footerText: '',
      variant: 'default',
      outline: false
    },
    propsSchema: {
      title: { type: 'text', label: 'Title', default: 'Card title' },
      subtitle: { type: 'text', label: 'Subtitle', default: 'Card subtitle' },
      text: { type: 'textarea', label: 'Text', default: 'Some quick example text to build on the card title.' },
      imageUrl: { type: 'image', label: 'Image URL', default: '' },
      imagePosition: {
        type: 'select',
        label: 'Image Position',
        options: [
          { label: 'Top', value: 'top' },
          { label: 'Bottom', value: 'bottom' },
          { label: 'Overlay', value: 'overlay' }
        ],
        default: 'top'
      },
      headerText: { type: 'text', label: 'Header Text', default: '' },
      footerText: { type: 'text', label: 'Footer Text', default: '' },
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary', value: 'secondary' },
          { label: 'Success', value: 'success' },
          { label: 'Danger', value: 'danger' },
          { label: 'Warning', value: 'warning' },
          { label: 'Info', value: 'info' },
          { label: 'Light', value: 'light' },
          { label: 'Dark', value: 'dark' }
        ],
        default: 'default'
      },
      outline: { type: 'boolean', label: 'Outline Variant', default: false }
    }
  })

  componentRegistry.register({
    type: 'stats-section',
    label: 'Stats Section',
    category: 'Sections',
    icon: '📊',
    defaultProps: {
      items: [
        { value: '120', label: 'Projects Completed', prefix: '', suffix: '+', icon: '🚀' },
        { value: '98', label: 'Client Satisfaction', prefix: '', suffix: '%', icon: '⭐' },
        { value: '24', label: 'Team Members', prefix: '', suffix: '', icon: '👥' },
        { value: '12', label: 'Awards Won', prefix: '', suffix: '', icon: '🏆' }
      ],
      columns: '4',
      variant: 'default',
      alignment: 'center'
    },
    propsSchema: {
      items: { type: 'array', label: 'Stats Items', default: [] },
      columns: {
        type: 'select',
        label: 'Columns',
        options: [
          { label: '2 Columns', value: '2' },
          { label: '3 Columns', value: '3' },
          { label: '4 Columns', value: '4' }
        ],
        default: '4'
      },
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Bordered', value: 'bordered' },
          { label: 'Cards', value: 'cards' }
        ],
        default: 'default'
      },
      alignment: {
        type: 'select',
        label: 'Alignment',
        options: [
          { label: 'Center', value: 'center' },
          { label: 'Left', value: 'left' }
        ],
        default: 'center'
      }
    }
  })

  componentRegistry.register({
    type: 'team-grid',
    label: 'Team Grid',
    category: 'Sections',
    icon: '👥',
    defaultProps: {
      members: [
        {
          name: 'Alex Rivera',
          role: 'Creative Director',
          imageUrl: IMAGE_PLACEHOLDER,
          bio: 'Leads brand strategy and cross-functional execution.',
          socialLinks: { twitter: '#', linkedin: '#', github: '' }
        },
        {
          name: 'Jordan Lee',
          role: 'Lead Engineer',
          imageUrl: IMAGE_PLACEHOLDER,
          bio: 'Builds reliable product architecture and platform tooling.',
          socialLinks: { twitter: '', linkedin: '#', github: '#' }
        },
        {
          name: 'Mina Patel',
          role: 'Product Manager',
          imageUrl: IMAGE_PLACEHOLDER,
          bio: 'Turns customer insights into pragmatic roadmaps.',
          socialLinks: { twitter: '#', linkedin: '#', github: '' }
        }
      ],
      columns: '3',
      cardStyle: 'card',
      showSocial: true
    },
    propsSchema: {
      members: { type: 'array', label: 'Members', default: [] },
      columns: {
        type: 'select',
        label: 'Columns',
        options: [
          { label: '2 Columns', value: '2' },
          { label: '3 Columns', value: '3' },
          { label: '4 Columns', value: '4' }
        ],
        default: '3'
      },
      cardStyle: {
        type: 'select',
        label: 'Card Style',
        options: [
          { label: 'Simple', value: 'simple' },
          { label: 'Card', value: 'card' },
          { label: 'Overlay', value: 'overlay' }
        ],
        default: 'card'
      },
      showSocial: { type: 'boolean', label: 'Show Social Links', default: true }
    }
  })

  componentRegistry.register({
    type: 'gallery',
    label: 'Gallery',
    category: 'Sections',
    icon: '🖼',
    defaultProps: {
      images: [
        { url: IMAGE_PLACEHOLDER, caption: 'Studio workspace', category: 'Workspace' },
        { url: IMAGE_PLACEHOLDER, caption: 'Team collaboration', category: 'People' },
        { url: IMAGE_PLACEHOLDER, caption: 'Product showcase', category: 'Product' },
        { url: IMAGE_PLACEHOLDER, caption: 'Customer event', category: 'Events' }
      ],
      columns: '4',
      gap: 'md',
      lightbox: false,
      filterable: false,
      layout: 'grid'
    },
    propsSchema: {
      images: { type: 'array', label: 'Images', default: [] },
      columns: {
        type: 'select',
        label: 'Columns',
        options: [
          { label: '2 Columns', value: '2' },
          { label: '3 Columns', value: '3' },
          { label: '4 Columns', value: '4' },
          { label: '6 Columns', value: '6' }
        ],
        default: '4'
      },
      gap: {
        type: 'select',
        label: 'Gap',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' }
        ],
        default: 'md'
      },
      lightbox: { type: 'boolean', label: 'Enable Lightbox', default: false },
      filterable: { type: 'boolean', label: 'Enable Category Filters', default: false },
      layout: {
        type: 'select',
        label: 'Layout',
        options: [
          { label: 'Grid', value: 'grid' },
          { label: 'Masonry', value: 'masonry' }
        ],
        default: 'grid'
      }
    }
  })

  componentRegistry.register({
    type: 'timeline',
    label: 'Timeline',
    category: 'Sections',
    icon: '🕒',
    defaultProps: {
      items: [
        { date: '2022', title: 'Company Founded', description: 'Initial team assembled and first concept validated.', icon: '🚀', variant: 'primary' },
        { date: '2023', title: 'Public Launch', description: 'Core platform released with first enterprise customers.', icon: '🎯', variant: 'success' },
        { date: '2024', title: 'Global Expansion', description: 'Expanded to new markets and launched multilingual support.', icon: '🌍', variant: 'info' }
      ],
      orientation: 'vertical',
      alternating: true,
      lineColor: '#6c757d'
    },
    propsSchema: {
      items: { type: 'array', label: 'Timeline Items', default: [] },
      orientation: {
        type: 'select',
        label: 'Orientation',
        options: [
          { label: 'Vertical', value: 'vertical' },
          { label: 'Horizontal', value: 'horizontal' }
        ],
        default: 'vertical'
      },
      alternating: { type: 'boolean', label: 'Alternating Layout', default: true },
      lineColor: { type: 'color', label: 'Line Color', default: '#6c757d' }
    }
  })

  componentRegistry.register({
    type: 'logo-cloud',
    label: 'Logo Cloud',
    category: 'Sections',
    icon: '🏢',
    defaultProps: {
      title: 'Trusted by leading teams',
      logos: [
        { imageUrl: IMAGE_PLACEHOLDER, altText: 'Acme', href: '#' },
        { imageUrl: IMAGE_PLACEHOLDER, altText: 'Northstar', href: '#' },
        { imageUrl: IMAGE_PLACEHOLDER, altText: 'Vertex', href: '#' },
        { imageUrl: IMAGE_PLACEHOLDER, altText: 'Orbit', href: '#' },
        { imageUrl: IMAGE_PLACEHOLDER, altText: 'Nimbus', href: '#' },
        { imageUrl: IMAGE_PLACEHOLDER, altText: 'Zenith', href: '#' }
      ],
      columns: '6',
      grayscale: true,
      variant: 'simple'
    },
    propsSchema: {
      title: { type: 'text', label: 'Heading', default: 'Trusted by leading teams' },
      logos: { type: 'array', label: 'Logos', default: [] },
      columns: {
        type: 'select',
        label: 'Columns',
        options: [
          { label: '3 Columns', value: '3' },
          { label: '4 Columns', value: '4' },
          { label: '5 Columns', value: '5' },
          { label: '6 Columns', value: '6' }
        ],
        default: '6'
      },
      grayscale: { type: 'boolean', label: 'Grayscale Logos', default: true },
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Simple', value: 'simple' },
          { label: 'Bordered', value: 'bordered' },
          { label: 'Cards', value: 'cards' }
        ],
        default: 'simple'
      }
    }
  })

  componentRegistry.register({
    type: 'process-steps',
    label: 'Process Steps',
    category: 'Sections',
    icon: '🧭',
    defaultProps: {
      steps: [
        { number: '1', title: 'Discover', description: 'Understand goals, constraints, and user context.', icon: '🔍' },
        { number: '2', title: 'Build', description: 'Design, prototype, and implement validated solutions.', icon: '🛠' },
        { number: '3', title: 'Launch', description: 'Deploy, monitor, and continuously improve outcomes.', icon: '🚀' }
      ],
      layout: 'horizontal',
      connectorStyle: 'line',
      variant: 'both'
    },
    propsSchema: {
      steps: { type: 'array', label: 'Steps', default: [] },
      layout: {
        type: 'select',
        label: 'Layout',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' }
        ],
        default: 'horizontal'
      },
      connectorStyle: {
        type: 'select',
        label: 'Connector Style',
        options: [
          { label: 'Line', value: 'line' },
          { label: 'Arrow', value: 'arrow' },
          { label: 'Dotted', value: 'dotted' }
        ],
        default: 'line'
      },
      variant: {
        type: 'select',
        label: 'Step Marker',
        options: [
          { label: 'Numbered', value: 'numbered' },
          { label: 'Icon', value: 'icon' },
          { label: 'Both', value: 'both' }
        ],
        default: 'both'
      }
    }
  })

  componentRegistry.register({
    type: 'newsletter',
    label: 'Newsletter',
    category: 'Sections',
    icon: '✉',
    defaultProps: {
      title: 'Subscribe to our newsletter',
      description: 'Get the latest updates right in your inbox.',
      placeholder: 'Enter your email address',
      buttonText: 'Subscribe',
      buttonVariant: 'primary',
      layout: 'inline',
      showNameField: false,
      variant: 'simple'
    },
    propsSchema: {
      title: { type: 'text', label: 'Title', default: 'Subscribe to our newsletter' },
      description: { type: 'textarea', label: 'Description', default: 'Get the latest updates right in your inbox.' },
      placeholder: { type: 'text', label: 'Email Placeholder', default: 'Enter your email address' },
      buttonText: { type: 'text', label: 'Button Text', default: 'Subscribe' },
      buttonVariant: {
        type: 'select',
        label: 'Button Variant',
        options: [
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary', value: 'secondary' },
          { label: 'Dark', value: 'dark' }
        ],
        default: 'primary'
      },
      layout: {
        type: 'select',
        label: 'Layout',
        options: [
          { label: 'Inline', value: 'inline' },
          { label: 'Stacked', value: 'stacked' }
        ],
        default: 'inline'
      },
      showNameField: { type: 'boolean', label: 'Show Name Field', default: false },
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Simple', value: 'simple' },
          { label: 'Card', value: 'card' },
          { label: 'Banner', value: 'banner' }
        ],
        default: 'simple'
      }
    }
  })

  componentRegistry.register({
    type: 'comparison-table',
    label: 'Comparison Table',
    category: 'Sections',
    icon: '📊',
    defaultProps: {
      plans: [
        { name: 'Basic', price: '$9', period: '/mo', features: [{text: '1 User', included: true}, {text: '5GB Storage', included: true}, {text: 'Support', included: false}], ctaText: 'Start Basic', ctaHref: '#', highlighted: false },
        { name: 'Pro', price: '$29', period: '/mo', features: [{text: '5 Users', included: true}, {text: '50GB Storage', included: true}, {text: 'Support', included: true}], ctaText: 'Start Pro', ctaHref: '#', highlighted: true }
      ],
      columns: 2
    },
    propsSchema: {
      plans: { type: 'array', label: 'Plans', default: [] },
      columns: { type: 'number', label: 'Columns', default: 2, min: 1, max: 4 }
    }
  })

  componentRegistry.register({
    type: 'contact-card',
    label: 'Contact Card',
    category: 'Sections',
    icon: '📇',
    defaultProps: {
      name: 'John Doe',
      title: 'Sales Representative',
      email: 'john@example.com',
      phone: '+1 (555) 123-4567',
      address: '123 Main St, City, Country',
      imageUrl: IMAGE_PLACEHOLDER,
      layout: 'vertical',
      showMap: false
    },
    propsSchema: {
      name: { type: 'text', label: 'Name', default: 'John Doe' },
      title: { type: 'text', label: 'Title', default: 'Sales Representative' },
      email: { type: 'text', label: 'Email', default: 'john@example.com' },
      phone: { type: 'text', label: 'Phone', default: '+1 (555) 123-4567' },
      address: { type: 'textarea', label: 'Address', default: '123 Main St, City, Country' },
      imageUrl: { type: 'image', label: 'Image URL', default: IMAGE_PLACEHOLDER },
      layout: {
        type: 'select',
        label: 'Layout',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' }
        ],
        default: 'vertical'
      },
      showMap: { type: 'boolean', label: 'Show Map', default: false }
    }
  })

  componentRegistry.register({
    type: 'social-links',
    label: 'Social Links',
    category: 'Components',
    icon: '🔗',
    defaultProps: {
      links: [
        { platform: 'twitter', url: '#', label: 'Twitter' },
        { platform: 'linkedin', url: '#', label: 'LinkedIn' },
        { platform: 'github', url: '#', label: 'GitHub' }
      ],
      style: 'icons-only',
      size: 'md',
      colorful: false
    },
    propsSchema: {
      links: { type: 'array', label: 'Links', default: [] },
      style: {
        type: 'select',
        label: 'Style',
        options: [
          { label: 'Icons Only', value: 'icons-only' },
          { label: 'Icons & Text', value: 'icons-text' },
          { label: 'Text Only', value: 'text-only' }
        ],
        default: 'icons-only'
      },
      size: {
        type: 'select',
        label: 'Size',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' }
        ],
        default: 'md'
      },
      colorful: { type: 'boolean', label: 'Brand Colors', default: false }
    }
  })

  componentRegistry.register({
    type: 'cookie-banner',
    label: 'Cookie Banner',
    category: 'Components',
    icon: '🍪',
    defaultProps: {
      message: 'We use cookies to improve your experience on our site.',
      acceptText: 'Accept',
      declineText: 'Decline',
      learnMoreUrl: '#',
      position: 'bottom',
      variant: 'simple'
    },
    propsSchema: {
      message: { type: 'textarea', label: 'Message', default: 'We use cookies to improve your experience on our site.' },
      acceptText: { type: 'text', label: 'Accept Text', default: 'Accept' },
      declineText: { type: 'text', label: 'Decline Text', default: 'Decline' },
      learnMoreUrl: { type: 'url', label: 'Learn More URL', default: '#' },
      position: {
        type: 'select',
        label: 'Position',
        options: [
          { label: 'Bottom', value: 'bottom' },
          { label: 'Top', value: 'top' }
        ],
        default: 'bottom'
      },
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Simple', value: 'simple' },
          { label: 'Detailed', value: 'detailed' }
        ],
        default: 'simple'
      }
    }
  })

  componentRegistry.register({
    type: 'back-to-top',
    label: 'Back to Top',
    category: 'Components',
    icon: '⬆',
    defaultProps: {
      style: 'circle',
      icon: 'lucide:arrow-up',
      size: 'md',
      position: 'bottom-right',
      offset: 300
    },
    propsSchema: {
      style: {
        type: 'select',
        label: 'Style',
        options: [
          { label: 'Circle', value: 'circle' },
          { label: 'Rounded', value: 'rounded' },
          { label: 'Square', value: 'square' }
        ],
        default: 'circle'
      },
      icon: { type: 'icon', label: 'Icon', default: 'lucide:arrow-up' },
      size: {
        type: 'select',
        label: 'Size',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' }
        ],
        default: 'md'
      },
      position: {
        type: 'select',
        label: 'Position',
        options: [
          { label: 'Bottom Right', value: 'bottom-right' },
          { label: 'Bottom Left', value: 'bottom-left' }
        ],
        default: 'bottom-right'
      },
      offset: { type: 'number', label: 'Scroll Offset', default: 300 }
    }
  })

  componentRegistry.register({
    type: 'countdown',
    label: 'Countdown',
    category: 'Interactive',
    icon: '⏱',
    defaultProps: {
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      labels: { days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds' },
      showDays: true,
      showSeconds: true,
      variant: 'simple',
      expiredMessage: 'Event has started!'
    },
    propsSchema: {
      targetDate: { type: 'text', label: 'Target Date (ISO)', default: '' },
      labels: { type: 'object', label: 'Labels', default: { days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds' } },
      showDays: { type: 'boolean', label: 'Show Days', default: true },
      showSeconds: { type: 'boolean', label: 'Show Seconds', default: true },
      variant: {
        type: 'select',
        label: 'Variant',
        options: [
          { label: 'Simple', value: 'simple' },
          { label: 'Cards', value: 'cards' },
          { label: 'Circles', value: 'circles' }
        ],
        default: 'simple'
      },
      expiredMessage: { type: 'text', label: 'Expired Message', default: 'Event has started!' }
    }
  })

  componentRegistry.register({
    type: 'before-after',
    label: 'Before/After Slider',
    category: 'Interactive',
    icon: '◨',
    defaultProps: {
      beforeImage: IMAGE_PLACEHOLDER,
      afterImage: IMAGE_PLACEHOLDER,
      beforeLabel: 'Before',
      afterLabel: 'After',
      orientation: 'horizontal',
      initialPosition: 50
    },
    propsSchema: {
      beforeImage: { type: 'image', label: 'Before Image', default: IMAGE_PLACEHOLDER },
      afterImage: { type: 'image', label: 'After Image', default: IMAGE_PLACEHOLDER },
      beforeLabel: { type: 'text', label: 'Before Label', default: 'Before' },
      afterLabel: { type: 'text', label: 'After Label', default: 'After' },
      orientation: {
        type: 'select',
        label: 'Orientation',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' }
        ],
        default: 'horizontal'
      },
      initialPosition: { type: 'number', label: 'Initial Position (%)', default: 50, min: 0, max: 100 }
    }
  })

  componentRegistry.register({
    type: 'map-embed',
    label: 'Map Embed',
    category: 'Interactive',
    icon: '🗺',
    defaultProps: {
      embedUrl: 'https://maps.google.com/maps?q=New+York&t=&z=13&ie=UTF8&iwloc=&output=embed',
      height: '400px',
      borderRadius: '8px',
      grayscale: false,
      title: 'Location Map'
    },
    propsSchema: {
      embedUrl: { type: 'url', label: 'Embed URL', default: 'https://maps.google.com/maps?q=New+York&t=&z=13&ie=UTF8&iwloc=&output=embed' },
      height: { type: 'measurement', label: 'Height', default: '400px' },
      borderRadius: { type: 'measurement', label: 'Border Radius', default: '8px' },
      grayscale: { type: 'boolean', label: 'Grayscale Map', default: false },
      title: { type: 'text', label: 'Title', default: 'Location Map' }
    }
  })
}
