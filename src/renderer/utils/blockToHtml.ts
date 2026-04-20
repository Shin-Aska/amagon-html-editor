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
  'page-list': 'div',
  'table': 'table',
  'dropdown': 'div',
  'offcanvas': 'div',
  'card': 'div',
  'spacer': 'div',
  'stats-section': 'section',
  'team-grid': 'section',
  'gallery': 'section',
  'timeline': 'section',
  'logo-cloud': 'section',
  'process-steps': 'section',
  'newsletter': 'section',
  'comparison-table': 'section',
  'contact-card': 'section',
  'social-links': 'div',
  'cookie-banner': 'div',
  'back-to-top': 'button',
  'countdown': 'div',
  'before-after': 'div',
  'map-embed': 'div'
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
    'id',
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
    'theme',
    // 9 new blocks nonAttribute props:
    'activePage',
    'value',
    'striped',
    'animated',
    'checked',
    'inline',
    'min',
    'max',
    'step',
    'accept',
    'multiple',
    'divider',
    'pages',
    'showPrevNext',
    'showFirstLast',
    'dismissible',
    'icon',
    'pill',
    // Phase 2 medium blocks
    'headers',
    'rows',
    'hover',
    'bordered',
    'responsive',
    'direction',
    'split',
    'placement',
    'backdrop',
    'scroll',
    'subtitle',
    'imageUrl',
    'imagePosition',
    'headerText',
    'footerText',
    'outline',
    // Phase 3 enhancements
    'caption',
    'captionPosition',
    'objectFit',
    'aspectRatio',
    'lazyLoad',
    'lightbox',
    'poster',
    'autoplay',
    'loop',
    'muted',
    'preload',
    'iconLeft',
    'iconRight',
    'block',
    'loading',
    'loadingText',
    'prepend',
    'append',
    'floatingLabel',
    'validationState',
    'validationMessage',
    'helpText',
    'switch',
    'optgroups',
    'showLineNumbers',
    'filename',
    'copyButton',
    'spin',
    'fixedWidth',
    'allowFullscreen',
    'lazy',
    // Phase 4 enhancements
    'anchorId',
    'decorative',
    'dropCap',
    'button',
    'newTab',
    'author',
    'source',
    'listStyle',
    'horizontal',
    'withText',
    'withIcon',
    'thickness',
    'bgColor',
    'bgImage',
    'bgOverlay',
    'section',
    'colSm',
    'colMd',
    'colLg',
    'colXl',
    'offset',
    'order',
    'bgVideo',
    'overlay',
    'overlayColor',
    'overlayOpacity',
    'ctaButtons',
    'fullHeight',
    'sticky',
    'stickyOffset',
    'stickyTop',
    'stickyZIndex',
    'transparent',
    'socialLinks',
    'showSocialLinks',
    'copyrightText',
    'showBackToTop',
    'scrollable',
    'centered',
    'flush',
    'alwaysOpen',
    'vertical',
    'justified',
    'fill',
    'transition',
    'fade',
    'imageHeightMode',
    'imageHeight',
    'thumbnails',
    // Legacy no-op (kept to avoid leaking into exported HTML as an attribute)
    'autoHeight',
    'interval',
    'layout',
    'validated',
    'height',
    'responsiveSm',
    'responsiveMd',
    'responsiveLg',
    'responsiveXl',
    // Phase 5 section widgets
    'members',
    'cardStyle',
    'showSocial',
    'images',
    'gap',
    'lightbox',
    'filterable',
    'orientation',
    'alternating',
    'lineColor',
    'logos',
    'grayscale',
    'steps',
    'connectorStyle',
    // Phase 6 new widgets
    'description',
    'placeholder',
    'buttonText',
    'buttonVariant',
    'showNameField',
    'features',
    'ctaText',
    'ctaHref',
    'highlighted',
    'name',
    'email',
    'phone',
    'address',
    'showMap',
    'links',
    'style',
    'colorful',
    'message',
    'acceptText',
    'declineText',
    'learnMoreUrl',
    'position',
    'targetDate',
    'labels',
    'showDays',
    'showSeconds',
    'expiredMessage',
    'beforeImage',
    'afterImage',
    'beforeLabel',
    'afterLabel',
    'initialPosition',
    'embedUrl',
    'borderRadius'
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

function normalizeVariantToken(value: unknown, fallback = 'primary'): string {
  const raw = String(value ?? fallback).trim()
  if (!raw) return fallback
  return raw.replace(/^btn-/, '')
}

function normalizeObjectFit(value: unknown): 'cover' | 'contain' | 'fill' | 'none' | 'scale-down' {
  const raw = String(value ?? 'cover').trim()
  if (raw === 'contain' || raw === 'fill' || raw === 'none' || raw === 'scale-down') return raw
  return 'cover'
}

function normalizeImageAspectRatio(value: unknown): 'auto' | '1:1' | '4:3' | '16:9' | '21:9' {
  const raw = String(value ?? 'auto').trim()
  if (raw === '1:1' || raw === '4:3' || raw === '16:9' || raw === '21:9') return raw
  return 'auto'
}

function normalizeMediaAspectRatio(value: unknown): '1:1' | '4:3' | '16:9' | '21:9' {
  const raw = String(value ?? '16:9').trim()
  if (raw === '1:1' || raw === '4:3' || raw === '21:9') return raw
  return '16:9'
}

function ratioToCssValue(ratio: 'auto' | '1:1' | '4:3' | '16:9' | '21:9'): string | null {
  if (ratio === 'auto') return null
  const [w, h] = ratio.split(':')
  return w && h ? `${w} / ${h}` : null
}

function ratioToBootstrapClass(ratio: '1:1' | '4:3' | '16:9' | '21:9'): string {
  switch (ratio) {
    case '1:1':
      return 'ratio-1x1'
    case '4:3':
      return 'ratio-4x3'
    case '21:9':
      return 'ratio-21x9'
    case '16:9':
    default:
      return 'ratio-16x9'
  }
}

function ratioToTailwindClass(ratio: '1:1' | '4:3' | '16:9' | '21:9'): string {
  switch (ratio) {
    case '1:1':
      return 'aspect-square'
    case '4:3':
      return 'aspect-[4/3]'
    case '21:9':
      return 'aspect-[21/9]'
    case '16:9':
    default:
      return 'aspect-video'
  }
}

function renderInlineIcon(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  if (raw.startsWith('lucide:')) {
    const svg = renderLucideIconMarkup(raw.replace(/^lucide:/, ''))
    if (svg) return svg
  }

  if (/^bi-/i.test(raw)) {
    const mapped = mapLegacyBootstrapIcon(raw)
    if (mapped) {
      const svg = renderLucideIconMarkup(mapped)
      if (svg) return svg
    }
  }

  if (isRenderableGlyph(raw)) {
    return escapeAttrValue(raw)
  }

  return ''
}

const SOCIAL_PLATFORM_ICON_CLASSES: Record<string, string> = {
  x: 'bi-twitter-x',
  twitter: 'bi-twitter-x',
  facebook: 'bi-facebook',
  instagram: 'bi-instagram',
  linkedin: 'bi-linkedin',
  github: 'bi-github',
  youtube: 'bi-youtube',
  tiktok: 'bi-tiktok',
  discord: 'bi-discord',
  dribbble: 'bi-dribbble',
  behance: 'bi-behance',
  email: 'bi-envelope-fill',
  mail: 'bi-envelope-fill',
  website: 'bi-globe2',
  web: 'bi-globe2',
  link: 'bi-link-45deg'
}

function renderSocialPlatformIcon(platform: unknown): string {
  const key = String(platform ?? '').trim().toLowerCase()
  const iconClass = SOCIAL_PLATFORM_ICON_CLASSES[key] || 'bi-link-45deg'
  return `<i class="bi ${iconClass}" aria-hidden="true"></i>`
}

function normalizeIconSizeToken(value: unknown): 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' {
  const raw = String(value ?? 'md').trim()
  if (raw === 'xs' || raw === 'sm' || raw === 'lg' || raw === 'xl' || raw === '2xl') return raw
  return 'md'
}

// ─── Style serialization ─────────────────────────────────────────────────────

function stylesToString(styles: Record<string, string>): string {
  return Object.entries(styles)
    .filter(([, v]) => v !== '' && v !== undefined)
    .map(([k, v]) => `${camelToKebab(k)}: ${v}`)
    .join('; ')
}

function getEffectiveStyles(block: Block): Record<string, string> {
  const styles = { ...block.styles }

  if (block.type === 'navbar' && block.props.sticky) {
    styles.position = styles.position || 'sticky'
    styles.top = styles.top || String(block.props.stickyOffset ?? block.props.stickyTop ?? '0').trim() || '0'
    styles.zIndex = styles.zIndex || String(block.props.stickyZIndex ?? '1030').trim() || '1030'
  }

  return styles
}

function eventsToAttributes(events?: Record<string, string>): string {
  if (!events) return ''

  const attrs = Object.entries(events)
    .filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
    .map(([name, code]) => `${escapeAttrName(name)}="${escapeAttrValue(code)}"`)

  return attrs.join(' ')
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
    
    case 'alert': return ['p-4', 'mb-4', 'rounded-lg', 'border']
    case 'alert-primary': return ['bg-blue-100', 'text-blue-800', 'border-blue-200']
    case 'alert-secondary': return ['bg-gray-100', 'text-gray-800', 'border-gray-200']
    case 'alert-success': return ['bg-green-100', 'text-green-800', 'border-green-200']
    case 'alert-danger': return ['bg-red-100', 'text-red-800', 'border-red-200']
    case 'alert-warning': return ['bg-yellow-100', 'text-yellow-800', 'border-yellow-200']
    case 'alert-info': return ['bg-cyan-100', 'text-cyan-800', 'border-cyan-200']
    case 'alert-light': return ['bg-gray-50', 'text-gray-600', 'border-gray-100']
    case 'alert-dark': return ['bg-gray-800', 'text-gray-100', 'border-gray-700']
    case 'alert-dismissible': return ['relative', 'pr-10']
    case 'btn-close': return ['absolute', 'top-4', 'right-4', 'text-gray-400', 'hover:text-gray-900', 'bg-transparent', 'border-0']
    
    case 'badge': return ['inline-block', 'py-1', 'px-2', 'text-xs', 'font-bold', 'leading-none', 'text-center', 'whitespace-nowrap', 'align-baseline', 'rounded']
    
    case 'progress': return ['flex', 'overflow-hidden', 'h-4', 'text-xs', 'bg-gray-200', 'rounded-full']
    case 'progress-bar': return ['flex', 'flex-col', 'justify-center', 'text-center', 'text-white', 'bg-blue-600', 'transition-all', 'duration-500']
    case 'progress-bar-striped': return ['bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)]', 'bg-[length:1rem_1rem]']
    case 'progress-bar-animated': return ['animate-[progress-bar-stripes_1s_linear_infinite]']
    
    case 'spinner-border': return ['inline-block', 'w-8', 'h-8', 'align-[-0.125em]', 'border-4', 'border-current', 'border-r-transparent', 'rounded-full', 'animate-spin']
    case 'spinner-grow': return ['inline-block', 'w-8', 'h-8', 'bg-current', 'rounded-full', 'opacity-0', 'animate-pulse']
    case 'spinner-border-sm': return ['w-4', 'h-4', 'border-2']
    case 'spinner-grow-sm': return ['w-4', 'h-4']
    
    case 'form-check': return ['flex', 'items-center', 'mb-2']
    case 'form-check-label': return ['inline-block', 'ml-2', 'text-gray-700']
    case 'form-check-inline': return ['inline-flex', 'mr-4']
    case 'form-label': return ['block', 'mb-2', 'text-sm', 'font-medium', 'text-gray-900']
    
    case 'form-range': return ['w-full', 'h-2', 'bg-gray-200', 'rounded-lg', 'appearance-none', 'cursor-pointer', 'accent-blue-600']
    
    case 'form-control-sm': return ['py-1', 'px-2', 'text-sm', 'rounded']
    case 'form-control-lg': return ['py-2', 'px-4', 'text-lg', 'rounded-lg']
    
    case 'breadcrumb': return ['flex', 'flex-wrap', 'py-2', 'px-4', 'mb-4', 'list-none', 'bg-gray-50', 'rounded-md']
    case 'breadcrumb-item': return ['inline-block', 'mr-2']
    case 'active': return ['text-gray-500']
    
    case 'pagination': return ['flex', 'list-none', 'rounded', 'items-center', 'flex-wrap']
    case 'page-item': return ['relative', 'block']
    case 'page-link': return ['relative', 'block', 'py-1.5', 'px-3', 'bg-white', 'border', 'border-gray-300', 'rounded', 'text-gray-800', 'hover:text-gray-900', 'hover:bg-gray-100']
    case 'pagination-sm': return ['text-sm']
    case 'pagination-lg': return ['text-lg']

    case 'table': return ['w-full', 'border-collapse', 'text-left', 'text-sm']
    case 'table-striped': return ['[&>tbody>tr:nth-child(odd)]:bg-[rgba(0,0,0,0.03)]']
    case 'table-bordered': return ['border', 'border-[var(--theme-border)]', '[&>thead>tr>th]:border', '[&>tbody>tr>td]:border', '[&>thead>tr>th]:border-[var(--theme-border)]', '[&>tbody>tr>td]:border-[var(--theme-border)]']
    case 'table-hover': return ['[&>tbody>tr:hover]:bg-[rgba(0,0,0,0.05)]']
    case 'table-sm': return ['text-xs']
    case 'table-dark': return ['bg-slate-900', 'text-white']
    case 'table-responsive': return ['overflow-x-auto']

    case 'dropdown': return ['relative', 'inline-block', 'text-left']
    case 'dropup': return ['relative', 'inline-block', 'text-left']
    case 'dropstart': return ['relative', 'inline-block', 'text-left']
    case 'dropend': return ['relative', 'inline-block', 'text-left']
    case 'btn-group': return ['inline-flex', 'items-center']
    case 'dropdown-toggle': return ['inline-flex', 'items-center', 'gap-2']
    case 'dropdown-toggle-split': return ['px-3']
    case 'dropdown-menu': return ['absolute', 'z-20', 'mt-2', 'min-w-[12rem]', 'rounded-md', 'border', 'border-[var(--theme-border)]', 'bg-[var(--theme-surface)]', 'p-1', 'shadow-lg']
    case 'dropdown-menu-end': return ['right-0']
    case 'dropdown-menu-dark': return ['bg-slate-900', 'text-white', 'border-slate-700']
    case 'dropdown-item': return ['block', 'w-full', 'rounded-sm', 'px-3', 'py-2', 'text-sm', 'text-[var(--theme-text)]', 'no-underline', 'hover:bg-[rgba(0,0,0,0.06)]']
    case 'dropdown-divider': return ['my-1', 'border-t', 'border-[var(--theme-border)]']

    case 'offcanvas': return ['fixed', 'z-50', 'bg-[var(--theme-surface)]', 'shadow-xl', 'border', 'border-[var(--theme-border)]', 'transition-transform']
    case 'offcanvas-start': return ['left-0', 'top-0', 'h-full', 'w-80']
    case 'offcanvas-end': return ['right-0', 'top-0', 'h-full', 'w-80']
    case 'offcanvas-top': return ['left-0', 'top-0', 'h-64', 'w-full']
    case 'offcanvas-bottom': return ['left-0', 'bottom-0', 'h-64', 'w-full']
    case 'offcanvas-header': return ['flex', 'items-center', 'justify-between', 'border-b', 'border-[var(--theme-border)]', 'px-4', 'py-3']
    case 'offcanvas-title': return ['text-lg', 'font-semibold']
    case 'offcanvas-body': return ['p-4', 'overflow-y-auto']
    case 'stats-section': return ['py-12']
    case 'stats-item': return ['h-full', 'rounded-lg', 'p-6']
    case 'team-grid': return ['py-12']
    case 'team-member-card': return ['h-full', 'rounded-xl', 'border', 'border-[var(--theme-border)]', 'bg-[var(--theme-surface)]', 'p-4', 'shadow-sm']
    case 'gallery': return ['py-12']
    case 'gallery-item': return ['overflow-hidden', 'rounded-lg']
    case 'timeline': return ['py-12']
    case 'timeline-item': return ['relative']
    case 'logo-cloud': return ['py-12']
    case 'logo-item': return ['flex', 'items-center', 'justify-center']
    case 'process-steps': return ['py-12']
    case 'process-step': return ['relative', 'rounded-lg', 'p-4']

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
    case 'card-subtitle':
      return ['text-sm', 'text-[var(--theme-text-muted)]']
    case 'card-text':
      return ['text-[var(--theme-text)]']
    case 'card-img-top':
      return ['w-full', 'rounded-t-xl', 'object-cover']
    case 'card-img-bottom':
      return ['w-full', 'rounded-b-xl', 'object-cover']
    case 'card-img-overlay':
      return ['absolute', 'inset-0', 'p-6']
    case 'text-bg-primary':
      return ['bg-[var(--theme-primary)]', 'text-white']
    case 'text-bg-secondary':
      return ['bg-[var(--theme-secondary)]', 'text-white']
    case 'text-bg-success':
      return ['bg-[var(--theme-success)]', 'text-white']
    case 'text-bg-danger':
      return ['bg-[var(--theme-danger)]', 'text-white']
    case 'text-bg-warning':
      return ['bg-[var(--theme-warning)]', 'text-slate-900']
    case 'text-bg-info':
      return ['bg-sky-500', 'text-white']
    case 'text-bg-light':
      return ['bg-slate-50', 'text-slate-900']
    case 'text-bg-dark':
      return ['bg-slate-900', 'text-white']
    case 'border-primary':
      return ['border-[var(--theme-primary)]']
    case 'border-secondary':
      return ['border-[var(--theme-secondary)]']
    case 'border-success':
      return ['border-[var(--theme-success)]']
    case 'border-danger':
      return ['border-[var(--theme-danger)]']
    case 'border-warning':
      return ['border-[var(--theme-warning)]']
    case 'border-info':
      return ['border-sky-500']
    case 'border-light':
      return ['border-slate-200']
    case 'border-dark':
      return ['border-slate-900']
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
    case 'btn-outline-success':
      return ['border-[var(--theme-success)]', 'text-[var(--theme-success)]', 'bg-transparent', 'hover:bg-[var(--theme-success)]', 'hover:text-white']
    case 'btn-outline-danger':
      return ['border-[var(--theme-danger)]', 'text-[var(--theme-danger)]', 'bg-transparent', 'hover:bg-[var(--theme-danger)]', 'hover:text-white']
    case 'btn-outline-warning':
      return ['border-[var(--theme-warning)]', 'text-[var(--theme-warning)]', 'bg-transparent', 'hover:bg-[var(--theme-warning)]', 'hover:text-slate-900']
    case 'btn-outline-info':
      return ['border-sky-500', 'text-sky-600', 'bg-transparent', 'hover:bg-sky-500', 'hover:text-white']
    case 'btn-outline-light':
      return ['border-slate-200', 'text-slate-200', 'bg-transparent', 'hover:bg-slate-200', 'hover:text-slate-900']
    case 'btn-outline-dark':
      return ['border-slate-900', 'text-slate-900', 'bg-transparent', 'hover:bg-slate-900', 'hover:text-white']
    case 'input-group':
      return ['flex', 'items-stretch', 'w-full']
    case 'input-group-text':
      return ['inline-flex', 'items-center', 'px-3', 'text-sm', 'border', 'border-[var(--theme-border)]', 'bg-[var(--theme-surface)]', 'text-[var(--theme-text-muted)]']
    case 'form-floating':
      return ['relative']
    case 'is-valid':
      return ['border-green-500', 'focus:ring-green-500']
    case 'is-invalid':
      return ['border-red-500', 'focus:ring-red-500']
    case 'valid-feedback':
      return ['mt-1', 'text-sm', 'text-green-600']
    case 'invalid-feedback':
      return ['mt-1', 'text-sm', 'text-red-600']
    case 'form-switch':
      return ['inline-flex', 'items-center', 'gap-2']
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
    case 'ratio':
      return ['relative', 'w-full', 'overflow-hidden']
    case 'ratio-1x1':
      return ['aspect-square']
    case 'ratio-4x3':
      return ['aspect-[4/3]']
    case 'ratio-16x9':
      return ['aspect-video']
    case 'ratio-21x9':
      return ['aspect-[21/9]']
    case 'object-fit-cover':
      return ['object-cover']
    case 'object-fit-contain':
      return ['object-contain']
    case 'object-fit-fill':
      return ['object-fill']
    case 'object-fit-none':
      return ['object-none']
    case 'object-fit-scale-down':
      return ['object-scale-down']
    case 'fa-xs':
      return ['text-xs']
    case 'fa-sm':
      return ['text-sm']
    case 'fa-lg':
      return ['text-lg']
    case 'fa-xl':
      return ['text-xl']
    case 'fa-2xl':
      return ['text-2xl']
    case 'fa-spin':
      return ['animate-spin']
    case 'fa-fw':
      return ['inline-flex', 'w-[1.25em]', 'justify-center']
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

    // Phase 4 additions
    case 'accordion-flush':
      return ['border-0', 'rounded-none']
    case 'modal-sm':
      return ['max-w-sm']
    case 'modal-lg':
      return ['max-w-2xl']
    case 'modal-xl':
      return ['max-w-5xl']
    case 'modal-fullscreen':
      return ['max-w-full', 'h-full', 'rounded-none']
    case 'modal-dialog-scrollable':
      return ['overflow-y-auto']
    case 'modal-dialog-centered':
      return ['items-center']
    case 'nav-pills':
      return ['flex', 'gap-1']
    case 'nav-underline':
      return ['flex', 'border-b', 'border-[var(--theme-border)]']
    case 'nav-fill':
      return ['flex-1']
    case 'nav-justified':
      return ['flex-1', 'text-center']
    case 'carousel-fade':
      return ['transition-opacity', 'duration-500']
    case 'position-sticky':
      return ['sticky']
    case 'z-3':
      return ['z-30']
    case 'navbar-transparent':
      return ['bg-transparent']
    case 'was-validated':
      return ['[&:invalid]:border-red-500', '[&:valid]:border-green-500']
    case 'needs-validation':
      return []
    case 'list-inline':
      return ['flex', 'flex-wrap', 'gap-2', 'list-none', 'p-0']
    case 'list-inline-item':
      return ['inline-block']
    case 'offset-1': return ['ml-[8.333%]']
    case 'offset-2': return ['ml-[16.666%]']
    case 'offset-3': return ['ml-[25%]']
    case 'offset-4': return ['ml-[33.333%]']
    case 'offset-5': return ['ml-[41.666%]']
    case 'offset-6': return ['ml-[50%]']
    case 'offset-7': return ['ml-[58.333%]']
    case 'offset-8': return ['ml-[66.666%]']
    case 'offset-9': return ['ml-[75%]']
    case 'offset-10': return ['ml-[83.333%]']
    case 'offset-11': return ['ml-[91.666%]']

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

  if (block.type === 'column') {
    const bpMap: Array<[string, unknown]> = [
      ['sm', block.props.colSm],
      ['md', block.props.colMd],
      ['lg', block.props.colLg],
      ['xl', block.props.colXl]
    ]
    for (const [bp, val] of bpMap) {
      const n = Number(val)
      if (n && n >= 1 && n <= 12) {
        classes.push(`col-${bp}-${n}`)
      }
    }
    const offset = Number(block.props.offset)
    if (offset && offset >= 1 && offset <= 11) {
      classes.push(`offset-${offset}`)
    }
    const order = Number(block.props.order)
    if (order && order >= 1 && order <= 12) {
      classes.push(`order-${order}`)
    }
  }

  if (block.type === 'button') {
    const rawVariant = typeof block.props.variant === 'string'
      ? String(block.props.variant).trim()
      : ''
    if (rawVariant) {
      const normalizedVariant = rawVariant.startsWith('btn-') ? rawVariant : `btn-${rawVariant}`
      if (block.props.outline && normalizedVariant.startsWith('btn-') && !normalizedVariant.startsWith('btn-outline-')) {
        classes.push(normalizedVariant.replace(/^btn-/, 'btn-outline-'))
      } else {
        classes.push(normalizedVariant)
      }
    }
    if (typeof block.props.size === 'string' && block.props.size.trim()) {
      classes.push(String(block.props.size).trim())
    }
    if (block.props.block) {
      classes.push('d-block', 'w-100')
    }
  }

  if (block.type === 'image') {
    const objectFit = String(block.props.objectFit ?? '').trim()
    if (objectFit) {
      classes.push(`object-fit-${objectFit}`)
    }
    const ratio = String(block.props.aspectRatio ?? '').trim()
    if (ratio && ratio !== 'auto') {
      if (ratio === '1:1') classes.push('ratio-1x1')
      else if (ratio === '4:3') classes.push('ratio-4x3')
      else if (ratio === '16:9') classes.push('ratio-16x9')
      else if (ratio === '21:9') classes.push('ratio-21x9')
    }
  }

  if (block.type === 'video' || block.type === 'iframe') {
    const ratio = String(block.props.aspectRatio ?? '').trim()
    if (ratio && ratio !== 'auto') {
      classes.push('ratio')
      if (ratio === '1:1') classes.push('ratio-1x1')
      else if (ratio === '4:3') classes.push('ratio-4x3')
      else if (ratio === '16:9') classes.push('ratio-16x9')
      else if (ratio === '21:9') classes.push('ratio-21x9')
    }
  }

  if (block.type === 'icon') {
    const rawSize = String(block.props.size ?? '').trim()
    if (rawSize) {
      const size = normalizeIconSizeToken(rawSize)
      if (size !== 'md') {
        classes.push(`fa-${size}`)
      }
    }
    if (block.props.spin) {
      classes.push('fa-spin')
    }
    if (block.props.fixedWidth) {
      classes.push('fa-fw')
    }
  }

  if (block.type === 'navbar' && typeof block.props.theme === 'string' && block.props.theme.trim()) {
    classes.push(String(block.props.theme).trim())
  }

  if (block.type === 'navbar' && block.props.sticky) {
    classes.push('position-sticky', 'top-0', 'z-3')
  }

  if (block.type === 'navbar' && block.props.transparent) {
    classes.push('navbar-transparent')
  }

  if (block.type === 'paragraph' && block.props.dropCap) {
    classes.push('amagon-drop-cap')
  }

  if (block.type === 'paragraph') {
    const cols = String(block.props.columns ?? '1').trim()
    if (cols === '2') classes.push('amagon-columns-2')
    else if (cols === '3') classes.push('amagon-columns-3')
  }

  if (block.type === 'list' && block.props.horizontal) {
    classes.push('list-inline')
  }

  if (block.type === 'accordion' && block.props.flush) {
    classes.push('accordion-flush')
  }

  if (block.type === 'blockquote') {
    const dec = String(block.props.decorative ?? 'none').trim()
    if (dec === 'border-left') classes.push('amagon-bq-border-left')
    else if (dec === 'large-quote') classes.push('amagon-bq-large-quote')
  }

  if (block.type === 'carousel' && normalizeCarouselTransition(block.props.transition, block.props.fade) === 'fade') {
    classes.push('carousel-fade')
  }

  if (block.type === 'form') {
    const layout = String(block.props.layout ?? 'vertical').trim()
    if (layout === 'horizontal') classes.push('row')
    else if (layout === 'inline') classes.push('row', 'row-cols-lg-auto', 'g-3', 'align-items-center')
    if (block.props.validated) classes.push('was-validated')
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

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.map((item) => String(item ?? '').trim())
}

function normalizeTableRows(input: unknown): string[][] {
  if (!Array.isArray(input)) return []
  return input.map((row) => {
    if (Array.isArray(row)) {
      return row.map((cell) => String(cell ?? '').trim())
    }
    return [String(row ?? '').trim()]
  })
}

interface StatsItemShape {
  value: string
  label: string
  prefix: string
  suffix: string
  icon: string
}

function normalizeStatsItems(input: unknown): StatsItemShape[] {
  if (!Array.isArray(input)) return []
  return input.map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>
      return {
        value: String(record.value ?? '').trim(),
        label: String(record.label ?? '').trim(),
        prefix: String(record.prefix ?? '').trim(),
        suffix: String(record.suffix ?? '').trim(),
        icon: String(record.icon ?? '').trim()
      }
    }
    return { value: String(item ?? '').trim(), label: '', prefix: '', suffix: '', icon: '' }
  })
}

interface TeamMemberShape {
  name: string
  role: string
  imageUrl: string
  bio: string
  socialLinks: Record<string, string>
}

function normalizeTeamMembers(input: unknown): TeamMemberShape[] {
  if (!Array.isArray(input)) return []
  return input.map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>
      const socialRaw = record.socialLinks
      const socialLinks: Record<string, string> = {}
      if (socialRaw && typeof socialRaw === 'object' && !Array.isArray(socialRaw)) {
        for (const [key, value] of Object.entries(socialRaw as Record<string, unknown>)) {
          const normalized = String(value ?? '').trim()
          if (normalized) socialLinks[key] = normalized
        }
      }
      return {
        name: String(record.name ?? '').trim(),
        role: String(record.role ?? '').trim(),
        imageUrl: String(record.imageUrl ?? IMAGE_PLACEHOLDER).trim() || IMAGE_PLACEHOLDER,
        bio: String(record.bio ?? '').trim(),
        socialLinks
      }
    }
    return { name: String(item ?? '').trim(), role: '', imageUrl: IMAGE_PLACEHOLDER, bio: '', socialLinks: {} }
  })
}

interface GalleryImageShape {
  url: string
  caption: string
  category: string
}

function normalizeGalleryImages(input: unknown): GalleryImageShape[] {
  if (!Array.isArray(input)) return []
  return input.map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>
      return {
        url: String(record.url ?? IMAGE_PLACEHOLDER).trim() || IMAGE_PLACEHOLDER,
        caption: String(record.caption ?? '').trim(),
        category: String(record.category ?? '').trim()
      }
    }
    return { url: IMAGE_PLACEHOLDER, caption: String(item ?? '').trim(), category: '' }
  })
}

interface TimelineItemShape {
  date: string
  title: string
  description: string
  icon: string
  variant: string
}

function normalizeTimelineItems(input: unknown): TimelineItemShape[] {
  if (!Array.isArray(input)) return []
  return input.map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>
      return {
        date: String(record.date ?? '').trim(),
        title: String(record.title ?? '').trim(),
        description: String(record.description ?? '').trim(),
        icon: String(record.icon ?? '').trim(),
        variant: String(record.variant ?? 'primary').trim() || 'primary'
      }
    }
    return { date: '', title: String(item ?? '').trim(), description: '', icon: '', variant: 'primary' }
  })
}

interface LogoShape {
  imageUrl: string
  altText: string
  href: string
}

function normalizeLogos(input: unknown): LogoShape[] {
  if (!Array.isArray(input)) return []
  return input.map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>
      return {
        imageUrl: String(record.imageUrl ?? IMAGE_PLACEHOLDER).trim() || IMAGE_PLACEHOLDER,
        altText: String(record.altText ?? '').trim(),
        href: String(record.href ?? '').trim()
      }
    }
    return { imageUrl: IMAGE_PLACEHOLDER, altText: String(item ?? '').trim(), href: '' }
  })
}

interface ProcessStepShape {
  number: string
  title: string
  description: string
  icon: string
}

function normalizeProcessSteps(input: unknown): ProcessStepShape[] {
  if (!Array.isArray(input)) return []
  return input.map((item, index) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>
      return {
        number: String(record.number ?? index + 1).trim() || String(index + 1),
        title: String(record.title ?? '').trim(),
        description: String(record.description ?? '').trim(),
        icon: String(record.icon ?? '').trim()
      }
    }
    return { number: String(index + 1), title: String(item ?? '').trim(), description: '', icon: '' }
  })
}

interface DropdownItemShape {
  label: string
  href: string
  divider: boolean
  disabled: boolean
}

function normalizeDropdownItems(input: unknown): DropdownItemShape[] {
  if (!Array.isArray(input)) return []
  return input.map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>
      return {
        label: String(record.label ?? '').trim(),
        href: String(record.href ?? '#').trim() || '#',
        divider: Boolean(record.divider),
        disabled: Boolean(record.disabled)
      }
    }
    return {
      label: String(item ?? '').trim(),
      href: '#',
      divider: false,
      disabled: false
    }
  })
}

interface SelectOptionShape {
  label: string
  value: string
}

interface SelectGroupShape {
  group: string
  options: SelectOptionShape[]
}

function normalizeFlatSelectOptions(input: unknown): SelectOptionShape[] {
  if (!Array.isArray(input)) return []

  return input.map((item) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const record = item as Record<string, unknown>
      const label = String(record.label ?? record.value ?? '').trim()
      const value = String(record.value ?? record.label ?? '').trim()
      return {
        label: label || value,
        value: value || label
      }
    }

    const text = String(item ?? '').trim()
    return { label: text, value: text }
  }).filter((item) => item.label || item.value)
}

function normalizeSelectGroups(input: unknown): SelectGroupShape[] {
  if (!Array.isArray(input)) return []

  return input
    .map((groupItem) => {
      if (!groupItem || typeof groupItem !== 'object' || Array.isArray(groupItem)) return null
      const record = groupItem as Record<string, unknown>
      const group = String(record.group ?? '').trim()
      const options = normalizeFlatSelectOptions(record.options)
      if (!group && options.length === 0) return null
      return {
        group: group || 'Group',
        options: options.length > 0 ? options : [{ label: 'Option', value: 'Option' }]
      }
    })
    .filter((item): item is SelectGroupShape => item !== null)
}

function normalizeDropdownDirection(input: unknown): 'down' | 'up' | 'start' | 'end' {
  const value = String(input ?? 'down').trim()
  if (value === 'up' || value === 'start' || value === 'end') return value
  return 'down'
}

function normalizeSize(input: unknown): 'sm' | 'default' | 'lg' {
  const value = String(input ?? 'default').trim()
  if (value === 'sm' || value === 'lg') return value
  return 'default'
}

function normalizePlacement(input: unknown): 'start' | 'end' | 'top' | 'bottom' {
  const value = String(input ?? 'start').trim()
  if (value === 'end' || value === 'top' || value === 'bottom') return value
  return 'start'
}

function toBoolean(input: unknown, fallback = false): boolean {
  if (typeof input === 'boolean') return input
  if (typeof input === 'string') {
    const normalized = input.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return fallback
}

function normalizeCarouselTransition(transition: unknown, legacyFade: unknown): 'slide' | 'fade' {
  const raw = String(transition ?? '').trim().toLowerCase()
  if (raw === 'fade') return 'fade'
  if (raw === 'slide') return 'slide'
  return toBoolean(legacyFade, false) ? 'fade' : 'slide'
}

function normalizeCarouselImageHeightMode(mode: unknown): 'auto' | 'fixed' | 'follow-first' {
  const raw = String(mode ?? '').trim().toLowerCase()
  if (raw === 'fixed') return 'fixed'
  if (raw === 'follow-first' || raw === 'followfirst' || raw === 'follow_first') return 'follow-first'
  return 'auto'
}

function normalizeCarouselImageHeight(height: unknown): string {
  return String(height ?? '').trim()
}

function normalizeCardVariant(input: unknown): 'default' | 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark' {
  const value = String(input ?? 'default').trim()
  if (value === 'primary' || value === 'secondary' || value === 'success' || value === 'danger' || value === 'warning' || value === 'info' || value === 'light' || value === 'dark') {
    return value
  }
  return 'default'
}

function getTailwindButtonVariant(variant: string): string {
  switch (variant) {
    case 'secondary':
      return 'border-[var(--theme-secondary)] bg-[var(--theme-secondary)] text-white'
    case 'success':
      return 'border-[var(--theme-success)] bg-[var(--theme-success)] text-white'
    case 'danger':
      return 'border-[var(--theme-danger)] bg-[var(--theme-danger)] text-white'
    case 'warning':
      return 'border-[var(--theme-warning)] bg-[var(--theme-warning)] text-slate-900'
    case 'info':
      return 'border-sky-500 bg-sky-500 text-white'
    case 'light':
      return 'border-slate-200 bg-slate-50 text-slate-900'
    case 'dark':
      return 'border-slate-900 bg-slate-900 text-white'
    case 'primary':
    default:
      return 'border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white'
  }
}

function highlightCodeSnippet(code: string, language: string): string {
  if (!code) return ''

  try {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value
    }
    return hljs.highlightAuto(code).value
  } catch (error) {
    console.warn('Failed to highlight code block string', error)
    return escapeAttrValue(code)
  }
}

function getCardVariantBootstrapClasses(variant: ReturnType<typeof normalizeCardVariant>, outline: boolean): string[] {
  if (variant === 'default') return []
  if (outline) {
    return [`border-${variant}`]
  }
  return [`text-bg-${variant}`]
}

function getCardVariantTailwindClasses(variant: ReturnType<typeof normalizeCardVariant>, outline: boolean): string[] {
  if (variant === 'default') return []

  if (outline) {
    const borderClass = mapBootstrapClassToTailwind(`border-${variant}`)
    return ['bg-[var(--theme-surface)]', ...borderClass]
  }

  return mapBootstrapClassToTailwind(`text-bg-${variant}`)
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
      return escapeAttrValue(String(props.text ?? ''))

    case 'link': {
      // Link content handled by special renderBlock path, but fallthrough for generic case
      return escapeAttrValue(String(props.text ?? ''))
    }

    case 'blockquote': {
      const text = escapeAttrValue(String(props.text ?? ''))
      // Use author/source if set, else fall back to legacy footer prop
      const authorStr = String(props.author ?? '').trim()
      const sourceStr = String(props.source ?? '').trim()
      const legacyFooter = String(props.footer ?? '').trim()
      const footerContent = authorStr
        ? (sourceStr ? `${escapeAttrValue(authorStr)}, <cite>${escapeAttrValue(sourceStr)}</cite>` : escapeAttrValue(authorStr))
        : (sourceStr ? escapeAttrValue(sourceStr) : (legacyFooter ? escapeAttrValue(legacyFooter) : ''))
      const footer = footerContent ? `<footer class="blockquote-footer mt-2">${footerContent}</footer>` : ''
      return `${text}${footer}`
    }

    case 'list': {
      const items = (props.items as string[]) ?? []
      const horizontal = Boolean(props.horizontal)
      if (horizontal) {
        return items.map((item) => `<li class="list-inline-item">${escapeAttrValue(item)}</li>`).join('\n')
      }
      const listStyle = String(props.listStyle ?? 'disc').trim()
      const liStyle = listStyle !== 'disc' && listStyle !== 'none' ? ` style="list-style-type: ${escapeAttrValue(listStyle)};"` : ''
      const noStyle = listStyle === 'none' ? ' class="list-unstyled"' : ''
      if (noStyle) {
        return items.map((item) => `<li${noStyle}>${escapeAttrValue(item)}</li>`).join('\n')
      }
      return items.map((item) => `<li${liStyle}>${escapeAttrValue(item)}</li>`).join('\n')
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
      const transition = normalizeCarouselTransition(props.transition, props.fade)
      const imageHeightMode = normalizeCarouselImageHeightMode(props.imageHeightMode)
      const imageHeight = normalizeCarouselImageHeight(props.imageHeight) || '400px'
      const thumbnails = toBoolean(props.thumbnails, false)
      const interval = Number(props.interval) || 5000

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
        const followFirstOnLoad = "(function(img){var root=img.closest('[data-tw-carousel], .carousel');if(!root)return;var w=img.naturalWidth||0;var h=img.naturalHeight||0;if(!w||!h)return;var width=img.getBoundingClientRect().width||0;if(!width)return;var px=Math.round(width*h/w);root.style.setProperty('--amagon-carousel-image-height',px+'px');})(this)"
        const imgStyleAttr = imageHeightMode === 'fixed'
          ? ` style="height: ${escapeAttrValue(imageHeight)}; object-fit: cover;"`
          : imageHeightMode === 'follow-first'
            ? ` style="height: var(--amagon-carousel-image-height, auto); object-fit: cover;"`
            : ''
        const hiddenSlideClasses = transition === 'fade'
          ? 'absolute inset-0 opacity-0 pointer-events-none'
          : 'absolute inset-0 opacity-0 pointer-events-none translate-x-4 scale-95'
        const activeSlideClasses = transition === 'fade'
          ? 'relative opacity-100 pointer-events-auto'
          : 'relative opacity-100 pointer-events-auto translate-x-0 scale-100'
        const transitionClasses = transition === 'fade'
          ? 'transition-opacity duration-700 ease-in-out'
          : 'transition-all duration-500 ease-out'
        const items = slides.map((slide, i) => `
        <div class="${i === 0 ? activeSlideClasses : hiddenSlideClasses} ${transitionClasses}" data-tw-carousel-slide="${i}" data-tw-active="${i === 0 ? 'true' : 'false'}" aria-hidden="${i === 0 ? 'false' : 'true'}">
          <img src="${escapeAttrValue(slide.src)}" class="block w-full rounded-xl" alt="${escapeAttrValue(slide.alt)}"${imgStyleAttr}${imageHeightMode === 'follow-first' && i === 0 ? ` onload="${followFirstOnLoad}"` : ''}>
          ${slide.caption ? `<div class="mt-3 text-center text-sm text-[var(--theme-text-muted)]">${escapeAttrValue(slide.caption)}</div>` : ''}
        </div>`).join('\n')

        const controlsScript = "var root=this.closest('[data-tw-carousel]');if(!root)return;var slides=Array.prototype.slice.call(root.querySelectorAll('[data-tw-carousel-slide]'));if(slides.length<2)return;var mode=root.getAttribute('data-tw-carousel-transition')==='fade'?'fade':'slide';var active=slides.findIndex(function(slide){return slide.getAttribute('data-tw-active')==='true';});if(active<0)active=0;var dir=Number(this.getAttribute('data-tw-dir')||'1');var next=(active+dir+slides.length)%slides.length;slides.forEach(function(slide,index){slide.setAttribute('data-tw-active',index===next?'true':'false');slide.setAttribute('aria-hidden',index===next?'false':'true');if(index===next){slide.classList.remove('absolute','inset-0','opacity-0','pointer-events-none','translate-x-4','scale-95');slide.classList.add('relative','opacity-100','pointer-events-auto','translate-x-0','scale-100');}else{slide.classList.remove('relative','opacity-100','pointer-events-auto','translate-x-0','scale-100');slide.classList.add('absolute','inset-0','opacity-0','pointer-events-none');if(mode==='slide'){slide.classList.add('translate-x-4','scale-95');}}});"
        const controls = slides.length > 1
          ? `
        <div class="mt-4 flex items-center justify-between gap-4">
          <button type="button" data-tw-dir="-1" class="inline-flex items-center justify-center rounded-md border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-text)]" onclick="(function(){${controlsScript}}).call(this)">Previous</button>
          <button type="button" data-tw-dir="1" class="inline-flex items-center justify-center rounded-md border border-[var(--theme-border)] px-4 py-2 text-sm font-medium text-[var(--theme-text)]" onclick="(function(){${controlsScript}}).call(this)">Next</button>
        </div>`
          : ''

        return `<div data-tw-carousel="${id}" data-tw-carousel-transition="${transition}"><div class="relative overflow-hidden">${items}</div>${controls}</div>`
      }

      const indicators = slides.map((_, i) =>
        `<button type="button" data-bs-target="#${id}" data-bs-slide-to="${i}" class="${i === 0 ? 'active' : ''}" aria-current="${i === 0 ? 'true' : 'false'}" aria-label="Slide ${i + 1}"></button>`
      ).join('\n')

      const followFirstOnLoad = "(function(img){var root=img.closest('[data-tw-carousel], .carousel');if(!root)return;var w=img.naturalWidth||0;var h=img.naturalHeight||0;if(!w||!h)return;var width=img.getBoundingClientRect().width||0;if(!width)return;var px=Math.round(width*h/w);root.style.setProperty('--amagon-carousel-image-height',px+'px');})(this)"
      const imgStyleAttr = imageHeightMode === 'fixed'
        ? ` style="height: ${escapeAttrValue(imageHeight)}; object-fit: cover;"`
        : imageHeightMode === 'follow-first'
          ? ` style="height: var(--amagon-carousel-image-height, auto); object-fit: cover;"`
          : ''

      const items = slides.map((slide, i) => `
        <div class="carousel-item ${i === 0 ? 'active' : ''}" data-bs-interval="${interval}">
          <img src="${escapeAttrValue(slide.src)}" class="d-block w-100" alt="${escapeAttrValue(slide.alt)}"${imgStyleAttr}${imageHeightMode === 'follow-first' && i === 0 ? ` onload="${followFirstOnLoad}"` : ''}>
          ${slide.caption ? `<div class="carousel-caption d-none d-md-block"><h5>${escapeAttrValue(slide.caption)}</h5></div>` : ''}
        </div>`).join('\n')

      const thumbsHtml = thumbnails && slides.length > 0
        ? `
        <div class="d-flex gap-2 mt-2 overflow-auto justify-content-center">
          ${slides.map((slide, i) => `<button type="button" class="p-0 border-0 bg-transparent${i === 0 ? ' opacity-100' : ' opacity-50'}" data-bs-target="#${id}" data-bs-slide-to="${i}" aria-label="Slide ${i + 1}" style="width:60px;height:40px;overflow:hidden;cursor:pointer;"><img src="${escapeAttrValue(slide.src)}" alt="${escapeAttrValue(slide.alt)}" style="width:100%;height:100%;object-fit:cover;"></button>`).join('\n          ')}
        </div>`
        : ''

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
        </button>${thumbsHtml}`
    }

    case 'accordion': {
      const id = String(props.id || 'accordion-' + Math.random().toString(36).substr(2, 9))
      const items = (props.items as Array<{ title: string; content: string }>) ?? []
      const flush = toBoolean(props.flush, false)
      const alwaysOpen = toBoolean(props.alwaysOpen, false)

      if (framework === 'tailwind') {
        const borderClass = flush ? 'border-0 rounded-none divide-y divide-[var(--theme-border)]' : 'divide-y divide-[var(--theme-border)] rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)]'
        return `<div class="${borderClass}">${
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
        const parentAttr = alwaysOpen ? '' : ` data-bs-parent="#${id}"`

        return `
        <div class="accordion-item">
          <h2 class="accordion-header" id="${itemId}">
            <button class="accordion-button ${collapsedClass}" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="${isExpanded}" aria-controls="${collapseId}">
              ${escapeAttrValue(item.title)}
            </button>
          </h2>
          <div id="${collapseId}" class="accordion-collapse collapse ${showClass}" aria-labelledby="${itemId}"${parentAttr}>
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
      const tabVariant = String(props.variant ?? 'tabs').trim()
      const vertical = toBoolean(props.vertical, false)
      const justified = toBoolean(props.justified, false)
      const fill = toBoolean(props.fill, false)

      if (framework === 'tailwind') {
        const navItems = tabs.map((tab, i) => `
        <button class="${i === defaultTab ? 'bg-[var(--theme-primary)] text-white' : 'border border-[var(--theme-border)] text-[var(--theme-text)]'} rounded-md px-4 py-2 text-sm font-medium" type="button" data-tw-tab-button="${id}" data-tw-tab-target="${id}-content-${i}" onclick="(function(){var root=this.closest('[data-tw-tabs]');if(!root)return;root.querySelectorAll('[data-tw-tab-button=\\"${id}\\"]').forEach(function(btn){btn.className='border border-[var(--theme-border)] text-[var(--theme-text)] rounded-md px-4 py-2 text-sm font-medium';});root.querySelectorAll('[data-tw-tab-panel]').forEach(function(panel){panel.classList.add('hidden');});this.className='bg-[var(--theme-primary)] text-white rounded-md px-4 py-2 text-sm font-medium';var panel=root.querySelector('#${id}-content-${i}');if(panel)panel.classList.remove('hidden');}).call(this)">${escapeAttrValue(tab.label)}</button>`).join('\n')

        const contentItems = tabs.map((tab, i) => `
        <div class="${i === defaultTab ? '' : 'hidden ' }rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 text-[var(--theme-text)]" id="${id}-content-${i}" data-tw-tab-panel>
          ${tab.blocks && tab.blocks.length > 0 ? blockToHtml(tab.blocks, { framework, includeDataAttributes: !isExportMode, includeEditorMetadata }) : escapeAttrValue(tab.content)}
        </div>`).join('\n')

        const navFlexClass = vertical ? 'flex-col' : 'flex-row flex-wrap'
        const wrapperClass = vertical ? 'flex gap-4' : ''

        return `
        <div data-tw-tabs="${id}"${tabVariant !== 'tabs' ? ` data-tw-tabs-variant="${tabVariant}"` : ''}>
          ${wrapperClass ? `<div class="${wrapperClass}">` : ''}
          <div class="mb-4 flex ${navFlexClass} gap-2">
            ${navItems}
          </div>
          <div class="${vertical ? 'flex-1 ' : ''}space-y-3">
            ${contentItems}
          </div>
          ${wrapperClass ? '</div>' : ''}
        </div>`
      }

      // Bootstrap nav class
      const navClass = tabVariant === 'pills' ? 'nav-pills' : tabVariant === 'underline' ? 'nav-underline' : 'nav-tabs'
      const extraNavClasses = [
        vertical ? 'flex-column' : '',
        justified ? 'nav-justified' : '',
        fill ? 'nav-fill' : ''
      ].filter(Boolean).join(' ')

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

      if (vertical) {
        return `
        <div class="d-flex">
          <ul class="nav ${navClass}${extraNavClasses ? ' ' + extraNavClasses : ''}" id="${id}" role="tablist">
            ${navItems}
          </ul>
          <div class="tab-content flex-grow-1 ps-3" id="${id}Content">
            ${contentItems}
          </div>
        </div>`
      }

      return `
        <ul class="nav ${navClass}${extraNavClasses ? ' ' + extraNavClasses : ''}" id="${id}" role="tablist">
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

    case 'badge':
      return escapeAttrValue(String(props.text ?? 'New'))

    case 'alert': {
      const alertText = escapeAttrValue(String(props.text ?? ''))
      const dismissible = toBoolean(props.dismissible, false)
      if (framework === 'tailwind') {
        const dismissHtml = dismissible
          ? `\n<button type="button" class="absolute top-4 right-4 text-gray-400 hover:text-gray-900 bg-transparent border-0 text-xl leading-none" aria-label="Close">×</button>`
          : ''
        return `${alertText}${dismissHtml}`
      }
      const dismissHtml = dismissible
        ? `\n<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>`
        : ''
      return `${alertText}${dismissHtml}`
    }

    case 'spinner':
      return framework === 'tailwind'
        ? `<span class="sr-only">Loading...</span>`
        : `<span class="visually-hidden">Loading...</span>`

    case 'progress': {
      const progressValue = Math.min(100, Math.max(0, Number(props.value ?? 50)))
      const progressVariant = String(props.variant ?? 'bg-primary').trim()
      const striped = toBoolean(props.striped, false)
      const animated = toBoolean(props.animated, false)
      const progressLabel = escapeAttrValue(String(props.label ?? ''))
      if (framework === 'tailwind') {
        const twVariant = mapBootstrapClassToTailwind(progressVariant).join(' ')
        return `<div class="${twVariant} h-full transition-all duration-500 ease-in-out flex items-center justify-center text-xs text-white" style="width: ${progressValue}%" role="progressbar" aria-valuenow="${progressValue}" aria-valuemin="0" aria-valuemax="100">${progressLabel}</div>`
      }
      const barClasses = ['progress-bar', progressVariant, striped && 'progress-bar-striped', animated && 'progress-bar-animated'].filter(Boolean).join(' ')
      return `<div class="${barClasses}" role="progressbar" style="width: ${progressValue}%" aria-valuenow="${progressValue}" aria-valuemin="0" aria-valuemax="100">${progressLabel}</div>`
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

  // Container with section=true renders as <section>
  if (block.type === 'container' && block.props.section) {
    return 'section'
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
  const eventAttr = eventsToAttributes(block.events)
  // Computed once here so all block-specific handlers can reference it directly
  const finalClasses = resolveFrameworkClasses(block, framework, { fullWidthFormControls })

  if (block.type === 'image') {
    const src = String(block.props.src ?? IMAGE_PLACEHOLDER).trim() || IMAGE_PLACEHOLDER
    const alt = String(block.props.alt ?? 'Image').trim() || 'Image'
    const caption = String(block.props.caption ?? '').trim()
    const captionPosition = String(block.props.captionPosition ?? 'below').trim() === 'overlay-bottom' ? 'overlay-bottom' : 'below'
    const objectFit = normalizeObjectFit(block.props.objectFit)
    const aspectRatio = normalizeImageAspectRatio(block.props.aspectRatio)
    const lazyLoad = toBoolean(block.props.lazyLoad, true)
    const lightbox = toBoolean(block.props.lightbox, false)
    const classes = resolveFrameworkClasses(block, framework, { fullWidthFormControls })
      .filter((cls) => !/^ratio(?:-|$)/.test(cls) && !/^object-fit-/.test(cls))
    const styles = { ...block.styles }
    const twObjectFitClass = `object-${objectFit === 'scale-down' ? 'scale-down' : objectFit}`
    const aspectStyleValue = ratioToCssValue(aspectRatio)
    if (framework !== 'tailwind') {
      if (!styles.objectFit) styles.objectFit = objectFit
      if (aspectStyleValue && !styles.aspectRatio) styles.aspectRatio = aspectStyleValue
    }

    const imgClasses = framework === 'tailwind'
      ? dedupeClasses([
        ...classes,
        twObjectFitClass,
        aspectRatio !== 'auto' ? ratioToTailwindClass(aspectRatio) : ''
      ]).join(' ')
      : dedupeClasses(classes).join(' ')
    const styleStr = stylesToString(styles)
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    const loadingAttr = lazyLoad ? ' loading="lazy"' : ''
    const imageMarkup = `<img class="${imgClasses}" src="${escapeAttrValue(src)}" alt="${escapeAttrValue(alt)}"${styleAttr}${loadingAttr}${eventAttr ? ` ${eventAttr}` : ''} />`
    const mediaMarkup = lightbox
      ? `<a href="${escapeAttrValue(src)}" class="${framework === 'tailwind' ? 'inline-block' : 'd-inline-block'}" data-amagon-lightbox="true">${imageMarkup}</a>`
      : imageMarkup
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="image"` : ''

    if (caption) {
      if (captionPosition === 'overlay-bottom') {
        const figureClass = framework === 'tailwind'
          ? 'relative overflow-hidden'
          : 'position-relative d-inline-block'
        const captionClass = framework === 'tailwind'
          ? 'absolute inset-x-0 bottom-0 bg-black/60 px-3 py-2 text-sm text-white'
          : 'position-absolute bottom-0 start-0 end-0 px-3 py-2 text-white'
        return `${pad}<figure class="${figureClass}"${dataAttr}>
${pad}  ${mediaMarkup}
${pad}  <figcaption class="${captionClass}">${escapeAttrValue(caption)}</figcaption>
${pad}</figure>`
      }

      const figureClass = framework === 'tailwind'
        ? 'space-y-2'
        : 'mb-0'
      const captionClass = framework === 'tailwind'
        ? 'text-sm text-[var(--theme-text-muted)]'
        : 'figure-caption'
      return `${pad}<figure class="${figureClass}"${dataAttr}>
${pad}  ${mediaMarkup}
${pad}  <figcaption class="${captionClass}">${escapeAttrValue(caption)}</figcaption>
${pad}</figure>`
    }

    if (lightbox) {
      return `${pad}<a href="${escapeAttrValue(src)}" class="${framework === 'tailwind' ? 'inline-block' : 'd-inline-block'}"${dataAttr}>
${pad}  ${imageMarkup}
${pad}</a>`
    }

    return `${pad}<img class="${imgClasses}" src="${escapeAttrValue(src)}" alt="${escapeAttrValue(alt)}"${styleAttr}${loadingAttr}${eventAttr ? ` ${eventAttr}` : ''}${dataAttr} />`
  }

  if (block.type === 'video') {
    const src = String(block.props.src ?? '').trim()
    const controls = toBoolean(block.props.controls, true)
    const autoplay = toBoolean(block.props.autoplay, false)
    const loop = toBoolean(block.props.loop, false)
    const muted = toBoolean(block.props.muted, false)
    const preload = String(block.props.preload ?? 'metadata').trim()
    const poster = String(block.props.poster ?? '').trim()
    const aspectRatio = normalizeMediaAspectRatio(block.props.aspectRatio)
    const wrapperClasses = framework === 'tailwind'
      ? dedupeClasses(['w-full', ratioToTailwindClass(aspectRatio)]).join(' ')
      : dedupeClasses(['ratio', ratioToBootstrapClass(aspectRatio)]).join(' ')
    const videoClasses = framework === 'tailwind'
      ? dedupeClasses(['h-full', 'w-full', 'object-cover', ...resolveFrameworkClasses(block, framework, { fullWidthFormControls })]).join(' ')
      : dedupeClasses(['w-100', 'h-100', ...block.classes]).join(' ')
    const styleStr = stylesToString(getEffectiveStyles(block))
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="video"` : ''
    const attrs = [
      controls ? 'controls' : '',
      autoplay ? 'autoplay' : '',
      loop ? 'loop' : '',
      muted ? 'muted' : '',
      preload ? `preload="${escapeAttrValue(preload)}"` : '',
      poster ? `poster="${escapeAttrValue(poster)}"` : '',
      eventAttr
    ].filter(Boolean).join(' ')

    return `${pad}<div class="${wrapperClasses}"${styleAttr}${dataAttr} data-amagon-media-ratio="${aspectRatio}">
${pad}  <video class="${videoClasses}" src="${escapeAttrValue(src)}"${attrs ? ` ${attrs}` : ''}></video>
${pad}</div>`
  }

  if (block.type === 'button') {
    const text = String(block.props.text ?? '').trim()
    const href = String(block.props.href ?? '').trim()
    const target = String(block.props.target ?? '').trim()
    const sizeClass = String(block.props.size ?? '').trim()
    const variantToken = normalizeVariantToken(block.props.variant, 'primary')
    const outline = toBoolean(block.props.outline, false)
    const blockWidth = toBoolean(block.props.block, false)
    const loading = toBoolean(block.props.loading, false)
    const loadingText = String(block.props.loadingText ?? 'Loading...').trim() || 'Loading...'
    const disabled = toBoolean(block.props.disabled, false) || loading
    const iconLeftMarkup = renderInlineIcon(block.props.iconLeft)
    const iconRightMarkup = renderInlineIcon(block.props.iconRight)
    const variantClass = outline ? `btn-outline-${variantToken}` : `btn-${variantToken}`
    const baseClasses = block.classes.filter((cls) => !/^btn(?:-outline)?-[a-z]+$/.test(cls) && cls !== 'd-block' && cls !== 'w-100')
    const bootstrapClasses = dedupeClasses([
      'btn',
      variantClass,
      sizeClass,
      blockWidth ? 'd-block' : '',
      blockWidth ? 'w-100' : '',
      ...baseClasses
    ])
    const classes = framework === 'tailwind'
      ? dedupeClasses(bootstrapClasses.flatMap((cls) => mapBootstrapClassToTailwind(cls)).concat(disabled ? ['opacity-60', 'pointer-events-none'] : [])).join(' ')
      : bootstrapClasses.join(' ')
    const styleStr = stylesToString(getEffectiveStyles(block))
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="button"` : ''
    const stateAttrs = ` data-amagon-button-variant="${escapeAttrValue(variantToken)}" data-amagon-button-size="${escapeAttrValue(sizeClass)}" data-amagon-button-outline="${outline}" data-amagon-button-block="${blockWidth}" data-amagon-button-loading="${loading}" data-amagon-button-loading-text="${escapeAttrValue(loadingText)}"`
    const spinnerMarkup = loading
      ? framework === 'tailwind'
        ? '<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"></span>'
        : '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>'
      : ''
    const labelMarkup = escapeAttrValue(loading ? loadingText : text)
    const hasDecorators = loading || !!iconLeftMarkup || !!iconRightMarkup
    const contentParts = hasDecorators
      ? [
        loading ? spinnerMarkup : (iconLeftMarkup ? `<span class="amagon-btn-icon amagon-btn-icon-left" data-amagon-button-icon="${escapeAttrValue(String(block.props.iconLeft ?? ''))}" aria-hidden="true">${iconLeftMarkup}</span>` : ''),
        `<span class="amagon-btn-label">${labelMarkup}</span>`,
        !loading && iconRightMarkup ? `<span class="amagon-btn-icon amagon-btn-icon-right" data-amagon-button-icon="${escapeAttrValue(String(block.props.iconRight ?? ''))}" aria-hidden="true">${iconRightMarkup}</span>` : ''
      ].filter(Boolean).join(framework === 'tailwind' ? ' ' : '\n')
      : labelMarkup

    if (href) {
      const disabledAttrs = disabled ? ' aria-disabled="true" tabindex="-1"' : ''
      return `${pad}<a class="${classes}" href="${escapeAttrValue(disabled ? '#' : href)}"${target ? ` target="${escapeAttrValue(target)}"` : ''}${styleAttr}${stateAttrs}${eventAttr ? ` ${eventAttr}` : ''}${disabledAttrs}${dataAttr}>${contentParts}</a>`
    }

    const type = String(block.props.type ?? 'button').trim() || 'button'
    return `${pad}<button type="${escapeAttrValue(type)}" class="${classes}"${disabled ? ' disabled' : ''}${styleAttr}${stateAttrs}${eventAttr ? ` ${eventAttr}` : ''}${dataAttr}>${contentParts}</button>`
  }

  if (block.type === 'code-block') {
    const code = String(block.props.code ?? '')
    const language = String(block.props.language ?? '').trim()
    const showLineNumbers = toBoolean(block.props.showLineNumbers, false)
    const filename = String(block.props.filename ?? '').trim()
    const copyButton = toBoolean(block.props.copyButton, false)
    const highlighted = highlightCodeSnippet(code, language)
    const lines = code.split(/\r?\n/)
    const lineNumbers = lines.map((_, index) => `${index + 1}`).join('\n')
    const encodedCode = encodeURIComponent(code)
    const classes = resolveFrameworkClasses(block, framework, { fullWidthFormControls }).join(' ')
    const styleStr = stylesToString(block.styles)
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="code-block"` : ''
    const stateAttrs = `data-amagon-code-block="true" data-code-language="${escapeAttrValue(language)}" data-code-show-line-numbers="${showLineNumbers}" data-code-filename="${escapeAttrValue(filename)}" data-code-copy-button="${copyButton}" data-code-content="${escapeAttrValue(encodedCode)}"`
    const copyScript = `(function(btn){var root=btn.closest('[data-amagon-code-block]');if(!root)return;var source=root.querySelector('[data-amagon-code-source]');if(!source)return;var text=source.textContent||'';if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text);}})(this)`
    const headerMarkup = (filename || copyButton)
      ? framework === 'tailwind'
        ? `${pad}  <div class="flex items-center justify-between border-b border-[var(--theme-border)] px-3 py-2 text-xs text-[var(--theme-text-muted)]">
${pad}    <span>${escapeAttrValue(filename || 'code')}</span>
${pad}    ${copyButton ? `<button type="button" class="rounded border border-[var(--theme-border)] px-2 py-1 text-[var(--theme-text)]" onclick="${copyScript}">Copy</button>` : ''}
${pad}  </div>`
        : `${pad}  <div class="d-flex align-items-center justify-content-between border-bottom px-3 py-2 small text-muted">
${pad}    <span>${escapeAttrValue(filename || 'code')}</span>
${pad}    ${copyButton ? `<button type="button" class="btn btn-sm btn-outline-secondary" onclick="${copyScript}">Copy</button>` : ''}
${pad}  </div>`
      : ''
    const codePaneMarkup = showLineNumbers
      ? framework === 'tailwind'
        ? `${pad}  <div class="flex">
${pad}    <pre class="m-0 select-none border-r border-[var(--theme-border)] bg-black/10 px-3 py-3 text-right text-xs text-[var(--theme-text-muted)]">${escapeAttrValue(lineNumbers)}</pre>
${pad}    <pre class="m-0 flex-1 overflow-auto px-3 py-3"><code class="hljs ${language ? `language-${language}` : ''}" data-amagon-code-source>${highlighted}</code></pre>
${pad}  </div>`
        : `${pad}  <div class="d-flex">
${pad}    <pre class="m-0 user-select-none border-end px-3 py-3 text-end text-muted"><code>${escapeAttrValue(lineNumbers)}</code></pre>
${pad}    <pre class="m-0 flex-grow-1 overflow-auto px-3 py-3"><code class="hljs ${language ? `language-${language}` : ''}" data-amagon-code-source>${highlighted}</code></pre>
${pad}  </div>`
      : `${pad}  <pre class="m-0 overflow-auto px-3 py-3"><code class="hljs ${language ? `language-${language}` : ''}" data-amagon-code-source>${highlighted}</code></pre>`

    return `${pad}<div class="${classes}"${styleAttr} ${stateAttrs}${eventAttr ? ` ${eventAttr}` : ''}${dataAttr}>
${headerMarkup ? `${headerMarkup}
` : ''}${codePaneMarkup}
${pad}</div>`
  }

  if (block.type === 'iframe') {
    const src = String(block.props.src ?? '').trim()
    const title = String(block.props.title ?? 'Embedded Content').trim() || 'Embedded Content'
    const aspectRatio = normalizeMediaAspectRatio(block.props.aspectRatio)
    const allowFullscreen = toBoolean(block.props.allowFullscreen, true)
    const lazy = toBoolean(block.props.lazy, false)
    const wrapperClass = framework === 'tailwind'
      ? dedupeClasses(['w-full', ratioToTailwindClass(aspectRatio)]).join(' ')
      : dedupeClasses(['ratio', ratioToBootstrapClass(aspectRatio)]).join(' ')
    const iframeClasses = resolveFrameworkClasses(block, framework, { fullWidthFormControls }).join(' ')
    const styleStr = stylesToString(block.styles)
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="iframe"` : ''
    return `${pad}<div class="${wrapperClass}" data-amagon-embed-ratio="${aspectRatio}"${styleAttr}${dataAttr}>
${pad}  <iframe class="${iframeClasses}" src="${escapeAttrValue(src)}" title="${escapeAttrValue(title)}"${allowFullscreen ? ' allowfullscreen' : ''}${lazy ? ' loading="lazy"' : ''}${eventAttr ? ` ${eventAttr}` : ''}></iframe>
${pad}</div>`
  }

  if (block.type === 'table') {
    const rawHeaders = normalizeStringArray(block.props.headers)
    const rawRows = normalizeTableRows(block.props.rows)
    const derivedColumnCount = Math.max(
      rawHeaders.length,
      ...rawRows.map((row) => row.length),
      1
    )
    const headers = rawHeaders.length > 0
      ? rawHeaders.slice(0, derivedColumnCount)
      : Array.from({ length: derivedColumnCount }, (_, i) => `Column ${i + 1}`)
    while (headers.length < derivedColumnCount) {
      headers.push(`Column ${headers.length + 1}`)
    }
    const rows = rawRows.length > 0
      ? rawRows.map((row) => {
        const next = [...row]
        while (next.length < derivedColumnCount) next.push('')
        return next.slice(0, derivedColumnCount)
      })
      : [Array.from({ length: derivedColumnCount }, () => '')]

    const striped = toBoolean(block.props.striped, false)
    const bordered = toBoolean(block.props.bordered, false)
    const hover = toBoolean(block.props.hover, false)
    const responsive = toBoolean(block.props.responsive, true)
    const size = normalizeSize(block.props.size) === 'sm' ? 'sm' : 'default'
    const variant = String(block.props.variant ?? 'default') === 'dark' ? 'dark' : 'default'
    const isTailwind = framework === 'tailwind'
    const tableClasses = isTailwind
      ? dedupeClasses([
        'w-full',
        'border-collapse',
        'text-left',
        size === 'sm' ? 'text-xs' : 'text-sm',
        bordered ? 'border border-[var(--theme-border)]' : '',
        variant === 'dark' ? 'bg-slate-900 text-white' : ''
      ]).join(' ')
      : ['table', striped ? 'table-striped' : '', bordered ? 'table-bordered' : '', hover ? 'table-hover' : '', size === 'sm' ? 'table-sm' : '', variant === 'dark' ? 'table-dark' : '']
        .filter(Boolean)
        .join(' ')

    const tableStyles = stylesToString(block.styles)
    const tableStyleAttr = tableStyles ? ` style="${tableStyles}"` : ''
    const rootDataAttrs = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="table"` : ''
    const stateAttrs = ` data-amagon-table="true" data-table-striped="${striped}" data-table-bordered="${bordered}" data-table-hover="${hover}" data-table-responsive="${responsive}" data-table-size="${size}" data-table-variant="${variant}"`

    const theadClass = isTailwind
      ? variant === 'dark' ? 'bg-slate-800 text-slate-100' : 'bg-[var(--theme-surface)]'
      : ''
    const headerCellClass = isTailwind
      ? `px-3 ${size === 'sm' ? 'py-1.5' : 'py-2'} font-semibold ${bordered ? 'border border-[var(--theme-border)]' : ''}`
      : ''
    const rowClass = (rowIndex: number): string => {
      if (!isTailwind) return ''
      const classes: string[] = []
      if (striped && rowIndex % 2 === 0) classes.push('bg-[rgba(0,0,0,0.03)]')
      if (hover) classes.push('hover:bg-[rgba(0,0,0,0.05)]')
      return classes.join(' ')
    }
    const cellClass = isTailwind
      ? `px-3 ${size === 'sm' ? 'py-1.5' : 'py-2'} align-top ${bordered ? 'border border-[var(--theme-border)]' : ''}`
      : ''

    const headHtml = headers.map((header) => {
      if (isTailwind) {
        return `${pad}      <th scope="col" class="${headerCellClass}">${escapeAttrValue(header)}</th>`
      }
      return `${pad}      <th scope="col">${escapeAttrValue(header)}</th>`
    }).join('\n')

    const bodyHtml = rows.map((row, rowIndex) => {
      const cells = row.map((cell) => {
        if (isTailwind) {
          return `${pad}      <td class="${cellClass}">${escapeAttrValue(cell)}</td>`
        }
        return `${pad}      <td>${escapeAttrValue(cell)}</td>`
      }).join('\n')

      if (isTailwind) {
        const trClass = rowClass(rowIndex)
        return `${pad}    <tr${trClass ? ` class="${trClass}"` : ''}>
${cells}
${pad}    </tr>`
      }
      return `${pad}    <tr>
${cells}
${pad}    </tr>`
    }).join('\n')

    const tableHtml = `${pad}<table class="${tableClasses}"${tableStyleAttr}${stateAttrs}${responsive ? ' data-amagon-table-inner="true"' : ''}${responsive ? '' : rootDataAttrs}>
${pad}  <thead${theadClass ? ` class="${theadClass}"` : ''}>
${pad}    <tr>
${headHtml}
${pad}    </tr>
${pad}  </thead>
${pad}  <tbody>
${bodyHtml}
${pad}  </tbody>
${pad}</table>`

    if (responsive) {
      const wrapperClasses = isTailwind ? 'overflow-x-auto' : 'table-responsive'
      return `${pad}<div class="${wrapperClasses}"${stateAttrs}${rootDataAttrs}>
${tableHtml}
${pad}</div>`
    }

    return tableHtml
  }

  if (block.type === 'dropdown') {
    const label = String(block.props.label ?? 'Dropdown').trim() || 'Dropdown'
    const variant = String(block.props.variant ?? 'primary').trim() || 'primary'
    const size = normalizeSize(block.props.size)
    const direction = normalizeDropdownDirection(block.props.direction)
    const split = toBoolean(block.props.split, false)
    const items = normalizeDropdownItems(block.props.items)
    const isTailwind = framework === 'tailwind'
    const isExportMode = !includeDataAttributes
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}" data-block-type="dropdown"` : ''
    const stateAttrs = `data-amagon-dropdown="true" data-dropdown-variant="${escapeAttrValue(variant)}" data-dropdown-size="${size}" data-dropdown-direction="${direction}" data-dropdown-split="${split}"`

    const normalizedItems = items.length > 0
      ? items
      : [{ label: 'Action', href: '#', divider: false, disabled: false }]

    if (isTailwind) {
      const toggleId = `tw-dropdown-${sanitizeElementId(block.id, block.id)}`
      const menuId = `${toggleId}-menu`
      const buttonSize = size === 'sm' ? 'px-3 py-1.5 text-sm' : size === 'lg' ? 'px-5 py-3 text-lg' : 'px-4 py-2'
      const baseButton = `inline-flex items-center justify-center rounded-md border font-medium ${buttonSize}`
      const buttonVariant = getTailwindButtonVariant(variant)
      const directionClass = direction === 'up'
        ? 'bottom-full mb-2'
        : direction === 'start'
          ? 'right-full mr-2 top-0'
          : direction === 'end'
            ? 'left-full ml-2 top-0'
            : 'top-full mt-2'

      const itemHtml = normalizedItems.map((item) => {
        if (item.divider) {
          return `${pad}    <div class="my-1 border-t border-[var(--theme-border)]" data-dropdown-divider="true"></div>`
        }
        const disabledClass = item.disabled ? 'opacity-50 pointer-events-none' : ''
        return `${pad}    <a href="${escapeAttrValue(item.href)}" class="block rounded-sm px-3 py-2 text-sm text-[var(--theme-text)] no-underline hover:bg-[rgba(0,0,0,0.06)] ${disabledClass}"${item.disabled ? ' aria-disabled="true"' : ''}>${escapeAttrValue(item.label)}</a>`
      }).join('\n')

      const menuVisibilityClass = isExportMode ? 'hidden' : 'block'
      const toggleScript = `(function(btn){var root=btn.closest('[data-amagon-dropdown]');if(!root)return;var menu=root.querySelector('[data-tw-dropdown-menu]');if(!menu)return;menu.classList.toggle('hidden');})(this)`

      if (split) {
        return `${pad}<div class="relative inline-flex items-center"${dataAttr ? ` ${dataAttr}` : ''} ${stateAttrs}>
${pad}  <button type="button" class="${baseButton} ${buttonVariant}">${escapeAttrValue(label)}</button>
${pad}  <button type="button" class="${baseButton} ${buttonVariant} px-3" aria-expanded="${isExportMode ? 'false' : 'true'}" aria-controls="${menuId}"${isExportMode ? ` onclick="${toggleScript}"` : ''}>▼</button>
${pad}  <div id="${menuId}" data-tw-dropdown-menu class="absolute ${directionClass} z-20 min-w-[12rem] rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] p-1 shadow-lg ${menuVisibilityClass}">
${itemHtml}
${pad}  </div>
${pad}</div>`
      }

      return `${pad}<div class="relative inline-block text-left"${dataAttr ? ` ${dataAttr}` : ''} ${stateAttrs}>
${pad}  <button type="button" class="${baseButton} ${buttonVariant}" aria-expanded="${isExportMode ? 'false' : 'true'}" aria-controls="${menuId}"${isExportMode ? ` onclick="${toggleScript}"` : ''}>
${pad}    ${escapeAttrValue(label)}
${pad}    <span class="ml-2">▼</span>
${pad}  </button>
${pad}  <div id="${menuId}" data-tw-dropdown-menu class="absolute ${directionClass} z-20 min-w-[12rem] rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] p-1 shadow-lg ${menuVisibilityClass}">
${itemHtml}
${pad}  </div>
${pad}</div>`
    }

    const directionClass = direction === 'up' ? 'dropup' : direction === 'start' ? 'dropstart' : direction === 'end' ? 'dropend' : 'dropdown'
    const buttonVariantClass = `btn-${variant}`
    const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : ''
    const menuClasses = ['dropdown-menu', includeDataAttributes ? 'show position-static mt-2' : '', variant === 'dark' ? 'dropdown-menu-dark' : '', direction === 'start' ? 'dropdown-menu-end' : '']
      .filter(Boolean)
      .join(' ')

    const menuItems = normalizedItems.map((item) => {
      if (item.divider) {
        return `${pad}    <li><hr class="dropdown-divider"></li>`
      }
      return `${pad}    <li><a class="dropdown-item${item.disabled ? ' disabled' : ''}" href="${escapeAttrValue(item.href)}"${item.disabled ? ' tabindex="-1" aria-disabled="true"' : ''}>${escapeAttrValue(item.label)}</a></li>`
    }).join('\n')

    if (split) {
      return `${pad}<div class="btn-group ${directionClass}" ${stateAttrs}${dataAttr ? ` ${dataAttr}` : ''}>
${pad}  <button type="button" class="btn ${buttonVariantClass} ${sizeClass}">${escapeAttrValue(label)}</button>
${pad}  <button type="button" class="btn ${buttonVariantClass} ${sizeClass} dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown" aria-expanded="${includeDataAttributes ? 'true' : 'false'}"></button>
${pad}  <ul class="${menuClasses}">
${menuItems}
${pad}  </ul>
${pad}</div>`
    }

    return `${pad}<div class="${directionClass}" ${stateAttrs}${dataAttr ? ` ${dataAttr}` : ''}>
${pad}  <button class="btn ${buttonVariantClass} ${sizeClass} dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="${includeDataAttributes ? 'true' : 'false'}">
${pad}    ${escapeAttrValue(label)}
${pad}  </button>
${pad}  <ul class="${menuClasses}">
${menuItems}
${pad}  </ul>
${pad}</div>`
  }

  if (block.type === 'offcanvas') {
    const fallbackId = 'offcanvas-' + Math.random().toString(36).substr(2, 9)
    const id = sanitizeElementId(String(block.props.id || fallbackId), fallbackId)
    const title = String(block.props.title ?? 'Offcanvas').trim() || 'Offcanvas'
    const placement = normalizePlacement(block.props.placement)
    const backdrop = toBoolean(block.props.backdrop, true)
    const scroll = toBoolean(block.props.scroll, false)
    const isExportMode = !includeDataAttributes
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}" data-block-type="offcanvas"` : ''
    const stateAttrs = `data-amagon-offcanvas="true" data-offcanvas-placement="${placement}" data-offcanvas-backdrop="${backdrop}" data-offcanvas-scroll="${scroll}"`
    const childrenHtml = (block.children || []).map((child) => renderBlock(child, indent + 2, indentSize, includeDataAttributes, includeEditorMetadata, pages, folders, framework, fullWidthFormControls)).join('\n')
    const themeSurface = 'var(--theme-surface)'
    const themeText = 'var(--theme-text)'
    const themeBorder = 'var(--theme-border)'

    if (!isExportMode) {
      if (framework === 'tailwind') {
        return `${pad}<div class="mb-4 rounded-xl border shadow-sm editor-outline-gated editor-offcanvas-preview" style="border: 2px dashed ${themeBorder}; background-color: ${themeSurface}; color: ${themeText};" ${stateAttrs}${dataAttr ? ` ${dataAttr}` : ''}>
${pad}  <div class="flex items-center justify-between px-4 py-3" style="background-color: rgba(0,0,0,0.03); border-bottom: 1px solid ${themeBorder};">
${pad}    <div class="flex items-center gap-2 font-bold">
${pad}      <span>☰</span> ${escapeAttrValue(title)}
${pad}    </div>
${pad}    <span class="rounded bg-[var(--theme-secondary)] px-2 py-1 text-xs text-white">Offcanvas Preview</span>
${pad}  </div>
${pad}  <div class="p-6">
${childrenHtml}
${pad}  </div>
${pad}</div>`
      }

      return `${pad}<div class="card mb-3 editor-outline-gated editor-offcanvas-preview" style="border: 2px dashed ${themeBorder}; background-color: ${themeSurface}; color: ${themeText};" ${stateAttrs}${dataAttr ? ` ${dataAttr}` : ''}>
${pad}  <div class="card-header d-flex justify-content-between align-items-center" style="background-color: rgba(0,0,0,0.03); border-bottom: 1px solid ${themeBorder};">
${pad}    <div class="fw-bold d-flex align-items-center gap-2">
${pad}      <span>☰</span> ${escapeAttrValue(title)}
${pad}    </div>
${pad}    <span class="badge bg-secondary">Offcanvas Preview</span>
${pad}  </div>
${pad}  <div class="card-body">
${childrenHtml}
${pad}  </div>
${pad}</div>`
    }

    if (framework === 'tailwind') {
      const backdropId = `${id}-backdrop`
      const placementClasses = placement === 'start'
        ? 'left-0 top-0 h-full w-80'
        : placement === 'end'
          ? 'right-0 top-0 h-full w-80'
          : placement === 'top'
            ? 'left-0 top-0 w-full h-64'
            : 'left-0 bottom-0 w-full h-64'
      const hiddenTransformClass = placement === 'start'
        ? '-translate-x-full'
        : placement === 'end'
          ? 'translate-x-full'
          : placement === 'top'
            ? '-translate-y-full'
            : 'translate-y-full'
      const shownTransformClass = placement === 'start' || placement === 'end'
        ? 'translate-x-0'
        : 'translate-y-0'
      const bodyOpenAction = scroll ? '' : 'document.body.classList.add(\'overflow-hidden\');'
      const bodyCloseAction = scroll ? '' : 'document.body.classList.remove(\'overflow-hidden\');'
      const openAction = `var panel=document.getElementById('${id}');if(panel){panel.classList.remove('hidden','-translate-x-full','translate-x-full','-translate-y-full','translate-y-full');panel.classList.add('${shownTransformClass}');}${backdrop ? `var backdrop=document.getElementById('${backdropId}');if(backdrop){backdrop.classList.remove('hidden');}` : ''}${bodyOpenAction}`
      const closeAction = `var panel=document.getElementById('${id}');if(panel){panel.classList.remove('${shownTransformClass}');panel.classList.add('${hiddenTransformClass}','hidden');}${backdrop ? `var backdrop=document.getElementById('${backdropId}');if(backdrop){backdrop.classList.add('hidden');}` : ''}${bodyCloseAction}`

      return `${pad}<div ${stateAttrs} data-tw-offcanvas-wrapper="true">
${pad}  <button type="button" class="inline-flex items-center justify-center rounded-md border border-[var(--theme-primary)] bg-[var(--theme-primary)] px-4 py-2 text-sm font-medium text-white" onclick="${openAction}">Toggle panel</button>
${backdrop ? `${pad}  <div id="${backdropId}" class="fixed inset-0 z-40 hidden bg-black/40" onclick="${closeAction}"></div>` : ''}
${pad}  <aside id="${id}" class="fixed ${placementClasses} ${hiddenTransformClass} z-50 hidden border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-xl transition-transform" data-tw-offcanvas-panel="true" aria-labelledby="${id}Label">
${pad}    <div class="flex items-center justify-between border-b border-[var(--theme-border)] px-4 py-3">
${pad}      <h2 id="${id}Label" class="text-lg font-semibold text-[var(--theme-text)]" data-tw-offcanvas-title>${escapeAttrValue(title)}</h2>
${pad}      <button type="button" class="rounded-md px-2 py-1 text-[var(--theme-text-muted)]" onclick="${closeAction}" aria-label="Close">✕</button>
${pad}    </div>
${pad}    <div class="p-4 text-[var(--theme-text)]" data-tw-offcanvas-body>
${childrenHtml}
${pad}    </div>
${pad}  </aside>
${pad}</div>`
    }

    const backdropAttr = backdrop ? '' : ' data-bs-backdrop="false"'
    const scrollAttr = scroll ? ' data-bs-scroll="true"' : ''

    return `${pad}<div ${stateAttrs}>
${pad}  <button class="btn btn-primary" type="button" data-bs-toggle="offcanvas" data-bs-target="#${id}" aria-controls="${id}">Toggle panel</button>
${pad}  <div class="offcanvas offcanvas-${placement}" tabindex="-1" id="${id}" aria-labelledby="${id}Label"${backdropAttr}${scrollAttr}${dataAttr ? ` ${dataAttr}` : ''}>
${pad}    <div class="offcanvas-header">
${pad}      <h5 class="offcanvas-title" id="${id}Label">${escapeAttrValue(title)}</h5>
${pad}      <button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>
${pad}    </div>
${pad}    <div class="offcanvas-body">
${childrenHtml}
${pad}    </div>
${pad}  </div>
${pad}</div>`
  }

  if (block.type === 'card') {
    const title = String(block.props.title ?? '').trim()
    const subtitle = String(block.props.subtitle ?? '').trim()
    const text = String(block.props.text ?? '').trim()
    const imageUrl = String(block.props.imageUrl ?? '').trim()
    const imagePositionRaw = String(block.props.imagePosition ?? 'top').trim()
    const imagePosition = imagePositionRaw === 'bottom' || imagePositionRaw === 'overlay' ? imagePositionRaw : 'top'
    const headerText = String(block.props.headerText ?? '').trim()
    const footerText = String(block.props.footerText ?? '').trim()
    const variant = normalizeCardVariant(block.props.variant)
    const outline = toBoolean(block.props.outline, false)
    const normalizedText = escapeAttrValue(text).replace(/\n/g, '<br>')
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}" data-block-type="card"` : ''
    const stateAttrs = `data-amagon-card="true" data-card-variant="${variant}" data-card-outline="${outline}" data-card-image-position="${imagePosition}"`
    const styleString = stylesToString(block.styles)
    const styleAttr = styleString ? ` style="${styleString}"` : ''
    const childBlocksHtml = (block.children || []).map((child) => renderBlock(child, indent + 2, indentSize, includeDataAttributes, includeEditorMetadata, pages, folders, framework, fullWidthFormControls)).join('\n')
    const hasChildren = childBlocksHtml.trim().length > 0
    const contentHtml = `${title ? `${pad}      <h5 class="card-title">${escapeAttrValue(title)}</h5>` : ''}
${subtitle ? `${pad}      <h6 class="card-subtitle mb-2 text-body-secondary">${escapeAttrValue(subtitle)}</h6>` : ''}
${text ? `${pad}      <p class="card-text">${normalizedText}</p>` : ''}`
    const childrenSection = hasChildren
      ? `${pad}    <div data-card-children="true">
${childBlocksHtml}
${pad}    </div>`
      : ''

    if (framework === 'tailwind') {
      const mappedCustomRoot = dedupeClasses(
        block.classes.flatMap((cls) => mapBootstrapClassToTailwind(cls))
      )
      const variantClasses = getCardVariantTailwindClasses(variant, outline)
      const rootClasses = dedupeClasses([
        'relative',
        'overflow-hidden',
        'rounded-lg',
        'border',
        'border-[var(--theme-border)]',
        'bg-[var(--theme-surface)]',
        'shadow-sm',
        ...variantClasses,
        ...mappedCustomRoot
      ]).join(' ')
      const sectionPadding = 'px-6 py-4'
      const bodyClasses = imagePosition === 'overlay' && imageUrl
        ? 'absolute inset-0 z-10 p-6 text-white bg-black/35'
        : 'p-6'
      const subtitleClass = imagePosition === 'overlay' && imageUrl
        ? 'mt-1 text-sm text-slate-100/90'
        : 'mt-1 text-sm text-[var(--theme-text-muted)]'
      const textClass = imagePosition === 'overlay' && imageUrl
        ? 'mt-3 text-sm text-slate-50'
        : 'mt-3 text-sm text-[var(--theme-text)]'
      const cardBodyContent = `${title ? `${pad}      <h5 class="text-lg font-semibold">${escapeAttrValue(title)}</h5>` : ''}
${subtitle ? `${pad}      <h6 class="${subtitleClass}">${escapeAttrValue(subtitle)}</h6>` : ''}
${text ? `${pad}      <p class="${textClass}">${normalizedText}</p>` : ''}`
      const topImage = imageUrl && imagePosition === 'top'
        ? `${pad}  <img src="${escapeAttrValue(imageUrl)}" alt="${escapeAttrValue(title || 'Card image')}" class="h-52 w-full object-cover" data-card-image="true">`
        : ''
      const bottomImage = imageUrl && imagePosition === 'bottom'
        ? `${pad}  <img src="${escapeAttrValue(imageUrl)}" alt="${escapeAttrValue(title || 'Card image')}" class="h-52 w-full object-cover" data-card-image="true">`
        : ''
      const overlaySection = imageUrl && imagePosition === 'overlay'
        ? `${pad}  <div class="relative" data-card-overlay="true">
${pad}    <img src="${escapeAttrValue(imageUrl)}" alt="${escapeAttrValue(title || 'Card image')}" class="h-64 w-full object-cover" data-card-image="true">
${pad}    <div class="${bodyClasses}" data-card-body="true">
${cardBodyContent}
${childrenSection}
${pad}    </div>
${pad}  </div>`
        : ''

      return `${pad}<div class="${rootClasses}" ${stateAttrs}${dataAttr ? ` ${dataAttr}` : ''}${styleAttr}>
${headerText ? `${pad}  <div class="${sectionPadding} border-b border-[var(--theme-border)]" data-card-header="true">${escapeAttrValue(headerText)}</div>` : ''}
${topImage}
${overlaySection || `${pad}  <div class="p-6" data-card-body="true">
${cardBodyContent}
${childrenSection}
${pad}  </div>`}
${!overlaySection && bottomImage ? bottomImage : ''}
${footerText ? `${pad}  <div class="${sectionPadding} border-t border-[var(--theme-border)] text-sm text-[var(--theme-text-muted)]" data-card-footer="true">${escapeAttrValue(footerText)}</div>` : ''}
${pad}</div>`
    }

    const variantClasses = getCardVariantBootstrapClasses(variant, outline)
    const rootClasses = dedupeClasses(['card', ...variantClasses, ...block.classes]).join(' ')
    const topImage = imageUrl && imagePosition === 'top'
      ? `${pad}  <img src="${escapeAttrValue(imageUrl)}" class="card-img-top" alt="${escapeAttrValue(title || 'Card image')}" data-card-image="true">`
      : ''
    const bottomImage = imageUrl && imagePosition === 'bottom'
      ? `${pad}  <img src="${escapeAttrValue(imageUrl)}" class="card-img-bottom" alt="${escapeAttrValue(title || 'Card image')}" data-card-image="true">`
      : ''
    const bodyClass = imageUrl && imagePosition === 'overlay' ? 'card-img-overlay' : 'card-body'
    const overlayImage = imageUrl && imagePosition === 'overlay'
      ? `${pad}  <img src="${escapeAttrValue(imageUrl)}" class="card-img" alt="${escapeAttrValue(title || 'Card image')}" data-card-image="true">`
      : ''

    return `${pad}<div class="${rootClasses}" ${stateAttrs}${dataAttr ? ` ${dataAttr}` : ''}${styleAttr}>
${headerText ? `${pad}  <div class="card-header" data-card-header="true">${escapeAttrValue(headerText)}</div>` : ''}
${topImage}
${overlayImage}
${pad}  <div class="${bodyClass}" data-card-body="true">
${pad}    <div data-card-content="true">
${contentHtml}
${pad}    </div>
${childrenSection}
${pad}  </div>
${bottomImage}
${footerText ? `${pad}  <div class="card-footer" data-card-footer="true">${escapeAttrValue(footerText)}</div>` : ''}
${pad}</div>`
  }

  if (block.type === 'stats-section') {
    const items = normalizeStatsItems(block.props.items)
    const columns = ['2', '3', '4'].includes(String(block.props.columns ?? '4')) ? String(block.props.columns) : '4'
    const variant = ['bordered', 'cards'].includes(String(block.props.variant ?? 'default')) ? String(block.props.variant) : 'default'
    const alignment = String(block.props.alignment ?? 'center') === 'left' ? 'left' : 'center'
    const dataAttrs = `data-block-type="stats-section"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''} data-stats-columns="${columns}" data-stats-variant="${variant}" data-stats-alignment="${alignment}"`

    const normalizedItems = items.length > 0
      ? items
      : [{ value: '120', label: 'Projects', prefix: '', suffix: '+', icon: '🚀' }]

    if (framework === 'tailwind') {
      const gridCols = columns === '2' ? 'md:grid-cols-2' : columns === '3' ? 'md:grid-cols-3' : 'md:grid-cols-4'
      const itemClass = variant === 'cards'
        ? 'stats-item rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-6 shadow-sm'
        : variant === 'bordered'
          ? 'stats-item rounded-lg border border-[var(--theme-border)] p-6'
          : 'stats-item p-4'
      const alignClass = alignment === 'left' ? 'text-left items-start' : 'text-center items-center'
      const itemsHtml = normalizedItems.map((item) => {
        const iconMarkup = renderInlineIcon(item.icon)
        return `${pad}    <div class="${itemClass}" data-stats-item="true" data-stat-value="${escapeAttrValue(item.value)}" data-stat-label="${escapeAttrValue(item.label)}" data-stat-prefix="${escapeAttrValue(item.prefix)}" data-stat-suffix="${escapeAttrValue(item.suffix)}" data-stat-icon="${escapeAttrValue(item.icon)}">
${pad}      ${iconMarkup ? `<div class="mb-2 text-2xl">${iconMarkup}</div>` : ''}
${pad}      <div class="flex ${alignClass} gap-2">
${pad}        <h3 class="text-4xl font-bold leading-tight">${escapeAttrValue(`${item.prefix}${item.value}${item.suffix}`)}</h3>
${pad}      </div>
${pad}      <p class="mt-2 text-sm text-[var(--theme-text-muted)]">${escapeAttrValue(item.label)}</p>
${pad}    </div>`
      }).join('\n')

      return `${pad}<section class="stats-section py-12" ${dataAttrs}>
${pad}  <div class="mx-auto max-w-6xl px-4">
${pad}    <div class="grid grid-cols-1 gap-4 ${gridCols}">
${itemsHtml}
${pad}    </div>
${pad}  </div>
${pad}</section>`
    }

    const rowCols = columns === '2' ? 'row-cols-md-2' : columns === '3' ? 'row-cols-md-3' : 'row-cols-md-4'
    const alignClass = alignment === 'left' ? 'text-start' : 'text-center'
    const itemClass = variant === 'cards'
      ? 'stats-item card h-100 border-0 shadow-sm'
      : variant === 'bordered'
        ? 'stats-item h-100 border rounded-3 p-4'
        : 'stats-item h-100 p-3'
    const itemsHtml = normalizedItems.map((item) => {
      const iconMarkup = renderInlineIcon(item.icon)
      return `${pad}      <div class="col">
${pad}        <div class="${itemClass}" data-stats-item="true" data-stat-value="${escapeAttrValue(item.value)}" data-stat-label="${escapeAttrValue(item.label)}" data-stat-prefix="${escapeAttrValue(item.prefix)}" data-stat-suffix="${escapeAttrValue(item.suffix)}" data-stat-icon="${escapeAttrValue(item.icon)}">
${pad}          ${variant === 'cards' ? '<div class="card-body">' : ''}
${pad}          ${iconMarkup ? `<div class="mb-2">${iconMarkup}</div>` : ''}
${pad}          <h3 class="display-5 fw-bold mb-1">${escapeAttrValue(`${item.prefix}${item.value}${item.suffix}`)}</h3>
${pad}          <p class="text-muted mb-0">${escapeAttrValue(item.label)}</p>
${pad}          ${variant === 'cards' ? '</div>' : ''}
${pad}        </div>
${pad}      </div>`
    }).join('\n')

    return `${pad}<section class="stats-section py-5 ${alignClass}" ${dataAttrs}>
${pad}  <div class="container">
${pad}    <div class="row row-cols-1 ${rowCols} g-4">
${itemsHtml}
${pad}    </div>
${pad}  </div>
${pad}</section>`
  }

  if (block.type === 'team-grid') {
    const members = normalizeTeamMembers(block.props.members)
    const columns = ['2', '3', '4'].includes(String(block.props.columns ?? '3')) ? String(block.props.columns) : '3'
    const cardStyle = ['simple', 'overlay'].includes(String(block.props.cardStyle ?? 'card')) ? String(block.props.cardStyle) : 'card'
    const showSocial = toBoolean(block.props.showSocial, true)
    const dataAttrs = `data-block-type="team-grid"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''} data-team-columns="${columns}" data-team-card-style="${cardStyle}" data-team-show-social="${showSocial}"`

    const normalizedMembers = members.length > 0
      ? members
      : [{ name: 'Team Member', role: 'Role', imageUrl: IMAGE_PLACEHOLDER, bio: '', socialLinks: {} }]

    const renderSocialLinks = (socialLinks: Record<string, string>): string => {
      if (!showSocial) return ''
      const entries = Object.entries(socialLinks).filter(([, href]) => String(href).trim().length > 0)
      if (entries.length === 0) return ''
      if (framework === 'tailwind') {
        return `<div class="mt-3 flex flex-wrap gap-2">${entries.map(([platform, href]) => `<a href="${escapeAttrValue(href)}" class="text-sm text-[var(--theme-primary)] no-underline">${escapeAttrValue(platform)}</a>`).join('')}</div>`
      }
      return `<div class="mt-3 d-flex flex-wrap gap-2">${entries.map(([platform, href]) => `<a href="${escapeAttrValue(href)}" class="small text-decoration-none">${escapeAttrValue(platform)}</a>`).join('')}</div>`
    }

    if (framework === 'tailwind') {
      const gridCols = columns === '2' ? 'md:grid-cols-2' : columns === '4' ? 'md:grid-cols-4' : 'md:grid-cols-3'
      const cardClasses = cardStyle === 'simple'
        ? 'team-member-card p-2'
        : 'team-member-card rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 shadow-sm'
      const membersHtml = normalizedMembers.map((member) => `${pad}    <article class="${cardClasses}" data-team-member="true" data-member-name="${escapeAttrValue(member.name)}" data-member-role="${escapeAttrValue(member.role)}" data-member-image-url="${escapeAttrValue(member.imageUrl)}" data-member-bio="${escapeAttrValue(member.bio)}" data-member-social="${escapeAttrValue(JSON.stringify(member.socialLinks || {}))}">
${pad}      <div class="relative overflow-hidden rounded-lg">
${pad}        <img src="${escapeAttrValue(member.imageUrl || IMAGE_PLACEHOLDER)}" alt="${escapeAttrValue(member.name || 'Team member')}" class="h-56 w-full object-cover">
${pad}        ${cardStyle === 'overlay' ? `<div class="absolute inset-x-0 bottom-0 bg-black/55 p-3 text-white"><h3 class="text-base font-semibold">${escapeAttrValue(member.name)}</h3><p class="text-sm text-slate-200">${escapeAttrValue(member.role)}</p></div>` : ''}
${pad}      </div>
${pad}      ${cardStyle === 'overlay' ? '' : `<h3 class="mt-4 text-lg font-semibold">${escapeAttrValue(member.name)}</h3><p class="text-sm text-[var(--theme-text-muted)]">${escapeAttrValue(member.role)}</p>`}
${pad}      ${member.bio ? `<p class="mt-2 text-sm text-[var(--theme-text)]">${escapeAttrValue(member.bio)}</p>` : ''}
${pad}      ${renderSocialLinks(member.socialLinks)}
${pad}    </article>`).join('\n')

      return `${pad}<section class="team-grid py-12" ${dataAttrs}>
${pad}  <div class="mx-auto max-w-6xl px-4">
${pad}    <div class="grid grid-cols-1 gap-5 ${gridCols}">
${membersHtml}
${pad}    </div>
${pad}  </div>
${pad}</section>`
    }

    const rowCols = columns === '2' ? 'row-cols-md-2' : columns === '4' ? 'row-cols-md-4' : 'row-cols-md-3'
    const membersHtml = normalizedMembers.map((member) => `${pad}      <div class="col">
${pad}        <article class="team-member-card h-100 ${cardStyle === 'simple' ? '' : 'card border-0 shadow-sm'}" data-team-member="true" data-member-name="${escapeAttrValue(member.name)}" data-member-role="${escapeAttrValue(member.role)}" data-member-image-url="${escapeAttrValue(member.imageUrl)}" data-member-bio="${escapeAttrValue(member.bio)}" data-member-social="${escapeAttrValue(JSON.stringify(member.socialLinks || {}))}">
${pad}          <div class="position-relative">
${pad}            <img src="${escapeAttrValue(member.imageUrl || IMAGE_PLACEHOLDER)}" alt="${escapeAttrValue(member.name || 'Team member')}" class="w-100 rounded-3${cardStyle !== 'simple' ? ' card-img-top' : ''}" style="height: 240px; object-fit: cover;">
${pad}            ${cardStyle === 'overlay' ? `<div class="position-absolute bottom-0 start-0 end-0 p-3 text-white" style="background: linear-gradient(0deg, rgba(0,0,0,0.65), transparent);"><h3 class="h5 mb-1">${escapeAttrValue(member.name)}</h3><p class="mb-0">${escapeAttrValue(member.role)}</p></div>` : ''}
${pad}          </div>
${pad}          ${cardStyle === 'overlay' ? '' : `<div class="${cardStyle === 'simple' ? 'pt-3' : 'card-body'}"><h3 class="h5 mb-1">${escapeAttrValue(member.name)}</h3><p class="text-muted mb-2">${escapeAttrValue(member.role)}</p>${member.bio ? `<p class="mb-0">${escapeAttrValue(member.bio)}</p>` : ''}</div>`}
${pad}          ${showSocial ? `<div class="${cardStyle === 'simple' ? 'pt-2' : 'card-body pt-0'}">${renderSocialLinks(member.socialLinks)}</div>` : ''}
${pad}        </article>
${pad}      </div>`).join('\n')

    return `${pad}<section class="team-grid py-5" ${dataAttrs}>
${pad}  <div class="container">
${pad}    <div class="row row-cols-1 ${rowCols} g-4">
${membersHtml}
${pad}    </div>
${pad}  </div>
${pad}</section>`
  }

  if (block.type === 'gallery') {
    const images = normalizeGalleryImages(block.props.images)
    const columns = ['2', '3', '4', '6'].includes(String(block.props.columns ?? '4')) ? String(block.props.columns) : '4'
    const gap = ['none', 'sm', 'lg'].includes(String(block.props.gap ?? 'md')) ? String(block.props.gap) : 'md'
    const lightbox = toBoolean(block.props.lightbox, false)
    const filterable = toBoolean(block.props.filterable, false)
    const layout = String(block.props.layout ?? 'grid') === 'masonry' ? 'masonry' : 'grid'
    const dataAttrs = `data-block-type="gallery"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''} data-gallery-columns="${columns}" data-gallery-gap="${gap}" data-gallery-lightbox="${lightbox}" data-gallery-filterable="${filterable}" data-gallery-layout="${layout}"`

    const normalizedImages = images.length > 0
      ? images
      : [{ url: IMAGE_PLACEHOLDER, caption: 'Gallery item', category: 'General' }]

    const categories = Array.from(new Set(normalizedImages.map((img) => img.category).filter(Boolean)))
    const gapClass = gap === 'none' ? 'g-0' : gap === 'sm' ? 'g-2' : gap === 'lg' ? 'g-5' : 'g-4'
    const twGapClass = gap === 'none' ? 'gap-0' : gap === 'sm' ? 'gap-2' : gap === 'lg' ? 'gap-8' : 'gap-4'

    if (framework === 'tailwind') {
      const gridCols = columns === '2' ? 'md:grid-cols-2' : columns === '3' ? 'md:grid-cols-3' : columns === '6' ? 'md:grid-cols-6' : 'md:grid-cols-4'
      const itemWrapperClass = layout === 'masonry' ? 'mb-4 break-inside-avoid' : ''
      const imagesHtml = normalizedImages.map((image) => `${pad}      <figure class="gallery-item overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] ${itemWrapperClass}" data-gallery-image="true" data-image-url="${escapeAttrValue(image.url)}" data-image-caption="${escapeAttrValue(image.caption)}" data-image-category="${escapeAttrValue(image.category)}">
${pad}        ${lightbox ? `<a href="${escapeAttrValue(image.url)}" data-gallery-lightbox-item="true">` : ''}
${pad}        <img src="${escapeAttrValue(image.url || IMAGE_PLACEHOLDER)}" alt="${escapeAttrValue(image.caption || 'Gallery image')}" class="h-56 w-full object-cover">
${pad}        ${lightbox ? '</a>' : ''}
${pad}        ${image.caption ? `<figcaption class="px-3 py-2 text-sm text-[var(--theme-text-muted)]">${escapeAttrValue(image.caption)}</figcaption>` : ''}
${pad}      </figure>`).join('\n')

      return `${pad}<section class="gallery py-12" ${dataAttrs}>
${pad}  <div class="mx-auto max-w-6xl px-4">
${filterable && categories.length > 0 ? `${pad}    <div class="mb-4 flex flex-wrap gap-2" data-gallery-filters="true">${categories.map((category) => `<span class="rounded-full border border-[var(--theme-border)] px-3 py-1 text-xs text-[var(--theme-text-muted)]">${escapeAttrValue(category)}</span>`).join('')}</div>
` : ''}${layout === 'masonry'
          ? `${pad}    <div class="columns-1 ${columns === '2' ? 'md:columns-2' : columns === '3' ? 'md:columns-3' : columns === '6' ? 'md:columns-6' : 'md:columns-4'} ${twGapClass}" data-gallery-grid="true">
${imagesHtml}
${pad}    </div>`
          : `${pad}    <div class="grid grid-cols-1 ${gridCols} ${twGapClass}" data-gallery-grid="true">
${imagesHtml}
${pad}    </div>`}
${pad}  </div>
${pad}</section>`
    }

    const rowCols = columns === '2' ? 'row-cols-md-2' : columns === '3' ? 'row-cols-md-3' : columns === '6' ? 'row-cols-md-6' : 'row-cols-md-4'
    const imagesHtml = normalizedImages.map((image) => `${pad}      <div class="col ${layout === 'masonry' ? 'mb-3' : ''}">
${pad}        <figure class="gallery-item overflow-hidden rounded-3 border" data-gallery-image="true" data-image-url="${escapeAttrValue(image.url)}" data-image-caption="${escapeAttrValue(image.caption)}" data-image-category="${escapeAttrValue(image.category)}">
${pad}          ${lightbox ? `<a href="${escapeAttrValue(image.url)}" data-gallery-lightbox-item="true">` : ''}
${pad}          <img src="${escapeAttrValue(image.url || IMAGE_PLACEHOLDER)}" alt="${escapeAttrValue(image.caption || 'Gallery image')}" class="img-fluid w-100" style="height: 220px; object-fit: cover;">
${pad}          ${lightbox ? '</a>' : ''}
${pad}          ${image.caption ? `<figcaption class="small text-muted px-3 py-2">${escapeAttrValue(image.caption)}</figcaption>` : ''}
${pad}        </figure>
${pad}      </div>`).join('\n')

    return `${pad}<section class="gallery py-5" ${dataAttrs}>
${pad}  <div class="container">
${filterable && categories.length > 0 ? `${pad}    <div class="d-flex flex-wrap gap-2 mb-3" data-gallery-filters="true">${categories.map((category) => `<span class="badge bg-light text-dark border">${escapeAttrValue(category)}</span>`).join('')}</div>
` : ''}${pad}    <div class="row row-cols-1 ${rowCols} ${gapClass}" data-gallery-grid="true">
${imagesHtml}
${pad}    </div>
${pad}  </div>
${pad}</section>`
  }

  if (block.type === 'timeline') {
    const items = normalizeTimelineItems(block.props.items)
    const orientation = String(block.props.orientation ?? 'vertical') === 'horizontal' ? 'horizontal' : 'vertical'
    const alternating = toBoolean(block.props.alternating, true)
    const lineColor = String(block.props.lineColor ?? '#6c757d').trim() || '#6c757d'
    const dataAttrs = `data-block-type="timeline"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''} data-timeline-orientation="${orientation}" data-timeline-alternating="${alternating}" data-timeline-line-color="${escapeAttrValue(lineColor)}"`
    const normalizedItems = items.length > 0
      ? items
      : [{ date: '2024', title: 'Milestone', description: 'Timeline item', icon: '•', variant: 'primary' }]

    if (framework === 'tailwind') {
      const containerClass = orientation === 'horizontal' ? 'grid grid-cols-1 gap-4 md:grid-cols-3' : 'space-y-4'
      const alignBase = orientation === 'vertical' && alternating ? 'md:[&:nth-child(even)]:ml-10' : ''
      const itemsHtml = normalizedItems.map((item) => {
        const iconMarkup = renderInlineIcon(item.icon) || escapeAttrValue(item.icon || '•')
        return `${pad}    <article class="timeline-item relative rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 ${alignBase}" data-timeline-item="true" data-timeline-date="${escapeAttrValue(item.date)}" data-timeline-title="${escapeAttrValue(item.title)}" data-timeline-description="${escapeAttrValue(item.description)}" data-timeline-icon="${escapeAttrValue(item.icon)}" data-timeline-variant="${escapeAttrValue(item.variant)}">
${pad}      <div class="mb-2 flex items-center gap-2 text-sm text-[var(--theme-text-muted)]">
${pad}        <span class="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--theme-border)]">${iconMarkup}</span>
${pad}        <span>${escapeAttrValue(item.date)}</span>
${pad}      </div>
${pad}      <h3 class="text-lg font-semibold">${escapeAttrValue(item.title)}</h3>
${pad}      <p class="mt-2 text-sm text-[var(--theme-text)]">${escapeAttrValue(item.description)}</p>
${pad}    </article>`
      }).join('\n')

      return `${pad}<section class="timeline py-12" style="--timeline-line-color: ${escapeAttrValue(lineColor)};" ${dataAttrs}>
${pad}  <div class="mx-auto max-w-6xl px-4">
${pad}    <div class="${containerClass}">
${itemsHtml}
${pad}    </div>
${pad}  </div>
${pad}</section>`
    }

    const containerClass = orientation === 'horizontal' ? 'row row-cols-1 row-cols-md-3 g-4' : 'd-flex flex-column gap-3'
    const itemsHtml = normalizedItems.map((item, index) => {
      const iconMarkup = renderInlineIcon(item.icon) || escapeAttrValue(item.icon || '•')
      return `${orientation === 'horizontal' ? `${pad}      <div class="col">` : ''}${pad}        <article class="timeline-item p-4 rounded-3 border${orientation === 'vertical' && alternating && index % 2 === 1 ? ' ms-md-5' : ''}" data-timeline-item="true" data-timeline-date="${escapeAttrValue(item.date)}" data-timeline-title="${escapeAttrValue(item.title)}" data-timeline-description="${escapeAttrValue(item.description)}" data-timeline-icon="${escapeAttrValue(item.icon)}" data-timeline-variant="${escapeAttrValue(item.variant)}">
${pad}          <div class="d-flex align-items-center gap-2 text-muted small mb-2">
${pad}            <span class="d-inline-flex align-items-center justify-content-center rounded-circle border" style="width:1.75rem;height:1.75rem;">${iconMarkup}</span>
${pad}            <span>${escapeAttrValue(item.date)}</span>
${pad}          </div>
${pad}          <h3 class="h5 mb-2">${escapeAttrValue(item.title)}</h3>
${pad}          <p class="mb-0">${escapeAttrValue(item.description)}</p>
${pad}        </article>${orientation === 'horizontal' ? `
${pad}      </div>` : ''}`
    }).join('\n')

    return `${pad}<section class="timeline py-5" style="--timeline-line-color: ${escapeAttrValue(lineColor)};" ${dataAttrs}>
${pad}  <div class="container">
${pad}    <div class="${containerClass}">
${itemsHtml}
${pad}    </div>
${pad}  </div>
${pad}</section>`
  }

  if (block.type === 'logo-cloud') {
    const title = String(block.props.title ?? '').trim()
    const logos = normalizeLogos(block.props.logos)
    const columns = ['3', '4', '5', '6'].includes(String(block.props.columns ?? '6')) ? String(block.props.columns) : '6'
    const grayscale = toBoolean(block.props.grayscale, true)
    const variant = ['bordered', 'cards'].includes(String(block.props.variant ?? 'simple')) ? String(block.props.variant) : 'simple'
    const dataAttrs = `data-block-type="logo-cloud"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''} data-logo-columns="${columns}" data-logo-grayscale="${grayscale}" data-logo-variant="${variant}"`

    const normalizedLogos = logos.length > 0
      ? logos
      : [{ imageUrl: IMAGE_PLACEHOLDER, altText: 'Partner', href: '' }]

    if (framework === 'tailwind') {
      const gridCols = columns === '3' ? 'md:grid-cols-3' : columns === '4' ? 'md:grid-cols-4' : columns === '5' ? 'md:grid-cols-5' : 'md:grid-cols-6'
      const logoClass = variant === 'cards'
        ? 'logo-item rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4'
        : variant === 'bordered'
          ? 'logo-item rounded-lg border border-[var(--theme-border)] p-3'
          : 'logo-item p-3'
      const logosHtml = normalizedLogos.map((logo) => `${pad}      <div class="${logoClass}" data-logo-item="true" data-logo-image-url="${escapeAttrValue(logo.imageUrl)}" data-logo-alt-text="${escapeAttrValue(logo.altText)}" data-logo-href="${escapeAttrValue(logo.href)}">
${pad}        ${logo.href ? `<a href="${escapeAttrValue(logo.href)}">` : ''}
${pad}        <img src="${escapeAttrValue(logo.imageUrl || IMAGE_PLACEHOLDER)}" alt="${escapeAttrValue(logo.altText || 'Logo')}" class="mx-auto h-12 w-auto object-contain${grayscale ? ' grayscale opacity-80 hover:grayscale-0 hover:opacity-100' : ''}">
${pad}        ${logo.href ? '</a>' : ''}
${pad}      </div>`).join('\n')

      return `${pad}<section class="logo-cloud py-12" ${dataAttrs}>
${pad}  <div class="mx-auto max-w-6xl px-4">
${title ? `${pad}    <h2 class="mb-6 text-center text-2xl font-semibold">${escapeAttrValue(title)}</h2>
` : ''}${pad}    <div class="grid grid-cols-2 gap-4 ${gridCols}">
${logosHtml}
${pad}    </div>
${pad}  </div>
${pad}</section>`
    }

    const rowCols = columns === '3' ? 'row-cols-md-3' : columns === '4' ? 'row-cols-md-4' : columns === '5' ? 'row-cols-md-5' : 'row-cols-md-6'
    const logosHtml = normalizedLogos.map((logo) => `${pad}      <div class="col">
${pad}        <div class="logo-item text-center ${variant === 'cards' ? 'card border-0 shadow-sm p-3' : variant === 'bordered' ? 'border rounded-3 p-3' : 'p-2'}" data-logo-item="true" data-logo-image-url="${escapeAttrValue(logo.imageUrl)}" data-logo-alt-text="${escapeAttrValue(logo.altText)}" data-logo-href="${escapeAttrValue(logo.href)}">
${pad}          ${logo.href ? `<a href="${escapeAttrValue(logo.href)}">` : ''}
${pad}          <img src="${escapeAttrValue(logo.imageUrl || IMAGE_PLACEHOLDER)}" alt="${escapeAttrValue(logo.altText || 'Logo')}" class="img-fluid mx-auto${grayscale ? ' opacity-75' : ''}" style="max-height: 48px; width: auto;">
${pad}          ${logo.href ? '</a>' : ''}
${pad}        </div>
${pad}      </div>`).join('\n')

    return `${pad}<section class="logo-cloud py-5" ${dataAttrs}>
${pad}  <div class="container">
${title ? `${pad}    <h2 class="h4 text-center mb-4">${escapeAttrValue(title)}</h2>
` : ''}${pad}    <div class="row row-cols-2 ${rowCols} g-3">
${logosHtml}
${pad}    </div>
${pad}  </div>
${pad}</section>`
  }

  if (block.type === 'process-steps') {
    const steps = normalizeProcessSteps(block.props.steps)
    const layout = String(block.props.layout ?? 'horizontal') === 'vertical' ? 'vertical' : 'horizontal'
    const connectorStyle = ['arrow', 'dotted'].includes(String(block.props.connectorStyle ?? 'line')) ? String(block.props.connectorStyle) : 'line'
    const variant = ['numbered', 'icon'].includes(String(block.props.variant ?? 'both')) ? String(block.props.variant) : 'both'
    const dataAttrs = `data-block-type="process-steps"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''} data-process-layout="${layout}" data-process-connector-style="${connectorStyle}" data-process-variant="${variant}"`
    const normalizedSteps = steps.length > 0
      ? steps
      : [{ number: '1', title: 'Step', description: '', icon: '•' }]

    if (framework === 'tailwind') {
      const containerClass = layout === 'vertical' ? 'space-y-4' : 'grid grid-cols-1 gap-4 md:grid-cols-3'
      const connectorClass = connectorStyle === 'arrow'
        ? 'after:content-[\'→\'] after:absolute after:right-[-12px] after:top-1/2 after:-translate-y-1/2 after:text-[var(--theme-text-muted)]'
        : connectorStyle === 'dotted'
          ? 'after:absolute after:right-[-10px] after:top-1/2 after:h-px after:w-5 after:-translate-y-1/2 after:border-t after:border-dotted after:border-[var(--theme-border)] after:content-[\'\']'
          : 'after:absolute after:right-[-10px] after:top-1/2 after:h-px after:w-5 after:-translate-y-1/2 after:bg-[var(--theme-border)] after:content-[\'\']'
      const stepsHtml = normalizedSteps.map((step, index) => {
        const iconMarkup = renderInlineIcon(step.icon) || escapeAttrValue(step.icon || '•')
        return `${pad}    <article class="process-step relative rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 ${layout === 'horizontal' && index < normalizedSteps.length - 1 ? connectorClass : ''}" data-process-step="true" data-step-number="${escapeAttrValue(step.number)}" data-step-title="${escapeAttrValue(step.title)}" data-step-description="${escapeAttrValue(step.description)}" data-step-icon="${escapeAttrValue(step.icon)}">
${pad}      <div class="mb-2 flex items-center gap-2">
${pad}        ${(variant === 'numbered' || variant === 'both') ? `<span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--theme-primary)] text-sm font-semibold text-white">${escapeAttrValue(step.number)}</span>` : ''}
${pad}        ${(variant === 'icon' || variant === 'both') ? `<span class="text-xl">${iconMarkup}</span>` : ''}
${pad}      </div>
${pad}      <h3 class="text-lg font-semibold">${escapeAttrValue(step.title)}</h3>
${pad}      <p class="mt-2 text-sm text-[var(--theme-text-muted)]">${escapeAttrValue(step.description)}</p>
${pad}    </article>`
      }).join('\n')

      return `${pad}<section class="process-steps py-12" ${dataAttrs}>
${pad}  <div class="mx-auto max-w-6xl px-4">
${pad}    <div class="${containerClass}">
${stepsHtml}
${pad}    </div>
${pad}  </div>
${pad}</section>`
    }

    const containerClass = layout === 'vertical' ? 'd-flex flex-column gap-3' : 'row row-cols-1 row-cols-md-3 g-4'
    const stepsHtml = normalizedSteps.map((step, index) => {
      const iconMarkup = renderInlineIcon(step.icon) || escapeAttrValue(step.icon || '•')
      return `${layout === 'horizontal' ? `${pad}      <div class="col">` : ''}${pad}        <article class="process-step position-relative rounded-3 border p-4 ${layout === 'horizontal' && index < normalizedSteps.length - 1 ? 'process-step-connector' : ''}" data-process-step="true" data-step-number="${escapeAttrValue(step.number)}" data-step-title="${escapeAttrValue(step.title)}" data-step-description="${escapeAttrValue(step.description)}" data-step-icon="${escapeAttrValue(step.icon)}">
${pad}          <div class="d-flex align-items-center gap-2 mb-2">
${pad}            ${(variant === 'numbered' || variant === 'both') ? `<span class="badge bg-primary rounded-pill">${escapeAttrValue(step.number)}</span>` : ''}
${pad}            ${(variant === 'icon' || variant === 'both') ? `<span>${iconMarkup}</span>` : ''}
${pad}          </div>
${pad}          <h3 class="h5 mb-2">${escapeAttrValue(step.title)}</h3>
${pad}          <p class="mb-0 text-muted">${escapeAttrValue(step.description)}</p>
${pad}        </article>${layout === 'horizontal' ? `
${pad}      </div>` : ''}`
    }).join('\n')

    return `${pad}<section class="process-steps py-5" ${dataAttrs}>
${pad}  <div class="container">
${pad}    <div class="${containerClass}" data-process-connector="${connectorStyle}">
${stepsHtml}
${pad}    </div>
${pad}  </div>
${pad}</section>`
  }

  // Phase 6 Widgets
  if (block.type === 'newsletter') {
    const title = String(block.props.title || '')
    const description = String(block.props.description || '')
    const placeholder = String(block.props.placeholder || 'Enter your email')
    const buttonText = String(block.props.buttonText || 'Subscribe')
    const buttonVariant = String(block.props.buttonVariant || 'primary')
    const layout = String(block.props.layout || 'inline')
    const showNameField = toBoolean(block.props.showNameField, false)
    const variant = String(block.props.variant || 'simple')
    const dataAttrs = `data-block-type="newsletter"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''}`

    if (framework === 'tailwind') {
      const containerClass = variant === 'card' ? 'max-w-2xl mx-auto bg-[var(--theme-surface)] p-8 rounded-xl shadow-sm border border-[var(--theme-border)]' : 'max-w-2xl mx-auto text-center'
      const formClass = layout === 'inline' ? 'flex flex-col sm:flex-row gap-3 mt-6' : 'flex flex-col gap-4 mt-6'
      const inputClass = 'flex-1 px-4 py-2 rounded-lg border border-[var(--theme-border)] bg-transparent focus:ring-2 focus:ring-[var(--theme-primary)] outline-none'
      const btnClass = `px-6 py-2 rounded-lg font-medium transition-colors ${buttonVariant === 'primary' ? 'bg-[var(--theme-primary)] text-white hover:bg-blue-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`
      
      return `${pad}<section ${dataAttrs} class="${finalClasses.join(' ')} py-12">
${pad}  <div class="container mx-auto px-4">
${pad}    <div class="${containerClass}">
${title ? `${pad}      <h2 class="text-3xl font-bold mb-3">${escapeAttrValue(title)}</h2>\n` : ''}
${description ? `${pad}      <p class="text-[var(--theme-text-muted)]">${escapeAttrValue(description)}</p>\n` : ''}
${pad}      <form class="${formClass}">
${showNameField ? `${pad}        <input type="text" placeholder="Name" class="${inputClass}">\n` : ''}
${pad}        <input type="email" placeholder="${escapeAttrValue(placeholder)}" class="${inputClass}" required>
${pad}        <button type="submit" class="${btnClass}">${escapeAttrValue(buttonText)}</button>
${pad}      </form>
${pad}    </div>
${pad}  </div>
${pad}</section>`
    }

    const containerClass = variant === 'card' ? 'card p-4 p-md-5 shadow-sm mx-auto' : 'text-center mx-auto'
    const formClass = layout === 'inline' ? 'd-flex flex-column flex-sm-row gap-2 mt-4' : 'd-flex flex-column gap-3 mt-4'
    const btnClass = `btn btn-${buttonVariant}`

    return `${pad}<section ${dataAttrs} class="${finalClasses.join(' ')} py-5">
${pad}  <div class="container">
${pad}    <div class="${containerClass}" style="max-width: 600px;">
${title ? `${pad}      <h2 class="mb-3">${escapeAttrValue(title)}</h2>\n` : ''}
${description ? `${pad}      <p class="text-muted">${escapeAttrValue(description)}</p>\n` : ''}
${pad}      <form class="${formClass}">
${showNameField ? `${pad}        <input type="text" placeholder="Name" class="form-control">\n` : ''}
${pad}        <input type="email" placeholder="${escapeAttrValue(placeholder)}" class="form-control" required>
${pad}        <button type="submit" class="${btnClass}">${escapeAttrValue(buttonText)}</button>
${pad}      </form>
${pad}    </div>
${pad}  </div>
${pad}</section>`
  }

  if (block.type === 'comparison-table') {
    const plans = Array.isArray(block.props.plans) ? block.props.plans : []
    const cols = Number(block.props.columns) || 2
    const dataAttrs = `data-block-type="comparison-table"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''}`

    if (framework === 'tailwind') {
      const gridClass = `grid grid-cols-1 md:grid-cols-${Math.min(Math.max(cols, 1), 4)} gap-6`
      const plansHtml = plans.map(plan => `
${pad}      <div class="rounded-xl border ${plan.highlighted ? 'border-[var(--theme-primary)] ring-2 ring-[var(--theme-primary)]/20' : 'border-[var(--theme-border)]'} bg-[var(--theme-surface)] p-6">
${pad}        <h3 class="text-xl font-bold">${escapeAttrValue(plan.name || 'Plan')}</h3>
${pad}        <div class="my-4"><span class="text-3xl font-bold">${escapeAttrValue(plan.price || '$0')}</span><span class="text-sm text-[var(--theme-text-muted)]">${escapeAttrValue(plan.period || '/mo')}</span></div>
${pad}        <ul class="space-y-3 mb-6">
${(Array.isArray(plan.features) ? plan.features : []).map((f: any) => `
${pad}          <li class="flex items-center gap-2 ${f.included ? '' : 'text-[var(--theme-text-muted)] opacity-75'}">
${pad}            <span>${f.included ? '✓' : '✕'}</span> ${escapeAttrValue(f.text || '')}
${pad}          </li>`).join('')}
${pad}        </ul>
${pad}        <a href="${escapeAttrValue(plan.ctaHref || '#')}" class="block w-full py-2 text-center rounded-lg font-medium transition-colors ${plan.highlighted ? 'bg-[var(--theme-primary)] text-white hover:bg-blue-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}">${escapeAttrValue(plan.ctaText || 'Select')}</a>
${pad}      </div>`).join('')

      return `${pad}<section ${dataAttrs} class="${finalClasses.join(' ')} py-12">
${pad}  <div class="container mx-auto px-4">
${pad}    <div class="${gridClass}">
${plansHtml}
${pad}    </div>
${pad}  </div>
${pad}</section>`
    }

    const plansHtml = plans.map(plan => `
${pad}      <div class="col">
${pad}        <div class="card h-100 ${plan.highlighted ? 'border-primary shadow' : ''}">
${pad}          <div class="card-body">
${pad}            <h3 class="card-title h5">${escapeAttrValue(plan.name || 'Plan')}</h3>
${pad}            <div class="my-3"><span class="h2">${escapeAttrValue(plan.price || '$0')}</span><span class="text-muted">${escapeAttrValue(plan.period || '/mo')}</span></div>
${pad}            <ul class="list-unstyled mb-4">
${(Array.isArray(plan.features) ? plan.features : []).map((f: any) => `
${pad}              <li class="mb-2 ${f.included ? '' : 'text-muted opacity-75'}">
${pad}                <span class="me-2">${f.included ? '✓' : '✕'}</span>${escapeAttrValue(f.text || '')}
${pad}              </li>`).join('')}
${pad}            </ul>
${pad}            <a href="${escapeAttrValue(plan.ctaHref || '#')}" class="btn w-100 ${plan.highlighted ? 'btn-primary' : 'btn-outline-primary'}">${escapeAttrValue(plan.ctaText || 'Select')}</a>
${pad}          </div>
${pad}        </div>
${pad}      </div>`).join('')

    return `${pad}<section ${dataAttrs} class="${finalClasses.join(' ')} py-5">
${pad}  <div class="container">
${pad}    <div class="row row-cols-1 row-cols-md-${Math.min(Math.max(cols, 1), 4)} g-4">
${plansHtml}
${pad}    </div>
${pad}  </div>
${pad}</section>`
  }

  if (block.type === 'contact-card') {
    const dataAttrs = `data-block-type="contact-card"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''}`
    const name = String(block.props.name || '')
    const title = String(block.props.title || '')
    const email = String(block.props.email || '')
    const phone = String(block.props.phone || '')
    const address = String(block.props.address || '')
    const imageUrl = String(block.props.imageUrl || IMAGE_PLACEHOLDER)
    const layout = String(block.props.layout || 'vertical')

    if (framework === 'tailwind') {
      const cardClass = layout === 'horizontal' ? 'flex flex-col md:flex-row gap-6 items-center' : 'flex flex-col text-center'
      const imgClass = layout === 'horizontal' ? 'w-32 h-32 rounded-full object-cover shrink-0' : 'w-32 h-32 rounded-full object-cover mx-auto mb-4'
      return `${pad}<section ${dataAttrs} class="${finalClasses.join(' ')} p-6 bg-[var(--theme-surface)] rounded-xl border border-[var(--theme-border)] max-w-lg mx-auto">
${pad}  <div class="${cardClass}">
${pad}    <img src="${escapeAttrValue(imageUrl)}" alt="${escapeAttrValue(name)}" class="${imgClass}">
${pad}    <div>
${pad}      <h3 class="text-2xl font-bold">${escapeAttrValue(name)}</h3>
${pad}      <p class="text-[var(--theme-primary)] font-medium mb-4">${escapeAttrValue(title)}</p>
${pad}      <div class="space-y-2 text-[var(--theme-text-muted)] text-sm">
${email ? `${pad}        <p>✉ ${escapeAttrValue(email)}</p>\n` : ''}
${phone ? `${pad}        <p>☎ ${escapeAttrValue(phone)}</p>\n` : ''}
${address ? `${pad}        <p>📍 ${escapeAttrValue(address)}</p>\n` : ''}
${pad}      </div>
${pad}    </div>
${pad}  </div>
${pad}</section>`
    }

    const cardClass = layout === 'horizontal' ? 'd-flex flex-column flex-md-row gap-4 align-items-center text-center text-md-start' : 'd-flex flex-column align-items-center text-center'
    const imgClass = 'rounded-circle object-fit-cover'
    return `${pad}<section ${dataAttrs} class="${finalClasses.join(' ')} card shadow-sm mx-auto" style="max-width: 600px;">
${pad}  <div class="card-body p-4 p-md-5 ${cardClass}">
${pad}    <img src="${escapeAttrValue(imageUrl)}" alt="${escapeAttrValue(name)}" class="${imgClass}" style="width: 120px; height: 120px;">
${pad}    <div>
${pad}      <h3 class="card-title h4 mb-1">${escapeAttrValue(name)}</h3>
${pad}      <p class="text-primary fw-medium mb-3">${escapeAttrValue(title)}</p>
${pad}      <div class="text-muted small">
${email ? `${pad}        <p class="mb-1">✉ ${escapeAttrValue(email)}</p>\n` : ''}
${phone ? `${pad}        <p class="mb-1">☎ ${escapeAttrValue(phone)}</p>\n` : ''}
${address ? `${pad}        <p class="mb-0">📍 ${escapeAttrValue(address)}</p>\n` : ''}
${pad}      </div>
${pad}    </div>
${pad}  </div>
${pad}</section>`
  }

  if (block.type === 'social-links') {
    const dataAttrs = `data-block-type="social-links"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''}`
    const links = Array.isArray(block.props.links) ? block.props.links : []
    const style = String(block.props.style || 'icons-only')
    const size = String(block.props.size || 'md')
    
    if (framework === 'tailwind') {
      const sizeClass = size === 'sm' ? 'text-sm gap-2' : size === 'lg' ? 'text-xl gap-6' : 'text-base gap-4'
      const linksHtml = links.map(link => `
${pad}    <a href="${escapeAttrValue(link.url || '#')}" class="inline-flex items-center gap-2 hover:text-[var(--theme-primary)] transition-colors" title="${escapeAttrValue(link.platform || 'Social')}" data-social-platform="${escapeAttrValue(link.platform || '')}">
${pad}      ${style !== 'text-only' ? `<span class="social-link-icon">${renderSocialPlatformIcon(link.platform)}</span>` : ''}
${pad}      ${style !== 'icons-only' ? `<span>${escapeAttrValue(link.label || link.platform || 'Link')}</span>` : ''}
${pad}    </a>`).join('')
      return `${pad}<div ${dataAttrs} class="${finalClasses.join(' ')} flex flex-wrap justify-center ${sizeClass}">
${linksHtml}
${pad}</div>`
    }

    const sizeClass = size === 'sm' ? 'fs-6 gap-2' : size === 'lg' ? 'fs-4 gap-4' : 'fs-5 gap-3'
    const linksHtml = links.map(link => `
${pad}    <a href="${escapeAttrValue(link.url || '#')}" class="text-decoration-none text-body d-inline-flex align-items-center gap-2" title="${escapeAttrValue(link.platform || 'Social')}" data-social-platform="${escapeAttrValue(link.platform || '')}">
${pad}      ${style !== 'text-only' ? `<span class="social-link-icon">${renderSocialPlatformIcon(link.platform)}</span>` : ''}
${pad}      ${style !== 'icons-only' ? `<span>${escapeAttrValue(link.label || link.platform || 'Link')}</span>` : ''}
${pad}    </a>`).join('')
    return `${pad}<div ${dataAttrs} class="${finalClasses.join(' ')} d-flex flex-wrap justify-content-center ${sizeClass}">
${linksHtml}
${pad}</div>`
  }

  if (block.type === 'cookie-banner') {
    const dataAttrs = `data-block-type="cookie-banner"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''}`
    const message = String(block.props.message || 'We use cookies.')
    const acceptText = String(block.props.acceptText || 'Accept')
    const declineText = String(block.props.declineText || 'Decline')
    const position = String(block.props.position || 'bottom')

    if (framework === 'tailwind') {
      const posClass = position === 'top' ? 'top-0 border-b' : 'bottom-0 border-t'
      return `${pad}<div ${dataAttrs} class="${finalClasses.join(' ')} fixed left-0 right-0 ${posClass} border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 z-50 shadow-lg">
${pad}  <div class="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
${pad}    <p class="text-[var(--theme-text)] m-0">${escapeAttrValue(message)}</p>
${pad}    <div class="flex gap-2 shrink-0">
${pad}      <button class="px-4 py-2 text-[var(--theme-text-muted)] hover:bg-gray-100 rounded-lg transition-colors">${escapeAttrValue(declineText)}</button>
${pad}      <button class="px-4 py-2 bg-[var(--theme-primary)] text-white rounded-lg hover:bg-blue-600 transition-colors">${escapeAttrValue(acceptText)}</button>
${pad}    </div>
${pad}  </div>
${pad}</div>`
    }

    const posClass = position === 'top' ? 'top-0 border-bottom' : 'bottom-0 border-top'
    return `${pad}<div ${dataAttrs} class="${finalClasses.join(' ')} fixed-${position === 'top' ? 'top' : 'bottom'} bg-body ${posClass} p-3 z-3 shadow">
${pad}  <div class="container d-flex flex-column flex-sm-row align-items-center justify-content-between gap-3 text-center text-sm-start">
${pad}    <p class="mb-0 small">${escapeAttrValue(message)}</p>
${pad}    <div class="d-flex gap-2 flex-shrink-0">
${pad}      <button class="btn btn-sm btn-light">${escapeAttrValue(declineText)}</button>
${pad}      <button class="btn btn-sm btn-primary">${escapeAttrValue(acceptText)}</button>
${pad}    </div>
${pad}  </div>
${pad}</div>`
  }

  if (block.type === 'back-to-top') {
    const dataAttrs = `data-block-type="back-to-top"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''}`
    const style = String(block.props.style || 'circle')
    const pos = String(block.props.position || 'bottom-right')
    
    if (framework === 'tailwind') {
      const radiusClass = style === 'circle' ? 'rounded-full' : style === 'rounded' ? 'rounded-lg' : 'rounded-none'
      const posClass = pos === 'bottom-left' ? 'bottom-6 left-6' : 'bottom-6 right-6'
      return `${pad}<button ${dataAttrs} class="${finalClasses.join(' ')} fixed ${posClass} ${radiusClass} p-3 bg-[var(--theme-primary)] text-white shadow-lg hover:bg-blue-600 transition-colors z-40 flex items-center justify-center" aria-label="Back to top">
${pad}  ↑
${pad}</button>`
    }

    const radiusClass = style === 'circle' ? 'rounded-circle' : style === 'rounded' ? 'rounded' : 'rounded-0'
    const posStyle = pos === 'bottom-left' ? 'bottom: 1.5rem; left: 1.5rem;' : 'bottom: 1.5rem; right: 1.5rem;'
    return `${pad}<button ${dataAttrs} class="${finalClasses.join(' ')} btn btn-primary ${radiusClass} shadow position-fixed z-3 d-flex align-items-center justify-content-center" style="${posStyle} width: 48px; height: 48px;" aria-label="Back to top">
${pad}  ↑
${pad}</button>`
  }

  if (block.type === 'countdown') {
    const dataAttrs = `data-block-type="countdown"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''}`
    const labels = block.props.labels as any || { days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds' }
    
    if (framework === 'tailwind') {
      return `${pad}<div ${dataAttrs} class="${finalClasses.join(' ')} flex flex-wrap justify-center gap-4 text-center">
${pad}  <div class="flex flex-col p-4 bg-[var(--theme-surface)] rounded-xl border border-[var(--theme-border)] min-w-[100px]">
${pad}    <span class="text-3xl font-bold">00</span>
${pad}    <span class="text-sm text-[var(--theme-text-muted)] uppercase tracking-wider">${escapeAttrValue(labels.days || 'Days')}</span>
${pad}  </div>
${pad}  <div class="flex flex-col p-4 bg-[var(--theme-surface)] rounded-xl border border-[var(--theme-border)] min-w-[100px]">
${pad}    <span class="text-3xl font-bold">00</span>
${pad}    <span class="text-sm text-[var(--theme-text-muted)] uppercase tracking-wider">${escapeAttrValue(labels.hours || 'Hours')}</span>
${pad}  </div>
${pad}  <div class="flex flex-col p-4 bg-[var(--theme-surface)] rounded-xl border border-[var(--theme-border)] min-w-[100px]">
${pad}    <span class="text-3xl font-bold">00</span>
${pad}    <span class="text-sm text-[var(--theme-text-muted)] uppercase tracking-wider">${escapeAttrValue(labels.minutes || 'Minutes')}</span>
${pad}  </div>
${pad}  <div class="flex flex-col p-4 bg-[var(--theme-surface)] rounded-xl border border-[var(--theme-border)] min-w-[100px]">
${pad}    <span class="text-3xl font-bold">00</span>
${pad}    <span class="text-sm text-[var(--theme-text-muted)] uppercase tracking-wider">${escapeAttrValue(labels.seconds || 'Seconds')}</span>
${pad}  </div>
${pad}</div>`
    }

    return `${pad}<div ${dataAttrs} class="${finalClasses.join(' ')} d-flex flex-wrap justify-content-center gap-3 text-center">
${pad}  <div class="card shadow-sm border-0" style="min-width: 90px;">
${pad}    <div class="card-body p-3">
${pad}      <div class="h2 mb-0 fw-bold">00</div>
${pad}      <small class="text-muted text-uppercase">${escapeAttrValue(labels.days || 'Days')}</small>
${pad}    </div>
${pad}  </div>
${pad}  <div class="card shadow-sm border-0" style="min-width: 90px;">
${pad}    <div class="card-body p-3">
${pad}      <div class="h2 mb-0 fw-bold">00</div>
${pad}      <small class="text-muted text-uppercase">${escapeAttrValue(labels.hours || 'Hours')}</small>
${pad}    </div>
${pad}  </div>
${pad}  <div class="card shadow-sm border-0" style="min-width: 90px;">
${pad}    <div class="card-body p-3">
${pad}      <div class="h2 mb-0 fw-bold">00</div>
${pad}      <small class="text-muted text-uppercase">${escapeAttrValue(labels.minutes || 'Minutes')}</small>
${pad}    </div>
${pad}  </div>
${pad}  <div class="card shadow-sm border-0" style="min-width: 90px;">
${pad}    <div class="card-body p-3">
${pad}      <div class="h2 mb-0 fw-bold">00</div>
${pad}      <small class="text-muted text-uppercase">${escapeAttrValue(labels.seconds || 'Seconds')}</small>
${pad}    </div>
${pad}  </div>
${pad}</div>`
  }

  if (block.type === 'before-after') {
    const dataAttrs = `data-block-type="before-after"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''}`
    const bImg = String(block.props.beforeImage || IMAGE_PLACEHOLDER)
    const aImg = String(block.props.afterImage || IMAGE_PLACEHOLDER)
    
    if (framework === 'tailwind') {
      return `${pad}<div ${dataAttrs} class="${finalClasses.join(' ')} relative w-full overflow-hidden rounded-xl bg-gray-200 aspect-video group">
${pad}  <img src="${escapeAttrValue(aImg)}" alt="After" class="absolute inset-0 w-full h-full object-cover">
${pad}  <div class="absolute inset-y-0 left-0 w-1/2 overflow-hidden border-r-2 border-white shadow-[1px_0_4px_rgba(0,0,0,0.5)]">
${pad}    <img src="${escapeAttrValue(bImg)}" alt="Before" class="absolute inset-0 w-[200%] h-full max-w-none object-cover">
${pad}  </div>
${pad}  <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center cursor-ew-resize">
${pad}    <span class="text-xs text-gray-500 tracking-tighter">↔</span>
${pad}  </div>
${pad}</div>`
    }

    return `${pad}<div ${dataAttrs} class="${finalClasses.join(' ')} position-relative w-100 overflow-hidden rounded bg-light" style="aspect-ratio: 16/9;">
${pad}  <img src="${escapeAttrValue(aImg)}" alt="After" class="position-absolute top-0 start-0 w-100 h-100 object-fit-cover">
${pad}  <div class="position-absolute top-0 start-0 h-100 border-end border-white border-2 shadow-sm" style="width: 50%;">
${pad}    <img src="${escapeAttrValue(bImg)}" alt="Before" class="position-absolute top-0 start-0 h-100 object-fit-cover" style="width: 200%; max-width: none;">
${pad}  </div>
${pad}  <div class="position-absolute top-50 start-50 translate-middle bg-white rounded-circle shadow d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; cursor: ew-resize;">
${pad}    <small class="text-secondary" style="letter-spacing: -2px;">↔</small>
${pad}  </div>
${pad}</div>`
  }

  if (block.type === 'map-embed') {
    const dataAttrs = `data-block-type="map-embed"${includeDataAttributes ? ` data-block-id="${block.id}"` : ''}`
    const embedUrl = String(block.props.embedUrl || 'https://maps.google.com/maps?q=New+York&t=&z=13&ie=UTF8&iwloc=&output=embed')
    const height = String(block.props.height || '400px')
    const grayscale = toBoolean(block.props.grayscale, false)
    const title = String(block.props.title || 'Location Map')
    
    const filterStyle = grayscale ? 'filter: grayscale(100%) invert(10%);' : ''
    
    if (framework === 'tailwind') {
      return `${pad}<div ${dataAttrs} class="${finalClasses.join(' ')} w-full overflow-hidden rounded-xl border border-[var(--theme-border)]">
${pad}  <iframe src="${escapeAttrValue(embedUrl)}" width="100%" height="${escapeAttrValue(height)}" style="border:0; ${filterStyle}" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${escapeAttrValue(title)}"></iframe>
${pad}</div>`
    }

    return `${pad}<div ${dataAttrs} class="${finalClasses.join(' ')} w-100 overflow-hidden rounded border">
${pad}  <iframe src="${escapeAttrValue(embedUrl)}" width="100%" height="${escapeAttrValue(height)}" style="border:0; ${filterStyle}" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="${escapeAttrValue(title)}"></iframe>
${pad}</div>`
  }

  // Special handling for Modal
  if (block.type === 'modal') {
    const fallbackId = 'modal-' + Math.random().toString(36).substr(2, 9)
    const id = sanitizeElementId(String(block.props.id || fallbackId), fallbackId)
    const buttonText = String(block.props.buttonText || 'Launch Modal')
    const title = String(block.props.title || 'Modal Title')
    const showClose = block.props.closeButton !== false
    const showFooter = block.props.footerButtons !== false
    const sizeVal = String(block.props.size ?? 'default').trim()
    const sizeClass = sizeVal !== 'default' ? ` ${sizeVal}` : ''
    const scrollable = toBoolean(block.props.scrollable, false)
    const centered = toBoolean(block.props.centered, false)
    const dialogClasses = ['modal-dialog', sizeClass.trim(), scrollable ? 'modal-dialog-scrollable' : '', centered ? 'modal-dialog-centered' : ''].filter(Boolean).join(' ')
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
${pad}  <div class="${dialogClasses}">
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

  // Special handling for Link with button mode or icons
  if (block.type === 'link') {
    const text = String(block.props.text ?? '').trim()
    const href = String(block.props.href ?? '#').trim() || '#'
    const isButton = toBoolean(block.props.button, false)
    const newTab = toBoolean(block.props.newTab, false)
    const target = newTab ? '_blank' : (String(block.props.target ?? '').trim() || undefined)
    const targetAttr = target ? ` target="${escapeAttrValue(target)}"` : ''
    const relAttr = newTab ? ' rel="noopener noreferrer"' : ''
    const iconLeftMarkup = renderInlineIcon(block.props.iconLeft)
    const iconRightMarkup = renderInlineIcon(block.props.iconRight)
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="link"` : ''
    const styleStr = stylesToString(block.styles)
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''

    if (isButton) {
      const variantToken = String(block.props.variant ?? 'primary').trim() || 'primary'
      const isOutline = variantToken.startsWith('outline-')
      const baseVariant = isOutline ? variantToken.replace('outline-', '') : variantToken
      const btnClass = isOutline ? `btn-outline-${baseVariant}` : `btn-${baseVariant}`
      const classes = framework === 'tailwind'
        ? dedupeClasses(resolveFrameworkClasses(block, framework, { fullWidthFormControls })).join(' ') || dedupeClasses([btnClass].flatMap(c => mapBootstrapClassToTailwind(c))).join(' ')
        : dedupeClasses(['btn', btnClass, ...block.classes]).join(' ')
      const hasDecorators = !!iconLeftMarkup || !!iconRightMarkup
      const label = escapeAttrValue(text)
      const contentParts = hasDecorators
        ? [
          iconLeftMarkup ? `<span aria-hidden="true">${iconLeftMarkup}</span>` : '',
          label,
          iconRightMarkup ? `<span aria-hidden="true">${iconRightMarkup}</span>` : ''
        ].filter(Boolean).join(' ')
        : label
      return `${pad}<a class="${classes}" href="${escapeAttrValue(href)}"${targetAttr}${relAttr}${styleAttr}${dataAttr}>${contentParts}</a>`
    }

    if (iconLeftMarkup || iconRightMarkup) {
      const classes = resolveFrameworkClasses(block, framework, { fullWidthFormControls }).join(' ')
      const classAttr = classes ? ` class="${classes}"` : ''
      const hasDecorators = true
      const label = escapeAttrValue(text)
      const contentParts = [
        iconLeftMarkup ? `<span aria-hidden="true">${iconLeftMarkup}</span>` : '',
        label,
        iconRightMarkup ? `<span aria-hidden="true">${iconRightMarkup}</span>` : ''
      ].filter(Boolean).join(' ')
      return `${pad}<a${classAttr} href="${escapeAttrValue(href)}"${targetAttr}${relAttr}${styleAttr}${dataAttr}>${contentParts}</a>`
    }

    // Plain link — add newTab/rel if needed
    if (newTab) {
      const classes = resolveFrameworkClasses(block, framework, { fullWidthFormControls }).join(' ')
      const classAttr = classes ? ` class="${classes}"` : ''
      return `${pad}<a${classAttr} href="${escapeAttrValue(href)}"${targetAttr}${relAttr}${styleAttr}${dataAttr}>${escapeAttrValue(text)}</a>`
    }

    // Fall through to generic path
  }

  // Special handling for Divider
  if (block.type === 'divider') {
    const divStyle = String(block.props.style ?? 'solid').trim()
    const thickness = String(block.props.thickness ?? '1px').trim() || '1px'
    const color = String(block.props.color ?? '').trim()
    const withText = String(block.props.withText ?? '').trim()
    const withIcon = String(block.props.withIcon ?? '').trim()
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="divider"` : ''

    if (withText || withIcon) {
      const iconMarkup = renderInlineIcon(withIcon)
      const centerContent = iconMarkup || (withText ? escapeAttrValue(withText) : '')
      if (framework === 'tailwind') {
        return `${pad}<div class="flex items-center gap-3 my-4"${dataAttr}>
${pad}  <div class="flex-1 border-t" style="border-style: ${divStyle}; border-color: ${color || 'currentColor'}; border-width: ${thickness};"></div>
${pad}  <span class="text-sm text-[var(--theme-text-muted)]">${centerContent}</span>
${pad}  <div class="flex-1 border-t" style="border-style: ${divStyle}; border-color: ${color || 'currentColor'}; border-width: ${thickness};"></div>
${pad}</div>`
      }
      return `${pad}<div class="d-flex align-items-center gap-2 my-3"${dataAttr}>
${pad}  <hr class="flex-grow-1 m-0" style="border-style: ${divStyle}; border-color: ${color || ''}; border-width: ${thickness};">
${pad}  <span class="text-muted small">${centerContent}</span>
${pad}  <hr class="flex-grow-1 m-0" style="border-style: ${divStyle}; border-color: ${color || ''}; border-width: ${thickness};">
${pad}</div>`
    }

    if (divStyle === 'gradient') {
      return `${pad}<div class="my-4" style="height: ${thickness}; background: linear-gradient(to right, transparent, ${color || 'currentColor'}, transparent);"${dataAttr}></div>`
    }

    const hrStyle = [
      divStyle !== 'solid' ? `border-style: ${divStyle};` : '',
      color ? `border-color: ${color};` : '',
      thickness !== '1px' ? `border-width: ${thickness};` : ''
    ].filter(Boolean).join(' ')
    const hrClasses = resolveFrameworkClasses(block, framework, { fullWidthFormControls }).join(' ')
    return `${pad}<hr${hrClasses ? ` class="${hrClasses}"` : ''}${hrStyle ? ` style="${hrStyle}"` : ''}${dataAttr}>`
  }

  // Special handling for Spacer
  if (block.type === 'spacer') {
    const height = String(block.props.height ?? '2rem').trim() || '2rem'
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="spacer"` : ''
    return `${pad}<div aria-hidden="true" style="height: ${escapeAttrValue(height)};"${dataAttr}></div>`
  }

  // Special handling for Radio (composite component)
  if (block.type === 'radio') {
    const radioLabel = escapeAttrValue(String(block.props.label ?? 'Radio option'))
    const radioName = escapeAttrValue(String(block.props.name ?? 'radio-group'))
    const radioValue = escapeAttrValue(String(block.props.value ?? 'option1'))
    const radioChecked = toBoolean(block.props.checked, false) ? 'checked' : ''
    const radioDisabled = toBoolean(block.props.disabled, false) ? 'disabled' : ''
    const radioInline = toBoolean(block.props.inline, false)
    const radioId = `radio-${sanitizeElementId(block.id, block.id)}`
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="radio"` : ''
    const styleStr = stylesToString(block.styles)
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    if (framework === 'tailwind') {
      const wrapperClass = radioInline ? 'inline-flex items-center gap-2 mr-4' : 'flex items-center gap-2 mb-2'
      return `${pad}<label class="${wrapperClass}"${dataAttr}${styleAttr}>
${pad}  <input type="radio" id="${radioId}" name="${radioName}" value="${radioValue}" ${radioChecked} ${radioDisabled} class="w-4 h-4 accent-[var(--theme-primary)]">
${pad}  <span class="text-[var(--theme-text)]">${radioLabel}</span>
${pad}</label>`
    }
    const wrapperClass = ['form-check', radioInline ? 'form-check-inline' : ''].filter(Boolean).join(' ')
    return `${pad}<div class="${wrapperClass}"${dataAttr}${styleAttr}>
${pad}  <input class="form-check-input" type="radio" id="${radioId}" name="${radioName}" value="${radioValue}" ${radioChecked} ${radioDisabled}>
${pad}  <label class="form-check-label" for="${radioId}">${radioLabel}</label>
${pad}</div>`
  }

  // Special handling for Range (composite component)
  if (block.type === 'range') {
    const rangeLabel = escapeAttrValue(String(block.props.label ?? ''))
    const rangeMin = Number(block.props.min ?? 0)
    const rangeMax = Number(block.props.max ?? 100)
    const rangeStep = Number(block.props.step ?? 1)
    const rangeValue = Number(block.props.value ?? 50)
    const rangeDisabled = toBoolean(block.props.disabled, false) ? ' disabled' : ''
    const rangeId = `range-${sanitizeElementId(block.id, block.id)}`
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="range"` : ''
    const styleStr = stylesToString(block.styles)
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    if (framework === 'tailwind') {
      return `${pad}<div${dataAttr}${styleAttr}>
${rangeLabel ? `${pad}  <label for="${rangeId}" class="block mb-2 text-sm font-medium text-[var(--theme-text)]">${rangeLabel}</label>` : ''}
${pad}  <input type="range" id="${rangeId}" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--theme-primary)]" min="${rangeMin}" max="${rangeMax}" step="${rangeStep}" value="${rangeValue}"${rangeDisabled}>
${pad}</div>`
    }
    return `${pad}<div${dataAttr}${styleAttr}>
${rangeLabel ? `${pad}  <label for="${rangeId}" class="form-label">${rangeLabel}</label>` : ''}
${pad}  <input type="range" id="${rangeId}" class="form-range" min="${rangeMin}" max="${rangeMax}" step="${rangeStep}" value="${rangeValue}"${rangeDisabled}>
${pad}</div>`
  }

  // Special handling for File Input (composite component)
  if (block.type === 'file-input') {
    const fileLabel = escapeAttrValue(String(block.props.label ?? 'Upload file'))
    const fileAccept = String(block.props.accept ?? '').trim()
    const fileMultiple = toBoolean(block.props.multiple, false) ? ' multiple' : ''
    const fileDisabled = toBoolean(block.props.disabled, false) ? ' disabled' : ''
    const fileSize = String(block.props.size ?? 'default')
    const fileId = `file-${sanitizeElementId(block.id, block.id)}`
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="file-input"` : ''
    const styleStr = stylesToString(block.styles)
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    const acceptAttr = fileAccept ? ` accept="${escapeAttrValue(fileAccept)}"` : ''
    if (framework === 'tailwind') {
      return `${pad}<div${dataAttr}${styleAttr}>
${fileLabel ? `${pad}  <label for="${fileId}" class="block mb-2 text-sm font-medium text-[var(--theme-text)]">${fileLabel}</label>` : ''}
${pad}  <input type="file" id="${fileId}" class="block w-full text-sm text-gray-900 border border-[var(--theme-border)] rounded-lg cursor-pointer bg-[var(--theme-surface)]"${acceptAttr}${fileMultiple}${fileDisabled}>
${pad}</div>`
    }
    const sizeClass = fileSize === 'sm' ? ' form-control-sm' : fileSize === 'lg' ? ' form-control-lg' : ''
    return `${pad}<div${dataAttr}${styleAttr}>
${fileLabel ? `${pad}  <label for="${fileId}" class="form-label">${fileLabel}</label>` : ''}
${pad}  <input type="file" id="${fileId}" class="form-control${sizeClass}"${acceptAttr}${fileMultiple}${fileDisabled}>
${pad}</div>`
  }

  // Special handling for Breadcrumb (composite component)
  if (block.type === 'breadcrumb') {
    const crumbItems = (block.props.items as Array<{ label: string; href: string; active: boolean }>) ?? []
    const crumbDivider = String(block.props.divider ?? 'slash')
    const dividerChar = crumbDivider === 'chevron' ? '>' : crumbDivider === 'dot' ? '·' : '/'
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="breadcrumb"` : ''
    const styleStr = stylesToString(block.styles)
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    if (framework === 'tailwind') {
      const listItems = crumbItems.map((item) =>
        item.active
          ? `${pad}    <li class="flex items-center text-sm font-medium text-[var(--theme-text)]" aria-current="page">${escapeAttrValue(item.label)}</li>`
          : `${pad}    <li class="flex items-center text-sm font-medium text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]"><a href="${escapeAttrValue(item.href)}">${escapeAttrValue(item.label)}</a><span class="mx-2">${dividerChar}</span></li>`
      ).join('\n')
      return `${pad}<nav aria-label="breadcrumb"${dataAttr}${styleAttr}>
${pad}  <ol class="flex flex-wrap items-center">
${listItems}
${pad}  </ol>
${pad}</nav>`
    }
    const listItems = crumbItems.map((item) =>
      item.active
        ? `${pad}    <li class="breadcrumb-item active" aria-current="page">${escapeAttrValue(item.label)}</li>`
        : `${pad}    <li class="breadcrumb-item"><a href="${escapeAttrValue(item.href)}">${escapeAttrValue(item.label)}</a></li>`
    ).join('\n')
    const dividerStyle = dividerChar !== '/' ? ` style="--bs-breadcrumb-divider: '${dividerChar}';"` : ''
    return `${pad}<nav aria-label="breadcrumb"${dataAttr}${styleAttr}${dividerStyle}>
${pad}  <ol class="breadcrumb">
${listItems}
${pad}  </ol>
${pad}</nav>`
  }

  // Special handling for Pagination (composite component)
  if (block.type === 'pagination') {
    const totalPages = Number(block.props.pages ?? 3)
    const activePg = Number(block.props.activePage ?? 1)
    const pgSize = String(block.props.size ?? 'default')
    const pgAlignment = String(block.props.alignment ?? 'start')
    const showPrevNext = toBoolean(block.props.showPrevNext, true)
    const showFirstLast = toBoolean(block.props.showFirstLast, false)
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="pagination"` : ''
    const styleStr = stylesToString(block.styles)
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    if (framework === 'tailwind') {
      const flexAlign = pgAlignment === 'center' ? 'justify-center' : pgAlignment === 'end' ? 'justify-end' : 'justify-start'
      const pgItems = Array.from({ length: totalPages }, (_, i) => {
        const n = i + 1
        const isActive = n === activePg
        const cls = isActive
          ? 'px-3 py-2 leading-tight border border-[var(--theme-border)] bg-[var(--theme-primary)] text-white'
          : 'px-3 py-2 leading-tight border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] hover:bg-[var(--theme-bg)]'
        return `${pad}    <li><a href="#" class="${cls}">${n}</a></li>`
      }).join('\n')
      const twLink = `px-3 py-2 leading-tight border border-[var(--theme-border)] bg-[var(--theme-surface)] text-[var(--theme-text)] hover:bg-[var(--theme-bg)]`
      const firstItem = showFirstLast ? `${pad}    <li><a href="#" class="${twLink}">«</a></li>` : ''
      const prevItem = showPrevNext ? `${pad}    <li><a href="#" class="${twLink}">Previous</a></li>` : ''
      const nextItem = showPrevNext ? `${pad}    <li><a href="#" class="${twLink}">Next</a></li>` : ''
      const lastItem = showFirstLast ? `${pad}    <li><a href="#" class="${twLink}">»</a></li>` : ''
      return `${pad}<nav aria-label="Page navigation"${dataAttr}${styleAttr}>
${pad}  <ul class="flex ${flexAlign} flex-wrap gap-1">
${[firstItem, prevItem, pgItems, nextItem, lastItem].filter(Boolean).join('\n')}
${pad}  </ul>
${pad}</nav>`
    }
    const sizeClass = pgSize === 'sm' ? ' pagination-sm' : pgSize === 'lg' ? ' pagination-lg' : ''
    const alignClass = pgAlignment === 'center' ? ' justify-content-center' : pgAlignment === 'end' ? ' justify-content-end' : ''
    const pgItems = Array.from({ length: totalPages }, (_, i) => {
      const n = i + 1
      const isActive = n === activePg
      const cls = isActive ? 'page-item active' : 'page-item'
      return `${pad}    <li class="${cls}"><a class="page-link" href="#">${n}</a></li>`
    }).join('\n')
    const firstItem = showFirstLast ? `${pad}    <li class="page-item"><a class="page-link" href="#">«</a></li>` : ''
    const prevItem = showPrevNext ? `${pad}    <li class="page-item"><a class="page-link" href="#">Previous</a></li>` : ''
    const nextItem = showPrevNext ? `${pad}    <li class="page-item"><a class="page-link" href="#">Next</a></li>` : ''
    const lastItem = showFirstLast ? `${pad}    <li class="page-item"><a class="page-link" href="#">»</a></li>` : ''
    return `${pad}<nav aria-label="Page navigation"${dataAttr}${styleAttr}>
${pad}  <ul class="pagination${sizeClass}${alignClass}">
${[firstItem, prevItem, pgItems, nextItem, lastItem].filter(Boolean).join('\n')}
${pad}  </ul>
${pad}</nav>`
  }

  // Special handling for Checkbox (composite component)
  if (block.type === 'checkbox') {
    const label = escapeAttrValue(String(block.props.label ?? ''))
    const name = block.props.name ? `name="${escapeAttrValue(String(block.props.name))}"` : ''
    const checked = block.props.checked ? 'checked' : ''
    const switchMode = toBoolean(block.props.switch, false)
    const inline = toBoolean(block.props.inline, false)
    const id = sanitizeElementId(String(block.props.id || block.id), block.id)
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}" data-block-type="checkbox"` : ''
    const classes = resolveFrameworkClasses(block, framework, { fullWidthFormControls }).join(' ')

    if (framework === 'tailwind') {
      if (switchMode) {
        return `${pad}<label class="mb-4 ${inline ? 'inline-flex' : 'flex'} items-center gap-3 text-[var(--theme-text)]" ${dataAttr}>
${pad}  <input class="peer sr-only ${classes}" type="checkbox" id="${id}" ${name} ${checked}>
${pad}  <span class="relative h-6 w-11 rounded-full bg-gray-300 transition peer-checked:bg-[var(--theme-primary)] after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5"></span>
${pad}  <span>${label}</span>
${pad}</label>`
      }

      return `${pad}<label class="mb-4 ${inline ? 'inline-flex' : 'flex'} items-center gap-3 text-[var(--theme-text)]" ${dataAttr}>
${pad}  <input class="${classes}" type="checkbox" id="${id}" ${name} ${checked}>
${pad}  <span>${label}</span>
${pad}</label>`
    }

    const wrapperClasses = dedupeClasses(['form-check', switchMode ? 'form-switch' : '', inline ? 'form-check-inline' : '']).join(' ')
    return `${pad}<div class="${wrapperClasses}" ${dataAttr}>
${pad}  <input class="${classes}" type="checkbox" id="${id}" ${name} ${checked}>
${pad}  <label class="form-check-label" for="${id}">
${pad}    ${label}
${pad}  </label>
${pad}</div>`
  }

  // Special handling for Hero with background image/video/overlay
  if (block.type === 'hero') {
    const bgImage = String(block.props.bgImage ?? '').trim()
    const bgVideo = String(block.props.bgVideo ?? '').trim()
    const overlay = toBoolean(block.props.overlay, false)
    const overlayColor = String(block.props.overlayColor ?? '#000000').trim() || '#000000'
    const overlayOpacity = Math.max(0, Math.min(100, Number(block.props.overlayOpacity) || 50))
    const alignment = String(block.props.alignment ?? 'center').trim()
    const fullHeight = toBoolean(block.props.fullHeight, false)
    const ctaButtons = (block.props.ctaButtons as Array<{ label: string; href: string; variant: string }>) ?? []
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}" data-block-type="hero"` : ''

    const hasBgMedia = !!(bgImage || bgVideo)
    if (!hasBgMedia && !overlay && !fullHeight && ctaButtons.length === 0 && alignment === 'center') {
      // No special rendering needed — fall through to generic
    } else {
      const childrenHtml = (block.children || []).map((child) => renderBlock(child, indent + 1, indentSize, includeDataAttributes, includeEditorMetadata, pages, folders, framework, fullWidthFormControls)).join('\n')
      const classes = resolveFrameworkClasses(block, framework, { fullWidthFormControls })
      const styleStr = stylesToString(block.styles)
      const styleAttrs: string[] = []

      if (bgImage && !bgVideo) styleAttrs.push(`background-image: url('${escapeAttrValue(bgImage)}'); background-size: cover; background-position: center;`)
      if (fullHeight) styleAttrs.push('min-height: 100vh;')
      if (styleStr) styleAttrs.push(styleStr)

      const alignClass = alignment === 'left' ? (framework === 'tailwind' ? 'text-left' : 'text-start') : alignment === 'right' ? (framework === 'tailwind' ? 'text-right' : 'text-end') : 'text-center'
      const fullHeightClass = fullHeight ? (framework === 'tailwind' ? 'min-h-screen flex flex-col justify-center' : 'd-flex flex-column justify-content-center min-vh-100') : ''
      const allClasses = dedupeClasses([...classes, alignClass, fullHeightClass]).filter(Boolean).join(' ')

      const overlayMarkup = overlay
        ? framework === 'tailwind'
          ? `${pad}  <div class="absolute inset-0" style="background-color: ${escapeAttrValue(overlayColor)}; opacity: ${overlayOpacity / 100};"></div>`
          : `${pad}  <div class="position-absolute top-0 start-0 w-100 h-100" style="background-color: ${escapeAttrValue(overlayColor)}; opacity: ${overlayOpacity / 100}; z-index: 0;"></div>`
        : ''

      const videoMarkup = bgVideo
        ? `${pad}  <video class="${framework === 'tailwind' ? 'absolute inset-0 h-full w-full object-cover' : 'position-absolute top-0 start-0 w-100 h-100 object-fit-cover'}" autoplay muted loop playsinline src="${escapeAttrValue(bgVideo)}"></video>`
        : ''

      const positionClass = hasBgMedia || overlay ? (framework === 'tailwind' ? 'relative overflow-hidden' : 'position-relative overflow-hidden') : ''
      const contentClass = hasBgMedia || overlay ? (framework === 'tailwind' ? 'relative z-10' : 'position-relative') : ''

      const ctaHtml = ctaButtons.length > 0
        ? `${pad}  <div class="${framework === 'tailwind' ? 'mt-6 flex flex-wrap gap-3 justify-center' : 'mt-4 d-flex flex-wrap gap-2 justify-content-center'}">
${ctaButtons.map((btn) => {
  const btnVariant = String(btn.variant ?? 'primary').trim() || 'primary'
  const btnClass = framework === 'tailwind'
    ? dedupeClasses([`btn-${btnVariant}`].flatMap(c => mapBootstrapClassToTailwind(c))).join(' ') || 'inline-flex items-center px-4 py-2 rounded-md'
    : `btn btn-${btnVariant}`
  return `${pad}    <a href="${escapeAttrValue(btn.href || '#')}" class="${btnClass}">${escapeAttrValue(btn.label || 'CTA')}</a>`
}).join('\n')}
${pad}  </div>`
        : ''

      const rootClasses = dedupeClasses([...allClasses.split(' '), positionClass]).filter(Boolean).join(' ')
      const styleAttr = styleAttrs.length > 0 ? ` style="${styleAttrs.join(' ')}"` : ''

      return `${pad}<div class="${rootClasses}"${styleAttr} ${dataAttr}>
${videoMarkup}
${overlayMarkup}
${contentClass ? `${pad}  <div class="${contentClass}">` : ''}
${childrenHtml}
${ctaHtml}
${contentClass ? `${pad}  </div>` : ''}
${pad}</div>`
    }
  }

  // Special handling for Footer with columns/social/copyright
  if (block.type === 'footer') {
    const footerColumns = Number(block.props.columns) || 1
    const showSocialLinks = toBoolean(block.props.showSocialLinks, false)
    const socialLinks = (block.props.socialLinks as Array<{ platform: string; url: string }>) ?? []
    const copyrightText = String(block.props.copyrightText ?? '').trim()
    const showBackToTop = toBoolean(block.props.showBackToTop, false)
    const hasEnhancements = footerColumns > 1 || showSocialLinks || !!copyrightText || showBackToTop

    if (hasEnhancements) {
      const dataAttr = includeDataAttributes ? `data-block-id="${block.id}" data-block-type="footer"` : ''
      const childrenHtml = (block.children || []).map((child) => renderBlock(child, indent + 1, indentSize, includeDataAttributes, includeEditorMetadata, pages, folders, framework, fullWidthFormControls)).join('\n')
      const classes = resolveFrameworkClasses(block, framework, { fullWidthFormControls })
      const styleStr = stylesToString(block.styles)
      const styleAttr = styleStr ? ` style="${styleStr}"` : ''

      const socialHtml = showSocialLinks && socialLinks.length > 0
        ? `${pad}  <div class="${framework === 'tailwind' ? 'flex gap-4 mt-4' : 'd-flex gap-3 mt-3'}">
${socialLinks.map((sl) => {
  return `${pad}    <a href="${escapeAttrValue(sl.url || '#')}" class="${framework === 'tailwind' ? 'text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]' : 'text-muted'}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttrValue(sl.platform || 'Social link')}">${renderSocialPlatformIcon(sl.platform)}</a>`
}).join('\n')}
${pad}  </div>`
        : ''

      const copyrightHtml = copyrightText
        ? `${pad}  <div class="${framework === 'tailwind' ? 'mt-4 border-t border-[var(--theme-border)] pt-4 text-sm text-[var(--theme-text-muted)]' : 'mt-3 pt-3 border-top small text-muted'}">${escapeAttrValue(copyrightText)}</div>`
        : ''

      const backToTopHtml = showBackToTop
        ? `${pad}  <div class="${framework === 'tailwind' ? 'mt-4 text-right' : 'mt-3 text-end'}"><a href="#" class="${framework === 'tailwind' ? 'text-sm text-[var(--theme-text-muted)] hover:text-[var(--theme-text)]' : 'text-muted small'}" onclick="window.scrollTo({top:0,behavior:'smooth'});return false;">↑ Back to top</a></div>`
        : ''

      return `${pad}<footer class="${classes.join(' ')}"${styleAttr} ${dataAttr}>
${childrenHtml}
${socialHtml}
${copyrightHtml}
${backToTopHtml}
${pad}</footer>`
    }
  }

  // Special handling for Navbar with pages datasource
  if (block.type === 'navbar' && block.props.usePages && pages && pages.length > 0) {
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}" data-block-type="navbar"` : ''
    const classesArray = normalizeNavbarThemeClasses([...block.classes, ...getPropDrivenClasses(block)])
    const classes = classesArray.join(' ')
    const styleStr = stylesToString(getEffectiveStyles(block))
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
    const label = String(block.props.label ?? '').trim()
    const id = sanitizeElementId(String(block.props.id || block.id), block.id)
    const dataAttr = includeDataAttributes ? `data-block-id="${block.id}" data-block-type="${block.type}"` : ''
    const tag = block.type
    const baseClasses = resolveFrameworkClasses(block, framework, { fullWidthFormControls })
      .filter((cls) => !['is-valid', 'is-invalid'].includes(cls))
    const validationState = String(block.props.validationState ?? 'none').trim()
    const validationClass = validationState === 'valid' ? 'is-valid' : validationState === 'invalid' ? 'is-invalid' : ''
    const classes = dedupeClasses([...baseClasses, validationClass]).join(' ')

    const attrs: string[] = []
    attrs.push(`class="${classes}"`)
    attrs.push(`id="${id}"`)

    const styleStr = stylesToString(block.styles)
    if (styleStr) attrs.push(`style="${styleStr}"`)

    const skipKeys = new Set([
      'label',
      'options',
      'items',
      'prepend',
      'append',
      'floatingLabel',
      'validationState',
      'validationMessage',
      'helpText',
      'optgroups'
    ])

    for (const [key, value] of Object.entries(block.props)) {
      if (value === undefined || value === null || value === false) continue
      if (skipKeys.has(key)) continue
      if (tag !== 'select' && (key === 'multiple' || key === 'size')) continue
      if (tag === 'select' && key === 'size' && !toBoolean(block.props.multiple, false)) continue
      if (tag !== 'input' && (key === 'type' || key === 'value')) continue

      if (value === true) {
        attrs.push(escapeAttrName(key))
      } else {
        attrs.push(`${escapeAttrName(key)}="${escapeAttrValue(String(value))}"`)
      }
    }

    const attrString = attrs.join(' ')
    const prepend = String(block.props.prepend ?? '').trim()
    const append = String(block.props.append ?? '').trim()
    const floatingLabel = toBoolean(block.props.floatingLabel, false) && !!label
    const validationMessage = String(block.props.validationMessage ?? '').trim()
    const helpText = String(block.props.helpText ?? '').trim()

    let inner = ''
    if (tag === 'input') {
      inner = `<input ${attrString}>`
    } else if (tag === 'textarea') {
      const val = block.props.value ?? ''
      inner = `<textarea ${attrString}>${escapeAttrValue(String(val))}</textarea>`
    } else if (tag === 'select') {
      const optgroups = toBoolean(block.props.optgroups, false)
      const flatOptions = normalizeFlatSelectOptions(block.props.options)
      const groupedOptions = normalizeSelectGroups(block.props.items)
      const optionsHtml = optgroups && groupedOptions.length > 0
        ? groupedOptions.map((group) => {
          const childOptions = group.options
            .map((option) => `<option value="${escapeAttrValue(option.value)}">${escapeAttrValue(option.label)}</option>`)
            .join('')
          return `<optgroup label="${escapeAttrValue(group.group)}">${childOptions}</optgroup>`
        }).join('')
        : flatOptions.map((option) => `<option value="${escapeAttrValue(option.value)}">${escapeAttrValue(option.label)}</option>`).join('')
      const optsHtml = optionsHtml || '<option value="">Option</option>'
      inner = `<select ${attrString}>${optsHtml}</select>`
    }

    const withInputGroup = tag === 'input' && (!!prepend || !!append)
    if (withInputGroup) {
      if (framework === 'tailwind') {
        const groupClasses = dedupeClasses(['flex', 'w-full', 'items-stretch']).join(' ')
        inner = `${prepend ? `<span class="inline-flex items-center rounded-l-md border border-r-0 border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 text-sm text-[var(--theme-text-muted)]">${escapeAttrValue(prepend)}</span>` : ''}${inner}${append ? `<span class="inline-flex items-center rounded-r-md border border-l-0 border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 text-sm text-[var(--theme-text-muted)]">${escapeAttrValue(append)}</span>` : ''}`
        inner = `<div class="${groupClasses}">${inner}</div>`
      } else {
        inner = `<div class="input-group">${prepend ? `<span class="input-group-text">${escapeAttrValue(prepend)}</span>` : ''}${inner}${append ? `<span class="input-group-text">${escapeAttrValue(append)}</span>` : ''}</div>`
      }
    }

    let controlSection = inner
    if (floatingLabel && tag === 'input') {
      if (framework === 'tailwind') {
        controlSection = `<div class="relative">${inner}<label for="${id}" class="pointer-events-none absolute start-3 top-2 text-xs text-[var(--theme-text-muted)]">${escapeAttrValue(label)}</label></div>`
      } else {
        controlSection = `<div class="form-floating">${inner}<label for="${id}">${escapeAttrValue(label)}</label></div>`
      }
    } else if (label) {
      controlSection = `${framework === 'tailwind'
        ? `<label for="${id}" class="mb-2 block text-sm font-medium text-[var(--theme-text)]">${escapeAttrValue(label)}</label>`
        : `<label for="${id}" class="form-label">${escapeAttrValue(label)}</label>`}
${controlSection}`
    }

    const feedbackMarkup = validationMessage && validationState !== 'none'
      ? framework === 'tailwind'
        ? `<div class="mt-1 text-sm ${validationState === 'valid' ? 'text-green-600' : 'text-red-600'}">${escapeAttrValue(validationMessage)}</div>`
        : `<div class="${validationState === 'valid' ? 'valid-feedback d-block' : 'invalid-feedback d-block'}">${escapeAttrValue(validationMessage)}</div>`
      : ''
    const helpMarkup = helpText
      ? framework === 'tailwind'
        ? `<div class="mt-1 text-sm text-[var(--theme-text-muted)]">${escapeAttrValue(helpText)}</div>`
        : `<div class="form-text">${escapeAttrValue(helpText)}</div>`
      : ''
    const wrapperClass = framework === 'tailwind' ? 'mb-4' : 'mb-3'

    if (label || includeDataAttributes || helpMarkup || feedbackMarkup || withInputGroup || floatingLabel) {
      return `${pad}<div class="${wrapperClass}" ${dataAttr}>
${pad}  ${controlSection}
${feedbackMarkup ? `${pad}  ${feedbackMarkup}` : ''}
${helpMarkup ? `${pad}  ${helpMarkup}` : ''}
${pad}</div>`
    }

    return `${pad}${controlSection}`
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
    const classes = stripLegacyBootstrapIconClasses(
      resolveFrameworkClasses(block, framework, { fullWidthFormControls })
    )

    const styles = { ...block.styles }
    const rawSize = String(block.props.size ?? '').trim()
    if (rawSize && !['xs', 'sm', 'md', 'lg', 'xl', '2xl'].includes(rawSize) && !styles.fontSize) {
      styles.fontSize = rawSize
    }
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
      eventAttr,
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
      eventAttr,
      includeEditorMetadata ? 'data-amagon-component="icon"' : '',
      includeEditorMetadata ? `data-amagon-icon-class="${escapeAttrValue(rawIconValue)}"` : ''
    ].filter(Boolean).join(' ')

    return `${pad}<span ${placeholderAttrs}>☆</span>`
  }

  // Special handling for Heading with anchorId and decorative
  if (block.type === 'heading') {
    const anchorId = String(block.props.anchorId ?? '').trim()
    const decorative = String(block.props.decorative ?? 'none').trim()
    const tag = `h${Math.max(1, Math.min(6, Number(block.props.level) || 2))}`
    const text = escapeAttrValue(String(block.props.text ?? ''))
    const classes = resolveFrameworkClasses(block, framework, { fullWidthFormControls })
    if (decorative === 'underline') classes.push('amagon-heading-underline')
    else if (decorative === 'gradient-underline') classes.push('amagon-heading-gradient-underline')
    const classAttr = classes.length > 0 ? ` class="${dedupeClasses(classes).join(' ')}"` : ''
    const elementId = anchorId || block.id
    const styleStr = stylesToString(block.styles)
    const styleAttr = styleStr ? ` style="${styleStr}"` : ''
    const attrStr = propsToAttributes(tag, block.type, block.props)
    const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="heading"` : ''
    return `${pad}<${tag} id="${sanitizeElementId(elementId, block.id)}"${classAttr}${styleAttr}${attrStr ? ` ${attrStr}` : ''}${dataAttr}>${text}</${tag}>`
  }

  // Special handling for Paragraph with dropCap and columns
  if (block.type === 'paragraph') {
    const dropCap = toBoolean(block.props.dropCap, false)
    const columns = String(block.props.columns ?? '1').trim()
    const hasExtras = dropCap || columns !== '1'
    if (hasExtras) {
      const text = escapeAttrValue(String(block.props.text ?? ''))
      const classes = resolveFrameworkClasses(block, framework, { fullWidthFormControls })
      const classAttr = classes.length > 0 ? ` class="${dedupeClasses(classes).join(' ')}"` : ''
      const styles: Record<string, string> = { ...block.styles }
      if (columns === '2') styles.columnCount = '2'
      else if (columns === '3') styles.columnCount = '3'
      if (dropCap) styles['--drop-cap'] = '1'
      const styleStr = stylesToString(styles)
      const styleAttr = styleStr ? ` style="${styleStr}"` : ''
      const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="paragraph"` : ''
      const dropCapStyle = dropCap ? ' data-drop-cap="true"' : ''
      return `${pad}<p${classAttr}${styleAttr}${dataAttr}${dropCapStyle}>${text}</p>`
    }
  }

  // Special handling for Container with background
  if (block.type === 'container' && !block.props.isForm && !block.props.section) {
    const bgColor = String(block.props.bgColor ?? '').trim()
    const bgImage = String(block.props.bgImage ?? '').trim()
    const bgOverlay = String(block.props.bgOverlay ?? '').trim()
    if (bgColor || bgImage || bgOverlay) {
      const tag = resolveTag(block)
      const classes = resolveFrameworkClasses(block, framework, { fullWidthFormControls })
      const classAttr = classes.length > 0 ? ` class="${dedupeClasses(classes).join(' ')}"` : ''
      const styles: Record<string, string> = { ...block.styles }
      if (bgColor) styles.backgroundColor = bgColor
      if (bgImage) {
        styles.backgroundImage = `url('${bgImage}')`
        styles.backgroundSize = styles.backgroundSize || 'cover'
        styles.backgroundPosition = styles.backgroundPosition || 'center'
      }
      const styleStr = stylesToString(styles)
      const styleAttr = styleStr ? ` style="${styleStr}"` : ''
      const attrStr = propsToAttributes(tag, block.type, block.props)
      const dataAttr = includeDataAttributes ? ` data-block-id="${block.id}" data-block-type="container"` : ''
      const elementId = String(block.props.id || block.id)
      const childrenHtml = block.children.map((child) => renderBlock(child, indent + 1, indentSize, includeDataAttributes, includeEditorMetadata, pages, folders, framework, fullWidthFormControls)).join('\n')

      const overlayHtml = bgOverlay
        ? framework === 'tailwind'
          ? `\n${pad}  <div class="absolute inset-0" style="background-color: ${escapeAttrValue(bgOverlay)}; opacity: 0.5; pointer-events: none;"></div>`
          : `\n${pad}  <div class="position-absolute top-0 start-0 w-100 h-100" style="background-color: ${escapeAttrValue(bgOverlay)}; opacity: 0.5; pointer-events: none; z-index: 0;"></div>`
        : ''

      const posClass = bgOverlay ? (framework === 'tailwind' ? ' relative overflow-hidden' : ' position-relative overflow-hidden') : ''
      const finalClasses = bgOverlay ? dedupeClasses([...classes, posClass.trim()]).join(' ') : classes.join(' ')
      const finalClassAttr = finalClasses ? ` class="${finalClasses}"` : ''

      return `${pad}<${tag} id="${sanitizeElementId(elementId, block.id)}"${finalClassAttr}${styleAttr}${attrStr ? ` ${attrStr}` : ''}${dataAttr}>${overlayHtml}
${childrenHtml}
${pad}</${tag}>`
    }
  }

  const tag = resolveTag(block)
  const isVoid = VOID_ELEMENTS.has(tag)
  const isExportMode = !includeDataAttributes
  const textContent = getBlockContent(block, isExportMode, framework, includeEditorMetadata)
  const hasChildren = block.children.length > 0
  const hasContent = textContent.length > 0

  // Build attribute string
  const parts: string[] = []

  // Inline styles
  const styleStr = stylesToString(getEffectiveStyles(block))

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

  parts.push(`id="${sanitizeElementId(String(block.props.id || block.id), block.id)}"`)

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
  let renderedHtml = lines.join('\n')

  // Non-pages navbar rendering is generic; inject brand image/text into brand anchor when provided.
  if (block.type === 'navbar' && !(block.props.usePages && pages && pages.length > 0)) {
    const brandImage = String(block.props.brandImage || '').trim()
    if (brandImage) {
      const brandText = escapeAttrValue(String(block.props.brandText || 'Brand'))
      const replacementInner = framework === 'tailwind'
        ? `<img src="${escapeAttrValue(brandImage)}" alt="${brandText}" class="h-8 w-auto">${brandText}`
        : `<img src="${escapeAttrValue(brandImage)}" alt="${brandText}" height="30" class="d-inline-block align-text-top me-2">${brandText}`

      const bootstrapBrandPattern = /(<a\b[^>]*class="[^"]*\bnavbar-brand\b[^"]*"[^>]*>)([\s\S]*?)(<\/a>)/
      const tailwindBrandPattern = /(<a\b[^>]*class="[^"]*\btext-lg\b[^"]*\bfont-semibold\b[^"]*\bno-underline\b[^"]*"[^>]*>)([\s\S]*?)(<\/a>)/
      const before = renderedHtml
      renderedHtml = renderedHtml.replace(bootstrapBrandPattern, `$1${replacementInner}$3`)
      if (renderedHtml === before) {
        renderedHtml = renderedHtml.replace(tailwindBrandPattern, `$1${replacementInner}$3`)
      }
    }
  }

  return renderedHtml
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
