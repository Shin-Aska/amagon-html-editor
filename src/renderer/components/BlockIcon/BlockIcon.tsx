import { Suspense } from 'react'
import { getLucideIconComponent, getLazyLucideIcon } from '../../utils/iconCatalog'

interface BlockIconProps {
  name: string
  className?: string
}

function BlockIconInner({ name, className }: BlockIconProps): JSX.Element {
  const IconComponent = getLucideIconComponent(name)
  if (IconComponent) {
    return <IconComponent className={className} size={16} />
  }

  const LazyIcon = getLazyLucideIcon(name)
  if (LazyIcon) {
    return <LazyIcon className={className} size={16} />
  }

  const DefaultIcon = getLucideIconComponent('default')!
  return <DefaultIcon className={className} size={16} />
}

export default function BlockIcon({ name, className }: BlockIconProps): JSX.Element {
  return (
    <Suspense fallback={<div className={className} style={{ width: 16, height: 16 }} />}>
      <BlockIconInner name={name} className={className} />
    </Suspense>
  )
}
