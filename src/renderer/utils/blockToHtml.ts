import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { IMAGE_PLACEHOLDER } from './placeholders'
import hljs from 'highlight.js'
import { getLucideIconComponent, isRenderableGlyph, mapLegacyBootstrapIcon } from './iconCatalog'

// We will inject the CSS for highlight.js in global.css or the canvas iframe CSS.

import type { Block, Page, PageFolder, FrameworkChoice } from '../store/types'

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
  const nonAttributeProps = new Set([
    'text',
    'items',
    'slides',
    'plans',
    'columns',
    'tabs',
    'options',
    'label',
    'code',
    'itemsPerPage',
    'showDescription',
    'detailsMode',
    'metaKeys',
    'showSearch',
    'showSort',
    'sortLayout',
    'sortPriority',
    'sortKeys',
    'sortDefaultKey',
    'sortDefaultDir',
    'filterTag',
    'hamburgerMenu',
    'isForm',
    'fluid',
    'gutters',
    'width',
    'alignment',
    'lead',
    'variant',
    'size',
    'usePages',
    'theme'
  ])

  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue

    if (nonAttributeProps.has(key)) continue

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
      case 'level':
        // Heading level is handled via tag, not attribute
        continue
      default:
        // Skip 'type' prop for buttons rendered as <a> (when they have href)
        if (type === 'button' && key === 'type') continue
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

function sanitizeElementId(value: string, fallback: string): string {
  const sanitized = value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9\-_:.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sanitized || fallback
}

function stripLegacyBootstrapIconClasses(classes: string[]): string[] {
  return classes.filter((cls) => cls !== 'bi' && !/^bi-/i.test(cls))
}

function renderLucideIconMarkup(name: string): string {
  const IconComponent = getLucideIconComponent(name)
  if (!IconComponent) return ''
  return renderToStaticMarkup(
    createElement(IconComponent, {
      size: '1em',
      'aria-hidden': 'true',
      focusable: 'false',
      strokeWidth: 2.25
    })
  )
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

function dedupeClasses(classes: string[]): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const cls of classes) {
    const value = String(cls || '').trim()
    if (!value || seen.has(value)) continue
    seen.add(value)
    next.push(value)
  }
  return next
}

function normalizeNavbarThemeClasses(classes: string[]): string[] {
  let classesArray = [...classes]
  if (classesArray.includes('bg-body-tertiary')) {
    classesArray = classesArray.filter(c => c !== 'bg-body-tertiary')
    if (!classesArray.some(c => c.startsWith('navbar-theme-'))) {
      classesArray.push('navbar-theme-light')
    }
  }
  if (classesArray.includes('navbar-dark')) {
    classesArray = classesArray.filter(c => c !== 'navbar-dark')
  }
  if (classesArray.includes('bg-dark')) {
    classesArray = classesArray.filter(c => c !== 'bg-dark')
    if (!classesArray.some(c => c.startsWith('navbar-theme-'))) {
      classesArray.push('navbar-theme-dark')
    }
  }
  if (classesArray.includes('bg-primary')) {
    classesArray = classesArray.filter(c => c !== 'bg-primary')
    if (!classesArray.some(c => c.startsWith('navbar-theme-'))) {
      classesArray.push('navbar-theme-primary')
    }
  }
  return classesArray
}

function mapBootstrapClassToTailwind(cls: string): string[] {
  const value = String(cls || '').trim()
  if (!value) return []

  const displaySizeMatch = value.match(/^display-([1-6])$/)
  if (displaySizeMatch) {
    const sizeMap: Record<string, string[]> = {
      '1': ['text-6xl', 'md:text-7xl'],
      '2': ['text-5xl', 'md:text-6xl'],
      '3': ['text-4xl', 'md:text-5xl'],
      '4': ['text-3xl', 'md:text-4xl'],
      '5': ['text-2xl', 'md:text-3xl'],
      '6': ['text-xl', 'md:text-2xl']
    }
    return sizeMap[displaySizeMatch[1]] || ['text-4xl']
  }

  const spacingMatch = value.match(/^(m|mt|mb|ms|me|mx|my|p|pt|pb|ps|pe|px|py)(?:-(sm|md|lg|xl))?-([0-5]|auto)$/)
  if (spacingMatch) {
    const axis = spacingMatch[1]
    const breakpoint = spacingMatch[2]
    const amount = spacingMatch[3]
    const axisMap: Record<string, string> = {
      m: 'm',
      mt: 'mt',
      mb: 'mb',
      ms: 'ml',
      me: 'mr',
      mx: 'mx',
      my: 'my',
      p: 'p',
      pt: 'pt',
      pb: 'pb',
      ps: 'pl',
      pe: 'pr',
      px: 'px',
      py: 'py'
    }
    const spacingMap: Record<string, string> = {
      '0': '0',
      '1': '1',
      '2': '2',
      '3': '4',
      '4': '6',
      '5': '12',
      auto: 'auto'
    }
    const mapped = `${axisMap[axis]}-${spacingMap[amount]}`
    return [breakpoint ? `${breakpoint}:${mapped}` : mapped]
  }

  const gapMatch = value.match(/^g(?:ap)?-(\d)$/)
  if (gapMatch) {
    const gapMap: Record<string, string> = { '0': 'gap-0', '1': 'gap-1', '2': 'gap-2', '3': 'gap-4', '4': 'gap-6', '5': 'gap-12' }
    return [gapMap[gapMatch[1]] || 'gap-4']
  }

  const colMatch = value.match(/^col-(\d{1,2})$/)
  if (colMatch) {
    const n = Math.min(12, Math.max(1, Number(colMatch[1])))
    const fractions: Record<number, string> = { 1: 'w-1/12', 2: 'w-2/12', 3: 'w-3/12', 4: 'w-4/12', 5: 'w-5/12', 6: 'w-6/12', 7: 'w-7/12', 8: 'w-8/12', 9: 'w-9/12', 10: 'w-10/12', 11: 'w-11/12', 12: 'w-full' }
    return [fractions[n] || 'w-full']
  }

  const responsiveColMatch = value.match(/^col-(sm|md|lg|xl)-(\d{1,2})$/)
  if (responsiveColMatch) {
    const bp = responsiveColMatch[1]
    const n = Math.min(12, Math.max(1, Number(responsiveColMatch[2])))
    const fractions: Record<number, string> = { 1: 'w-1/12', 2: 'w-2/12', 3: 'w-3/12', 4: 'w-4/12', 5: 'w-5/12', 6: 'w-6/12', 7: 'w-7/12', 8: 'w-8/12', 9: 'w-9/12', 10: 'w-10/12', 11: 'w-11/12', 12: 'w-full' }
    return [`${bp}:${fractions[n] || 'w-full'}`]
  }

  const rowColsMatch = value.match(/^row-cols-(\d{1,2})$/)
  if (rowColsMatch) return [`grid-cols-${Math.min(12, Math.max(1, Number(rowColsMatch[1])))} `].map((s) => s.trim())

  const responsiveRowColsMatch = value.match(/^row-cols-(sm|md|lg|xl)-(\d{1,2})$/)
  if (responsiveRowColsMatch) return [`${responsiveRowColsMatch[1]}:grid-cols-${Math.min(12, Math.max(1, Number(responsiveRowColsMatch[2])))} `].map((s) => s.trim())

  const displayMatch = value.match(/^d-(sm|md|lg|xl)-(block|flex|grid|none)$/)
  if (displayMatch) {
    const displayMap: Record<string, string> = { block: 'block', flex: 'flex', grid: 'grid', none: 'hidden' }
    return [`${displayMatch[1]}:${displayMap[displayMatch[2]]}`]
  }

  switch (value) {
    case 'container':
      return ['w-full', 'max-w-6xl', 'mx-auto', 'px-4']
    case 'container-fluid':
      return ['w-full', 'px-4']
    case 'row':
      return ['w-full']
    case 'col':
      return ['min-w-0', 'px-2']
    case 'd-block':
      return ['block']
    case 'd-flex':
      return ['flex']
    case 'd-grid':
      return ['grid']
    case 'd-none':
      return ['hidden']
    case 'd-inline':
      return ['inline']
    case 'd-inline-block':
      return ['inline-block']
    case 'd-inline-flex':
      return ['inline-flex']
    case 'flex-column':
      return ['flex-col']
    case 'flex-row':
      return ['flex-row']
    case 'flex-wrap':
      return ['flex-wrap']
    case 'flex-nowrap':
      return ['flex-nowrap']
    case 'flex-grow-1':
      return ['grow']
    case 'flex-shrink-0':
      return ['shrink-0']
    case 'w-100':
      return ['w-full']
    case 'h-100':
      return ['h-full']
    case 'text-center':
      return ['text-center']
    case 'text-start':
      return ['text-left']
    case 'text-end':
      return ['text-right']
    case 'fw-bold':
      return ['font-bold']
    case 'fw-normal':
      return ['font-normal']
    case 'lead':
      return ['text-lg', 'leading-8']
    case 'display-5':
      return ['text-4xl', 'md:text-5xl']
    case 'img-fluid':
      return ['max-w-full', 'h-auto']
    case 'text-muted':
      return ['text-[var(--theme-text-muted)]']
    case 'text-body-emphasis':
      return ['text-[var(--theme-text)]']
    case 'rounded-3':
      return ['rounded-xl']
    case 'shadow-sm':
      return ['shadow-sm']
    case 'shadow':
      return ['shadow']
    case 'shadow-lg':
      return ['shadow-lg']
    case 'bg-light':
      return ['bg-[var(--theme-surface)]']
    case 'bg-dark':
      return ['bg-slate-900', 'text-white']
    case 'bg-primary':
      return ['bg-[var(--theme-primary)]', 'text-white']
    case 'bg-secondary':
      return ['bg-[var(--theme-secondary)]', 'text-white']
    case 'bg-success':
      return ['bg-[var(--theme-success)]', 'text-white']
    case 'bg-danger':
      return ['bg-[var(--theme-danger)]', 'text-white']
    case 'bg-warning':
      return ['bg-[var(--theme-warning)]']
    case 'bg-white':
      return ['bg-white']
    case 'bg-transparent':
      return ['bg-transparent']
    case 'text-light':
      return ['text-white']
    case 'text-dark':
      return ['text-slate-900']
    case 'text-white':
      return ['text-white']
    case 'text-primary':
      return ['text-[var(--theme-primary)]']
    case 'text-secondary':
      return ['text-[var(--theme-secondary)]']
    case 'text-success':
      return ['text-[var(--theme-success)]']
    case 'text-danger':
      return ['text-[var(--theme-danger)]']
    case 'text-warning':
      return ['text-[var(--theme-warning)]']
    case 'text-uppercase':
      return ['uppercase']
    case 'text-lowercase':
      return ['lowercase']
    case 'text-capitalize':
      return ['capitalize']
    case 'text-nowrap':
      return ['whitespace-nowrap']
    case 'text-truncate':
      return ['truncate']
    case 'text-decoration-none':
      return ['no-underline']
    case 'font-monospace':
      return ['font-mono']
    case 'overflow-hidden':
      return ['overflow-hidden']
    case 'overflow-auto':
      return ['overflow-auto']
    case 'min-vh-100':
      return ['min-h-screen']
    case 'vh-100':
      return ['h-screen']
    case 'vw-100':
      return ['w-screen']
    case 'rounded':
      return ['rounded']
    case 'rounded-circle':
      return ['rounded-full']
    case 'rounded-pill':
      return ['rounded-full']
    case 'rounded-0':
      return ['rounded-none']
    case 'opacity-0':
      return ['opacity-0']
    case 'opacity-25':
      return ['opacity-25']
    case 'opacity-50':
      return ['opacity-50']
    case 'opacity-75':
      return ['opacity-75']
    case 'opacity-100':
      return ['opacity-100']
    case 'mt-auto':
      return ['mt-auto']
    case 'mb-auto':
      return ['mb-auto']
    case 'ms-auto':
      return ['ml-auto']
    case 'me-auto':
      return ['mr-auto']
    case 'list-unstyled':
      return ['list-none', 'p-0']
    case 'border-top':
      return ['border-t']
    case 'border':
      return ['border']
    case 'small':
      return ['text-sm']
    case 'align-items-center':
      return ['items-center']
    case 'align-items-start':
      return ['items-start']
    case 'align-items-end':
      return ['items-end']
    case 'align-self-center':
      return ['self-center']
    case 'align-self-start':
      return ['self-start']
    case 'align-self-end':
      return ['self-end']
    case 'justify-content-center':
      return ['justify-center']
    case 'justify-content-between':
      return ['justify-between']
    case 'justify-content-end':
      return ['justify-end']
    case 'justify-content-start':
      return ['justify-start']
    case 'justify-content-around':
      return ['justify-around']
    case 'justify-content-evenly':
      return ['justify-evenly']
    case 'justify-content-sm-center':
      return ['sm:justify-center']
    case 'position-relative':
      return ['relative']
    case 'position-absolute':
      return ['absolute']
    case 'top-0':
      return ['top-0']
    case 'end-0':
      return ['right-0']
    case 'card':
      return ['rounded-xl', 'border', 'shadow-sm', 'bg-[var(--theme-surface)]']
    case 'card-body':
      return ['p-6']
    case 'card-header':
      return ['px-6', 'py-4', 'border-b']
    case 'card-footer':
      return ['px-6', 'py-4', 'border-t']
    case 'card-title':
      return ['text-lg', 'font-semibold']
    case 'card-text':
      return ['text-[var(--theme-text)]']
    case 'card-img-top':
      return ['w-full', 'rounded-t-xl', 'object-cover']
    case 'btn':
      return ['inline-flex', 'items-center', 'justify-center', 'rounded-md', 'border', 'px-4', 'py-2', 'font-medium', 'transition-colors', 'no-underline']
    case 'btn-lg':
      return ['px-5', 'py-3', 'text-lg']
    case 'btn-sm':
      return ['px-3', 'py-1.5', 'text-sm']
    case 'btn-primary':
      return ['bg-[var(--theme-primary)]', 'border-[var(--theme-primary)]', 'text-white']
    case 'btn-secondary':
      return ['bg-[var(--theme-secondary)]', 'border-[var(--theme-secondary)]', 'text-white']
    case 'btn-success':
      return ['bg-[var(--theme-success)]', 'border-[var(--theme-success)]', 'text-white']
    case 'btn-danger':
      return ['bg-[var(--theme-danger)]', 'border-[var(--theme-danger)]', 'text-white']
    case 'btn-warning':
      return ['bg-[var(--theme-warning)]', 'border-[var(--theme-warning)]', 'text-slate-950']
    case 'btn-info':
      return ['bg-sky-500', 'border-sky-500', 'text-white']
    case 'btn-light':
      return ['bg-white', 'border-white', 'text-slate-900']
    case 'btn-dark':
      return ['bg-slate-900', 'border-slate-900', 'text-white']
    case 'btn-link':
      return ['border-transparent', 'bg-transparent', 'p-0', 'text-[var(--theme-primary)]', 'underline-offset-4', 'hover:underline']
    case 'btn-outline-primary':
      return ['border-[var(--theme-primary)]', 'text-[var(--theme-primary)]', 'bg-transparent', 'hover:bg-[var(--theme-primary)]', 'hover:text-white']
    case 'btn-outline-secondary':
      return ['border-[var(--theme-secondary)]', 'text-[var(--theme-secondary)]', 'bg-transparent', 'hover:bg-[var(--theme-secondary)]', 'hover:text-white']
    case 'form-control':
      return ['w-full', 'rounded-md', 'border', 'px-3', 'py-2', 'bg-[var(--theme-surface)]', 'text-[var(--theme-text)]']
    case 'form-select':
      return ['w-full', 'rounded-md', 'border', 'px-3', 'py-2', 'bg-[var(--theme-surface)]', 'text-[var(--theme-text)]']
    case 'form-check-input':
      return ['h-4', 'w-4', 'accent-[var(--theme-primary)]']
    case 'blockquote':
      return ['border-l-4', 'pl-4', 'italic']
    case 'blockquote-footer':
      return ['mt-2', 'text-sm', 'text-[var(--theme-text-muted)]']
    case 'navbar':
      return ['w-full']
    case 'navbar-expand-lg':
      return []
    case 'navbar-brand':
      return ['text-lg', 'font-semibold', 'no-underline']
    case 'navbar-nav':
      return ['flex', 'flex-col', 'gap-4', 'lg:flex-row', 'lg:items-center']
    case 'nav-item':
      return ['list-none']
    case 'nav-link':
      return ['no-underline', 'text-[var(--theme-text)]', 'hover:text-[var(--theme-primary)]']
    case 'navbar-theme-light':
    case 'navbar-theme-dark':
    case 'navbar-theme-primary':
      return [value]
    case 'g-0':
      return ['gap-0']
    case 'd-sm-flex':
      return ['sm:flex']
    case 'd-md-flex':
      return ['md:flex']
    case 'd-lg-flex':
      return ['lg:flex']
    case 'd-sm-block':
      return ['sm:block']
    case 'd-md-block':
      return ['md:block']
    case 'd-lg-block':
      return ['lg:block']
    case 'd-sm-none':
      return ['sm:hidden']
    case 'd-md-none':
      return ['md:hidden']
    case 'd-lg-none':
      return ['lg:hidden']
    default:
      return [value]
  }
}

function getPropDrivenClasses(block: Block): string[] {
  const classes: string[] = []

  if (typeof block.props.alignment === 'string' && block.props.alignment.trim()) {
    classes.push(String(block.props.alignment).trim())
  }

  if (block.type === 'paragraph' && block.props.lead) {
    classes.push('lead')
  }

  if (block.type === 'column' && typeof block.props.width === 'string' && block.props.width.trim()) {
    classes.push(String(block.props.width).trim())
  }

  if (block.type === 'button') {
    if (typeof block.props.variant === 'string' && block.props.variant.trim()) {
      classes.push(String(block.props.variant).trim())
    }
    if (typeof block.props.size === 'string' && block.props.size.trim()) {
      classes.push(String(block.props.size).trim())
    }
  }

  if (block.type === 'navbar' && typeof block.props.theme === 'string' && block.props.theme.trim()) {
    classes.push(String(block.props.theme).trim())
  }

  if (block.type === 'row' && block.props.gutters === false) {
    classes.push('g-0')
  }

  if (block.type === 'container' && block.props.fluid) {
    classes.push('container-fluid')
  }

  return classes
}

function resolveFrameworkClasses(block: Block, framework: FrameworkChoice, options?: BlockToHtmlOptions): string[] {
  let baseClasses = [...block.classes]
  if (block.type === 'container' && block.props.fluid) {
    baseClasses = baseClasses.filter((cls) => cls !== 'container')
  }

  if (options?.fullWidthFormControls !== false) {
    if (block.type === 'input' || block.type === 'textarea' || block.type === 'select') {
      if (framework === 'tailwind' && !baseClasses.some(c => c.includes('w-'))) {
        baseClasses.push('w-full')
      } else if (framework === 'bootstrap-5' && !baseClasses.some(c => c.includes('w-'))) {
        baseClasses.push('w-100')
      }
    }
  }

  const merged = [...baseClasses, ...getPropDrivenClasses(block)]
  const normalized = block.type === 'navbar'
    ? normalizeNavbarThemeClasses(merged)
    : merged

  if (framework !== 'tailwind') return dedupeClasses(normalized)

  let mapped = normalized.flatMap((cls) => mapBootstrapClassToTailwind(cls))
  const hasGridCols = mapped.some((cls) => /^(grid-cols-|\w+:grid-cols-)/.test(cls))

  if (block.type === 'row') {
    const hasColumnChildren = block.children.some((child) => child.type === 'column')
    const hasZeroGutters = normalized.includes('g-0')

    if (hasGridCols) {
      mapped = mapped.filter((cls) => cls !== 'flex' && cls !== 'flex-wrap' && cls !== '-mx-2')
      if (!mapped.includes('grid')) mapped.unshift('grid')
      if (!mapped.includes('w-full')) mapped.unshift('w-full')
    } else if (hasColumnChildren) {
      mapped = mapped.filter((cls) => !/^gap-/.test(cls) && cls !== 'grid')
      if (!mapped.includes('flex')) mapped.unshift('flex')
      if (!mapped.includes('w-full')) mapped.unshift('w-full')
      if (!mapped.includes('flex-wrap')) mapped.push('flex-wrap')
      if (!hasZeroGutters && !mapped.includes('-mx-2')) mapped.push('-mx-2')
    } else {
      mapped = mapped.filter((cls) => cls !== 'flex' && cls !== 'flex-wrap' && cls !== '-mx-2' && cls !== 'grid' && !/^gap-/.test(cls))
      if (!mapped.includes('w-full')) mapped.unshift('w-full')
    }
  }

  if (block.type === 'column') {
    const hasExplicitWidth = normalized.some((cls) => /^(?:col-\d{1,2}|col-(?:sm|md|lg|xl)-\d{1,2})$/.test(cls))
    if (!hasExplicitWidth) {
      if (!mapped.includes('w-full')) mapped.unshift('w-full')
      if (!mapped.includes('md:flex-1')) mapped.push('md:flex-1')
    }
  }

  if (block.type === 'container' && block.props.fluid) {
    return dedupeClasses(mapped.filter((cls) => cls !== 'max-w-6xl').concat(['w-full']))
  }

  // Catch AI-generated or custom rows that might not have block.type === 'row'
  // but act as rows (flex-wrap and -mx-2 for negative margins)
  if (mapped.includes('flex-wrap') && mapped.includes('-mx-2') && !mapped.includes('w-full')) {
    mapped.unshift('w-full')
  }

  return dedupeClasses(mapped)
}

// ─── Content generation for specific block types ─────────────────────────────

function getBlockContent(
  block: Block,
  isExportMode?: boolean,
  framework: FrameworkChoice = 'bootstrap-5',
  includeEditorMetadata: boolean = false
): string {
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

      const isTw = framework === 'tailwind'
      const badgeHtml = language
        ? isTw
          ? `<div class="absolute top-0 right-0 mt-2 mr-2 px-2 py-1 bg-[var(--theme-secondary)] text-white rounded font-mono" style="font-size: 0.75rem; opacity: 0.8; z-index: 5;">${language}</div>`
          : `<div class="position-absolute top-0 end-0 mt-2 me-2 px-2 py-1 bg-secondary text-white rounded font-monospace" style="font-size: 0.75rem; opacity: 0.8; z-index: 5;">${language}</div>`
        : ''

      // Return just the inner generated html. The parent engine assigns external padding arrays to `tag`!
      return `<div class="${isTw ? 'relative' : 'position-relative'}">${badgeHtml}<pre class="m-0" style="background: transparent; padding: 0;"><code class="hljs ${language ? `language-${language}` : ''}" style="background: transparent; padding: 0;">${highlighted}</code></pre></div>`
    }

    case 'icon':
      return ''

    case 'carousel': {
      const id = String(props.id || 'carousel-' + Math.random().toString(36).substr(2, 9))
      const slides = (props.slides as Array<{ src: string; alt: string; caption?: string }>) ?? []

      if (slides.length === 0) {
        if (isExportMode) {
          return `<div class="carousel-inner"></div>`
        }
        return `<div class="carousel-inner editor-placeholder">
          <div class="text-center p-4">
            <div style="font-size:2rem;margin-bottom:0.5rem;">🎠</div>
            <p class="mb-0">No slides — select this block and add slides in the inspector.</p>
          </div>
        </div>`
      }

      if (framework === 'tailwind') {
        const items = slides.map((slide, i) => `
        <div class="${i === 0 ? 'block' : 'hidden'}" data-tw-carousel-slide="${i}">
          <img src="${escapeAttrValue(slide.src)}" class="block w-full rounded-xl" alt="${escapeAttrValue(slide.alt)}">
          ${slide.caption ? `<div class="mt-3 text-center text-sm text-[var(--theme-text-muted)]">${escapeAttrValue(slide.caption)}</div>` : ''}
        </div>`).join('\n')

        const controls = slides.length > 1
          ? `
        <div class="mt-4 flex items-center justify-between gap-4">
          <button type="button" class="inline-flex items-center justify-center rounded-md border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-text)]" onclick="(function(){var root=this.closest('[data-tw-carousel]');if(!root)return;var slides=Array.prototype.slice.call(root.querySelectorAll('[data-tw-carousel-slide]'));var index=slides.findIndex(function(slide){return !slide.classList.contains('hidden');});if(index<0)index=0;slides[index].classList.add('hidden');var next=(index-1+slides.length)%slides.length;slides[next].classList.remove('hidden');}).call(this)">Previous</button>
          <button type="button" class="inline-flex items-center justify-center rounded-md border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-text)]" onclick="(function(){var root=this.closest('[data-tw-carousel]');if(!root)return;var slides=Array.prototype.slice.call(root.querySelectorAll('[data-tw-carousel-slide]'));var index=slides.findIndex(function(slide){return !slide.classList.contains('hidden');});if(index<0)index=0;slides[index].classList.add('hidden');var next=(index+1)%slides.length;slides[next].classList.remove('hidden');}).call(this)">Next</button>
        </div>`
          : ''

        return `<div data-tw-carousel="${id}">${items}${controls}</div>`
      }

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

      if (framework === 'tailwind') {
        return `<div class="divide-y divide-[var(--theme-border)] rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)]">${
          items.map((item, i) => `
        <details class="group"${i === 0 ? ' open' : ''}>
          <summary class="flex cursor-pointer list-none items-center justify-between px-4 py-3 font-medium text-[var(--theme-text)]">
            <span>${escapeAttrValue(item.title)}</span>
            <span class="text-[var(--theme-text-muted)] group-open:rotate-45 transition-transform">+</span>
          </summary>
          <div class="px-4 pb-4 text-sm text-[var(--theme-text-muted)]">
            ${escapeAttrValue(item.content)}
          </div>
        </details>`).join('\n')
        }</div>`
      }

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
      const tabs = (props.tabs as Array<{ label: string; content: string; blocks?: Block[] }>) ?? []
      const defaultTab = typeof props.defaultTab === 'number' ? props.defaultTab : 0

      if (framework === 'tailwind') {
        const navItems = tabs.map((tab, i) => `
        <button class="${i === defaultTab ? 'bg-[var(--theme-primary)] text-white' : 'border border-[var(--theme-border)] text-[var(--theme-text)]'} rounded-md px-4 py-2 text-sm font-medium" type="button" data-tw-tab-button="${id}" data-tw-tab-target="${id}-content-${i}" onclick="(function(){var root=this.closest('[data-tw-tabs]');if(!root)return;root.querySelectorAll('[data-tw-tab-button=\\"${id}\\"]').forEach(function(btn){btn.className='border border-[var(--theme-border)] text-[var(--theme-text)] rounded-md px-4 py-2 text-sm font-medium';});root.querySelectorAll('[data-tw-tab-panel]').forEach(function(panel){panel.classList.add('hidden');});this.className='bg-[var(--theme-primary)] text-white rounded-md px-4 py-2 text-sm font-medium';var panel=root.querySelector('#${id}-content-${i}');if(panel)panel.classList.remove('hidden');}).call(this)">${escapeAttrValue(tab.label)}</button>`).join('\n')

        const contentItems = tabs.map((tab, i) => `
        <div class="${i === defaultTab ? '' : 'hidden ' }rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 text-[var(--theme-text)]" id="${id}-content-${i}" data-tw-tab-panel>
          ${tab.blocks && tab.blocks.length > 0 ? blockToHtml(tab.blocks, { framework, includeDataAttributes: !isExportMode, includeEditorMetadata }) : escapeAttrValue(tab.content)}
        </div>`).join('\n')

        return `
        <div data-tw-tabs="${id}">
          <div class="mb-4 flex flex-wrap gap-2">
            ${navItems}
          </div>
          <div class="space-y-3">
            ${contentItems}
          </div>
        </div>`
      }

      const navItems = tabs.map((tab, i) => {
        const tabId = `${id}-tab-${i}`
        const contentId = `${id}-content-${i}`
        const activeClass = i === defaultTab ? 'active' : ''

        return `
        <li class="nav-item" role="presentation">
          <button class="nav-link ${activeClass}" id="${tabId}" data-bs-toggle="tab" data-bs-target="#${contentId}" type="button" role="tab" aria-controls="${contentId}" aria-selected="${i === defaultTab}">
            ${escapeAttrValue(tab.label)}
          </button>
        </li>`
      }).join('\n')

      const contentItems = tabs.map((tab, i) => {
        const tabId = `${id}-tab-${i}`
        const contentId = `${id}-content-${i}`
        const activeClass = i === defaultTab ? 'show active' : ''

        return `
        <div class="tab-pane fade ${activeClass}" id="${contentId}" role="tabpanel" aria-labelledby="${tabId}">
          ${tab.blocks && tab.blocks.length > 0 ? blockToHtml(tab.blocks, { framework, includeDataAttributes: !isExportMode, includeEditorMetadata }) : escapeAttrValue(tab.content)}
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

    case 'raw-html': {
      const rawHtml = typeof block.content === 'string'
        ? block.content
        : String(props.content ?? '')
      if (rawHtml.trim().length === 0) {
        if (isExportMode) return ''
        return `<div class="editor-placeholder">
          <div class="text-center p-4">
            <div style="font-size:1.5rem;margin-bottom:0.5rem;">&lt;/&gt;</div>
            <p class="mb-0">Raw HTML — add content in the Inspector</p>
          </div>
        </div>`
      }
      return rawHtml
    }

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

  // Container with isForm renders as <form>
  if (block.type === 'container' && block.props.isForm) {
    return 'form'
  }

  // Button with href renders as <a> (Bootstrap link-button pattern)
  if (block.type === 'button' && block.props.href) {
    return 'a'
  }

  return DEFAULT_TAGS[block.type] ?? 'div'
}

// ─── Main conversion ─────────────────────────────────────────────────────────

export interface BlockToHtmlOptions {
  indent?: number          // Starting indent level (default 0)
  indentSize?: number      // Spaces per indent (default 2)
  includeDataAttributes?: boolean  // Include data-block-id for editor use
  includeEditorMetadata?: boolean
  pages?: Page[]           // Page list for components that use pages as datasource (e.g. navbar)
  folders?: PageFolder[]   // Folder list for effective tag resolution
  framework?: FrameworkChoice
  fullWidthFormControls?: boolean
}

export function blockToHtml(blocks: Block[], options: BlockToHtmlOptions = {}): string {
  const {
    indent = 0,
    indentSize = 2,
    includeDataAttributes = false,
    includeEditorMetadata = false,
    pages,
    folders,
    framework = 'bootstrap-5',
    fullWidthFormControls = true
  } = options
  return blocks.map((block) => renderBlock(block, indent, indentSize, includeDataAttributes, includeEditorMetadata, pages, folders, framework, fullWidthFormControls)).join('\n')
}

function renderBlock(
  block: Block,
  indent: number,
  indentSize: number,
  includeDataAttributes: boolean,
  includeEditorMetadata: boolean,
  pages?: Page[],
  folders?: PageFolder[],
  framework: FrameworkChoice = 'bootstrap-5',
  fullWidthFormControls: boolean = true
): string {
  const pad = ' '.repeat(indent * indentSize)

  // Special handling for Modal
  if (block.type === 'modal') {
    const fallbackId = 'modal-' + Math.random().toString(36).substr(2, 9)
    const id = sanitizeElementId(String(block.props.id || fallbackId), fallbackId)
    const buttonText = String(block.props.buttonText || 'Launch Modal')
    const title = String(block.props.title || 'Modal Title')
    const showClose = block.props.closeButton !== false
    const showFooter = block.props.footerButtons !== false
    const sizeClass = block.props.size && block.props.size !== 'default' ? ` ${block.props.size}` : ''
    const themeSurface = 'var(--theme-surface)'
    const themeText = 'var(--theme-text)'
    const themeBorder = 'var(--theme-border)'
    const isExportMode = !includeDataAttributes
    
    const childrenHtml = (block.children || []).map((child) => renderBlock(child, indent + 1, indentSize, includeDataAttributes, includeEditorMetadata, pages, folders, framework, fullWidthFormControls)).join('\n')
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}" data-block-type="modal"` : ''

    if (!isExportMode) {
      // Editor preview mode
      if (framework === 'tailwind') {
        return `${pad}<div class="mb-4 rounded-xl border shadow-sm editor-outline-gated editor-modal-preview" style="border: 2px dashed ${themeBorder}; background-color: ${themeSurface}; color: ${themeText};" ${dataAttr}>
${pad}  <div class="flex items-center justify-between px-4 py-3" style="background-color: rgba(0,0,0,0.03); border-bottom: 1px solid ${themeBorder};">
${pad}    <div class="flex items-center gap-2 font-bold">
${pad}      <span>🔲</span> ${escapeAttrValue(title)}
${pad}    </div>
${pad}    <span class="rounded bg-[var(--theme-secondary)] px-2 py-1 text-xs text-white">Modal Preview</span>
${pad}  </div>
${pad}  <div class="p-6">
${childrenHtml}
${pad}  </div>
${pad}</div>`
      }
      return `${pad}<div class="card mb-3 editor-outline-gated editor-modal-preview" style="border: 2px dashed ${themeBorder}; background-color: ${themeSurface}; color: ${themeText};" ${dataAttr}>
${pad}  <div class="card-header d-flex justify-content-between align-items-center" style="background-color: rgba(0,0,0,0.03); border-bottom: 1px solid ${themeBorder};">
${pad}    <div class="fw-bold d-flex align-items-center gap-2">
${pad}      <span>🔲</span> ${escapeAttrValue(title)}
${pad}    </div>
${pad}    <span class="badge bg-secondary">Modal Preview</span>
${pad}  </div>
${pad}  <div class="card-body">
${childrenHtml}
${pad}  </div>
${pad}</div>`
    } else {
      if (framework === 'tailwind') {
        const closeAction = `document.getElementById('${id}')?.classList.add('hidden');document.body.classList.remove('overflow-hidden');`
        const openAction = `document.getElementById('${id}')?.classList.remove('hidden');document.body.classList.add('overflow-hidden');`
        return `${pad}<button type="button" class="inline-flex items-center justify-center rounded-md border border-[var(--theme-primary)] bg-[var(--theme-primary)] px-4 py-2 font-medium text-white" onclick="${openAction}">
${pad}  ${escapeAttrValue(buttonText)}
${pad}</button>

${pad}<div class="fixed inset-0 z-50 hidden" id="${id}" aria-labelledby="${id}Label" aria-hidden="true">
${pad}  <div class="absolute inset-0 bg-black/50" onclick="${closeAction}"></div>
${pad}  <div class="relative flex min-h-full items-center justify-center p-4">
${pad}    <div class="w-full max-w-2xl rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-xl">
${pad}      <div class="flex items-center justify-between border-b border-[var(--theme-border)] px-6 py-4">
${pad}        <h2 class="text-xl font-semibold text-[var(--theme-text)]" id="${id}Label">${escapeAttrValue(title)}</h2>
${pad}        ${showClose ? `<button type="button" class="rounded-md px-3 py-2 text-[var(--theme-text-muted)]" onclick="${closeAction}" aria-label="Close">✕</button>` : ''}
${pad}      </div>
${pad}      <div class="px-6 py-5 text-[var(--theme-text)]">
${childrenHtml}
${pad}      </div>
${pad}      ${showFooter ? `<div class="flex justify-end gap-3 border-t border-[var(--theme-border)] px-6 py-4">
${pad}        <button type="button" class="inline-flex items-center justify-center rounded-md border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-text)]" onclick="${closeAction}">Close</button>
${pad}        <button type="button" class="inline-flex items-center justify-center rounded-md border border-[var(--theme-primary)] bg-[var(--theme-primary)] px-4 py-2 text-sm font-medium text-white">Save changes</button>
${pad}      </div>` : ''}
${pad}    </div>
${pad}  </div>
${pad}</div>`
      }

      // Export mode
      return `${pad}<!-- Button trigger modal -->
${pad}<button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#${id}">
${pad}  ${escapeAttrValue(buttonText)}
${pad}</button>

${pad}<!-- Modal -->
${pad}<div class="modal fade" id="${id}" tabindex="-1" aria-labelledby="${id}Label" aria-hidden="true">
${pad}  <div class="modal-dialog${sizeClass}">
${pad}    <div class="modal-content" style="background-color: ${themeSurface}; color: ${themeText}; border-color: ${themeBorder};">
${pad}      <div class="modal-header" style="border-bottom-color: ${themeBorder};">
${pad}        <h1 class="modal-title fs-5" id="${id}Label">${escapeAttrValue(title)}</h1>
${pad}        ${showClose ? `<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" style="filter: var(--theme-close-filter, none);"></button>` : ''}
${pad}      </div>
${pad}      <div class="modal-body">
${childrenHtml}
${pad}      </div>
${pad}      ${showFooter ? `<div class="modal-footer" style="border-top-color: ${themeBorder};">
${pad}        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
${pad}        <button type="button" class="btn btn-primary">Save changes</button>
${pad}      </div>` : ''}
${pad}    </div>
${pad}  </div>
${pad}</div>`
    }
  }

  // Special handling for Checkbox (composite component)
  if (block.type === 'checkbox') {
    const label = escapeAttrValue(String(block.props.label ?? ''))
    const name = block.props.name ? `name="${escapeAttrValue(String(block.props.name))}"` : ''
    const checked = block.props.checked ? 'checked' : ''
    const id = block.id
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}"` : ''
    const classes = resolveFrameworkClasses(block, framework, { fullWidthFormControls }).join(' ')

    if (framework === 'tailwind') {
      return `${pad}<label class="mb-4 inline-flex items-center gap-3 text-[var(--theme-text)]" ${dataAttr}>
${pad}  <input class="${classes}" type="checkbox" id="${id}" ${name} ${checked}>
${pad}  <span>${label}</span>
${pad}</label>`
    }

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
    const classesArray = normalizeNavbarThemeClasses([...block.classes, ...getPropDrivenClasses(block)])
    const classes = classesArray.join(' ')
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
      brandHtml = framework === 'tailwind'
        ? `<img src="${escapeAttrValue(brandImage)}" alt="${brandText}" class="h-8 w-auto">${brandText}`
        : `<img src="${escapeAttrValue(brandImage)}" alt="${brandText}" height="30" class="d-inline-block align-text-top me-2">${brandText}`
    } else {
      brandHtml = brandText
    }

    const hamburgerMenu = block.props.hamburgerMenu !== false

    if (framework === 'tailwind') {
      const themeClass = classesArray.find((c) => c.startsWith('navbar-theme-')) || 'navbar-theme-light'
      const toneClasses = themeClass === 'navbar-theme-dark'
        ? 'bg-slate-900 text-white'
        : themeClass === 'navbar-theme-primary'
          ? 'bg-[var(--theme-primary)] text-white'
          : 'bg-[var(--theme-surface)] text-[var(--theme-text)] border border-[var(--theme-border)]'
          
      return `${pad}<nav class="${toneClasses} w-full"${styleAttr} ${dataAttr}>
${pad}  <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
${hamburgerMenu ? `${pad}    <div class="flex items-center justify-between w-full lg:w-auto">
${pad}      <a class="inline-flex items-center gap-2 text-lg font-semibold no-underline" href="#">${brandHtml}</a>
${pad}      <button class="lg:hidden text-current border p-1 rounded" onclick="document.getElementById('${navbarId}').classList.toggle('hidden')">
${pad}        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
${pad}      </button>
${pad}    </div>` : `${pad}    <a class="inline-flex items-center gap-2 text-lg font-semibold no-underline" href="#">${brandHtml}</a>`}
${pad}    <ul id="${navbarId}" class="list-none flex-col gap-3 p-0 lg:flex-row lg:items-center ${hamburgerMenu ? 'hidden lg:flex' : 'flex'}">
${navLinks.replace(/nav-item/g, 'list-none').replace(/nav-link/g, themeClass === 'navbar-theme-light' ? 'no-underline hover:text-[var(--theme-primary)]' : 'no-underline text-inherit opacity-90 hover:opacity-100')}
${pad}    </ul>
${pad}  </div>
${pad}</nav>`
    }

    return `${pad}<nav class="${classes}"${styleAttr} ${dataAttr}>
${pad}  <div class="container">
${pad}    <a class="navbar-brand" href="#">${brandHtml}</a>
${hamburgerMenu ? `${pad}    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#${navbarId}" aria-controls="${navbarId}" aria-expanded="false" aria-label="Toggle navigation">
${pad}      <span class="navbar-toggler-icon"></span>
${pad}    </button>
${pad}    <div class="collapse navbar-collapse" id="${navbarId}">
${pad}      <ul class="navbar-nav ms-auto mb-2 mb-lg-0">
${navLinks}
${pad}      </ul>
${pad}    </div>` : `${pad}    <div class="w-100 mt-2 mt-lg-0" id="${navbarId}">
${pad}      <ul class="navbar-nav ms-auto mb-2 mb-lg-0 flex-row gap-3 flex-wrap">
${navLinks}
${pad}      </ul>
${pad}    </div>`}
${pad}  </div>
${pad}</nav>`
  }

  // Special handling for Page List with pagination
  if (block.type === 'page-list' && pages && pages.length > 0) {
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}" data-block-type="page-list"` : ''
    const classes = resolveFrameworkClasses(block, framework, { fullWidthFormControls }).join(' ')
    const styleStr = stylesToString(block.styles)
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    const filterTag = String(block.props.filterTag || '').trim()
    const itemsPerPage = Math.max(1, Number(block.props.itemsPerPage) || 6)
    const cols = Number(block.props.columns) || 3
    const showSearch = block.props.showSearch === true
    const showSort = block.props.showSort === true
    const sortLayout = block.props.sortLayout === 'new-row' ? 'new-row' : 'inline'
    const rawSortPriority = Array.isArray(block.props.sortPriority)
      ? (block.props.sortPriority as unknown[])
        .map((k) => String(k).trim())
        .filter(Boolean)
      : typeof block.props.sortPriority === 'string'
        ? block.props.sortPriority
          .split(/[,\n]+/)
          .map((k) => k.trim())
          .filter(Boolean)
        : []
    const legacySortKeys = Array.isArray(block.props.sortKeys)
      ? (block.props.sortKeys as unknown[])
        .map((k) => String(k).trim())
        .filter(Boolean)
      : typeof block.props.sortKeys === 'string'
        ? block.props.sortKeys
          .split(/[,\n]+/)
          .map((k) => k.trim())
          .filter(Boolean)
        : []
    const legacyDefaultSortKey = typeof block.props.sortDefaultKey === 'string' ? block.props.sortDefaultKey : ''
    const sortDefaultDir = block.props.sortDefaultDir === 'desc' ? 'desc' : 'asc'
    const detailsMode = typeof block.props.detailsMode === 'string' ? block.props.detailsMode : ''
    const legacyShowDesc = block.props.showDescription !== false
    const showDesc = detailsMode
      ? (detailsMode === 'description' || detailsMode === 'description+meta')
      : legacyShowDesc

    const showMeta = detailsMode === 'meta' || detailsMode === 'description+meta'
    const metaKeys = Array.isArray(block.props.metaKeys)
      ? (block.props.metaKeys as unknown[])
        .map((k) => String(k).trim())
        .filter(Boolean)
      : typeof block.props.metaKeys === 'string'
        ? block.props.metaKeys
          .split(/[,\n]+/)
          .map((k) => k.trim())
          .filter(Boolean)
        : []
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
    const colClass = framework === 'tailwind'
      ? cols === 1 ? 'w-full' : cols === 2 ? 'w-full md:w-6/12' : 'w-full md:w-6/12 lg:w-4/12'
      : cols === 1 ? 'col-12' : cols === 2 ? 'col-md-6' : 'col-md-6 col-lg-4'

    // Build card HTML for each page
    const cards = filteredPages.map((p) => {
      const href = p.slug === 'index' ? 'index.html' : `${p.slug}.html`
      const title = escapeAttrValue(p.title)
      const rawTitle = String(p.title || '')
      const rawMeta = (p.meta || {}) as Record<string, string>
      const rawDesc = rawMeta.description ? String(rawMeta.description) : ''
      const searchText = `${rawTitle}\n${rawDesc}\n${Object.entries(rawMeta).map(([k, v]) => `${k}: ${v}`).join('\n')}`
      const metaJson = JSON.stringify(rawMeta)
      const meta = showMeta && metaKeys.length > 0
        ? metaKeys
          .map((k) => {
            const v = p.meta?.[k]
            if (!v) return ''
            const label = k
              .replace(/[-_]+/g, ' ')
              .replace(/^\w/, (c) => c.toUpperCase())
            return `<div class="${framework === 'tailwind' ? 'text-sm text-[var(--theme-text-muted)]' : 'small text-muted'}">${escapeAttrValue(label)}: ${escapeAttrValue(String(v))}</div>`
          })
          .filter(Boolean)
          .join('')
        : ''
      const desc = showDesc && p.meta?.description ? `<p class="${framework === 'tailwind' ? 'text-sm text-[var(--theme-text-muted)]' : 'card-text text-muted'}">${escapeAttrValue(p.meta.description)}</p>` : ''
      if (framework === 'tailwind') {
        return `<div class="${colClass} mb-4" data-page-list-card data-title="${escapeAttrValue(rawTitle)}" data-meta="${escapeAttrValue(metaJson)}" data-search="${escapeAttrValue(searchText)}"><div class="flex h-full flex-col rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-sm"><h5 class="text-lg font-semibold text-[var(--theme-text)]">${title}</h5>${meta}${desc}<a href="${href}" class="mt-auto inline-flex items-center justify-center rounded-md border border-[var(--theme-primary)] bg-[var(--theme-primary)] px-4 py-2 text-sm font-medium text-white no-underline">Read more</a></div></div>`
      }
      return `<div class="${colClass} mb-4" data-page-list-card data-title="${escapeAttrValue(rawTitle)}" data-meta="${escapeAttrValue(metaJson)}" data-search="${escapeAttrValue(searchText)}"><div class="card h-100"><div class="card-body d-flex flex-column"><h5 class="card-title">${title}</h5>${meta}${desc}<a href="${href}" class="btn btn-primary mt-auto">Read more</a></div></div></div>`
    })

    const classAttr = classes ? ` class="${classes}"` : ''

    if (showSearch || showSort) {
      const availableKeysRaw = (metaKeys.length > 0 ? metaKeys : legacySortKeys)
        .map((k) => String(k || '').trim())
        .filter(Boolean)
        .filter((k) => k !== 'title')

      const availableKeys: string[] = []
      const seenAvailable = new Set<string>()
      const pushAvailable = (k: string) => {
        const key = String(k || '').trim()
        if (!key) return
        if (seenAvailable.has(key)) return
        seenAvailable.add(key)
        availableKeys.push(key)
      }

      pushAvailable('title')
      availableKeysRaw.forEach(pushAvailable)

      const inAvailable = new Set<string>(availableKeys)
      const sortKeys: string[] = []
      const seen = new Set<string>()

      const pushKey = (k: string) => {
        const key = String(k || '').trim()
        if (!key) return
        if (!inAvailable.has(key)) return
        if (seen.has(key)) return
        seen.add(key)
        sortKeys.push(key)
      }

      rawSortPriority.forEach(pushKey)

      if (sortKeys.length === 0 && legacyDefaultSortKey) pushKey(legacyDefaultSortKey)

      availableKeys.forEach(pushKey)

      const sortDefaultKey = sortKeys[0] || 'title'

      const labelForKey = (k: string) =>
        k === 'title'
          ? 'Title'
          : k === 'datePublished'
            ? 'Date Published'
            : k
              .replace(/[-_]+/g, ' ')
              .replace(/^\w/, (c) => c.toUpperCase())

      const searchControl = showSearch
        ? `<input type="search" class="${framework === 'tailwind' ? 'w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 text-[var(--theme-text)]' : 'form-control'}" placeholder="Search..." data-page-list-search>`
        : ''

      const sortOptionsHtml = sortKeys
        .map((k) => `${pad}      <option value="${escapeAttrValue(k)}"${k === sortDefaultKey ? ' selected' : ''}>${escapeAttrValue(labelForKey(k))}</option>`)
        .join('\n')

      const sortControl = showSort
        ? sortLayout === 'new-row'
          ? `<select class="${framework === 'tailwind' ? 'w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 text-[var(--theme-text)]' : 'form-select'}" style="flex: 1 1 260px; min-width: 200px" data-page-list-sort>
${sortOptionsHtml}
${pad}    </select>
${pad}    <select class="${framework === 'tailwind' ? 'w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 text-[var(--theme-text)]' : 'form-select'}" style="flex: 0 0 160px; max-width: 160px" data-page-list-dir>
${pad}      <option value="asc"${sortDefaultDir === 'asc' ? ' selected' : ''}>Ascending</option>
${pad}      <option value="desc"${sortDefaultDir === 'desc' ? ' selected' : ''}>Descending</option>
${pad}    </select>`
          : `<select class="${framework === 'tailwind' ? 'w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 text-[var(--theme-text)]' : 'form-select'}" style="width: 220px; max-width: 220px" data-page-list-sort>
${sortOptionsHtml}
${pad}    </select>
${pad}    <select class="${framework === 'tailwind' ? 'w-full rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 text-[var(--theme-text)]' : 'form-select'}" style="width: 160px; max-width: 160px" data-page-list-dir>
${pad}      <option value="asc"${sortDefaultDir === 'asc' ? ' selected' : ''}>Ascending</option>
${pad}      <option value="desc"${sortDefaultDir === 'desc' ? ' selected' : ''}>Descending</option>
${pad}    </select>`
        : ''

      const controlsHtml = sortLayout === 'new-row'
        ? `${pad}  <div class="mb-3">
${showSearch ? `${pad}    <div class="mb-2">${searchControl}</div>` : ''}
${showSort ? `${pad}    <div class="d-flex gap-2 align-items-center" style="width: 100%; flex-wrap: wrap">${sortControl}</div>` : ''}
${pad}  </div>`
        : `${pad}  <div class="mb-3 d-flex gap-2 align-items-center" style="flex-wrap: wrap">
${showSearch ? `${pad}    <div style="flex: 1 1 260px; min-width: 200px">${searchControl}</div>` : ''}
${showSort ? `${pad}    <div style="flex: 0 0 auto; margin-left: auto">
${pad}      <div class="d-flex gap-2 align-items-center" style="flex-wrap: nowrap">${sortControl}</div>
${pad}    </div>` : ''}
${pad}  </div>`

      const cardsHtml = `${pad}  <div class="${framework === 'tailwind' ? 'flex flex-wrap gap-4' : 'row'}" data-page-list-cards>\n${cards.map((c) => `${pad}    ${c}`).join('\n')}\n${pad}  </div>`

      const paginationShell = `${pad}  <nav aria-label="Page list pagination" data-page-list-pagination style="display:none">\n${pad}    <ul class="${framework === 'tailwind' ? 'mt-4 flex items-center justify-center gap-2' : 'pagination justify-content-center mt-4'}" data-page-list-pagination-items></ul>\n${pad}  </nav>`

      const script = `
${pad}  <script>
${pad}    (function(){
${pad}      var root=document.getElementById('${pageListId}');
${pad}      if(!root)return;
${pad}      var allCards=Array.prototype.slice.call(root.querySelectorAll('[data-page-list-card]'));
${pad}      var cardsContainer=root.querySelector('[data-page-list-cards]');
${pad}      var searchInput=root.querySelector('[data-page-list-search]');
${pad}      var sortSelect=root.querySelector('[data-page-list-sort]');
${pad}      var dirSelect=root.querySelector('[data-page-list-dir]');
${pad}      var paginationNav=root.querySelector('[data-page-list-pagination]');
${pad}      var paginationItems=root.querySelector('[data-page-list-pagination-items]');
${pad}      var itemsPerPage=${itemsPerPage};
${pad}      var currentPage=0;

${pad}      function looksLikeISODate(v){return /^\d{4}-\d{2}-\d{2}/.test(v||'');}
${pad}      function coerce(v){
${pad}        if(v===null||v===undefined)return '';
${pad}        v=String(v);
${pad}        if(looksLikeISODate(v)){
${pad}          var t=Date.parse(v);
${pad}          return isNaN(t)?v.toLowerCase():t;
${pad}        }
${pad}        if(/^\s*-?\d+(\.\d+)?\s*$/.test(v)){
${pad}          var n=Number(v);
${pad}          return isNaN(n)?v.toLowerCase():n;
${pad}        }
${pad}        return v.toLowerCase();
${pad}      }

${pad}      function getMeta(card){
${pad}        try { return JSON.parse(card.getAttribute('data-meta')||'{}')||{}; } catch(e) { return {}; }
${pad}      }

${pad}      function getSortValue(card,key){
${pad}        if(key==='title') return card.getAttribute('data-title')||'';
${pad}        var meta=getMeta(card);
${pad}        return meta && meta[key] ? meta[key] : '';
${pad}      }

${pad}      function buildPagination(total){
${pad}        if(!paginationNav||!paginationItems) return;
${pad}        paginationItems.innerHTML='';
${pad}        if(total<=1){ paginationNav.style.display='none'; return; }
${pad}        paginationNav.style.display='';
${pad}        for(var i=0;i<total;i++){
${pad}          var li=document.createElement('li');
${pad}          li.className=${framework === 'tailwind' ? `'${'inline-flex'}'+(i===currentPage?' active':'')` : `'page-item'+(i===currentPage?' active':'')`};
${pad}          var a=document.createElement('a');
${pad}          a.className=${framework === 'tailwind' ? `'inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-[var(--theme-border)] px-3 text-sm text-[var(--theme-text)] no-underline'` : `'page-link'`};
${pad}          a.href='#';
${pad}          a.setAttribute('data-page-list-target',String(i));
${pad}          a.textContent=String(i+1);
${pad}          li.appendChild(a);
${pad}          paginationItems.appendChild(li);
${pad}        }
${pad}      }

${pad}      function render(){
${pad}        var q=searchInput?String(searchInput.value||'').toLowerCase().trim():'';
${pad}        var visible=allCards.filter(function(card){
${pad}          if(!q) return true;
${pad}          var hay=String(card.getAttribute('data-search')||'').toLowerCase();
${pad}          return hay.indexOf(q)!==-1;
${pad}        });

${pad}        if(sortSelect){
${pad}          var key=String(sortSelect.value||'title');
${pad}          var dir=dirSelect?String(dirSelect.value||'asc'):'asc';
${pad}          visible.sort(function(a,b){
${pad}            var av=coerce(getSortValue(a,key));
${pad}            var bv=coerce(getSortValue(b,key));
${pad}            if(typeof av==='number' && typeof bv==='number') return dir==='desc'?(bv-av):(av-bv);
${pad}            var as=String(av); var bs=String(bv);
${pad}            var cmp=as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' });
${pad}            return dir==='desc'?-cmp:cmp;
${pad}          });
${pad}        }

${pad}        var totalPages=Math.ceil(visible.length/itemsPerPage)||1;
${pad}        if(currentPage>=totalPages) currentPage=0;
${pad}        buildPagination(totalPages);

${pad}        if(!cardsContainer) return;
${pad}        cardsContainer.innerHTML='';
${pad}        var start=currentPage*itemsPerPage;
${pad}        var end=start+itemsPerPage;
${pad}        visible.slice(start,end).forEach(function(card){
${pad}          cardsContainer.appendChild(card);
${pad}        });
${pad}      }

${pad}      if(searchInput){
${pad}        searchInput.addEventListener('input',function(){currentPage=0;render();});
${pad}      }
${pad}      if(sortSelect){
${pad}        sortSelect.addEventListener('change',function(){currentPage=0;render();});
${pad}      }
${pad}      if(dirSelect){
${pad}        dirSelect.addEventListener('change',function(){currentPage=0;render();});
${pad}      }
${pad}      if(paginationNav){
${pad}        paginationNav.addEventListener('click',function(e){
${pad}          var t=e.target.closest('[data-page-list-target]');
${pad}          if(!t) return;
${pad}          e.preventDefault();
${pad}          currentPage=parseInt(t.getAttribute('data-page-list-target')||'0',10)||0;
${pad}          render();
${pad}        });
${pad}      }

${pad}      render();
${pad}    })();
${pad}  <\/script>`

      return `${pad}<div id="${pageListId}"${classAttr}${styleAttr} ${dataAttr}>\n${controlsHtml}${cardsHtml}\n${paginationShell}${script}\n${pad}</div>`
    }

    // Group cards into pages
    const pageGroups: string[][] = []
    for (let i = 0; i < cards.length; i += itemsPerPage) {
      pageGroups.push(cards.slice(i, i + itemsPerPage))
    }

    // Render each page group as a row with data-page attribute
    const groupsHtml = pageGroups.map((group, idx) => {
      const display = idx === 0 ? '' : ' style="display:none"'
      return `${pad}  <div class="${framework === 'tailwind' ? 'flex flex-wrap gap-4' : 'row'}" data-page-list-page="${idx}"${display}>\n${group.map(c => `${pad}    ${c}`).join('\n')}\n${pad}  </div>`
    }).join('\n')

    // Pagination nav
    let paginationHtml = ''
    if (totalPages > 1) {
      const pageItems = Array.from({ length: totalPages }, (_, i) => {
        const activeClass = i === 0 ? ' active' : ''
        return framework === 'tailwind'
          ? `${pad}      <li class="inline-flex${activeClass}"><a class="inline-flex h-10 min-w-10 items-center justify-center rounded-md border border-[var(--theme-border)] px-3 text-sm text-[var(--theme-text)] no-underline" href="#" data-page-list-target="${i}">${i + 1}</a></li>`
          : `${pad}      <li class="page-item${activeClass}"><a class="page-link" href="#" data-page-list-target="${i}">${i + 1}</a></li>`
      }).join('\n')

      paginationHtml = `\n${pad}  <nav aria-label="Page list pagination">\n${pad}    <ul class="${framework === 'tailwind' ? 'mt-4 flex items-center justify-center gap-2' : 'pagination justify-content-center mt-4'}">\n${pageItems}\n${pad}    </ul>\n${pad}  </nav>`
    }

    // Inline script for pagination
    const script = totalPages > 1 ? `\n${pad}  <script>\n${pad}    (function(){\n${pad}      var c=document.getElementById('${pageListId}');\n${pad}      if(!c)return;\n${pad}      c.addEventListener('click',function(e){\n${pad}        var t=e.target.closest('[data-page-list-target]');\n${pad}        if(!t)return;\n${pad}        e.preventDefault();\n${pad}        var p=parseInt(t.getAttribute('data-page-list-target'),10);\n${pad}        c.querySelectorAll('[data-page-list-page]').forEach(function(r){r.style.display=parseInt(r.getAttribute('data-page-list-page'),10)===p?'':'none';});\n${pad}        c.querySelectorAll('.page-item').forEach(function(li,i){li.classList.toggle('active',i===p);});\n${pad}      });\n${pad}    })();\n${pad}  <\/script>` : ''

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
      return `${pad}<div class="${framework === 'tailwind' ? 'mb-4' : 'mb-3'}" ${dataAttr}>
${pad}  <label for="${id}" class="${framework === 'tailwind' ? 'mb-2 block text-sm font-medium text-[var(--theme-text)]' : 'form-label'}">${label}</label>
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
        return `${pad}<div class="${framework === 'tailwind' ? 'mb-4' : 'mb-3'}" ${dataAttr}>
${pad}  ${inner}
${pad}</div>`
      }
      return `${pad}${inner}` // No wrapper if no label and no ID needed? Maybe still want mb-3.
    }
  }

  // Special handling for Icon
  if (block.type === 'icon') {
    const rawIconValue = String(block.props.iconClass ?? '').trim()
    const legacyBootstrapClass = rawIconValue.startsWith('bi-')
      ? rawIconValue
      : block.classes.find((cls) => /^bi-/i.test(cls)) || ''
    const mappedLegacyLucide = mapLegacyBootstrapIcon(legacyBootstrapClass)
    const resolvedLucideName = rawIconValue.startsWith('lucide:')
      ? rawIconValue.replace(/^lucide:/, '')
      : mappedLegacyLucide || ''
    const resolvedGlyph = !resolvedLucideName && isRenderableGlyph(rawIconValue) ? rawIconValue : ''
    const classes = stripLegacyBootstrapIconClasses(block.classes)

    const styles = { ...block.styles }
    if (block.props.size && !styles.fontSize) styles.fontSize = String(block.props.size)
    if (block.props.color && !styles.color) styles.color = String(block.props.color)
    if (!styles.display) styles.display = 'inline-flex'
    if (!styles.alignItems) styles.alignItems = 'center'
    if (!styles.justifyContent) styles.justifyContent = 'center'
    if (!styles.lineHeight) styles.lineHeight = '1'
    if (!styles.minWidth) styles.minWidth = '1em'
    if (!styles.minHeight) styles.minHeight = '1em'

    const styleStr = stylesToString(styles)
    const attrs = [
      classes.length > 0 ? `class="${classes.join(' ')}"` : '',
      styleStr ? `style="${styleStr}"` : '',
      includeDataAttributes ? `data-block-id="${block.id}" data-block-type="${block.type}"` : '',
      includeEditorMetadata ? 'data-amagon-component="icon"' : '',
      includeEditorMetadata ? `data-amagon-icon-class="${escapeAttrValue(rawIconValue)}"` : ''
    ].filter(Boolean).join(' ')

    if (resolvedLucideName) {
      const svgMarkup = renderLucideIconMarkup(resolvedLucideName)
      if (svgMarkup) {
        return `${pad}<span ${attrs}>${svgMarkup}</span>`
      }
    }

    if (resolvedGlyph) {
      return `${pad}<span ${attrs}>${escapeAttrValue(resolvedGlyph)}</span>`
    }

    const placeholderStyles = {
      ...styles,
      minWidth: '2rem',
      minHeight: '2rem',
      border: '2px dashed #dee2e6',
      borderRadius: '0.375rem',
      color: styles.color || '#6c757d'
    }
    const placeholderAttrs = [
      classes.length > 0 ? `class="${classes.join(' ')}"` : '',
      `style="${stylesToString(placeholderStyles)}"`,
      legacyBootstrapClass ? `title="${escapeAttrValue(legacyBootstrapClass)}"` : 'title="No icon selected"',
      includeDataAttributes ? `data-block-id="${block.id}" data-block-type="${block.type}"` : '',
      includeEditorMetadata ? 'data-amagon-component="icon"' : '',
      includeEditorMetadata ? `data-amagon-icon-class="${escapeAttrValue(rawIconValue)}"` : ''
    ].filter(Boolean).join(' ')

    return `${pad}<span ${placeholderAttrs}>☆</span>`
  }

  const tag = resolveTag(block)
  const isVoid = VOID_ELEMENTS.has(tag)
  const isExportMode = !includeDataAttributes
  const textContent = getBlockContent(block, isExportMode, framework, includeEditorMetadata)
  const hasChildren = block.children.length > 0
  const hasContent = textContent.length > 0

  // Build attribute string
  const parts: string[] = []

  // Classes (with legacy navbar class migration for generic path)
  const finalClasses = resolveFrameworkClasses(block, framework, { fullWidthFormControls })

  // Inline styles
  const styleStr = stylesToString(block.styles)

  // Props → attributes
  const attrStr = propsToAttributes(tag, block.type, block.props)

  // Event attributes (e.g. onclick="...")
  let hasEventAttributes = false
  let eventStr = ''
  if (block.events && Object.keys(block.events).length > 0) {
    const eventAttributes = Object.entries(block.events)
      .filter(([, v]) => v && v.trim().length > 0)
      .map(([name, code]) => `${escapeAttrName(name)}="${escapeAttrValue(code)}"`)
    if (eventAttributes.length > 0) {
      hasEventAttributes = true
      eventStr = ' ' + eventAttributes.join(' ')
    }
  }

  // Form-specific attributes for container with isForm
  let formAttrs = ''
  if (block.type === 'container' && block.props.isForm) {
    const action = block.props.action ? String(block.props.action) : ''
    const method = block.props.method ? String(block.props.method) : ''
    if (action) formAttrs += ` action="${escapeAttrValue(action)}"`
    if (method) formAttrs += ` method="${escapeAttrValue(method)}"`
  }

  const shouldUseLayoutNeutralWrapper =
    includeDataAttributes &&
    tag === 'div' &&
    !hasContent &&
    hasChildren &&
    finalClasses.length === 0 &&
    !styleStr &&
    !attrStr &&
    !hasEventAttributes &&
    formAttrs.trim().length === 0

  // data-block-id (editor mode only)
  if (includeDataAttributes) {
    parts.push(`data-block-id="${block.id}"`)
    parts.push(`data-block-type="${block.type}"`)
    if (shouldUseLayoutNeutralWrapper) {
      parts.push('data-editor-layout-neutral="true"')
    }
  }

  if (finalClasses.length > 0) {
    parts.push(`class="${finalClasses.join(' ')}"`)
  }

  if (styleStr) {
    parts.push(`style="${styleStr}"`)
  }

  if (attrStr) {
    parts.push(attrStr)
  }

  const attrString = parts.length > 0 ? ' ' + parts.join(' ') : ''

  const fullAttrString = attrString + formAttrs + eventStr

  // Void element (self-closing)
  if (isVoid) {
    return `${pad}<${tag}${fullAttrString} />`
  }

  if (
    isExportMode &&
    tag === 'div' &&
    !hasContent &&
    hasChildren &&
    fullAttrString.trim().length === 0
  ) {
    return block.children
      .map((child) => renderBlock(child, indent, indentSize, includeDataAttributes, includeEditorMetadata, pages, folders, framework, fullWidthFormControls))
      .join('\n')
  }

  // Simple inline content (no children)
  if (!hasChildren && hasContent && !textContent.includes('\n')) {
    return `${pad}<${tag}${fullAttrString}>${textContent}</${tag}>`
  }

  // Multiline or children
  const lines: string[] = []
  lines.push(`${pad}<${tag}${fullAttrString}>`)

  if (hasContent) {
    const contentLines = textContent.split('\n')
    for (const line of contentLines) {
      lines.push(`${' '.repeat((indent + 1) * indentSize)}${line}`)
    }
  }

  if (hasChildren) {
    for (const child of block.children) {
      lines.push(renderBlock(child, indent + 1, indentSize, includeDataAttributes, includeEditorMetadata, pages, folders, framework, fullWidthFormControls))
    }
  } else if (tag === 'form' && includeDataAttributes) {
    // Empty form indicator for editor mode
    lines.push(`${pad}  <div class="editor-placeholder editor-outline-gated">`)
    lines.push(`${pad}    <div class="text-center p-3">`)
    lines.push(`${pad}      <div style="font-size:1.5rem;margin-bottom:0.1rem;">📝</div>`)
    lines.push(`${pad}      <p class="mb-0" style="font-size:0.8rem;opacity:0.8;">Form — drop elements here</p>`)
    lines.push(`${pad}    </div>`)
    lines.push(`${pad}  </div>`)
  }

  lines.push(`${pad}</${tag}>`)
  return lines.join('\n')
}

// ─── Full page HTML generation ───────────────────────────────────────────────

export interface PageHtmlOptions extends BlockToHtmlOptions {
  title?: string
  pageTitle?: string
  framework?: 'bootstrap-5' | 'tailwind' | 'vanilla'
  meta?: Record<string, string>
  customCss?: string
  pages?: Page[]
  folders?: PageFolder[]
}

export function pageToHtml(blocks: Block[], options: PageHtmlOptions = {}): string {
  const {
    title = 'Untitled Page',
    pageTitle,
    framework = 'bootstrap-5',
    meta = {},
    customCss = '',
    ...blockOptions
  } = options

  const effectiveTitle = pageTitle || title

  const bodyHtml = blockToHtml(blocks, { ...blockOptions, indent: 1, pages: options.pages, folders: options.folders, framework })

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
${metaTags ? metaTags + '\n' : ''}    <title>${escapeAttrValue(effectiveTitle)}</title>
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
