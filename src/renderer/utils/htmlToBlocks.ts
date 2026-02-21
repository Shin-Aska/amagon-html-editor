import type { Block } from '../store/types'
import { generateBlockId } from '../store/types'
import { parse } from 'parse5'

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
const SKIP_ATTRS = new Set(['class', 'style', 'data-block-id'])

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

  for (const node of Array.from(parent.childNodes)) {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    'span': 'span'
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
