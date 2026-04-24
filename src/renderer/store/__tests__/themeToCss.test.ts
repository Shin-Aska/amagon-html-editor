import {describe, expect, it} from 'vitest'
import {createDefaultTheme, themeToCSS} from '../../store/types'

describe('themeToCSS', () => {
  it('emits a baseline heading size scale so H1-H6 are visually distinct', () => {
    const css = themeToCSS(createDefaultTheme());

    expect(css).toContain('h1 { font-size: 2em; }');
    expect(css).toContain('h2 { font-size: 1.5em; }');
    expect(css).toContain('h3 { font-size: 1.17em; }');
    expect(css).toContain('h4 { font-size: 1em; }');
    expect(css).toContain('h5 { font-size: 0.83em; }');
    expect(css).toContain('h6 { font-size: 0.67em; }')
  });

  it('can emit @font-face rules with export-friendly relative URLs', () => {
    const css = themeToCSS(
      createDefaultTheme(),
      undefined,
      [
        {
          id: 'font_1',
          name: 'My Font',
          fileName: 'MyFont-Regular.woff2',
          relativePath: 'assets/fonts/MyFont-Regular.woff2',
          format: 'woff2',
          weight: '400',
          style: 'normal',
          source: 'imported'
        }
      ],
      { fontUrlPrefix: './' }
    );

    expect(css).toContain('@font-face {');
    expect(css).toContain('font-family: "My Font";');
    expect(css).toContain('src: url("./assets/fonts/MyFont-Regular.woff2");');
    expect(css).toContain('font-weight: 400;');
    expect(css).toContain('font-style: normal;')
  })
});
