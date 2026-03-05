import type { ReactNode } from 'react'

export type PropType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'color'
  | 'image'
  | 'icon'
  | 'measurement' // e.g. "10px", "1rem"
  | 'array' // for lists
  | 'combobox' // editable dropdown with suggestions
  | 'url' // URL input with page suggestions

export interface PropSchema {
  type: PropType
  label: string
  description?: string
  default?: any
  options?: { label: string; value: string | number | boolean }[] // for select
  min?: number
  max?: number
  step?: number
  group?: string // for grouping in inspector
  dataSource?: string // for combobox: e.g. 'tags' to pull options from project tags
}

export interface BlockDefinition {
  type: string
  label: string
  category: string
  icon?: ReactNode | string
  description?: string
  defaultProps?: Record<string, unknown>
  defaultClasses?: string[]
  defaultStyles?: Record<string, string>
  defaultChildren?: any[] // Simplified for now
  propsSchema: Record<string, PropSchema>
  // template? - Rendering is currently handled by blockToHtml, but we might move it here later
}

class ComponentRegistry {
  private definitions: Map<string, BlockDefinition> = new Map()
  private categories: Set<string> = new Set()

  register(definition: BlockDefinition): void {
    if (this.definitions.has(definition.type)) {
      console.warn(`Block type "${definition.type}" is already registered. Overwriting.`)
    }
    this.definitions.set(definition.type, definition)
    this.categories.add(definition.category)
  }

  get(type: string): BlockDefinition | undefined {
    return this.definitions.get(type)
  }

  getAll(): BlockDefinition[] {
    return Array.from(this.definitions.values())
  }

  getByCategory(category: string): BlockDefinition[] {
    return this.getAll().filter((def) => def.category === category)
  }

  getCategories(): string[] {
    return Array.from(this.categories)
  }
}

export const componentRegistry = new ComponentRegistry()
