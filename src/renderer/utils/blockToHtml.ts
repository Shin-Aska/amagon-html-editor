import { IMAGE_PLACEHOLDER, ICON_PLACEHOLDER } from './placeholders'
import hljs from 'highlight.js'

// We will inject the CSS for highlight.js in global.css or the canvas iframe CSS.

import type { Block, Page, PageFolder } from '../store/types'

// ─── Tag Defaults ────────────────────────────────────────────────────────────

const DEFAULT_TAGS: Record<string, string> = {
  'heading': 'h1',
  'paragraph': 'p',
  'image': 'img',
  'link': 'a',
  'button': 'button',
  'container': 'div',
  'section': 'section',
  'row': 'div',
  'column': 'div',
  'list': 'ul',
  'list-item': 'li',
  'blockquote': 'blockquote',
  'form': 'form',
  'input': 'input',
  'textarea': 'textarea',
  'select': 'select',
  'checkbox': 'div', // Special handling in renderBlock
  'navbar': 'nav',
  'footer': 'footer',
  'header': 'header',
  'article': 'article',
  'aside': 'aside',
  'video': 'video',
  'hr': 'hr',
  'br': 'br',
  'span': 'span',
  'raw-html': 'div',
  'code-block': 'pre',
  'iframe': 'iframe',
  'icon': 'i',
  'accordion': 'div',
  'tabs': 'div',
  'modal': 'div',
  'page-list': 'div'
}

// Self-closing HTML tags
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
])

// ─── Prop → Attribute Mapping ────────────────────────────────────────────────

function propsToAttributes(tag: string, type: string, props: Record<string, unknown>): string {
  const attrs: string[] = []

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue

    // Handle boolean attributes
    if (value === false) continue
    if (value === true) {
      // For some props, true means the attribute exists (checked, disabled, etc)
      // For others it might be a prop that shouldn't be an attribute? 
      // Assuming all boolean true props are attributes for now.
      attrs.push(key)
      continue
    }

    // Special handling for common props
    switch (key) {
      case 'text':
      case 'items':
      case 'slides':
      case 'plans':
      case 'columns':
      case 'tabs':
      case 'options': // select options
      case 'label': // checkbox label
      case 'code': // code-block content
      case 'itemsPerPage': // blog-list
      case 'showDescription': // blog-list
      case 'filterTag': // blog-list / navbar
        // These are content props, not attributes
        continue
      case 'level':
        // Heading level is handled via tag, not attribute
        continue
      default:
        attrs.push(`${escapeAttrName(key)}="${escapeAttrValue(String(value))}"`)
    }
  }

  return attrs.join(' ')
}

function escapeAttrName(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_]/g, '')
}

function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ─── Style serialization ─────────────────────────────────────────────────────

function stylesToString(styles: Record<string, string>): string {
  return Object.entries(styles)
    .filter(([, v]) => v !== '' && v !== undefined)
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join('; ')
}

function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

// ─── Content generation for specific block types ─────────────────────────────

function getBlockContent(block: Block): string {
  const { type, props } = block

  switch (type) {
    case 'heading':
    case 'paragraph':
    case 'button':
    case 'link':
      return escapeAttrValue(String(props.text ?? ''))

    case 'blockquote': {
      const text = escapeAttrValue(String(props.text ?? ''))
      const footer = props.footer ? `<footer class="blockquote-footer mt-2">${escapeAttrValue(String(props.footer))}</footer>` : ''
      return `${text}${footer}`
    }

    case 'list': {
      const items = (props.items as string[]) ?? []
      return items.map((item) => `<li>${escapeAttrValue(item)}</li>`).join('\n')
    }

    case 'select': {
      const options = (props.options as string[]) ?? []
      return options.map(opt => `<option value="${escapeAttrValue(opt)}">${escapeAttrValue(opt)}</option>`).join('\n')
    }
    case 'code-block': {
      const codeType = String(block.props.code ?? '')
      const language = String(block.props.language ?? '')

      let highlighted = escapeAttrValue(codeType)
      try {
        if (language && hljs.getLanguage(language)) {
          highlighted = hljs.highlight(codeType, { language }).value
        } else {
          highlighted = hljs.highlightAuto(codeType).value
        }
      } catch (e) {
        // Fallback to unhighlighted if hljs fails
        console.warn('Failed to highlight code block string', e)
      }

      const badgeHtml = language
        ? `<div class="position-absolute top-0 end-0 mt-2 me-2 px-2 py-1 bg-secondary text-white rounded font-monospace" style="font-size: 0.75rem; opacity: 0.8; z-index: 5;">${language}</div>`
        : ''

      // Return just the inner generated html. The parent engine assigns external padding arrays to `tag`!
      return `<div class="position-relative">${badgeHtml}<pre class="m-0" style="background: transparent; padding: 0;"><code class="hljs ${language ? `language-${language}` : ''}" style="background: transparent; padding: 0;">${highlighted}</code></pre></div>`
    }

    case 'icon':
      return `<img src="${ICON_PLACEHOLDER}" alt="icon" width="100%" height="100%" />`

    case 'carousel': {
      const id = String(props.id || 'carousel-' + Math.random().toString(36).substr(2, 9))
      const slides = (props.slides as Array<{ src: string; alt: string; caption?: string }>) ?? []

      const indicators = slides.map((_, i) =>
        `<button type="button" data-bs-target="#${id}" data-bs-slide-to="${i}" class="${i === 0 ? 'active' : ''}" aria-current="${i === 0 ? 'true' : 'false'}" aria-label="Slide ${i + 1}"></button>`
      ).join('\n')

      const items = slides.map((slide, i) => `
        <div class="carousel-item ${i === 0 ? 'active' : ''}">
          <img src="${escapeAttrValue(slide.src)}" class="d-block w-100" alt="${escapeAttrValue(slide.alt)}">
          ${slide.caption ? `<div class="carousel-caption d-none d-md-block"><h5>${escapeAttrValue(slide.caption)}</h5></div>` : ''}
        </div>`).join('\n')

      return `
        <div class="carousel-indicators">
          ${indicators}
        </div>
        <div class="carousel-inner">
          ${items}
        </div>
        <button class="carousel-control-prev" type="button" data-bs-target="#${id}" data-bs-slide="prev">
          <span class="carousel-control-prev-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Previous</span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#${id}" data-bs-slide="next">
          <span class="carousel-control-next-icon" aria-hidden="true"></span>
          <span class="visually-hidden">Next</span>
        </button>`
    }

    case 'accordion': {
      const id = String(props.id || 'accordion-' + Math.random().toString(36).substr(2, 9))
      const items = (props.items as Array<{ title: string; content: string }>) ?? []

      return items.map((item, i) => {
        const itemId = `${id}-item-${i}`
        const collapseId = `${id}-collapse-${i}`
        const isExpanded = i === 0 ? 'true' : 'false'
        const showClass = i === 0 ? 'show' : ''
        const collapsedClass = i === 0 ? '' : 'collapsed'

        return `
        <div class="accordion-item">
          <h2 class="accordion-header" id="${itemId}">
            <button class="accordion-button ${collapsedClass}" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${isExpanded}" aria-controls="${collapseId}">
              ${escapeAttrValue(item.title)}
            </button>
          </h2>
          <div id="${collapseId}" class="accordion-collapse collapse ${showClass}" aria-labelledby="${itemId}" data-bs-parent="#${id}">
            <div class="accordion-body">
              ${escapeAttrValue(item.content)}
            </div>
          </div>
        </div>`
      }).join('\n')
    }

    case 'tabs': {
      const id = String(props.id || 'tabs-' + Math.random().toString(36).substr(2, 9))
      const tabs = (props.tabs as Array<{ label: string; content: string }>) ?? []

      const navItems = tabs.map((tab, i) => {
        const tabId = `${id}-tab-${i}`
        const contentId = `${id}-content-${i}`
        const activeClass = i === 0 ? 'active' : ''

        return `
        <li class="nav-item" role="presentation">
          <button class="nav-link ${activeClass}" id="${tabId}" data-bs-toggle="tab" data-bs-target="#${contentId}" type="button" role="tab" aria-controls="${contentId}" aria-selected="${i === 0}">
            ${escapeAttrValue(tab.label)}
          </button>
        </li>`
      }).join('\n')

      const contentItems = tabs.map((tab, i) => {
        const tabId = `${id}-tab-${i}`
        const contentId = `${id}-content-${i}`
        const activeClass = i === 0 ? 'show active' : ''

        return `
        <div class="tab-pane fade ${activeClass}" id="${contentId}" role="tabpanel" aria-labelledby="${tabId}">
          ${escapeAttrValue(tab.content)}
        </div>`
      }).join('\n')

      return `
        <ul class="nav nav-tabs" id="${id}" role="tablist">
          ${navItems}
        </ul>
        <div class="tab-content" id="${id}Content">
          ${contentItems}
        </div>`
    }

    case 'textarea':
      // Textarea content is the value
      return '' // Usually value is prop/attribute? Or content? 
    // HTML textarea: <textarea>content</textarea>
    // But standard way is often just attributes if controlled? 
    // Let's assume empty for now as value attribute works too, or if we want defaults:
    // return escapeAttrValue(String(props.value ?? '')) 

    case 'raw-html':
      return block.content ?? String(props.content ?? '')

    default:
      return block.content ?? ''
  }
}

// ─── Resolve the HTML tag ────────────────────────────────────────────────────

function resolveTag(block: Block): string {
  if (block.tag) return block.tag

  // Heading level → h1..h6
  if (block.type === 'heading') {
    const level = Number(block.props.level) || 1
    return `h${Math.max(1, Math.min(6, level))}`
  }

  return DEFAULT_TAGS[block.type] ?? 'div'
}

// ─── Main conversion ─────────────────────────────────────────────────────────

export interface BlockToHtmlOptions {
  indent?: number          // Starting indent level (default 0)
  indentSize?: number      // Spaces per indent (default 2)
  includeDataAttributes?: boolean  // Include data-block-id for editor use
  pages?: Page[]           // Page list for components that use pages as datasource (e.g. navbar)
  folders?: PageFolder[]   // Folder list for effective tag resolution
}

export function blockToHtml(blocks: Block[], options: BlockToHtmlOptions = {}): string {
  const { indent = 0, indentSize = 2, includeDataAttributes = false, pages, folders } = options
  return blocks.map((block) => renderBlock(block, indent, indentSize, includeDataAttributes, pages, folders)).join('\n')
}

function renderBlock(
  block: Block,
  indent: number,
  indentSize: number,
  includeDataAttributes: boolean,
  pages?: Page[],
  folders?: PageFolder[]
): string {
  const pad = ' '.repeat(indent * indentSize)

  // Special handling for Checkbox (composite component)
  if (block.type === 'checkbox') {
    const label = escapeAttrValue(String(block.props.label ?? ''))
    const name = block.props.name ? `name="${escapeAttrValue(String(block.props.name))}"` : ''
    const checked = block.props.checked ? 'checked' : ''
    const id = block.id
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}"` : ''
    const classes = block.classes.join(' ')

    return `${pad}<div class="form-check" ${dataAttr}>
${pad}  <input class="${classes}" type="checkbox" id="${id}" ${name} ${checked}>
${pad}  <label class="form-check-label" for="${id}">
${pad}    ${label}
${pad}  </label>
${pad}</div>`
  }

  // Special handling for Navbar with pages datasource
  if (block.type === 'navbar' && block.props.usePages && pages && pages.length > 0) {
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}" data-block-type="navbar"` : ''
    const classes = block.classes.join(' ')
    const styleStr = stylesToString(block.styles)
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    const brandText = escapeAttrValue(String(block.props.brandText || 'Brand'))
    const brandImage = String(block.props.brandImage || '').trim()
    const filterTag = String(block.props.filterTag || '').trim()

    // Helper to get effective tags for a page (own + folder inherited)
    const getEffective = (p: Page): string[] => {
      const own = p.tags ?? []
      if (!p.folderId || !folders) return own
      const folder = folders.find((f) => f.id === p.folderId)
      if (!folder?.tags?.length) return own
      return Array.from(new Set([...own, ...folder.tags]))
    }

    const filteredPages = filterTag
      ? pages.filter((p) => getEffective(p).includes(filterTag))
      : pages

    const navLinks = filteredPages.map((p) => {
      const href = p.slug === 'index' ? 'index.html' : `${p.slug}.html`
      return `${pad}            <li class="nav-item"><a class="nav-link" href="${href}">${escapeAttrValue(p.title)}</a></li>`
    }).join('\n')

    const navbarId = `navbar-${block.id.replace(/[^a-zA-Z0-9]/g, '')}`

    // Brand: image + text, image only, or text only
    let brandHtml: string
    if (brandImage) {
      brandHtml = `<img src="${escapeAttrValue(brandImage)}" alt="${brandText}" height="30" class="d-inline-block align-text-top me-2">${brandText}`
    } else {
      brandHtml = brandText
    }

    return `${pad}<nav class="${classes}"${styleAttr} ${dataAttr}>
${pad}  <div class="container">
${pad}    <a class="navbar-brand" href="#">${brandHtml}</a>
${pad}    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#${navbarId}" aria-controls="${navbarId}" aria-expanded="false" aria-label="Toggle navigation">
${pad}      <span class="navbar-toggler-icon"></span>
${pad}    </button>
${pad}    <div class="collapse navbar-collapse" id="${navbarId}">
${pad}      <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
${navLinks}
${pad}      </ul>
${pad}    </div>
${pad}  </div>
${pad}</nav>`
  }

  // Special handling for Page List with pagination
  if (block.type === 'page-list' && pages && pages.length > 0) {
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}" data-block-type="page-list"` : ''
    const classes = block.classes.length > 0 ? block.classes.join(' ') : ''
    const styleStr = stylesToString(block.styles)
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    const filterTag = String(block.props.filterTag || '').trim()
    const itemsPerPage = Math.max(1, Number(block.props.itemsPerPage) || 6)
    const cols = Number(block.props.columns) || 3
    const showDesc = block.props.showDescription !== false
    const pageListId = `page-list-${block.id.replace(/[^a-zA-Z0-9]/g, '')}`

    // Resolve effective tags (own + folder inherited) — same pattern as navbar
    const getEffective = (p: Page): string[] => {
      const own = p.tags ?? []
      if (!p.folderId || !folders) return own
      const folder = folders.find((f) => f.id === p.folderId)
      if (!folder?.tags?.length) return own
      return Array.from(new Set([...own, ...folder.tags]))
    }

    const filteredPages = filterTag
      ? pages.filter((p) => getEffective(p).includes(filterTag))
      : pages

    const totalPages = Math.ceil(filteredPages.length / itemsPerPage)
    const colClass = cols === 1 ? 'col-12' : cols === 2 ? 'col-md-6' : 'col-md-6 col-lg-4'

    // Build card HTML for each page
    const cards = filteredPages.map((p) => {
      const href = p.slug === 'index' ? 'index.html' : `${p.slug}.html`
      const title = escapeAttrValue(p.title)
      const desc = showDesc && p.meta?.description ? `<p class="card-text text-muted">${escapeAttrValue(p.meta.description)}</p>` : ''
      return `<div class="${colClass} mb-4"><div class="card h-100"><div class="card-body d-flex flex-column"><h5 class="card-title">${title}</h5>${desc}<a href="${href}" class="btn btn-primary mt-auto">Read more</a></div></div></div>`
    })

    // Group cards into pages
    const pageGroups: string[][] = []
    for (let i = 0; i < cards.length; i += itemsPerPage) {
      pageGroups.push(cards.slice(i, i + itemsPerPage))
    }

    // Render each page group as a row with data-page attribute
    const groupsHtml = pageGroups.map((group, idx) => {
      const display = idx === 0 ? '' : ' style="display:none"'
      return `${pad}  <div class="row" data-page-list-page="${idx}"${display}>\n${group.map(c => `${pad}    ${c}`).join('\n')}\n${pad}  </div>`
    }).join('\n')

    // Pagination nav
    let paginationHtml = ''
    if (totalPages > 1) {
      const pageItems = Array.from({ length: totalPages }, (_, i) => {
        const activeClass = i === 0 ? ' active' : ''
        return `${pad}      <li class="page-item${activeClass}"><a class="page-link" href="#" data-page-list-target="${i}">${i + 1}</a></li>`
      }).join('\n')

      paginationHtml = `\n${pad}  <nav aria-label="Page list pagination">\n${pad}    <ul class="pagination justify-content-center mt-4">\n${pageItems}\n${pad}    </ul>\n${pad}  </nav>`
    }

    // Inline script for pagination
    const script = totalPages > 1 ? `\n${pad}  <script>\n${pad}    (function(){\n${pad}      var c=document.getElementById('${pageListId}');\n${pad}      if(!c)return;\n${pad}      c.addEventListener('click',function(e){\n${pad}        var t=e.target.closest('[data-page-list-target]');\n${pad}        if(!t)return;\n${pad}        e.preventDefault();\n${pad}        var p=parseInt(t.getAttribute('data-page-list-target'),10);\n${pad}        c.querySelectorAll('[data-page-list-page]').forEach(function(r){r.style.display=parseInt(r.getAttribute('data-page-list-page'),10)===p?'':'none';});\n${pad}        c.querySelectorAll('.page-item').forEach(function(li,i){li.classList.toggle('active',i===p);});\n${pad}      });\n${pad}    })();\n${pad}  <\/script>` : ''

    const classAttr = classes ? ` class="${classes}"` : ''
    return `${pad}<div id="${pageListId}"${classAttr}${styleAttr} ${dataAttr}>\n${groupsHtml}${paginationHtml}${script}\n${pad}</div>`
  }

  // Special handling for Input/Textarea/Select (Form controls with labels)
  if (['input', 'textarea', 'select'].includes(block.type)) {
    const label = block.props.label ? escapeAttrValue(String(block.props.label)) : null
    const id = block.id
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}"` : ''
    // Filter out label from attributes as we render it separately
    // The inner input rendering needs to NOT include data-block-id if we put it on the wrapper
    // But usually we want the wrapper to be the block target?
    // Let's put data-block-id on the wrapper.

    // We need to generate the inner element string manually or call a helper
    // Let's generate it manually to correctly map props

    const tag = block.type
    const classes = block.classes.join(' ')

    // Build attributes for the input element
    const attrs: string[] = []
    attrs.push(`class="${classes}"`)
    attrs.push(`id="${id}"`)

    // Style
    const styleStr = stylesToString(block.styles)
    if (styleStr) attrs.push(`style="${styleStr}"`)

    // Props
    for (const [key, value] of Object.entries(block.props)) {
      if (key === 'label' || value === undefined || value === null || value === false) continue
      if (key === 'options') continue // select options
      if (key === 'text') continue // textarea text?

      if (value === true) {
        attrs.push(escapeAttrName(key))
      } else {
        attrs.push(`${escapeAttrName(key)}="${escapeAttrValue(String(value))}"`)
      }
    }

    const attrString = attrs.join(' ')

    let inner = ''
    if (tag === 'input') {
      inner = `<input ${attrString}>`
    } else if (tag === 'textarea') {
      const val = block.props.value ?? '' // Or content?
      inner = `<textarea ${attrString}>${escapeAttrValue(String(val))}</textarea>`
    } else if (tag === 'select') {
      const options = (block.props.options as string[]) ?? []
      const optsHtml = options.map(opt => `<option value="${escapeAttrValue(opt)}">${escapeAttrValue(opt)}</option>`).join('')
      inner = `<select ${attrString}>${optsHtml}</select>`
    }

    if (label) {
      return `${pad}<div class="mb-3" ${dataAttr}>
${pad}  <label for="${id}" class="form-label">${label}</label>
${pad}  ${inner}
${pad}</div>`
    } else {
      // If no label, just render the input, but we might still want the data-block-id on it?
      // If we put data-block-id on the input, we don't need the wrapper.
      // But standard bootstrap form control spacing usually needs a wrapper?
      // Let's stick to wrapper if it helps, or just return inner with data-block-id injected.
      // Simpler: Just return the inner element with data-block-id injected if no label.

      if (includeDataAttributes) {
        // We constructed inner without data-block-id. Let's inject it.
        // Hacky string injection? Or just rebuild.
        // Let's just use the wrapper for consistency? "mb-3" is good default.
        return `${pad}<div class="mb-3" ${dataAttr}>
${pad}  ${inner}
${pad}</div>`
      }
      return `${pad}${inner}` // No wrapper if no label and no ID needed? Maybe still want mb-3.
    }
  }

  // Special handling for Icon
  if (block.type === 'icon') {
    const iconClass = escapeAttrValue(String(block.props.iconClass ?? 'bi-star'))
    const classes = [...block.classes, iconClass].filter(Boolean).join(' ')

    // Merge styles with props like size/color if they exist and aren't in styles
    const styles = { ...block.styles }
    if (block.props.size && !styles.fontSize) styles.fontSize = String(block.props.size)
    if (block.props.color && !styles.color) styles.color = String(block.props.color)

    const styleStr = stylesToString(styles)
    const styleAttr = styleStr ? `style="${styleStr}"` : ''
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}"` : ''

    return `${pad}<i class="${classes}" ${styleAttr} ${dataAttr}></i>`
  }

  const tag = resolveTag(block)
  const isVoid = VOID_ELEMENTS.has(tag)

  // Build attribute string
  const parts: string[] = []

  // data-block-id (editor mode only)
  if (includeDataAttributes) {
    parts.push(`data-block-id="${block.id}"`)
    parts.push(`data-block-type="${block.type}"`)
  }

  // Classes
  if (block.classes.length > 0) {
    parts.push(`class="${block.classes.join(' ')}"`)
  }

  // Inline styles
  const styleStr = stylesToString(block.styles)
  if (styleStr) {
    parts.push(`style="${styleStr}"`)
  }

  // Props → attributes
  const attrStr = propsToAttributes(tag, block.type, block.props)
  if (attrStr) {
    parts.push(attrStr)
  }

  const attrString = parts.length > 0 ? ' ' + parts.join(' ') : ''

  // Void element (self-closing)
  if (isVoid) {
    return `${pad}<${tag}${attrString} />`
  }

  // Determine inner content
  const textContent = getBlockContent(block)
  const hasChildren = block.children.length > 0
  const hasContent = textContent.length > 0

  // Simple inline content (no children)
  if (!hasChildren && hasContent && !textContent.includes('\n')) {
    return `${pad}<${tag}${attrString}>${textContent}</${tag}>`
  }

  // Multiline or children
  const lines: string[] = []
  lines.push(`${pad}<${tag}${attrString}>`)

  if (hasContent) {
    const contentLines = textContent.split('\n')
    for (const line of contentLines) {
      lines.push(`${' '.repeat((indent + 1) * indentSize)}${line}`)
    }
  }

  if (hasChildren) {
    for (const child of block.children) {
      lines.push(renderBlock(child, indent + 1, indentSize, includeDataAttributes, pages, folders))
    }
  }

  lines.push(`${pad}</${tag}>`)
  return lines.join('\n')
}

// ─── Full page HTML generation ───────────────────────────────────────────────

export interface PageHtmlOptions extends BlockToHtmlOptions {
  title?: string
  framework?: 'bootstrap-5' | 'tailwind' | 'vanilla'
  meta?: Record<string, string>
  customCss?: string
  pages?: Page[]
  folders?: PageFolder[]
}

export function pageToHtml(blocks: Block[], options: PageHtmlOptions = {}): string {
  const {
    title = 'Untitled Page',
    framework = 'bootstrap-5',
    meta = {},
    customCss = '',
    ...blockOptions
  } = options

  const bodyHtml = blockToHtml(blocks, { ...blockOptions, indent: 1, pages: options.pages, folders: options.folders })

  const metaTags = Object.entries(meta)
    .map(([name, content]) => `    <meta name="${escapeAttrValue(name)}" content="${escapeAttrValue(content)}">`)
    .join('\n')

  const frameworkHead = getFrameworkHead(framework)

  const customCssTag =
    customCss.trim().length > 0
      ? `    <style id="html-editor-custom-css">\n${customCss}\n    </style>\n`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
${metaTags ? metaTags + '\n' : ''}    <title>${title}</title>
${frameworkHead}${customCssTag}</head>
<body>
${bodyHtml}
</body>
</html>`
}

function getFrameworkHead(framework: string): string {
  switch (framework) {
    case 'bootstrap-5':
      return `    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" defer><\/script>\n`
    case 'tailwind':
      return `    <script src="https://cdn.tailwindcss.com"><\/script>\n`
    case 'vanilla':
    default:
      return ''
  }
}
