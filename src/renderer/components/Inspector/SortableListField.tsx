import type {ReactNode} from 'react'

type Props = {
  items: string[]
  onChange: (items: string[]) => void
  labelForItem?: (item: string) => ReactNode
}

function SortableListField({ items, onChange, labelForItem }: Props): JSX.Element {
  const move = (from: number, to: number) => {
    if (from === to) return
    if (from < 0 || from >= items.length) return
    if (to < 0 || to >= items.length) return

    const next = items.slice()
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  return (
    <div className="sortable-list">
      {items.map((item, idx) => (
        <div key={item} className="sortable-list-item">
          <div className="sortable-list-label">{labelForItem ? labelForItem(item) : item}</div>
          <div className="sortable-list-actions">
            <button
              type="button"
              className="sortable-list-button"
              onClick={() => move(idx, idx - 1)}
              disabled={idx === 0}
              aria-label="Move up"
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className="sortable-list-button"
              onClick={() => move(idx, idx + 1)}
              disabled={idx === items.length - 1}
              aria-label="Move down"
              title="Move down"
            >
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default SortableListField
