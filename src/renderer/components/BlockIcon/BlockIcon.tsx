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
  Globe
} from 'lucide-react'

interface BlockIconProps {
  name: string
  className?: string
}

const ICONS: Record<string, any> = {
  // Layout
  'container': Square,
  'row': Rows,
  'column': Columns,
  'divider': Minus,
  'section': LayoutTemplate,
  
  // Typography
  'heading': Heading,
  'paragraph': Type,
  'blockquote': Quote,
  'code-block': Braces,
  'list': List,
  
  // Media
  'image': Image,
  'video': Video,
  'icon': Star,
  'carousel': GalleryHorizontal,
  
  // Interactive
  'button': MousePointerClick,
  'link': Link,
  'form': FormInput,
  'input': TextCursorInput,
  'textarea': AlignLeft,
  'checkbox': CheckSquare,
  'select': ChevronDown,
  
  // Components
  'navbar': PanelTop,
  'hero': Sparkles,
  'feature-card': CreditCard,
  'footer': PanelBottom,
  'accordion': ChevronsUpDown,
  'tabs': BookOpen,
  'pricing-table': DollarSign,
  'testimonial': MessageCircle,
  'cta-section': Megaphone,
  'modal': AppWindow,
  
  // Embed
  'raw-html': FileCode,
  'iframe': Globe,
  
  // Other
  'user-block': Puzzle,
  'default': BoxSelect,
  'code': Code
}

export default function BlockIcon({ name, className }: BlockIconProps): JSX.Element {
  const IconComponent = ICONS[name.toLowerCase()] || ICONS['default']
  return <IconComponent className={className} size={16} />
}
