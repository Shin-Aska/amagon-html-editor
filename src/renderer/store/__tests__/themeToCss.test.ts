import { describe, expect, it } from 'vitest'
import { createDefaultTheme, themeToCSS } from '../../store/types'

describe('themeToCSS', () => {
  it('emits a baseline heading size scale so H1-H6 are visually distinct', () => {
    const css = themeToCSS(createDefaultTheme())

    expect(css).toContain('h1 { font-size: 2em; }')
    expect(css).toContain('h2 { font-size: 1.5em; }')
    expect(css).toContain('h3 { font-size: 1.17em; }')
    expect(css).toContain('h4 { font-size: 1em; }')
    expect(css).toContain('h5 { font-size: 0.83em; }')
    expect(css).toContain('h6 { font-size: 0.67em; }')
  })
})

