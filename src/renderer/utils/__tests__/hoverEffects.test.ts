import {describe, expect, it} from 'vitest'
import {
    buildHoverEffectStylesCss,
    clearHoverEffectFromBlock,
    defaultHoverEffect,
    getHoverEffectClasses,
    hoverEffectClassForPreset,
    hoverEffectFromClassNames,
    isBlockEligibleForHoverEffect,
    stripHoverEffectTokens
} from '../hoverEffects'
import {createBlock} from '../../store/types'

describe('hover effect presets', () => {
    it('marks only selected interactive and media widgets as eligible', () => {
        const eligible = ['button', 'link', 'card', 'image', 'icon', 'social-links', 'back-to-top'];
        for (const type of eligible) {
            expect(isBlockEligibleForHoverEffect(type)).toBe(true)
        }

        const excluded = ['heading', 'paragraph', 'container', 'input', 'checkbox', 'radio', 'range', 'file-input', 'breadcrumb', 'pagination', 'raw-html'];
        for (const type of excluded) {
            expect(isBlockEligibleForHoverEffect(type)).toBe(false)
        }
    });

    it('builds stable preset classes', () => {
        expect(defaultHoverEffect('lift')).toEqual({preset: 'lift'});
        expect(hoverEffectClassForPreset('glow')).toBe('amagon-hover-glow');
        expect(getHoverEffectClasses({preset: 'shadow'})).toEqual(['amagon-hover-shadow', 'amagon-hover'])
    });

    it('ignores unknown preset names during import', () => {
        expect(hoverEffectFromClassNames(['amagon-hover', 'amagon-hover-lift'])).toEqual({preset: 'lift'});
        expect(hoverEffectFromClassNames(['amagon-hover', 'amagon-hover-spin'])).toBeUndefined()
    });

    it('strips generated classes from custom class storage', () => {
        expect(stripHoverEffectTokens(['btn', 'amagon-hover', 'amagon-hover-glow'])).toEqual(['btn'])
    });

    it('clears hover effect metadata and generated classes from a block', () => {
        const block = createBlock('button', {
            classes: ['btn', 'amagon-hover', 'amagon-hover-lift'],
            hoverEffect: {preset: 'lift'}
        });

        const cleared = clearHoverEffectFromBlock(block);

        expect(cleared.classes).toEqual(['btn']);
        expect(cleared.hoverEffect).toBeUndefined()
    });

    it('generates hover-capable CSS with reduced-motion fallback', () => {
        const css = buildHoverEffectStylesCss();

        expect(css).toContain('.amagon-hover');
        expect(css).toContain('.amagon-hover-lift:hover');
        expect(css).toContain('@media (hover: hover) and (pointer: fine)');
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
        expect(css).toContain('transition-property: transform, opacity, filter, box-shadow, color, background-color, border-color')
    })

    it('supports full and reduced editor preview overrides', () => {
        const fullCss = buildHoverEffectStylesCss('full');
        const reducedCss = buildHoverEffectStylesCss('reduced');

        expect(fullCss).not.toContain('@media (prefers-reduced-motion: reduce)');
        expect(fullCss).not.toContain('transition-duration: 0.01ms !important');
        expect(reducedCss).not.toContain('@media (prefers-reduced-motion: reduce)');
        expect(reducedCss).toContain('transition-duration: 0.01ms !important')
    })
});
