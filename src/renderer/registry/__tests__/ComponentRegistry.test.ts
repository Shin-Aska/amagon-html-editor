import { describe, expect, it } from 'vitest'
import { buildDefaultBlockProps, componentRegistry } from '../ComponentRegistry'
import { registerBlocks } from '../registerBlocks'

describe('buildDefaultBlockProps', () => {
  it('materializes schema defaults for checkbox blocks', () => {
    registerBlocks()
    const definition = componentRegistry.get('checkbox')
    expect(definition).toBeDefined()

    const props = buildDefaultBlockProps(definition!)
    expect(props.label).toBe('Check me')
    expect(props.checked).toBe(false)
    expect(props.name).toBe('')
  })
})
