import { getLucideIconComponent } from '../../utils/iconCatalog'

interface BlockIconProps {
  name: string
  className?: string
}

export default function BlockIcon({ name, className }: BlockIconProps): JSX.Element {
  const IconComponent = getLucideIconComponent(name) || getLucideIconComponent('default')!
  return <IconComponent className={className} size={16} />
}
