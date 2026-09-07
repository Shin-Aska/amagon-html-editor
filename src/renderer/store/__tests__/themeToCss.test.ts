import {describe, expect, it} from 'vitest'
import {createDefaultTheme, createDefaultThemeVariants, themeToCSS} from '../types'

describe('themeToCSS', () => {
    it('emits opt-in palette transitions with reduced-motion protection', () => {
        // Given
        const theme = createDefaultTheme();
        const variants = {...createDefaultThemeVariants(theme), transitionEnabled: true};
        // When
        const css = themeToCSS(theme, variants);
        // Then
        expect(css).toContain('@property --theme-bg');
        expect(css).toContain('@media (prefers-reduced-motion: no-preference)');
        expect(css).toContain('--theme-bg var(--theme-transition-duration) ease-in-out');
        expect(css).not.toContain('transition: all');
    });

    it('honors full and reduced canvas motion overrides without changing export defaults', () => {
        const theme = createDefaultTheme();
        const variants = {...createDefaultThemeVariants(theme), transitionEnabled: true};
        const full = themeToCSS(theme, variants, [], {motionPreviewMode: 'full'});
        const reduced = themeToCSS(theme, variants, [], {motionPreviewMode: 'reduced'});
        expect(full).toContain('--theme-transition-duration');
        expect(full).not.toContain('@media (prefers-reduced-motion: no-preference)');
        expect(reduced).not.toContain('--theme-transition-duration');
        expect(themeToCSS(theme, {...variants, transitionEnabled: false}, [], {motionPreviewMode: 'full'})).not.toContain('--theme-transition-duration');
    });

    it('keeps transitions absent for existing projects and an unchecked setting', () => {
        // Given
        const theme = createDefaultTheme();
        const variants = createDefaultThemeVariants(theme);
        // When
        const outputs = [themeToCSS(theme), themeToCSS(theme, variants), themeToCSS(theme, {...variants, transitionEnabled: false})];
        // Then
        for (const css of outputs) expect(css).not.toContain('--theme-transition-duration');
    });

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
            {fontUrlPrefix: './'}
        );

        expect(css).toContain('@font-face {');
        expect(css).toContain('font-family: "My Font";');
        expect(css).toContain('src: url("./assets/fonts/MyFont-Regular.woff2");');
        expect(css).toContain('font-weight: 400;');
        expect(css).toContain('font-style: normal;')
    })
});
