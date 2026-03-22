import type { Block } from '../store/types'
import { generateBlockId } from '../store/types'
import { parse } from 'parse5'
import { isRenderableGlyph } from './iconCatalog'

// ─── Tag → Block Type Mapping ────────────────────────────────────────────────

const TAG_TO_TYPE: Record<string, string> = {
  'h1': 'heading',
  'h2': 'heading',
  'h3': 'heading',
  'h4': 'heading',
  'h5': 'heading',
  'h6': 'heading',
  'p': 'paragraph',
  'img': 'image',
  'a': 'link',
  'button': 'button',
  'section': 'section',
  'nav': 'navbar',
  'footer': 'footer',
  'header': 'header',
  'article': 'article',
  'aside': 'aside',
  'blockquote': 'blockquote',
  'ul': 'list',
  'ol': 'list',
  'li': 'list-item',
  'form': 'form',
  'input': 'input',
  'textarea': 'textarea',
  'select': 'select',
  'video': 'video',
  'hr': 'hr',
  'br': 'br',
  'span': 'span',
  'div': 'container'
}

// Tags that store their text content as a `text` prop
const TEXT_CONTENT_TYPES = new Set([
  'heading', 'paragraph', 'button', 'link', 'blockquote', 'span'
])

// Attributes to skip (handled specially)
const SKIP_ATTRS = new Set([
  'class',
  'style',
  'data-block-id',
  'data-block-type',
  'data-amagon-component',
  'data-amagon-icon-class'
])

// ─── Parse result ────────────────────────────────────────────────────────────

export interface ParseResult {
  blocks: Block[]
  diagnostics: HtmlDiagnostic[]
}

export type HtmlDiagnosticSeverity = 'error' | 'warning'

export interface HtmlDiagnostic {
  message: string
  severity: HtmlDiagnosticSeverity
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
  code?: string
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function htmlToBlocks(html: string): ParseResult {
  const diagnostics: HtmlDiagnostic[] = []

  try {
    parse(html, {
      onParseError: (err: unknown) => {
        const e = err as {
          code?: string
          startLine?: number
          startCol?: number
          endLine?: number
          endCol?: number
        }

        const code = e.code
        if (code === 'missing-doctype') return
        const severity: HtmlDiagnosticSeverity =
          code && (code.includes('eof') || code.includes('missing') || code.includes('duplicate') || code.includes('unexpected'))
            ? 'warning'
            : 'error'

        diagnostics.push({
          message: code ? `HTML parse ${severity}: ${code}` : 'HTML parse error',
          severity,
          startLineNumber: e.startLine ?? 1,
          startColumn: e.startCol ?? 1,
          endLineNumber: e.endLine ?? e.startLine ?? 1,
          endColumn: e.endCol ?? (e.startCol ?? 1),
          code
        })
      }
    } as unknown as Record<string, unknown>)
  } catch {
    diagnostics.push({
      message: 'Fatal parse error',
      severity: 'error',
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1
    })
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Check for parser errors
    // Parse from body children (ignoring doctype, head, etc.)
    const body = doc.body
    if (!body) {
      return {
        blocks: [],
        diagnostics: [
          {
            message: 'No body element found',
            severity: 'error',
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1
          }
        ]
      }
    }

    const blocks = parseChildren(body)
    return { blocks, diagnostics }
  } catch (error) {
    return {
      blocks: [],
      diagnostics: [
        {
          message: `Fatal parse error: ${String(error)}`,
          severity: 'error',
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1
        }
      ]
    }
  }
}

// ─── Parse a full HTML document, extracting body blocks ──────────────────────

export function htmlDocumentToBlocks(html: string): ParseResult {
  return htmlToBlocks(html)
}

// ─── Recursive child parser ──────────────────────────────────────────────────

function parseChildren(parent: Element): Block[] {
  const blocks: Block[] = []
  const nodes = Array.from(parent.childNodes)

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]

    const modalParse = tryParseBootstrapModal(nodes, i)
    if (modalParse) {
      blocks.push(modalParse.block)
      i = modalParse.nextIndex
      continue
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const block = elementToBlock(node as Element)
      if (block) {
        blocks.push(block)
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) {
        // Wrap orphan text in a paragraph block
        blocks.push({
          id: generateBlockId(),
          type: 'paragraph',
          tag: 'p',
          props: { text },
          styles: {},
          classes: [],
          children: []
        })
      }
    }
  }

  return blocks
}

// ─── Convert a single element to a Block ─────────────────────────────────────

function elementToBlock(el: Element): Block | null {
  const tagName = el.tagName.toLowerCase()

  // Skip script and style tags
  if (tagName === 'script' || tagName === 'style' || tagName === 'link' || tagName === 'meta') {
    return null
  }

  const blockType = el.getAttribute('data-block-type')

  const hasBootstrapTabsStructure =
    !!el.querySelector(':scope > ul.nav.nav-tabs') &&
    !!el.querySelector(':scope > div.tab-content')
  if (blockType === 'tabs' || el.hasAttribute('data-tw-tabs') || hasBootstrapTabsStructure) {
    if (el.hasAttribute('data-tw-tabs')) {
      return parseTailwindTabs(el, String(el.getAttribute('data-tw-tabs') || '').trim())
    }
    return parseBootstrapTabs(el)
  }

  const hasBootstrapAccordionStructure =
    el.classList.contains('accordion') &&
    !!el.querySelector(':scope > .accordion-item, .accordion-item')
  if (blockType === 'accordion' || hasBootstrapAccordionStructure) {
    return parseBootstrapAccordion(el)
  }

  const hasBootstrapCheckboxStructure =
    tagName === 'div' &&
    el.classList.contains('form-check') &&
    !!el.querySelector(':scope > input[type="checkbox"], input[type="checkbox"]')
  if (hasBootstrapCheckboxStructure) {
    return parseBootstrapCheckbox(el)
  }

  const hasWrappedFormControlStructure =
    tagName === 'div' &&
    !el.classList.contains('form-check') &&
    hasWrappedFormControl(el)
  if (hasWrappedFormControlStructure) {
    return parseWrappedFormControl(el)
  }

  const hasBootstrapCarouselStructure =
    tagName === 'div' &&
    (el.classList.contains('carousel') || el.hasAttribute('data-tw-carousel')) &&
    !!el.querySelector(':scope > .carousel-inner, .carousel-inner, [data-tw-carousel-slide]')
  if (hasBootstrapCarouselStructure) {
    return parseCarouselBlock(el)
  }

  const isEditorIcon =
    blockType === 'icon' ||
    el.getAttribute('data-amagon-component') === 'icon'
  const hasIconPlaceholderStructure =
    tagName === 'span' &&
    el.getAttribute('title') === 'No icon selected' &&
    el.textContent?.trim() === '☆'
  const hasSvgIconStructure =
    tagName === 'span' &&
    el.children.length === 1 &&
    el.firstElementChild?.tagName.toLowerCase() === 'svg' &&
    el.getAttribute('style')?.includes('display: inline-flex')
  const hasLegacyBootstrapIconStructure =
    (tagName === 'span' || tagName === 'i') &&
    Array.from(el.classList).some((cls) => cls === 'bi' || /^bi-/i.test(cls))
  const hasGlyphIconStructure =
    tagName === 'span' &&
    el.children.length === 0 &&
    isRenderableGlyph(el.textContent?.trim() || '') &&
    el.getAttribute('style')?.includes('display: inline-flex')
  if (isEditorIcon || hasIconPlaceholderStructure || hasSvgIconStructure || hasLegacyBootstrapIconStructure || hasGlyphIconStructure) {
    return parseIconBlock(el)
  }

  const type = TAG_TO_TYPE[tagName] ?? 'container'

  // Extract existing block ID or generate new one
  const existingId = el.getAttribute('data-block-id')
  const id = existingId || generateBlockId()

  // Extract classes
  const classes = el.className
    ? el.className.split(/\s+/).filter((c) => c.length > 0)
    : []

  // Extract inline styles
  const styles = parseInlineStyles(el)

  // Extract props (attributes)
  const props = parseAttributes(el, tagName, type)

  // For text-content types, extract innerHTML as text prop if no block-level children
  const isTextType = TEXT_CONTENT_TYPES.has(type)
  let children: Block[] = []

  if (isTextType) {
    const innerHTML = el.innerHTML
    if (!containsBlockElements(innerHTML)) {
      // Simple inline content → store as text prop, no child blocks
      props.text = innerHTML
    } else {
      // Contains block elements → parse as children
      children = parseChildren(el)
    }
  } else {
    children = parseChildren(el)
  }

  // Special handling for heading level
  if (type === 'heading') {
    const level = parseInt(tagName.charAt(1), 10)
    props.level = level
  }

  // Special handling for list items
  if (type === 'list') {
    const items: string[] = []
    for (const child of Array.from(el.children)) {
      if (child.tagName.toLowerCase() === 'li') {
        items.push(child.innerHTML)
      }
    }
    if (items.length > 0) {
      props.items = items
      props.ordered = tagName === 'ol'
    }
  }

  const block: Block = {
    id,
    type,
    tag: tagName !== defaultTagForType(type) ? tagName : undefined,
    props,
    styles,
    classes,
    children: TEXT_CONTENT_TYPES.has(type) ? [] : children
  }

  return block
}

function parseBootstrapCheckbox(el: Element): Block {
  const input =
    el.querySelector(':scope > input[type="checkbox"]') ??
    el.querySelector('input[type="checkbox"]')
  const label =
    el.querySelector(':scope > label.form-check-label') ??
    el.querySelector('label.form-check-label') ??
    el.querySelector(':scope > label') ??
    el.querySelector('label')

  const inputClasses = input?.className
    ? input.className.split(/\s+/).filter((c) => c.length > 0)
    : []
  const inputStyles = input ? parseInlineStyles(input) : {}
  const existingId =
    el.getAttribute('data-block-id') ||
    input?.getAttribute('data-block-id') ||
    input?.getAttribute('id')

  return {
    id: existingId || generateBlockId(),
    type: 'checkbox',
    props: {
      label: label?.textContent?.trim() || '',
      name: input?.getAttribute('name') || '',
      checked: input?.hasAttribute('checked') || false
    },
    styles: inputStyles,
    classes: inputClasses,
    children: []
  }
}

function hasWrappedFormControl(el: Element): boolean {
  const children = Array.from(el.children)
  const controls = children.filter((child) => isFormControlTag(child.tagName.toLowerCase()))
  if (controls.length !== 1) return false
  const control = controls[0]
  if (control.tagName.toLowerCase() === 'input' && control.getAttribute('type') === 'checkbox') {
    return false
  }

  return children.every((child) => {
    const tag = child.tagName.toLowerCase()
    return child === control || tag === 'label'
  })
}

function parseWrappedFormControl(el: Element): Block {
  const children = Array.from(el.children)
  const control = children.find((child) => isFormControlTag(child.tagName.toLowerCase()))

  if (!control) {
    return {
      id: el.getAttribute('data-block-id') || generateBlockId(),
      type: 'container',
      props: {},
      styles: parseInlineStyles(el),
      classes: el.className ? el.className.split(/\s+/).filter(Boolean) : [],
      children: parseChildren(el)
    }
  }

  return parseFormControlElement(control, children.find((child) => child.tagName.toLowerCase() === 'label'))
}

function parseCarouselBlock(el: Element): Block {
  if (el.hasAttribute('data-tw-carousel')) {
    return parseTailwindCarousel(el)
  }

  const id = el.getAttribute('data-block-id') || generateBlockId()
  const classes = el.className ? el.className.split(/\s+/).filter(Boolean) : []
  const styles = parseInlineStyles(el)
  const carouselId = el.id || String(el.getAttribute('data-bs-target') || '').replace(/^#/, '') || `carousel-${id}`
  const items = Array.from(el.querySelectorAll(':scope > .carousel-inner > .carousel-item, .carousel-inner > .carousel-item'))

  const slides = items.map((item, index) => {
    const img = item.querySelector('img')
    const caption = item.querySelector('.carousel-caption h5, .carousel-caption')
    return {
      src: img?.getAttribute('src') || '',
      alt: img?.getAttribute('alt') || `Slide ${index + 1}`,
      caption: caption?.textContent?.trim() || ''
    }
  })

  return {
    id,
    type: 'carousel',
    tag: el.tagName.toLowerCase() !== defaultTagForType('carousel') ? el.tagName.toLowerCase() : undefined,
    props: {
      id: carouselId,
      slides
    },
    styles,
    classes,
    children: []
  }
}

function parseTailwindCarousel(el: Element): Block {
  const id = el.getAttribute('data-block-id') || generateBlockId()
  const classes = el.className ? el.className.split(/\s+/).filter(Boolean) : []
  const styles = parseInlineStyles(el)
  const carouselId = el.getAttribute('data-tw-carousel') || el.id || `carousel-${id}`
  const slides = Array.from(el.querySelectorAll('[data-tw-carousel-slide]')).map((slide, index) => {
    const img = slide.querySelector('img')
    const caption = slide.querySelector('div')
    return {
      src: img?.getAttribute('src') || '',
      alt: img?.getAttribute('alt') || `Slide ${index + 1}`,
      caption: caption?.textContent?.trim() || ''
    }
  })

  return {
    id,
    type: 'carousel',
    tag: el.tagName.toLowerCase() !== defaultTagForType('carousel') ? el.tagName.toLowerCase() : undefined,
    props: {
      id: carouselId,
      slides
    },
    styles,
    classes,
    children: []
  }
}

function parseIconBlock(el: Element): Block {
  const styles = parseInlineStyles(el)
  const classes = el.className
    ? el.className.split(/\s+/).filter((c) => c.length > 0)
    : []
  const textContent = el.textContent?.trim() || ''
  const title = el.getAttribute('title') || ''
  const metadataIconClass = el.getAttribute('data-amagon-icon-class')
  const legacyBootstrapClass = classes.find((cls) => /^bi-/i.test(cls)) || (title.startsWith('bi-') ? title : '')

  const id = el.getAttribute('data-block-id') || generateBlockId()
  const props: Record<string, unknown> = {
    iconClass: metadataIconClass ?? (title === 'No icon selected' ? '' : legacyBootstrapClass || textContent || '')
  }

  if (styles.fontSize) {
    props.size = styles.fontSize
  }

  if (styles.color && !(title === 'No icon selected' && styles.color === '#6c757d')) {
    props.color = styles.color
  }

  const nextStyles = { ...styles }
  delete nextStyles.fontSize

  if (props.color === nextStyles.color) {
    delete nextStyles.color
  }

  delete nextStyles.display
  delete nextStyles.alignItems
  delete nextStyles.justifyContent
  delete nextStyles.lineHeight

  if (title === 'No icon selected') {
    delete nextStyles.minWidth
    delete nextStyles.minHeight
    delete nextStyles.border
    delete nextStyles.borderRadius
    if (styles.color === '#6c757d' && props.color === undefined) {
      delete nextStyles.color
    }
  }

  return {
    id,
    type: 'icon',
    props,
    styles: nextStyles,
    classes,
    children: []
  }
}

function parseBootstrapTabs(el: Element): Block {
  const id = el.getAttribute('data-block-id') || generateBlockId()
  const tagName = el.tagName.toLowerCase()
  const classes = el.className
    ? el.className.split(/\s+/).filter((c) => c.length > 0)
    : []
  const styles = parseInlineStyles(el)
  const ul = el.querySelector(':scope > ul.nav.nav-tabs') ?? el.querySelector('ul.nav.nav-tabs')
  const tabsId = ul?.id || el.id || `tabs-${id}`
  const navButtons = Array.from(
    (ul?.querySelectorAll(':scope > li.nav-item > button.nav-link, li.nav-item > button.nav-link') ?? [])
  )
  const contentContainer = el.querySelector(':scope > div.tab-content') ?? el.querySelector('div.tab-content')
  const panes = Array.from(contentContainer?.querySelectorAll(':scope > div.tab-pane, div.tab-pane') ?? [])
  const tabCount = Math.max(navButtons.length, panes.length)
  const defaultTab = navButtons.findIndex((btn) => btn.classList.contains('active'))
  const tabs = Array.from({ length: tabCount }, (_, i) => {
    const pane = panes[i]
    const paneBlocks = pane ? parseChildren(pane) : []
    const fallbackLabel = `Tab ${i + 1}`
    const label = navButtons[i]?.textContent?.trim() || fallbackLabel
    const content = pane?.textContent?.trim() || ''

    return {
      label,
      content,
      blocks: paneBlocks
    }
  })

  return {
    id,
    type: 'tabs',
    tag: tagName !== defaultTagForType('tabs') ? tagName : undefined,
    props: {
      id: tabsId,
      defaultTab: defaultTab >= 0 ? defaultTab : 0,
      tabs
    },
    styles,
    classes,
    children: []
  }
}

function parseTailwindTabs(el: Element, tabsIdInput: string): Block {
  const id = el.getAttribute('data-block-id') || generateBlockId()
  const tagName = el.tagName.toLowerCase()
  const classes = el.className
    ? el.className.split(/\s+/).filter((c) => c.length > 0)
    : []
  const styles = parseInlineStyles(el)
  const tabsId = tabsIdInput || el.id || `tabs-${id}`
  const navButtons = Array.from(el.querySelectorAll(`[data-tw-tab-button="${tabsId}"]`))
  const panels = Array.from(el.querySelectorAll('[data-tw-tab-panel]'))
  const tabCount = Math.max(navButtons.length, panels.length)
  const defaultTab = panels.findIndex((panel) => !panel.classList.contains('hidden'))
  const tabs = Array.from({ length: tabCount }, (_, i) => {
    const panel = panels[i]
    const panelBlocks = panel ? parseChildren(panel) : []
    const fallbackLabel = `Tab ${i + 1}`
    const label = navButtons[i]?.textContent?.trim() || fallbackLabel
    const content = panel?.textContent?.trim() || ''

    return {
      label,
      content,
      blocks: panelBlocks
    }
  })

  return {
    id,
    type: 'tabs',
    tag: tagName !== defaultTagForType('tabs') ? tagName : undefined,
    props: {
      id: tabsId,
      defaultTab: defaultTab >= 0 ? defaultTab : 0,
      tabs
    },
    styles,
    classes,
    children: []
  }
}

function parseBootstrapAccordion(el: Element): Block {
  const id = el.getAttribute('data-block-id') || generateBlockId()
  const tagName = el.tagName.toLowerCase()
  const classes = el.className
    ? el.className.split(/\s+/).filter((c) => c.length > 0)
    : []
  const styles = parseInlineStyles(el)
  const accordionId = el.id || `accordion-${id}`
  const itemEls = Array.from(el.querySelectorAll(':scope > .accordion-item, .accordion-item'))
  const items = itemEls.map((item, i) => {
    const title = item.querySelector('.accordion-button')?.textContent?.trim() || `Item ${i + 1}`
    const content = item.querySelector('.accordion-body')?.textContent?.trim() || ''
    return { title, content }
  })

  return {
    id,
    type: 'accordion',
    tag: tagName !== defaultTagForType('accordion') ? tagName : undefined,
    props: {
      id: accordionId,
      items
    },
    styles,
    classes,
    children: []
  }
}

function tryParseBootstrapModal(nodes: ChildNode[], index: number): { block: Block, nextIndex: number } | null {
  const triggerNode = nodes[index]
  if (!isElementNode(triggerNode)) return null

  const triggerEl = triggerNode as Element
  if (triggerEl.tagName.toLowerCase() !== 'button') return null
  if (triggerEl.getAttribute('data-bs-toggle') !== 'modal') return null

  const target = String(triggerEl.getAttribute('data-bs-target') || '').trim()
  if (!target.startsWith('#')) return null

  let nextIndex = index + 1
  while (nextIndex < nodes.length) {
    const nextNode = nodes[nextIndex]
    if (nextNode.nodeType === Node.TEXT_NODE && !(nextNode.textContent || '').trim()) {
      nextIndex += 1
      continue
    }
    if (nextNode.nodeType === Node.COMMENT_NODE) {
      nextIndex += 1
      continue
    }
    if (!isElementNode(nextNode)) return null

    const modalEl = nextNode as Element
    if (
      modalEl.tagName.toLowerCase() === 'div' &&
      modalEl.classList.contains('modal') &&
      modalEl.id === target.slice(1)
    ) {
      return {
        block: parseBootstrapModal(triggerEl, modalEl),
        nextIndex
      }
    }

    return null
  }

  return null
}

function parseBootstrapModal(triggerEl: Element, modalEl: Element): Block {
  const id = modalEl.getAttribute('data-block-id') || generateBlockId()
  const styles = parseInlineStyles(modalEl)
  const classes = modalEl.className ? modalEl.className.split(/\s+/).filter(Boolean) : []
  const titleEl = modalEl.querySelector('.modal-title')
  const bodyEl = modalEl.querySelector('.modal-body')
  const dialogEl = modalEl.querySelector('.modal-dialog')
  const closeButton = !!modalEl.querySelector('.btn-close')
  const footerButtons = !!modalEl.querySelector('.modal-footer')
  const sizeClass = Array.from(dialogEl?.classList || []).find((cls) => /^modal-(sm|lg|xl)$/.test(cls)) || 'default'

  return {
    id,
    type: 'modal',
    props: {
      id: modalEl.id || '',
      buttonText: triggerEl.textContent?.trim() || 'Launch Modal',
      title: titleEl?.textContent?.trim() || 'Modal Title',
      closeButton,
      footerButtons,
      size: sizeClass
    },
    styles,
    classes,
    children: bodyEl ? parseChildren(bodyEl) : []
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseFormControlElement(control: Element, label?: Element): Block {
  const tagName = control.tagName.toLowerCase()
  const type = TAG_TO_TYPE[tagName] ?? tagName
  const props = parseAttributes(control, tagName, type)
  const styles = parseInlineStyles(control)
  const classes = control.className ? control.className.split(/\s+/).filter(Boolean) : []
  const id = control.getAttribute('data-block-id') || control.getAttribute('id') || generateBlockId()

  if (label?.textContent?.trim()) {
    props.label = label.textContent.trim()
  }

  delete props.id

  if (tagName === 'textarea') {
    props.value = control.textContent || ''
  }

  if (tagName === 'select') {
    props.options = Array.from(control.querySelectorAll(':scope > option')).map((option) => option.textContent?.trim() || option.getAttribute('value') || '')
  }

  return {
    id,
    type,
    props,
    styles,
    classes,
    children: []
  }
}

function isFormControlTag(tagName: string): boolean {
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

function isElementNode(node: ChildNode): node is Element {
  return node.nodeType === Node.ELEMENT_NODE
}

function parseInlineStyles(el: Element): Record<string, string> {
  const styles: Record<string, string> = {}
  const styleAttr = el.getAttribute('style')
  if (!styleAttr) return styles

  const parts = styleAttr.split(';').map((s) => s.trim()).filter(Boolean)
  for (const part of parts) {
    const colonIdx = part.indexOf(':')
    if (colonIdx === -1) continue
    const key = part.slice(0, colonIdx).trim()
    const value = part.slice(colonIdx + 1).trim()
    if (key && value) {
      styles[kebabToCamel(key)] = value
    }
  }
  return styles
}

function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

function parseAttributes(el: Element, _tagName: string, _type: string): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  for (const attr of Array.from(el.attributes)) {
    if (SKIP_ATTRS.has(attr.name)) continue
    props[attr.name] = attr.value
  }

  return props
}

function defaultTagForType(type: string): string {
  const map: Record<string, string> = {
    'heading': 'h1',
    'paragraph': 'p',
    'image': 'img',
    'link': 'a',
    'button': 'button',
    'container': 'div',
    'section': 'section',
    'navbar': 'nav',
    'footer': 'footer',
    'header': 'header',
    'article': 'article',
    'aside': 'aside',
    'blockquote': 'blockquote',
    'list': 'ul',
    'list-item': 'li',
    'form': 'form',
    'input': 'input',
    'textarea': 'textarea',
    'select': 'select',
    'video': 'video',
    'hr': 'hr',
    'br': 'br',
    'span': 'span',
    'accordion': 'div',
    'tabs': 'div'
  }
  return map[type] ?? 'div'
}

const BLOCK_ELEMENTS = new Set([
  'div', 'p', 'section', 'article', 'aside', 'nav', 'header', 'footer',
  'main', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'form', 'table', 'figure', 'figcaption', 'details', 'summary'
])

function containsBlockElements(html: string): boolean {
  const tagRegex = /<(\w+)[\s>]/g
  let match
  while ((match = tagRegex.exec(html)) !== null) {
    if (BLOCK_ELEMENTS.has(match[1].toLowerCase())) {
      return true
    }
  }
  return false
}
