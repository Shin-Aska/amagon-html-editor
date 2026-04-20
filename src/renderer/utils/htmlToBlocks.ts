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
  'table': 'table',
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
  'data-amagon-icon-class',
  'data-amagon-lightbox',
  'data-amagon-media-ratio',
  'data-amagon-embed-ratio',
  'data-amagon-code-block',
  'data-code-language',
  'data-code-show-line-numbers',
  'data-code-filename',
  'data-code-copy-button',
  'data-code-content',
  'data-amagon-button-icon',
  'data-amagon-code-source',
  'data-amagon-button-variant',
  'data-amagon-button-size',
  'data-amagon-button-outline',
  'data-amagon-button-block',
  'data-amagon-button-loading',
  'data-amagon-button-loading-text'
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

  const hasEnhancedImageStructure =
    tagName === 'figure' ||
    (
      tagName === 'a' &&
      !!el.querySelector(':scope > img') &&
      (
        el.getAttribute('data-amagon-lightbox') === 'true' ||
        (el.textContent || '').trim().length === 0
      )
    )
  if (blockType === 'image' || hasEnhancedImageStructure) return parseImageBlock(el)

  const hasEnhancedVideoStructure =
    tagName === 'video' ||
    (
      tagName === 'div' &&
      (
        el.hasAttribute('data-amagon-media-ratio') ||
        !!el.querySelector(':scope > video')
      )
    )
  if (blockType === 'video' || hasEnhancedVideoStructure) return parseVideoBlock(el)

  // map-embed renders as a div containing an iframe — must be checked before embed detection
  if (blockType === 'map-embed') return parseMapEmbedBlock(el)

  const hasEnhancedEmbedStructure =
    tagName === 'iframe' ||
    (
      tagName === 'div' &&
      (
        el.hasAttribute('data-amagon-embed-ratio') ||
        !!el.querySelector(':scope > iframe')
      )
    )
  if (blockType === 'iframe' || hasEnhancedEmbedStructure) return parseIframeBlock(el)

  const hasCodeBlockStructure =
    tagName === 'pre' ||
    (
      tagName === 'div' &&
      (
        el.getAttribute('data-amagon-code-block') === 'true' ||
        !!el.querySelector(':scope > pre > code.hljs, :scope code.hljs')
      )
    )
  if (blockType === 'code-block' || hasCodeBlockStructure) return parseCodeBlock(el)

  // Editor-preview modal card (data-block-type="modal" on a .card div)
  if (blockType === 'modal') return parseEditorModalBlock(el)

  // Link block with button styling — must be checked before button detection
  if (blockType === 'link') return parseLinkBlock(el)

  // back-to-top renders as a <button> with btn classes — must be checked before button detection
  if (blockType === 'back-to-top') return parseBackToTopBlock(el)

  const hasButtonStructure =
    (
      tagName === 'button' ||
      tagName === 'a'
    ) &&
    (
      blockType === 'button' ||
      el.classList.contains('btn') ||
      Array.from(el.classList).some((cls) => /^btn-/.test(cls)) ||
      el.hasAttribute('data-amagon-button-variant') ||
      !!el.querySelector(':scope > .amagon-btn-label')
    )
  if (blockType === 'button' || hasButtonStructure) return parseButtonBlock(el)


  const hasTableStructure =
    tagName === 'table' ||
    (
      tagName === 'div' &&
      (
        el.getAttribute('data-amagon-table') === 'true' ||
        !!el.querySelector(':scope > table[data-amagon-table-inner], :scope > table.table')
      )
    )
  if (blockType === 'table' || hasTableStructure) return parseTableBlock(el)

  const hasDropdownStructure =
    (
      tagName === 'div' &&
      (
        el.getAttribute('data-amagon-dropdown') === 'true' ||
        !!el.querySelector(':scope > .dropdown-menu, :scope > [data-tw-dropdown-menu]') ||
        !!el.querySelector(':scope > [data-bs-toggle="dropdown"]')
      )
    ) ||
    el.hasAttribute('data-tw-dropdown-menu')
  if (blockType === 'dropdown' || hasDropdownStructure) return parseDropdownBlock(el)

  const hasOffcanvasStructure =
    (
      tagName === 'div' &&
      (
        el.getAttribute('data-amagon-offcanvas') === 'true' ||
        !!el.querySelector(':scope > .offcanvas, :scope > [data-tw-offcanvas-panel]')
      )
    ) ||
    el.classList.contains('offcanvas') ||
    el.hasAttribute('data-tw-offcanvas-panel')
  if (blockType === 'offcanvas' || hasOffcanvasStructure) return parseOffcanvasBlock(el)

  const hasCardStructure =
    (
      tagName === 'div' &&
      (
        el.getAttribute('data-amagon-card') === 'true' ||
        !!el.querySelector(':scope > .card-body[data-card-body], :scope > [data-card-body]')
      )
    )
  if (blockType === 'card' || hasCardStructure) return parseCardBlock(el)
  if (blockType === 'stats-section') return parseStatsSectionBlock(el)
  if (blockType === 'team-grid') return parseTeamGridBlock(el)
  if (blockType === 'gallery') return parseGalleryBlock(el)
  if (blockType === 'timeline') return parseTimelineBlock(el)
  if (blockType === 'logo-cloud') return parseLogoCloudBlock(el)
  if (blockType === 'process-steps') return parseProcessStepsBlock(el)
  if (blockType === 'newsletter') return parseNewsletterBlock(el)
  if (blockType === 'comparison-table') return parseComparisonTableBlock(el)
  if (blockType === 'contact-card') return parseContactCardBlock(el)
  if (blockType === 'social-links') return parseSocialLinksBlock(el)
  if (blockType === 'cookie-banner') return parseCookieBannerBlock(el)
  if (blockType === 'back-to-top') return parseBackToTopBlock(el)
  if (blockType === 'countdown') return parseCountdownBlock(el)
  if (blockType === 'before-after') return parseBeforeAfterBlock(el)
  if (blockType === 'map-embed') return parseMapEmbedBlock(el)

  if (blockType === 'alert' || el.classList.contains('alert')) return parseAlertBlock(el)
  if (blockType === 'badge' || el.classList.contains('badge')) return parseBadgeBlock(el)
  if (blockType === 'progress' || el.classList.contains('progress')) return parseProgressBlock(el)
  if (blockType === 'spinner' || el.classList.contains('spinner-border') || el.classList.contains('spinner-grow') || el.classList.contains('animate-spin')) return parseSpinnerBlock(el)
  if (blockType === 'breadcrumb' || (tagName === 'nav' && el.getAttribute('aria-label') === 'breadcrumb') || el.classList.contains('breadcrumb')) return parseBreadcrumbBlock(el)
  if (blockType === 'pagination' || el.classList.contains('pagination') || el.querySelector(':scope > ul.pagination')) return parsePaginationBlock(el)

  const isRadio = tagName === 'input' && el.getAttribute('type') === 'radio'
  const isWrappedRadio = tagName === 'div' && el.classList.contains('form-check') && !!el.querySelector(':scope > input[type="radio"], input[type="radio"]')
  if (blockType === 'radio' || isRadio || isWrappedRadio) return parseRadioBlock(el)

  const isRange = tagName === 'input' && el.getAttribute('type') === 'range'
  const isWrappedRange = tagName === 'div' && !!el.querySelector(':scope > input[type="range"], input[type="range"]')
  if (blockType === 'range' || isRange || isWrappedRange) return parseRangeBlock(el)

  const isFileInput = tagName === 'input' && el.getAttribute('type') === 'file'
  const isWrappedFileInput = tagName === 'div' && !!el.querySelector(':scope > input[type="file"], input[type="file"]')
  if (blockType === 'file-input' || isFileInput || isWrappedFileInput) return parseFileInputBlock(el)

  const inputType = (el.getAttribute('type') || '').toLowerCase()
  const isStandaloneFormControl =
    tagName === 'textarea' ||
    tagName === 'select' ||
    (tagName === 'input' && !['checkbox', 'radio', 'range', 'file'].includes(inputType))
  if (isStandaloneFormControl) {
    return parseFormControlElement(el)
  }

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
  const isCheckboxInput = tagName === 'input' && el.getAttribute('type') === 'checkbox'
  const isCheckboxLabelWrapper = tagName === 'label' && !!el.querySelector(':scope > input[type="checkbox"]')
  if (blockType === 'checkbox' || hasBootstrapCheckboxStructure || isCheckboxInput || isCheckboxLabelWrapper) {
    return parseCheckboxBlock(el)
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

  // Detect blockquote (always route to dedicated parser — handles author/source footer and decorative classes)
  if (tagName === 'blockquote') return parseBlockquoteBlock(el)

  // Detect spacer block
  if (blockType === 'spacer' || (tagName === 'div' && el.hasAttribute('aria-hidden') && el.getAttribute('aria-hidden') === 'true' && el.children.length === 0 && (el.getAttribute('style') || '').includes('height'))) {
    const spacerStyles = parseInlineStyles(el)
    return {
      id: el.getAttribute('data-block-id') || generateBlockId(),
      type: 'spacer',
      props: { height: spacerStyles.height || '2rem' },
      styles: {},
      classes: [],
      children: []
    }
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

  // Special handling for heading level + anchorId
  if (type === 'heading') {
    const level = parseInt(tagName.charAt(1), 10)
    props.level = level
    // Recover anchorId: if the id is not a block UUID (contains only alphanumeric/dash), use it as anchorId
    const elId = el.getAttribute('id') || ''
    if (elId && !elId.startsWith('block-') && !/^[a-f0-9-]{36}$/.test(elId)) {
      props.anchorId = elId
    }
    // Recover decorative
    if (el.classList.contains('amagon-heading-underline')) props.decorative = 'underline'
    else if (el.classList.contains('amagon-heading-gradient-underline')) props.decorative = 'gradient-underline'
    else props.decorative = 'none'
  }

  // Special handling for paragraph props
  if (type === 'paragraph') {
    // Recover columns from style
    const colCount = styles.columnCount
    if (colCount === '2') props.columns = '2'
    else if (colCount === '3') props.columns = '3'
    else props.columns = '1'
    // Recover dropCap
    if (el.getAttribute('data-drop-cap') === 'true') props.dropCap = true
    // Recover lead
    if (el.classList.contains('lead') || el.classList.contains('text-lg')) props.lead = true
  }

  // Special handling for list items + listStyle + horizontal
  if (type === 'list') {
    const items: string[] = []
    const isHorizontal = el.classList.contains('list-inline') || el.classList.contains('flex')
    if (isHorizontal) props.horizontal = true
    for (const child of Array.from(el.children)) {
      const childTag = child.tagName.toLowerCase()
      if (childTag === 'li') {
        // strip list-inline-item class from innerHTML
        items.push(child.innerHTML)
      }
    }
    if (items.length > 0) {
      props.items = items
      props.ordered = tagName === 'ol'
    }
  }

  // Special handling for navbar props that are encoded in markup/classes.
  if (type === 'navbar') {
    if (classes.includes('position-sticky') || classes.includes('sticky') || styles.position === 'sticky') {
      props.sticky = true
    }
    if (styles.top) {
      props.stickyOffset = styles.top
    }
    if (styles.zIndex) {
      const zIndex = Number(styles.zIndex)
      props.stickyZIndex = Number.isFinite(zIndex) ? zIndex : styles.zIndex
    }
    if (classes.includes('navbar-transparent')) {
      props.transparent = true
    }

    const classBrandAnchor = el.querySelector('a.navbar-brand')
    const inferredBrandAnchor = classBrandAnchor || Array.from(el.querySelectorAll('a')).find((anchor) => {
      const cls = anchor.className || ''
      return /\btext-lg\b/.test(cls) && /\bfont-semibold\b/.test(cls) && /\bno-underline\b/.test(cls)
    }) || null

    if (inferredBrandAnchor) {
      const brandImageEl = inferredBrandAnchor.querySelector('img')
      const brandImageSrc = brandImageEl?.getAttribute('src') || ''
      if (brandImageSrc) {
        props.brandImage = brandImageSrc
      }
      const brandText = inferredBrandAnchor.textContent?.trim() || ''
      if (brandText) {
        props.brandText = brandText
      }
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

function parseImageBlock(el: Element): Block {
  const tagName = el.tagName.toLowerCase()
  const figure = tagName === 'figure' ? el : null
  const figureAnchors = figure ? Array.from(figure.querySelectorAll('a')) : []
  const anchor = tagName === 'a'
    ? el
    : figureAnchors.find((candidate) => !!candidate.querySelector('img')) || null
  const img = tagName === 'img'
    ? el
    : (
      figure?.querySelector(':scope img') ||
      anchor?.querySelector(':scope > img') ||
      el.querySelector(':scope > img')
    )

  if (!img) {
    return {
      id: el.getAttribute('data-block-id') || generateBlockId(),
      type: 'container',
      props: parseAttributes(el, tagName, 'container'),
      styles: parseInlineStyles(el),
      classes: splitClasses(el),
      children: parseChildren(el)
    }
  }

  const classes = splitClasses(img)
  const styles = parseInlineStyles(img)
  const figcaption = figure?.querySelector(':scope > figcaption, figcaption') || null
  const caption = figcaption?.textContent?.trim() || ''
  const captionClasses = splitClasses(figcaption || undefined)
  const captionPosition = captionClasses.includes('position-absolute') || captionClasses.includes('absolute')
    ? 'overlay-bottom'
    : 'below'
  const lightbox = !!anchor && (
    anchor.getAttribute('data-amagon-lightbox') === 'true' ||
    anchor.getAttribute('href') === img.getAttribute('src')
  )
  const loading = img.getAttribute('loading')
  const lazyLoad = loading === 'lazy'
  const objectFitFromStyle = styles.objectFit
  const objectFitFromClass = classes.includes('object-cover')
    ? 'cover'
    : classes.includes('object-contain')
      ? 'contain'
      : classes.includes('object-fill')
        ? 'fill'
        : classes.includes('object-none')
          ? 'none'
          : classes.includes('object-scale-down')
            ? 'scale-down'
            : ''
  const objectFit = (objectFitFromStyle || objectFitFromClass || 'cover') as string
  const aspectRatioFromStyle = styles.aspectRatio
  const aspectRatioFromClass =
    classes.includes('aspect-square') ? '1:1' :
      classes.includes('aspect-video') ? '16:9' :
        classes.includes('aspect-[4/3]') ? '4:3' :
          classes.includes('aspect-[21/9]') ? '21:9' :
            ''
  const aspectRatio = (
    aspectRatioFromClass ||
    (aspectRatioFromStyle === '1 / 1' ? '1:1' :
      aspectRatioFromStyle === '4 / 3' ? '4:3' :
        aspectRatioFromStyle === '16 / 9' ? '16:9' :
          aspectRatioFromStyle === '21 / 9' ? '21:9' : 'auto')
  ) as string

  delete styles.objectFit
  delete styles.aspectRatio

  return {
    id: figure?.getAttribute('data-block-id') || anchor?.getAttribute('data-block-id') || img.getAttribute('data-block-id') || generateBlockId(),
    type: 'image',
    props: {
      src: img.getAttribute('src') || '',
      alt: img.getAttribute('alt') || '',
      caption,
      captionPosition,
      objectFit,
      aspectRatio,
      lazyLoad,
      lightbox
    },
    styles,
    classes: classes.filter((cls) => !['object-cover', 'object-contain', 'object-fill', 'object-none', 'object-scale-down', 'aspect-square', 'aspect-video', 'aspect-[4/3]', 'aspect-[21/9]'].includes(cls)),
    children: []
  }
}

function parseVideoBlock(el: Element): Block {
  const tagName = el.tagName.toLowerCase()
  const wrapper = tagName === 'div' && !!el.querySelector(':scope > video') ? el : null
  const video = tagName === 'video' ? el : wrapper?.querySelector(':scope > video') || el.querySelector('video')

  if (!video) {
    return {
      id: el.getAttribute('data-block-id') || generateBlockId(),
      type: 'container',
      props: parseAttributes(el, tagName, 'container'),
      styles: parseInlineStyles(el),
      classes: splitClasses(el),
      children: parseChildren(el)
    }
  }

  const wrapperClasses = splitClasses(wrapper || undefined)
  const aspectRatio = (
    (wrapper?.getAttribute('data-amagon-media-ratio') || '').trim() ||
    (wrapperClasses.includes('ratio-1x1') ? '1:1' :
      wrapperClasses.includes('ratio-4x3') ? '4:3' :
        wrapperClasses.includes('ratio-21x9') ? '21:9' :
          wrapperClasses.includes('ratio-16x9') ? '16:9' :
            wrapperClasses.includes('aspect-square') ? '1:1' :
              wrapperClasses.includes('aspect-[4/3]') ? '4:3' :
                wrapperClasses.includes('aspect-[21/9]') ? '21:9' :
                  wrapperClasses.includes('aspect-video') ? '16:9' : '16:9')
  )

  return {
    id: wrapper?.getAttribute('data-block-id') || video.getAttribute('data-block-id') || generateBlockId(),
    type: 'video',
    props: {
      src: video.getAttribute('src') || '',
      controls: video.hasAttribute('controls'),
      autoplay: video.hasAttribute('autoplay'),
      loop: video.hasAttribute('loop'),
      muted: video.hasAttribute('muted'),
      preload: video.getAttribute('preload') || 'metadata',
      poster: video.getAttribute('poster') || '',
      aspectRatio
    },
    styles: parseInlineStyles(wrapper || video),
    classes: splitClasses(video),
    children: []
  }
}

function parseIframeBlock(el: Element): Block {
  const tagName = el.tagName.toLowerCase()
  const wrapper = tagName === 'div' && !!el.querySelector(':scope > iframe') ? el : null
  const frame = tagName === 'iframe' ? el : wrapper?.querySelector(':scope > iframe') || el.querySelector('iframe')

  if (!frame) {
    return {
      id: el.getAttribute('data-block-id') || generateBlockId(),
      type: 'container',
      props: parseAttributes(el, tagName, 'container'),
      styles: parseInlineStyles(el),
      classes: splitClasses(el),
      children: parseChildren(el)
    }
  }

  const wrapperClasses = splitClasses(wrapper || undefined)
  const aspectRatio = (
    (wrapper?.getAttribute('data-amagon-embed-ratio') || '').trim() ||
    (wrapperClasses.includes('ratio-1x1') ? '1:1' :
      wrapperClasses.includes('ratio-4x3') ? '4:3' :
        wrapperClasses.includes('ratio-21x9') ? '21:9' :
          wrapperClasses.includes('ratio-16x9') ? '16:9' :
            wrapperClasses.includes('aspect-square') ? '1:1' :
              wrapperClasses.includes('aspect-[4/3]') ? '4:3' :
                wrapperClasses.includes('aspect-[21/9]') ? '21:9' :
                  wrapperClasses.includes('aspect-video') ? '16:9' : '16:9')
  )

  return {
    id: wrapper?.getAttribute('data-block-id') || frame.getAttribute('data-block-id') || generateBlockId(),
    type: 'iframe',
    props: {
      src: frame.getAttribute('src') || '',
      title: frame.getAttribute('title') || 'Embedded Content',
      aspectRatio,
      allowFullscreen: frame.hasAttribute('allowfullscreen'),
      lazy: (frame.getAttribute('loading') || '').trim() === 'lazy'
    },
    styles: parseInlineStyles(wrapper || frame),
    classes: splitClasses(frame),
    children: []
  }
}

function parseButtonBlock(el: Element): Block {
  const tagName = el.tagName.toLowerCase()
  const classes = splitClasses(el)
  const styles = parseInlineStyles(el)
  const labelNode = el.querySelector('.amagon-btn-label')
  const iconLeftNode = el.querySelector('.amagon-btn-icon-left')
  const iconRightNode = el.querySelector('.amagon-btn-icon-right')
  const text = labelNode?.textContent?.trim() || el.textContent?.trim() || ''
  const attrVariant = el.getAttribute('data-amagon-button-variant')
  const attrSize = el.getAttribute('data-amagon-button-size')
  const attrOutline = el.getAttribute('data-amagon-button-outline')
  const attrBlock = el.getAttribute('data-amagon-button-block')
  const attrLoading = el.getAttribute('data-amagon-button-loading')
  const attrLoadingText = el.getAttribute('data-amagon-button-loading-text')
  const variantClass = classes.find((cls) => /^btn-(outline-)?[a-z]+$/.test(cls)) || ''
  const sizeClass = attrSize || (classes.includes('btn-sm') ? 'btn-sm' : classes.includes('btn-lg') ? 'btn-lg' : '')
  const outline = attrOutline === 'true' || variantClass.startsWith('btn-outline-')
  const variant = attrVariant
    ? `btn-${attrVariant.replace(/^btn-/, '')}`
    : outline && variantClass
      ? variantClass.replace(/^btn-outline-/, 'btn-')
      : (variantClass || 'btn-primary')
  const isLoading = !!el.querySelector('.spinner-border, .animate-spin')
  const loading = attrLoading === 'true' || isLoading
  const loadingText = attrLoadingText || (loading ? text : 'Loading...')
  const iconLeft = iconLeftNode?.getAttribute('data-amagon-button-icon') || ''
  const iconRight = iconRightNode?.getAttribute('data-amagon-button-icon') || ''

  return {
    id: el.getAttribute('data-block-id') || el.getAttribute('id') || generateBlockId(),
    type: 'button',
    props: {
      text,
      href: tagName === 'a' ? (el.getAttribute('href') || '') : '',
      target: tagName === 'a' ? (el.getAttribute('target') || '') : '',
      type: tagName === 'button' ? (el.getAttribute('type') || 'button') : 'button',
      variant,
      size: sizeClass,
      iconLeft,
      iconRight,
      outline,
      block: attrBlock === 'true' || classes.includes('d-block') || classes.includes('w-100') || classes.includes('w-full'),
      loading,
      loadingText,
      disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true'
    },
    styles,
    classes,
    children: []
  }
}

function parseCodeBlock(el: Element): Block {
  const root = el.getAttribute('data-amagon-code-block') === 'true'
    ? el
    : el.closest('[data-amagon-code-block="true"]') || el
  const codeEl = root.querySelector('[data-amagon-code-source]') || root.querySelector('code')
  const classes = splitClasses(root)
  const styles = parseInlineStyles(root)
  const languageFromAttr = root.getAttribute('data-code-language') || ''
  const languageFromClass = splitClasses(codeEl || undefined).find((cls) => cls.startsWith('language-'))?.replace('language-', '') || ''
  const language = languageFromAttr || languageFromClass
  const showLineNumbers = root.getAttribute('data-code-show-line-numbers') === 'true' || !!root.querySelector('.text-end code')
  const filename = root.getAttribute('data-code-filename') || root.querySelector('[data-amagon-code-filename]')?.textContent?.trim() || ''
  const copyButton = root.getAttribute('data-code-copy-button') === 'true' || !!root.querySelector('button')
  const encodedCode = root.getAttribute('data-code-content') || ''
  let decodedCode = ''
  if (encodedCode) {
    try {
      decodedCode = decodeURIComponent(encodedCode)
    } catch {
      decodedCode = encodedCode
    }
  }
  const code = decodedCode || codeEl?.textContent || ''

  return {
    id: root.getAttribute('data-block-id') || generateBlockId(),
    type: 'code-block',
    props: {
      code,
      language,
      showLineNumbers,
      filename,
      copyButton
    },
    styles,
    classes,
    children: []
  }
}

// Parses the editor-mode modal card preview (data-block-type="modal" on a .card div)
function parseEditorModalBlock(el: Element): Block {
  const id = el.getAttribute('data-block-id') || generateBlockId()
  const styles = parseInlineStyles(el)
  // Extract title from card-header / flex header
  const headerEl = el.querySelector('.card-header, [class*="flex"][class*="items-center"]')
  const titleEl = headerEl?.querySelector('.fw-bold, .font-bold, [class*="font-bold"]') || headerEl
  // Strip badge/icon text from title
  const titleClone = titleEl?.cloneNode(true) as Element | undefined
  titleClone?.querySelectorAll('.badge, span[class*="badge"], span[class*="rounded"]').forEach((n) => n.remove())
  const title = titleClone?.textContent?.replace(/🔲/g, '').trim() || 'Modal Title'
  // Parse children from body
  const bodyEl = el.querySelector('.card-body, .p-6')
  const children = bodyEl ? parseChildren(bodyEl) : []
  return {
    id,
    type: 'modal',
    props: {
      id: '',
      buttonText: 'Launch Modal',
      title,
      closeButton: true,
      footerButtons: true,
      size: 'default',
      scrollable: false,
      centered: false
    },
    styles,
    classes: [],
    children
  }
}

function parseBlockquoteBlock(el: Element): Block {
  const footer = el.querySelector(':scope > footer, :scope > .blockquote-footer')
  const cite = footer?.querySelector('cite') || null
  const source = cite?.textContent?.trim() || ''
  let author = footer?.textContent?.trim() || ''
  // Strip source from author text (cite element content)
  if (source && author.endsWith(source)) author = author.slice(0, -source.length).replace(/,\s*$/, '').trim()

  // Clone to remove footer before reading text
  const clone = el.cloneNode(true) as Element
  const footerInClone = clone.querySelector('footer, .blockquote-footer')
  if (footerInClone) footerInClone.remove()
  const text = clone.innerHTML.trim()

  const classes = splitClasses(el)
  let decorative = 'none'
  if (classes.includes('amagon-bq-border-left')) decorative = 'border-left'
  else if (classes.includes('amagon-bq-large-quote')) decorative = 'large-quote'

  return {
    id: el.getAttribute('data-block-id') || generateBlockId(),
    type: 'blockquote',
    props: { text, author, source, decorative },
    styles: parseInlineStyles(el),
    classes: classes.filter((c) => c !== 'amagon-bq-border-left' && c !== 'amagon-bq-large-quote'),
    children: []
  }
}

function parseLinkBlock(el: Element): Block {
  const classes = splitClasses(el)
  const isButton = classes.some((cls) => cls === 'btn' || /^btn-/.test(cls))
  const variantClass = classes.find((cls) => /^btn-(outline-)?[a-z]+$/.test(cls)) || ''
  const isOutline = variantClass.startsWith('btn-outline-')
  const baseVariant = isOutline
    ? variantClass.replace('btn-outline-', '')
    : variantClass.replace('btn-', '') || 'primary'
  const variant = isOutline ? `outline-${baseVariant}` : baseVariant

  const iconLeftNode = el.querySelector('.amagon-btn-icon-left')
  const iconRightNode = el.querySelector('.amagon-btn-icon-right')
  const labelNode = el.querySelector('.amagon-btn-label')
  const text = labelNode?.textContent?.trim() || el.textContent?.trim() || ''
  const iconLeft = iconLeftNode?.getAttribute('data-amagon-button-icon') || ''
  const iconRight = iconRightNode?.getAttribute('data-amagon-button-icon') || ''

  const href = el.getAttribute('href') || '#'
  const target = el.getAttribute('target') || ''
  const newTab = target === '_blank'

  return {
    id: el.getAttribute('data-block-id') || generateBlockId(),
    type: 'link',
    props: {
      text,
      href,
      target: target && !newTab ? target : '',
      newTab,
      button: isButton,
      variant,
      iconLeft,
      iconRight
    },
    styles: parseInlineStyles(el),
    classes: isButton ? classes.filter((c) => c !== 'btn' && !/^btn-/.test(c)) : classes,
    children: []
  }
}

function parseCheckboxBlock(el: Element): Block {
  const input = el.tagName.toLowerCase() === 'input'
    ? el
    : (
      el.querySelector(':scope > input[type="checkbox"]') ??
      el.querySelector('input[type="checkbox"]')
    )
  const label =
    el.querySelector(':scope > label.form-check-label') ??
    el.querySelector('label.form-check-label') ??
    el.querySelector(':scope > label') ??
    el.querySelector('label') ??
    (el.tagName.toLowerCase() === 'label' ? el : null)
  const wrapper = el.closest('.form-check') || (el.tagName.toLowerCase() === 'label' ? el : null)

  const inputClasses = input?.className
    ? input.className.split(/\s+/).filter((c) => c.length > 0)
    : []
  const wrapperClasses = wrapper?.className
    ? wrapper.className.split(/\s+/).filter((c) => c.length > 0)
    : []
  const inputStyles = input ? parseInlineStyles(input) : {}
  const existingId =
    el.getAttribute('data-block-id') ||
    input?.getAttribute('data-block-id') ||
    input?.getAttribute('id')
  const parsedLabel = (() => {
    if (!label) return ''
    if (label.tagName.toLowerCase() !== 'label') return label.textContent?.trim() || ''
    const clone = label.cloneNode(true) as HTMLElement
    clone.querySelectorAll('input[type="checkbox"], span[aria-hidden="true"]').forEach((node) => node.remove())
    return clone.textContent?.trim() || ''
  })()

  return {
    id: existingId || generateBlockId(),
    type: 'checkbox',
    props: {
      label: parsedLabel || '',
      name: input?.getAttribute('name') || '',
      checked: input?.hasAttribute('checked') || false,
      switch: wrapperClasses.includes('form-switch') || !!label?.querySelector('.peer'),
      inline: wrapperClasses.includes('form-check-inline') || wrapper?.classList.contains('inline-flex') || false
    },
    styles: inputStyles,
    classes: inputClasses,
    children: []
  }
}

function hasWrappedFormControl(el: Element): boolean {
  const directControl = el.querySelector(':scope > input, :scope > textarea, :scope > select')
  const groupedControl = el.querySelector(':scope > .input-group > input, :scope > .input-group > textarea, :scope > .input-group > select')
  const floatingControl = el.querySelector(':scope > .form-floating > input, :scope > .form-floating > textarea, :scope > .form-floating > select')
  const control = directControl || groupedControl || floatingControl
  if (!control) return false
  if (control.tagName.toLowerCase() === 'input' && control.getAttribute('type') === 'checkbox') {
    return false
  }
  return true
}

function parseWrappedFormControl(el: Element): Block {
  const directControl = el.querySelector(':scope > input, :scope > textarea, :scope > select')
  const inputGroup = el.querySelector(':scope > .input-group')
  const floating = el.querySelector(':scope > .form-floating')
  const control = directControl ||
    inputGroup?.querySelector(':scope > input, :scope > textarea, :scope > select') ||
    floating?.querySelector(':scope > input, :scope > textarea, :scope > select') ||
    null

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

  const label =
    el.querySelector(':scope > label') ||
    floating?.querySelector(':scope > label') ||
    undefined
  const parsed = parseFormControlElement(control, label)
  const prependEl = inputGroup?.querySelector(':scope > .input-group-text:first-child')
  const appendEls = inputGroup ? Array.from(inputGroup.querySelectorAll(':scope > .input-group-text')) : []
  const appendEl = appendEls.length > 1 ? appendEls[appendEls.length - 1] : null
  const helpEl = el.querySelector(':scope > .form-text')
  const validEl = el.querySelector(':scope > .valid-feedback, :scope > .text-green-600')
  const invalidEl = el.querySelector(':scope > .invalid-feedback, :scope > .text-red-600')

  if (prependEl) parsed.props.prepend = prependEl.textContent?.trim() || ''
  if (appendEl) parsed.props.append = appendEl.textContent?.trim() || ''
  if (floating) parsed.props.floatingLabel = true
  if (helpEl) parsed.props.helpText = helpEl.textContent?.trim() || ''
  if (validEl) {
    parsed.props.validationState = 'valid'
    parsed.props.validationMessage = validEl.textContent?.trim() || ''
  } else if (invalidEl) {
    parsed.props.validationState = 'invalid'
    parsed.props.validationMessage = invalidEl.textContent?.trim() || ''
  }

  return parsed
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
  const fade = el.classList.contains('carousel-fade')

  // Recover interval from first item
  const firstItem = items[0] as Element | undefined
  const intervalRaw = firstItem?.getAttribute('data-bs-interval')
  const interval = intervalRaw ? (Number(intervalRaw) || 5000) : 5000

  // Detect thumbnails: look for a thumbnail row after carousel-inner
  const thumbnails = !!el.querySelector('button[data-bs-slide-to] img')

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
      slides,
      fade,
      interval,
      thumbnails
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

  const sizeClass = classes.find((cls) => ['fa-xs', 'fa-sm', 'fa-lg', 'fa-xl', 'fa-2xl', 'text-xs', 'text-sm', 'text-lg', 'text-xl', 'text-2xl'].includes(cls))
  if (sizeClass) {
    const classToSize: Record<string, string> = {
      'fa-xs': 'xs',
      'fa-sm': 'sm',
      'fa-lg': 'lg',
      'fa-xl': 'xl',
      'fa-2xl': '2xl',
      'text-xs': 'xs',
      'text-sm': 'sm',
      'text-lg': 'lg',
      'text-xl': 'xl',
      'text-2xl': '2xl'
    }
    props.size = classToSize[sizeClass] || 'md'
  } else if (styles.fontSize) {
    props.size = styles.fontSize
  } else {
    props.size = 'md'
  }

  if (styles.color && !(title === 'No icon selected' && styles.color === '#6c757d')) {
    props.color = styles.color
  }

  if (classes.includes('fa-spin') || classes.includes('animate-spin')) {
    props.spin = true
  }
  if (classes.includes('fa-fw') || classes.includes('w-[1.25em]')) {
    props.fixedWidth = true
  }

  const nextStyles = { ...styles }
  if (typeof props.size === 'string' && ['xs', 'sm', 'md', 'lg', 'xl', '2xl'].includes(String(props.size))) {
    delete nextStyles.fontSize
  }

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
    classes: classes.filter((cls) => !['fa-xs', 'fa-sm', 'fa-lg', 'fa-xl', 'fa-2xl', 'text-xs', 'text-sm', 'text-lg', 'text-xl', 'text-2xl', 'fa-spin', 'animate-spin', 'fa-fw', 'w-[1.25em]'].includes(cls)),
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

  // Check if vertical (wrapped in d-flex with flex-column nav)
  const isVertical = el.classList.contains('d-flex') ||
    (!!el.querySelector(':scope > div.d-flex') && !!el.querySelector('ul.nav.flex-column'))
  const navEl = el.querySelector('ul.nav.nav-tabs, ul.nav.nav-pills, ul.nav.nav-underline') ??
    el.querySelector('ul.nav')
  const ul = navEl
  const tabsId = ul?.id || el.id || `tabs-${id}`

  // Detect variant from nav classes
  let tabVariant = 'tabs'
  if (ul?.classList.contains('nav-pills')) tabVariant = 'pills'
  else if (ul?.classList.contains('nav-underline')) tabVariant = 'underline'

  const vertical = isVertical || (ul?.classList.contains('flex-column') ?? false)
  const justified = ul?.classList.contains('nav-justified') ?? false
  const fill = ul?.classList.contains('nav-fill') ?? false

  const navButtons = Array.from(
    (ul?.querySelectorAll(':scope > li.nav-item > button.nav-link, li.nav-item > button.nav-link') ?? [])
  )
  const contentContainer = el.querySelector(':scope > div.tab-content, :scope > div.flex-grow-1 > div.tab-content') ?? el.querySelector('div.tab-content')
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
      tabs,
      variant: tabVariant,
      vertical,
      justified,
      fill
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
  const flush = el.classList.contains('accordion-flush')
  const itemEls = Array.from(el.querySelectorAll(':scope > .accordion-item, .accordion-item'))

  // alwaysOpen: none of the collapses have data-bs-parent pointing to accordion
  const firstCollapse = el.querySelector('.accordion-collapse')
  const alwaysOpen = firstCollapse ? !firstCollapse.hasAttribute('data-bs-parent') : false

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
      items,
      flush,
      alwaysOpen
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
  const dialogClasses = Array.from(dialogEl?.classList || [])
  const sizeClass = dialogClasses.find((cls) => /^modal-(sm|lg|xl|fullscreen)$/.test(cls)) || 'default'
  const scrollable = dialogClasses.includes('modal-dialog-scrollable')
  const centered = dialogClasses.includes('modal-dialog-centered')

  return {
    id,
    type: 'modal',
    props: {
      id: modalEl.id || '',
      buttonText: triggerEl.textContent?.trim() || 'Launch Modal',
      title: titleEl?.textContent?.trim() || 'Modal Title',
      closeButton,
      footerButtons,
      size: sizeClass,
      scrollable,
      centered
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
    const optionGroups = Array.from(control.querySelectorAll(':scope > optgroup'))
    const flatOptions = Array.from(control.querySelectorAll(':scope > option')).map((option) => ({
      label: option.textContent?.trim() || option.getAttribute('value') || '',
      value: option.getAttribute('value') || option.textContent?.trim() || ''
    }))
    if (optionGroups.length > 0) {
      props.optgroups = true
      props.items = optionGroups.map((group) => ({
        group: group.getAttribute('label') || 'Group',
        options: Array.from(group.querySelectorAll(':scope > option')).map((option) => ({
          label: option.textContent?.trim() || option.getAttribute('value') || '',
          value: option.getAttribute('value') || option.textContent?.trim() || ''
        }))
      }))
      props.options = flatOptions.map((option) => option.label)
    } else {
      props.optgroups = false
      props.options = flatOptions.map((option) => option.label)
    }
    props.multiple = control.hasAttribute('multiple')
    if (control.hasAttribute('size')) {
      const parsedSize = Number(control.getAttribute('size'))
      if (Number.isFinite(parsedSize) && parsedSize > 0) {
        props.size = parsedSize
      }
    }
  }

  if (classes.includes('is-valid')) {
    props.validationState = 'valid'
  } else if (classes.includes('is-invalid')) {
    props.validationState = 'invalid'
  } else if (type === 'input') {
    props.validationState = 'none'
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
    'iframe': 'iframe',
    'code-block': 'pre',
    'icon': 'i',
    'hr': 'hr',
    'br': 'br',
    'span': 'span',
    'accordion': 'div',
    'tabs': 'div',
    'alert': 'div',
    'badge': 'span',
    'progress': 'div',
    'spinner': 'div',
    'radio': 'div',
    'range': 'input',
    'file-input': 'input',
    'breadcrumb': 'nav',
    'pagination': 'nav',
    'table': 'table',
    'dropdown': 'div',
    'offcanvas': 'div',
    'card': 'div',
    'stats-section': 'section',
    'team-grid': 'section',
    'gallery': 'section',
    'timeline': 'section',
    'logo-cloud': 'section',
    'process-steps': 'section',
    'spacer': 'div',
    'divider': 'hr'
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

function parseDataBoolean(el: Element | null | undefined, attr: string, fallback: boolean): boolean {
  if (!el) return fallback
  const raw = el.getAttribute(attr)
  if (raw === null) return fallback
  const normalized = raw.trim().toLowerCase()
  if (normalized === 'false') return false
  if (normalized === 'true') return true
  return fallback
}

function splitClasses(el: Element | null | undefined): string[] {
  if (!el || !el.className) return []
  return el.className.split(/\s+/).filter(Boolean)
}

function parseTableBlock(el: Element): Block {
  const tagName = el.tagName.toLowerCase()
  const wrapper = tagName === 'div' ? el : null
  const table = tagName === 'table'
    ? el
    : (
      wrapper?.querySelector(':scope > table[data-amagon-table-inner], :scope > table.table') ??
      wrapper?.querySelector('table')
    )

  if (!table) {
    return {
      id: el.getAttribute('data-block-id') || generateBlockId(),
      type: 'container',
      props: parseAttributes(el, tagName, 'container'),
      styles: parseInlineStyles(el),
      classes: splitClasses(el),
      children: parseChildren(el)
    }
  }

  const id =
    wrapper?.getAttribute('data-block-id') ||
    table.getAttribute('data-block-id') ||
    generateBlockId()
  const tableClasses = splitClasses(table)
  const wrapperClasses = splitClasses(wrapper)

  const headerCells = Array.from(table.querySelectorAll(':scope > thead > tr > th'))
  const fallbackHeaderRow = table.querySelector(':scope > tbody > tr, :scope > tr')
  const fallbackHeaders = fallbackHeaderRow
    ? Array.from(fallbackHeaderRow.querySelectorAll(':scope > th, :scope > td'))
    : []
  const headersSource = headerCells.length > 0 ? headerCells : fallbackHeaders
  const headers = headersSource.map((cell) => cell.textContent?.trim() || '')

  const bodyRows = Array.from(table.querySelectorAll(':scope > tbody > tr'))
  const rowSource = bodyRows.length > 0
    ? bodyRows
    : Array.from(table.querySelectorAll(':scope > tr')).slice(headers.length > 0 ? 1 : 0)
  const rows = rowSource.map((row) =>
    Array.from(row.querySelectorAll(':scope > th, :scope > td')).map((cell) => cell.textContent?.trim() || '')
  )

  const striped = parseDataBoolean(wrapper || table, 'data-table-striped', tableClasses.includes('table-striped'))
  const bordered = parseDataBoolean(wrapper || table, 'data-table-bordered', tableClasses.includes('table-bordered'))
  const hover = parseDataBoolean(wrapper || table, 'data-table-hover', tableClasses.includes('table-hover'))
  const responsive = parseDataBoolean(
    wrapper || table,
    'data-table-responsive',
    wrapperClasses.includes('table-responsive')
  )
  const size = String((wrapper || table).getAttribute('data-table-size') || (tableClasses.includes('table-sm') ? 'sm' : 'default'))
  const variant = String((wrapper || table).getAttribute('data-table-variant') || (tableClasses.includes('table-dark') ? 'dark' : 'default'))

  const filteredClasses = [
    ...wrapperClasses.filter((cls) => cls !== 'table-responsive'),
    ...tableClasses.filter((cls) => !['table', 'table-striped', 'table-bordered', 'table-hover', 'table-sm', 'table-dark'].includes(cls))
  ]

  return {
    id,
    type: 'table',
    props: {
      headers: headers.length > 0 ? headers : ['Column 1'],
      rows: rows.length > 0 ? rows : [['']],
      striped,
      bordered,
      hover,
      responsive,
      size: size === 'sm' ? 'sm' : 'default',
      variant: variant === 'dark' ? 'dark' : 'default'
    },
    styles: parseInlineStyles(table),
    classes: Array.from(new Set(filteredClasses)),
    children: []
  }
}

function parseDropdownBlock(el: Element): Block {
  const closestRoot = el.closest('[data-amagon-dropdown="true"]')
  const tagName = el.tagName.toLowerCase()
  const root = closestRoot ||
    (
      tagName === 'div' &&
      (
        el.classList.contains('dropdown') ||
        el.classList.contains('dropup') ||
        el.classList.contains('dropstart') ||
        el.classList.contains('dropend') ||
        el.classList.contains('btn-group')
      )
    ? el
    : el.parentElement && el.parentElement.tagName.toLowerCase() === 'div'
      ? el.parentElement
      : el)

  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const styles = parseInlineStyles(root)
  const menu =
    root.querySelector(':scope > .dropdown-menu, :scope > [data-tw-dropdown-menu]') ||
    root.querySelector('.dropdown-menu, [data-tw-dropdown-menu]')

  const buttons = Array.from(root.querySelectorAll(':scope > button, :scope > .btn-group > button'))
  const labelButton = buttons.find((button) => !button.classList.contains('dropdown-toggle-split') && (button.textContent || '').trim().length > 0)
  const label = labelButton?.textContent?.trim() || 'Dropdown'

  const buttonClasses = buttons.flatMap((button) => splitClasses(button))
  const variantFromClass = buttonClasses.find((cls) => /^btn-(primary|secondary|success|danger|warning|info|light|dark)$/.test(cls))
  const variant = root.getAttribute('data-dropdown-variant') || (variantFromClass ? variantFromClass.replace(/^btn-/, '') : 'primary')
  const size = root.getAttribute('data-dropdown-size') || (buttonClasses.includes('btn-sm') ? 'sm' : buttonClasses.includes('btn-lg') ? 'lg' : 'default')
  const direction = root.getAttribute('data-dropdown-direction') ||
    (classes.includes('dropup') ? 'up' : classes.includes('dropstart') ? 'start' : classes.includes('dropend') ? 'end' : 'down')
  const split = parseDataBoolean(
    root,
    'data-dropdown-split',
    buttonClasses.includes('dropdown-toggle-split') || buttons.length > 1
  )

  const items: Array<{ label: string; href: string; divider: boolean; disabled: boolean }> = []
  if (menu) {
    const directChildren = Array.from(menu.children)
    directChildren.forEach((child) => {
      const tag = child.tagName.toLowerCase()
      const dividerEl =
        child.querySelector(':scope > .dropdown-divider, :scope > hr.dropdown-divider') ||
        (tag === 'hr' ? child : null)
      const isDivider = child.getAttribute('data-dropdown-divider') === 'true' || !!dividerEl
      if (isDivider) {
        items.push({ label: '', href: '#', divider: true, disabled: false })
        return
      }

      const itemEl =
        child.matches('a,button')
          ? child
          : child.querySelector(':scope > .dropdown-item, :scope > a, :scope > button')
      if (!itemEl) return

      const disabled =
        itemEl.classList.contains('disabled') ||
        itemEl.getAttribute('aria-disabled') === 'true' ||
        itemEl.getAttribute('tabindex') === '-1'
      items.push({
        label: itemEl.textContent?.trim() || '',
        href: itemEl.getAttribute('href') || '#',
        divider: false,
        disabled
      })
    })
  }

  const filteredClasses = classes.filter((cls) => !['dropdown', 'dropup', 'dropstart', 'dropend', 'btn-group', 'relative', 'inline-block', 'text-left', 'inline-flex', 'items-center'].includes(cls))

  return {
    id,
    type: 'dropdown',
    props: {
      label,
      variant: String(variant),
      items: items.length > 0 ? items : [{ label: 'Action', href: '#', divider: false, disabled: false }],
      size: size === 'sm' || size === 'lg' ? size : 'default',
      direction: direction === 'up' || direction === 'start' || direction === 'end' ? direction : 'down',
      split
    },
    styles,
    classes: filteredClasses,
    children: []
  }
}

function parseOffcanvasBlock(el: Element): Block {
  const tagName = el.tagName.toLowerCase()
  const closestRoot = el.closest('[data-amagon-offcanvas="true"]')
  const wrapper = closestRoot || (
    tagName === 'div' &&
    (
      el.getAttribute('data-amagon-offcanvas') === 'true' ||
      !!el.querySelector(':scope > .offcanvas, :scope > [data-tw-offcanvas-panel]')
    )
      ? el
      : null
  )
  const panel =
    (tagName === 'div' && (el.classList.contains('offcanvas') || el.hasAttribute('data-tw-offcanvas-panel')) ? el : null) ||
    wrapper?.querySelector(':scope > .offcanvas, :scope > [data-tw-offcanvas-panel]') ||
    wrapper?.querySelector('.offcanvas, [data-tw-offcanvas-panel]')

  if (!panel) {
    return {
      id: el.getAttribute('data-block-id') || generateBlockId(),
      type: 'container',
      props: parseAttributes(el, tagName, 'container'),
      styles: parseInlineStyles(el),
      classes: splitClasses(el),
      children: parseChildren(el)
    }
  }

  const id =
    wrapper?.getAttribute('data-block-id') ||
    panel.getAttribute('data-block-id') ||
    generateBlockId()
  const panelClasses = splitClasses(panel)
  const placementFromClass =
    panelClasses.includes('offcanvas-end') ? 'end' :
      panelClasses.includes('offcanvas-top') ? 'top' :
        panelClasses.includes('offcanvas-bottom') ? 'bottom' : 'start'
  const placement = String(wrapper?.getAttribute('data-offcanvas-placement') || placementFromClass)
  const backdrop = parseDataBoolean(wrapper || panel, 'data-offcanvas-backdrop', panel.getAttribute('data-bs-backdrop') !== 'false')
  const scroll = parseDataBoolean(wrapper || panel, 'data-offcanvas-scroll', panel.getAttribute('data-bs-scroll') === 'true')
  const titleEl =
    panel.querySelector('.offcanvas-title') ||
    panel.querySelector('[data-tw-offcanvas-title]')
  const bodyEl =
    panel.querySelector('.offcanvas-body') ||
    panel.querySelector('[data-tw-offcanvas-body]')
  const blockId = panel.id || String(wrapper?.getAttribute('data-offcanvas-id') || '')

  return {
    id,
    type: 'offcanvas',
    props: {
      title: titleEl?.textContent?.trim() || 'Offcanvas',
      placement: placement === 'end' || placement === 'top' || placement === 'bottom' ? placement : 'start',
      backdrop,
      scroll,
      id: blockId || `offcanvas-${id}`
    },
    styles: parseInlineStyles(panel),
    classes: panelClasses.filter((cls) => !['offcanvas', 'offcanvas-start', 'offcanvas-end', 'offcanvas-top', 'offcanvas-bottom'].includes(cls)),
    children: bodyEl ? parseChildren(bodyEl) : []
  }
}

function parseCardBlock(el: Element): Block {
  const root = el.closest('[data-amagon-card="true"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const styles = parseInlineStyles(root)
  const headerEl = root.querySelector(':scope > [data-card-header], :scope > .card-header')
  const footerEl = root.querySelector(':scope > [data-card-footer], :scope > .card-footer')
  const bodyEl = root.querySelector(':scope > [data-card-body], :scope > .card-body, :scope > .card-img-overlay')
  const titleEl = bodyEl?.querySelector('.card-title')
  const subtitleEl = bodyEl?.querySelector('.card-subtitle')
  const textEl = bodyEl?.querySelector('.card-text')
  const imageEl = root.querySelector(':scope > [data-card-image], :scope > .card-img-top, :scope > .card-img-bottom, :scope > .card-img')
  const imagePositionAttr = root.getAttribute('data-card-image-position')
  const imagePosition =
    imagePositionAttr === 'bottom' || imagePositionAttr === 'overlay'
      ? imagePositionAttr
      : imageEl?.classList.contains('card-img-bottom')
        ? 'bottom'
        : bodyEl?.classList.contains('card-img-overlay')
          ? 'overlay'
          : 'top'

  const variantFromAttr = root.getAttribute('data-card-variant')
  const variantFromTextBg = classes.find((cls) => /^text-bg-/.test(cls))?.replace(/^text-bg-/, '')
  const variant = variantFromAttr || variantFromTextBg || 'default'
  const outline = parseDataBoolean(root, 'data-card-outline', classes.some((cls) => /^border-(primary|secondary|success|danger|warning|info|light|dark)$/.test(cls)))

  const childrenContainer = bodyEl?.querySelector(':scope > [data-card-children], [data-card-children]')

  return {
    id,
    type: 'card',
    props: {
      title: titleEl?.textContent?.trim() || '',
      subtitle: subtitleEl?.textContent?.trim() || '',
      text: textEl?.textContent?.trim() || '',
      imageUrl: imageEl?.getAttribute('src') || '',
      imagePosition,
      headerText: headerEl?.textContent?.trim() || '',
      footerText: footerEl?.textContent?.trim() || '',
      variant: ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark'].includes(variant) ? variant : 'default',
      outline
    },
    styles,
    classes: classes.filter((cls) => cls !== 'card' && !/^text-bg-/.test(cls) && !/^border-(primary|secondary|success|danger|warning|info|light|dark)$/.test(cls)),
    children: childrenContainer ? parseChildren(childrenContainer) : []
  }
}

function parseStatsSectionBlock(el: Element): Block {
  const root = el.closest('[data-block-type="stats-section"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const items = Array.from(root.querySelectorAll('[data-stats-item="true"]')).map((item) => ({
    value: item.getAttribute('data-stat-value') || '',
    label: item.getAttribute('data-stat-label') || '',
    prefix: item.getAttribute('data-stat-prefix') || '',
    suffix: item.getAttribute('data-stat-suffix') || '',
    icon: item.getAttribute('data-stat-icon') || ''
  }))

  const columns = String(root.getAttribute('data-stats-columns') || '4')
  const variant = String(root.getAttribute('data-stats-variant') || 'default')
  const alignment = String(root.getAttribute('data-stats-alignment') || 'center')

  return {
    id,
    type: 'stats-section',
    props: {
      items: items.length > 0 ? items : [{ value: '120', label: 'Projects', prefix: '', suffix: '+', icon: '🚀' }],
      columns: ['2', '3', '4'].includes(columns) ? columns : '4',
      variant: ['bordered', 'cards'].includes(variant) ? variant : 'default',
      alignment: alignment === 'left' ? 'left' : 'center'
    },
    styles: parseInlineStyles(root),
    classes: classes.filter((cls) => !['stats-section', 'py-5', 'py-12', 'text-center', 'text-start'].includes(cls)),
    children: []
  }
}

function parseTeamGridBlock(el: Element): Block {
  const root = el.closest('[data-block-type="team-grid"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const members = Array.from(root.querySelectorAll('[data-team-member="true"]')).map((item) => {
    const socialRaw = item.getAttribute('data-member-social') || '{}'
    let socialLinks: Record<string, string> = {}
    try {
      const parsed = JSON.parse(socialRaw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        socialLinks = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>)
            .map(([k, v]) => [k, String(v ?? '').trim()])
            .filter(([, v]) => v.length > 0)
        )
      }
    } catch {
      socialLinks = {}
    }

    return {
      name: item.getAttribute('data-member-name') || '',
      role: item.getAttribute('data-member-role') || '',
      imageUrl: item.getAttribute('data-member-image-url') || '',
      bio: item.getAttribute('data-member-bio') || '',
      socialLinks
    }
  })

  const columns = String(root.getAttribute('data-team-columns') || '3')
  const cardStyle = String(root.getAttribute('data-team-card-style') || 'card')
  const showSocial = parseDataBoolean(root, 'data-team-show-social', true)

  return {
    id,
    type: 'team-grid',
    props: {
      members: members.length > 0 ? members : [{ name: 'Team Member', role: 'Role', imageUrl: '', bio: '', socialLinks: {} }],
      columns: ['2', '3', '4'].includes(columns) ? columns : '3',
      cardStyle: ['simple', 'overlay'].includes(cardStyle) ? cardStyle : 'card',
      showSocial
    },
    styles: parseInlineStyles(root),
    classes: classes.filter((cls) => !['team-grid', 'py-5', 'py-12'].includes(cls)),
    children: []
  }
}

function parseGalleryBlock(el: Element): Block {
  const root = el.closest('[data-block-type="gallery"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const images = Array.from(root.querySelectorAll('[data-gallery-image="true"]')).map((item) => ({
    url: item.getAttribute('data-image-url') || '',
    caption: item.getAttribute('data-image-caption') || '',
    category: item.getAttribute('data-image-category') || ''
  }))

  const columns = String(root.getAttribute('data-gallery-columns') || '4')
  const gap = String(root.getAttribute('data-gallery-gap') || 'md')
  const layout = String(root.getAttribute('data-gallery-layout') || 'grid')

  return {
    id,
    type: 'gallery',
    props: {
      images: images.length > 0 ? images : [{ url: '', caption: 'Gallery item', category: '' }],
      columns: ['2', '3', '4', '6'].includes(columns) ? columns : '4',
      gap: ['none', 'sm', 'lg'].includes(gap) ? gap : 'md',
      lightbox: parseDataBoolean(root, 'data-gallery-lightbox', false),
      filterable: parseDataBoolean(root, 'data-gallery-filterable', false),
      layout: layout === 'masonry' ? 'masonry' : 'grid'
    },
    styles: parseInlineStyles(root),
    classes: classes.filter((cls) => !['gallery', 'py-5', 'py-12'].includes(cls)),
    children: []
  }
}

function parseTimelineBlock(el: Element): Block {
  const root = el.closest('[data-block-type="timeline"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const items = Array.from(root.querySelectorAll('[data-timeline-item="true"]')).map((item) => ({
    date: item.getAttribute('data-timeline-date') || '',
    title: item.getAttribute('data-timeline-title') || '',
    description: item.getAttribute('data-timeline-description') || '',
    icon: item.getAttribute('data-timeline-icon') || '',
    variant: item.getAttribute('data-timeline-variant') || 'primary'
  }))
  const orientation = String(root.getAttribute('data-timeline-orientation') || 'vertical')

  return {
    id,
    type: 'timeline',
    props: {
      items: items.length > 0 ? items : [{ date: '2024', title: 'Milestone', description: '', icon: '', variant: 'primary' }],
      orientation: orientation === 'horizontal' ? 'horizontal' : 'vertical',
      alternating: parseDataBoolean(root, 'data-timeline-alternating', true),
      lineColor: root.getAttribute('data-timeline-line-color') || '#6c757d'
    },
    styles: parseInlineStyles(root),
    classes: classes.filter((cls) => !['timeline', 'py-5', 'py-12'].includes(cls)),
    children: []
  }
}

function parseLogoCloudBlock(el: Element): Block {
  const root = el.closest('[data-block-type="logo-cloud"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const logos = Array.from(root.querySelectorAll('[data-logo-item="true"]')).map((item) => ({
    imageUrl: item.getAttribute('data-logo-image-url') || '',
    altText: item.getAttribute('data-logo-alt-text') || '',
    href: item.getAttribute('data-logo-href') || ''
  }))
  const titleEl = root.querySelector('h1, h2, h3, h4, h5, h6')
  const columns = String(root.getAttribute('data-logo-columns') || '6')
  const variant = String(root.getAttribute('data-logo-variant') || 'simple')

  return {
    id,
    type: 'logo-cloud',
    props: {
      logos: logos.length > 0 ? logos : [{ imageUrl: '', altText: 'Logo', href: '' }],
      columns: ['3', '4', '5', '6'].includes(columns) ? columns : '6',
      grayscale: parseDataBoolean(root, 'data-logo-grayscale', true),
      title: titleEl?.textContent?.trim() || '',
      variant: ['bordered', 'cards'].includes(variant) ? variant : 'simple'
    },
    styles: parseInlineStyles(root),
    classes: classes.filter((cls) => !['logo-cloud', 'py-5', 'py-12'].includes(cls)),
    children: []
  }
}

function parseProcessStepsBlock(el: Element): Block {
  const root = el.closest('[data-block-type="process-steps"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const steps = Array.from(root.querySelectorAll('[data-process-step="true"]')).map((item) => ({
    number: item.getAttribute('data-step-number') || '',
    title: item.getAttribute('data-step-title') || '',
    description: item.getAttribute('data-step-description') || '',
    icon: item.getAttribute('data-step-icon') || ''
  }))
  const layout = String(root.getAttribute('data-process-layout') || 'horizontal')
  const connectorStyle = String(root.getAttribute('data-process-connector-style') || root.getAttribute('data-process-connector') || 'line')
  const variant = String(root.getAttribute('data-process-variant') || 'both')

  return {
    id,
    type: 'process-steps',
    props: {
      steps: steps.length > 0 ? steps : [{ number: '1', title: 'Step', description: '', icon: '' }],
      layout: layout === 'vertical' ? 'vertical' : 'horizontal',
      connectorStyle: ['arrow', 'dotted'].includes(connectorStyle) ? connectorStyle : 'line',
      variant: ['numbered', 'icon'].includes(variant) ? variant : 'both'
    },
    styles: parseInlineStyles(root),
    classes: classes.filter((cls) => !['process-steps', 'py-5', 'py-12'].includes(cls)),
    children: []
  }
}


function parseAlertBlock(el: Element): Block {
  const id = el.getAttribute('data-block-id') || generateBlockId()
  const classes = el.className ? el.className.split(/\s+/).filter(Boolean) : []
  const styles = parseInlineStyles(el)
  
  const variantClass = classes.find(c => c.startsWith('alert-')) || 'alert-primary'
  const dismissible = classes.includes('alert-dismissible')
  const textContent = Array.from(el.childNodes)
    .filter(n => n.nodeType === Node.TEXT_NODE || (isElementNode(n) && (n as Element).tagName.toLowerCase() !== 'button'))
    .map(n => n.textContent || '')
    .join('').trim() || 'A simple alert check it out!'

  return {
    id,
    type: 'alert',
    props: {
      text: textContent,
      variant: variantClass,
      dismissible,
      icon: ''
    },
    styles,
    classes: classes.filter(c => c !== 'alert' && c !== variantClass && c !== 'alert-dismissible' && c !== 'fade' && c !== 'show'),
    children: []
  }
}

function parseBadgeBlock(el: Element): Block {
  const id = el.getAttribute('data-block-id') || generateBlockId()
  const classes = el.className ? el.className.split(/\s+/).filter(Boolean) : []
  const styles = parseInlineStyles(el)

  const variantClass = classes.find(c => c.startsWith('bg-')) || 'bg-primary'
  const pill = classes.includes('rounded-pill') || classes.includes('rounded-full')

  return {
    id,
    type: 'badge',
    props: {
      text: el.textContent?.trim() || 'New',
      variant: variantClass,
      pill
    },
    styles,
    classes: classes.filter(c => c !== 'badge' && c !== variantClass && c !== 'rounded-pill' && c !== 'rounded-full'),
    children: []
  }
}

function parseProgressBlock(el: Element): Block {
  const id = el.getAttribute('data-block-id') || generateBlockId()
  const classes = el.className ? el.className.split(/\s+/).filter(Boolean) : []
  const styles = parseInlineStyles(el)

  const bar = el.querySelector('.progress-bar, [role="progressbar"]') || el.firstElementChild || el
  const barClasses = bar.className ? bar.className.split(/\s+/) : []
  
  // style.width returns just the value (e.g. '75%'), getAttribute returns 'width: 75%'
  const styleWidth = (bar as HTMLElement).style?.width || ''
  const styleAttr = bar.getAttribute('style') || ''
  const attrMatch = styleAttr.match(/width:\s*(\d+)/)
  const value = styleWidth ? (parseInt(styleWidth, 10) || 50) : (attrMatch ? parseInt(attrMatch[1], 10) : 50)

  const variantClass = barClasses.find(c => c.startsWith('bg-')) || 'bg-primary'
  const striped = barClasses.includes('progress-bar-striped')
  const animated = barClasses.includes('progress-bar-animated')
  const label = bar.textContent?.trim() || ''

  return {
    id,
    type: 'progress',
    props: { value, variant: variantClass, striped, animated, label },
    styles,
    classes: classes.filter(c => c !== 'progress'),
    children: []
  }
}

function parseSpinnerBlock(el: Element): Block {
  const id = el.getAttribute('data-block-id') || generateBlockId()
  const classes = el.className ? el.className.split(/\s+/).filter(Boolean) : []
  const styles = parseInlineStyles(el)

  let type = 'border'
  if (classes.includes('spinner-grow')) type = 'grow'

  const variantClass = classes.find(c => c.startsWith('text-')) || 'text-primary'
  
  let size = 'default'
  if (classes.includes('spinner-border-sm') || classes.includes('spinner-grow-sm')) {
    size = 'sm'
  }

  return {
    id,
    type: 'spinner',
    props: { variant: variantClass, type, size },
    styles,
    classes: classes.filter(c => !c.startsWith('spinner-') && c !== variantClass),
    children: []
  }
}

function parseBreadcrumbBlock(el: Element): Block {
  const id = el.getAttribute('data-block-id') || generateBlockId()
  const classes = el.className ? el.className.split(/\s+/).filter(Boolean) : []
  const styles = parseInlineStyles(el)

  const list = el.querySelector('ol, ul') || el
  const items = Array.from(list.querySelectorAll('li')).map(li => {
    const a = li.querySelector('a')
    return {
      label: li.textContent?.trim() || '',
      href: a?.getAttribute('href') || '#',
      active: li.classList.contains('active') || li.getAttribute('aria-current') === 'page'
    }
  })

  let divider = 'slash'
  if (el.getAttribute('style')?.includes('>')) divider = 'chevron'
  if (el.getAttribute('style')?.includes('·')) divider = 'dot'

  return {
    id,
    type: 'breadcrumb',
    props: { items: items.length > 0 ? items : [{ label: 'Item', href: '#', active: false }], divider },
    styles,
    classes: classes.filter(c => c !== 'breadcrumb'),
    children: []
  }
}

function parsePaginationBlock(el: Element): Block {
  const id = el.getAttribute('data-block-id') || generateBlockId()
  const classes = el.className ? el.className.split(/\s+/).filter(Boolean) : []
  const styles = parseInlineStyles(el)

  const ul = el.querySelector('ul') || el
  const ulClasses = ul.className ? ul.className.split(/\s+/) : []
  
  let size = 'default'
  if (ulClasses.includes('pagination-sm')) size = 'sm'
  if (ulClasses.includes('pagination-lg')) size = 'lg'

  let alignment = 'start'
  if (ulClasses.includes('justify-content-center')) alignment = 'center'
  if (ulClasses.includes('justify-content-end')) alignment = 'end'

  const items = Array.from(ul.querySelectorAll('li.page-item'))
  const pageItems = items.filter(li => !li.textContent?.includes('Previous') && !li.textContent?.includes('Next') && !li.textContent?.includes('«') && !li.textContent?.includes('»'))
  const pages = pageItems.length || 3
  
  let activePage = 1
  const activeLi = pageItems.find(li => li.classList.contains('active'))
  if (activeLi) {
    activePage = parseInt(activeLi.textContent?.replace(/\(current\)/, '').trim() || '1', 10) || 1
  }

  const showPrevNext = items.some(li => li.textContent?.includes('Previous') || li.textContent?.includes('Next'))
  const showFirstLast = items.some(li => li.textContent?.includes('«') || li.textContent?.includes('»'))

  return {
    id,
    type: 'pagination',
    props: { pages, activePage, size, alignment, showPrevNext, showFirstLast },
    styles,
    classes: classes.filter(c => c !== 'pagination'),
    children: []
  }
}

function parseRadioBlock(el: Element): Block {
  const input = el.tagName.toLowerCase() === 'input' ? el : el.querySelector('input[type="radio"]')
  const label = el.tagName.toLowerCase() === 'input' ? null : el.querySelector('label')
  
  const root = el.tagName.toLowerCase() === 'input' ? el : el
  const classes = root.className ? root.className.split(/\s+/).filter(Boolean) : []
  const styles = parseInlineStyles(root)
  const existingId = el.getAttribute('data-block-id') || input?.getAttribute('data-block-id') || input?.getAttribute('id') || generateBlockId()

  const inline = classes.includes('form-check-inline')
  const disabled = input?.hasAttribute('disabled') || false

  return {
    id: existingId || generateBlockId(),
    type: 'radio',
    props: {
      name: input?.getAttribute('name') || 'radio-group',
      label: label?.textContent?.trim() || 'Radio option',
      value: input?.getAttribute('value') || 'option1',
      checked: input?.hasAttribute('checked') || false,
      inline,
      disabled
    },
    styles,
    classes: classes.filter(c => c !== 'form-check' && c !== 'form-check-inline'),
    children: []
  }
}

function parseRangeBlock(el: Element): Block {
  const root = el.tagName.toLowerCase() === 'input' ? el : (el.querySelector('input[type="range"]') || el)
  const input = root as Element
  const label = el.tagName.toLowerCase() === 'input' ? null : el.querySelector('label')

  const classes = input.className ? input.className.split(/\s+/).filter(Boolean) : []
  const styles = parseInlineStyles(input)
  const existingId = el.getAttribute('data-block-id') || input.getAttribute('data-block-id') || input.getAttribute('id') || generateBlockId()

  return {
    id: existingId || generateBlockId(),
    type: 'range',
    props: {
      label: label?.textContent?.trim() || '',
      min: parseFloat(input.getAttribute('min') || '0'),
      max: parseFloat(input.getAttribute('max') || '100'),
      step: parseFloat(input.getAttribute('step') || '1'),
      value: parseFloat(input.getAttribute('value') || '50'),
      disabled: input.hasAttribute('disabled')
    },
    styles,
    classes: classes.filter(c => c !== 'form-range' && c !== 'w-full'),
    children: []
  }
}

function parseFileInputBlock(el: Element): Block {
  const root = el.tagName.toLowerCase() === 'input' ? el : (el.querySelector('input[type="file"]') || el)
  const input = root as Element
  const label = el.tagName.toLowerCase() === 'input' ? null : el.querySelector('label')

  const classes = input.className ? input.className.split(/\s+/).filter(Boolean) : []
  const styles = parseInlineStyles(input)
  const existingId = el.getAttribute('data-block-id') || input.getAttribute('data-block-id') || input.getAttribute('id') || generateBlockId()

  let size = 'default'
  if (classes.includes('form-control-sm')) size = 'sm'
  if (classes.includes('form-control-lg')) size = 'lg'

  return {
    id: existingId || generateBlockId(),
    type: 'file-input',
    props: {
      label: label?.textContent?.trim() || '',
      accept: input.getAttribute('accept') || '',
      multiple: input.hasAttribute('multiple'),
      disabled: input.hasAttribute('disabled'),
      size
    },
    styles,
    classes: classes.filter(c => !c.startsWith('form-control')),
    children: []
  }
}

function parseNewsletterBlock(el: Element): Block {
  const root = el.closest('[data-block-type="newsletter"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const styles = parseInlineStyles(root)

  return {
    id,
    type: 'newsletter',
    props: {
      title: root.querySelector('h2')?.textContent?.trim() || 'Subscribe to our newsletter',
      description: root.querySelector('p')?.textContent?.trim() || 'Get the latest updates right in your inbox.',
      placeholder: root.querySelector('input[type="email"]')?.getAttribute('placeholder') || 'Enter your email address',
      buttonText: root.querySelector('button')?.textContent?.trim() || 'Subscribe',
      buttonVariant: 'primary',
      layout: root.querySelector('form')?.className.includes('flex-row') || root.querySelector('form')?.className.includes('flex-sm-row') ? 'inline' : 'stacked',
      showNameField: !!root.querySelector('input[type="text"]'),
      variant: 'simple'
    },
    styles,
    classes: classes.filter((c) => !['py-12', 'py-5'].includes(c)),
    children: []
  }
}

function parseComparisonTableBlock(el: Element): Block {
  const root = el.closest('[data-block-type="comparison-table"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const styles = parseInlineStyles(root)

  return {
    id,
    type: 'comparison-table',
    props: {
      plans: [
        { name: 'Basic', price: '$9', period: '/mo', features: [{text: '1 User', included: true}, {text: '5GB Storage', included: true}, {text: 'Support', included: false}], ctaText: 'Start Basic', ctaHref: '#', highlighted: false },
        { name: 'Pro', price: '$29', period: '/mo', features: [{text: '5 Users', included: true}, {text: '50GB Storage', included: true}, {text: 'Support', included: true}], ctaText: 'Start Pro', ctaHref: '#', highlighted: true }
      ],
      columns: 2
    },
    styles,
    classes: classes.filter((c) => !['py-12', 'py-5'].includes(c)),
    children: []
  }
}

function parseContactCardBlock(el: Element): Block {
  const root = el.closest('[data-block-type="contact-card"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const styles = parseInlineStyles(root)

  return {
    id,
    type: 'contact-card',
    props: {
      name: root.querySelector('h3')?.textContent?.trim() || 'John Doe',
      title: root.querySelector('p.text-primary, p.text-\\[var\\(--theme-primary\\)\\]')?.textContent?.trim() || 'Sales Representative',
      email: 'john@example.com',
      phone: '+1 (555) 123-4567',
      address: '123 Main St, City, Country',
      imageUrl: root.querySelector('img')?.getAttribute('src') || '',
      layout: root.querySelector('.flex-row, .flex-md-row') ? 'horizontal' : 'vertical',
      showMap: false
    },
    styles,
    classes: classes.filter((c) => !['p-6', 'card', 'shadow-sm', 'mx-auto', 'max-w-lg'].includes(c)),
    children: []
  }
}

function parseSocialLinksBlock(el: Element): Block {
  const root = el.closest('[data-block-type="social-links"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const styles = parseInlineStyles(root)

  return {
    id,
    type: 'social-links',
    props: {
      links: [
        { platform: 'twitter', url: '#', label: 'Twitter' },
        { platform: 'linkedin', url: '#', label: 'LinkedIn' },
        { platform: 'github', url: '#', label: 'GitHub' }
      ],
      style: 'icons-only',
      size: classes.includes('text-sm') || classes.includes('fs-6') ? 'sm' : classes.includes('text-xl') || classes.includes('fs-4') ? 'lg' : 'md',
      colorful: false
    },
    styles,
    classes: classes.filter((c) => !['flex', 'flex-wrap', 'justify-center', 'd-flex', 'justify-content-center'].includes(c)),
    children: []
  }
}

function parseCookieBannerBlock(el: Element): Block {
  const root = el.closest('[data-block-type="cookie-banner"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const styles = parseInlineStyles(root)

  return {
    id,
    type: 'cookie-banner',
    props: {
      message: root.querySelector('p')?.textContent?.trim() || 'We use cookies to improve your experience on our site.',
      acceptText: 'Accept',
      declineText: 'Decline',
      learnMoreUrl: '#',
      position: classes.includes('top-0') || classes.includes('fixed-top') ? 'top' : 'bottom',
      variant: 'simple'
    },
    styles,
    classes: classes.filter((c) => !['fixed', 'left-0', 'right-0', 'bottom-0', 'top-0', 'border-t', 'border-b', 'z-50', 'fixed-bottom', 'fixed-top', 'bg-body', 'z-3'].includes(c)),
    children: []
  }
}

function parseBackToTopBlock(el: Element): Block {
  const root = el.closest('[data-block-type="back-to-top"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const styles = parseInlineStyles(root)

  return {
    id,
    type: 'back-to-top',
    props: {
      style: classes.includes('rounded-full') || classes.includes('rounded-circle') ? 'circle' : classes.includes('rounded-none') || classes.includes('rounded-0') ? 'square' : 'rounded',
      icon: 'lucide:arrow-up',
      size: 'md',
      position: classes.includes('bottom-left') || classes.includes('left-6') ? 'bottom-left' : 'bottom-right',
      offset: 300
    },
    styles,
    classes: classes.filter((c) => !['fixed', 'bottom-6', 'right-6', 'left-6', 'z-40', 'position-fixed', 'z-3'].includes(c)),
    children: []
  }
}

function parseCountdownBlock(el: Element): Block {
  const root = el.closest('[data-block-type="countdown"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const styles = parseInlineStyles(root)

  return {
    id,
    type: 'countdown',
    props: {
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      labels: { days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds' },
      showDays: true,
      showSeconds: true,
      variant: 'simple',
      expiredMessage: 'Event has started!'
    },
    styles,
    classes: classes.filter((c) => !['flex', 'flex-wrap', 'justify-center', 'd-flex', 'justify-content-center', 'gap-4', 'gap-3'].includes(c)),
    children: []
  }
}

function parseBeforeAfterBlock(el: Element): Block {
  const root = el.closest('[data-block-type="before-after"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const styles = parseInlineStyles(root)

  const imgs = root.querySelectorAll('img')
  return {
    id,
    type: 'before-after',
    props: {
      beforeImage: imgs[1]?.getAttribute('src') || '',
      afterImage: imgs[0]?.getAttribute('src') || '',
      beforeLabel: 'Before',
      afterLabel: 'After',
      orientation: 'horizontal',
      initialPosition: 50
    },
    styles,
    classes: classes.filter((c) => !['relative', 'w-full', 'overflow-hidden', 'position-relative', 'w-100'].includes(c)),
    children: []
  }
}

function parseMapEmbedBlock(el: Element): Block {
  const root = el.closest('[data-block-type="map-embed"]') || el
  const id = root.getAttribute('data-block-id') || generateBlockId()
  const classes = splitClasses(root)
  const styles = parseInlineStyles(root)
  const iframe = root.querySelector('iframe')

  return {
    id,
    type: 'map-embed',
    props: {
      embedUrl: iframe?.getAttribute('src') || 'https://maps.google.com/maps?q=New+York&t=&z=13&ie=UTF8&iwloc=&output=embed',
      height: iframe?.getAttribute('height') || '400px',
      borderRadius: '8px',
      grayscale: false,
      title: iframe?.getAttribute('title') || 'Location Map'
    },
    styles,
    classes: classes.filter((c) => !['w-full', 'overflow-hidden', 'w-100'].includes(c)),
    children: []
  }
}
