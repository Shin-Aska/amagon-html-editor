import type { LucideIcon } from 'lucide-react'
import {
  Square,
  Columns,
  Rows,
  Minus,
  Heading,
  Type,
  Image,
  Video,
  Star,
  GalleryHorizontal,
  MousePointerClick,
  Link,
  FormInput,
  BoxSelect,
  Puzzle,
  Code,
  LayoutTemplate,
  Quote,
  Braces,
  List,
  TextCursorInput,
  AlignLeft,
  CheckSquare,
  ChevronDown,
  PanelTop,
  Sparkles,
  CreditCard,
  PanelBottom,
  ChevronsUpDown,
  BookOpen,
  DollarSign,
  MessageCircle,
  Megaphone,
  AppWindow,
  FileCode,
  Globe,
  Newspaper,
  Bell,
  Badge,
  ChartColumn,
  CircleDot,
  Clock,
  FileInput,
  Footprints,
  Images,
  ListOrdered,
  Map,
  PanelLeft,
  Radio,
  SlidersHorizontal,
  Table,
  TableProperties,
  Timer,
  Users,
  Workflow,
  Building2,
  Mail,
  Cookie,
  ArrowUp,
  SquareChartGantt,
  Rocket,
  Circle,
  Search,
  Wrench,
  Trophy
} from 'lucide-react'

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
  'map-embed': Map,
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
