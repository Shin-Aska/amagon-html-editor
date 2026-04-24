import type {LucideIcon} from 'lucide-react'
import {
    AlignLeft,
    AppWindow,
    ArrowUp,
    Badge,
    Bell,
    BookOpen,
    BoxSelect,
    Braces,
    Building2,
    ChartColumn,
    CheckSquare,
    ChevronDown,
    ChevronsUpDown,
    Circle,
    CircleDot,
    Clock,
    Code,
    Columns,
    Cookie,
    CreditCard,
    DollarSign,
    FileCode,
    FileInput,
    Footprints,
    FormInput,
    GalleryHorizontal,
    Globe,
    Heading,
    Image,
    Images,
    LayoutTemplate,
    Link,
    List,
    ListOrdered,
    Mail,
    Map as MapIcon,
    Megaphone,
    MessageCircle,
    Minus,
    MousePointerClick,
    Newspaper,
    PanelBottom,
    PanelLeft,
    PanelTop,
    Puzzle,
    Quote,
    Radio,
    Rocket,
    Rows,
    Search,
    SlidersHorizontal,
    Sparkles,
    Square,
    SquareChartGantt,
    Star,
    Table,
    TableProperties,
    TextCursorInput,
    Timer,
    Trophy,
    Type,
    Users,
    Video,
    Workflow,
    Wrench
} from 'lucide-react'
import dynamicIconImports from 'lucide-react/dynamicIconImports'
import React from 'react'
import lucideIconCatalog from '../data/lucideIconCatalog.json'

function normalizeLucideKey(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

const genericLucideIcons: Record<string, LucideIcon> = {
  square: Square,
  columns: Columns,
  rows: Rows,
  minus: Minus,
  heading: Heading,
  type: Type,
  image: Image,
  video: Video,
  star: Star,
  galleryhorizontal: GalleryHorizontal,
  mousepointerclick: MousePointerClick,
  link: Link,
  forminput: FormInput,
  boxselect: BoxSelect,
  puzzle: Puzzle,
  code: Code,
  layouttemplate: LayoutTemplate,
  quote: Quote,
  braces: Braces,
  list: List,
  textcursorinput: TextCursorInput,
  alignleft: AlignLeft,
  checksquare: CheckSquare,
  chevrondown: ChevronDown,
  paneltop: PanelTop,
  sparkles: Sparkles,
  creditcard: CreditCard,
  panelbottom: PanelBottom,
  chevronsupdown: ChevronsUpDown,
  bookopen: BookOpen,
  dollarsign: DollarSign,
  messagecircle: MessageCircle,
  megaphone: Megaphone,
  appwindow: AppWindow,
  filecode: FileCode,
  globe: Globe,
  newspaper: Newspaper,
  rocket: Rocket,
  circle: Circle,
  search: Search,
  wrench: Wrench,
  trophy: Trophy
}

const blockAliasIcons: Record<string, LucideIcon> = {
  container: Square,
  row: Rows,
  column: Columns,
  divider: Minus,
  section: LayoutTemplate,
  paragraph: Type,
  blockquote: Quote,
  'code-block': Braces,
  icon: Star,
  carousel: GalleryHorizontal,
  button: MousePointerClick,
  form: FormInput,
  input: TextCursorInput,
  textarea: AlignLeft,
  checkbox: CheckSquare,
  select: ChevronDown,
  navbar: PanelTop,
  hero: Sparkles,
  'feature-card': CreditCard,
  footer: PanelBottom,
  accordion: ChevronsUpDown,
  tabs: BookOpen,
  'pricing-table': DollarSign,
  testimonial: MessageCircle,
  'cta-section': Megaphone,
  modal: AppWindow,
  'blog-list': Newspaper,
  'page-list': Newspaper,
  'raw-html': FileCode,
  iframe: Globe,
  alert: Bell,
  badge: Badge,
  progress: ChartColumn,
  spinner: Timer,
  radio: Radio,
  range: SlidersHorizontal,
  'file-input': FileInput,
  breadcrumb: Footprints,
  pagination: ListOrdered,
  table: Table,
  dropdown: ChevronDown,
  offcanvas: PanelLeft,
  card: CreditCard,
  'stats-section': ChartColumn,
  'team-grid': Users,
  gallery: Images,
  timeline: Clock,
  'logo-cloud': Building2,
  'process-steps': Workflow,
  newsletter: Mail,
  'comparison-table': TableProperties,
  'contact-card': Badge,
  'social-links': Link,
  'cookie-banner': Cookie,
  'back-to-top': ArrowUp,
  countdown: Timer,
  'before-after': SquareChartGantt,
  'map-embed': MapIcon,
  spacer: ChevronsUpDown,
  list: List,
  link: Link,
  page: Newspaper,
  item: CircleDot,
  'user-block': Puzzle,
  default: BoxSelect
}

export const lucideIconComponents: Record<string, LucideIcon> = {
  ...genericLucideIcons,
  ...Object.fromEntries(
    Object.entries(blockAliasIcons).map(([key, component]) => [normalizeLucideKey(key), component])
  )
}

export const lucidePickerIcons = [
  'star',
  'image',
  'video',
  'square',
  'columns',
  'rows',
  'layouttemplate',
  'sparkles',
  'globe',
  'link',
  'code',
  'messagecircle',
  'newspaper',
  'bookopen',
  'creditcard',
  'dollarsign',
  'puzzle',
  'megaphone',
  'appwindow',
  'paneltop',
  'panelbottom',
  'chevrondown',
  'checksquare',
  'list',
  'quote',
  'rocket',
  'circle',
  'search',
  'wrench',
  'trophy'
]

export function getLucideIconComponent(name: string): LucideIcon | null {
  return lucideIconComponents[normalizeLucideKey(name)] || null
}

export function mapLegacyBootstrapIcon(value: string): string | null {
  const trimmed = String(value || '').trim().toLowerCase()
  if (!trimmed.startsWith('bi-')) return null
  if (trimmed.includes('star')) return 'star'
  if (trimmed.includes('image') || trimmed.includes('card-image')) return 'image'
  if (trimmed.includes('play') || trimmed.includes('camera-video') || trimmed.includes('film')) return 'video'
  if (trimmed.includes('link')) return 'link'
  if (trimmed.includes('globe')) return 'globe'
  if (trimmed.includes('code')) return 'code'
  if (trimmed.includes('chat') || trimmed.includes('message')) return 'messagecircle'
  if (trimmed.includes('book')) return 'bookopen'
  if (trimmed.includes('newspaper')) return 'newspaper'
  if (trimmed.includes('sparkle') || trimmed.includes('magic')) return 'sparkles'
  if (trimmed.includes('layout') || trimmed.includes('window')) return 'layouttemplate'
  return null
}

export function isRenderableGlyph(value: string): boolean {
  const trimmed = String(value || '').trim()
  if (!trimmed) return false
  if (trimmed.startsWith('lucide:')) return true
  if (trimmed.startsWith('bi-')) return false
  if (/^[\u2500-\u257F\u2580-\u259F\u25A0-\u25FF]$/.test(trimmed)) return false
  if (trimmed === '☐' || trimmed === '☑' || trimmed === '▢' || trimmed === '▣' || trimmed === '▭' || trimmed === '🔲' || trimmed === '🔳') return false
  return true
}

const dynamicImportsMap = dynamicIconImports as Record<string, () => Promise<{ default: LucideIcon }>>

export const allLucideIconNames: string[] = Object.keys(dynamicImportsMap).sort()

const normalizedDynamicImports = new Map<string, () => Promise<{ default: LucideIcon }>>()
Object.entries(dynamicImportsMap).forEach(([rawName, loader]) => {
  normalizedDynamicImports.set(normalizeLucideKey(rawName), loader)
})

type LazyIconComponent = React.ComponentType<{ size?: number; className?: string }>

const lazyIconCache = new Map<string, LazyIconComponent>()

export function getLazyLucideIcon(name: string): LazyIconComponent | null {
  const key = normalizeLucideKey(name)
  const loader = normalizedDynamicImports.get(key)
  if (!loader) return null
  if (!lazyIconCache.has(key)) {
    lazyIconCache.set(key, React.lazy(loader))
  }
  return lazyIconCache.get(key)!
}

export function isKnownLucideIcon(name: string): boolean {
  const key = normalizeLucideKey(name)
  return !!lucideIconComponents[key] || normalizedDynamicImports.has(key)
}

type IconNode = [string, Record<string, string>]

const normalizedIconCatalog = new Map<string, IconNode[]>()
const rawIconCatalog = lucideIconCatalog as Record<string, unknown>

Object.entries(rawIconCatalog).forEach(([rawName, rawNodes]) => {
  const nodes: IconNode[] = Array.isArray(rawNodes)
    ? rawNodes.flatMap((rawNode) => {
        if (!Array.isArray(rawNode) || rawNode.length !== 2) return []

        const [tag, attrs] = rawNode
        if (typeof tag !== 'string' || !attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return []

        return [[tag, Object.fromEntries(
          Object.entries(attrs).map(([key, value]) => [key, String(value)])
        )]]
      })
    : []

  normalizedIconCatalog.set(normalizeLucideKey(rawName), nodes)
})

function escapeSvgAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function iconNodeToSvgMarkup(nodes: IconNode[]): string {
  return nodes
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${escapeSvgAttr(v)}"`)
        .join(' ')
      return `<${tag} ${attrStr}></${tag}>`
    })
    .join('')
}

export function renderLucideIconSvg(
  name: string,
  options: { size?: string | number; strokeWidth?: number } = {}
): string | null {
  const key = normalizeLucideKey(name)
  const nodes = normalizedIconCatalog.get(key)
  if (!nodes || nodes.length === 0) return null

  const size = options.size ?? '1em'
  const strokeWidth = options.strokeWidth ?? 2.25
  const sizeAttr = typeof size === 'number' ? `${size}px` : size

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${escapeSvgAttr(sizeAttr)}" height="${escapeSvgAttr(sizeAttr)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">` +
    iconNodeToSvgMarkup(nodes) +
    `</svg>`
  )
}
