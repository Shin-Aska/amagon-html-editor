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
  Code
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
  
  // Typography
  'heading': Heading,
  'paragraph': Type,
  
  // Media
  'image': Image,
  'video': Video,
  'icon': Star,
  'carousel': GalleryHorizontal,
  
  // Interactive
  'button': MousePointerClick,
  'link': Link,
  'form': FormInput,
  
  // Other
  'user-block': Puzzle,
  'default': BoxSelect,
  'code': Code
}

export default function BlockIcon({ name, className }: BlockIconProps): JSX.Element {
  const IconComponent = ICONS[name.toLowerCase()] || ICONS['default']
  return <IconComponent className={className} size={16} />
}
