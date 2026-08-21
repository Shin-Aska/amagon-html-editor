import {describe, expect, it} from 'vitest'
import {createBlock} from '../../store/types'
import {
    animationClassForPreset,
    animationFromClassNameAndStyles,
    buildAnimationStyleVariables,
    buildBlockAnimation,
    buildAnimationStylesCss,
    clampDelayMs,
    clampDurationMs,
    clearAnimationFromBlock,
    defaultAnimation,
    getAnimationClasses,
    getAnimationPresentation,
    isBlockEligibleForAnimation,
    normalizeAnimationPreset,
    normalizeEasing,
    PRESETS,
    stripAnimationTokens,
    stripLegacyAnimationStyles
} from '../animationPresets'

describe('animationPresets catalog', () => {
    it('exposes all expected presets', () => {
        expect(PRESETS).toEqual([
            'fade',
            'slide-up',
            'slide-left',
            'slide-right',
            'scale',
            'zoom',
            'bounce'
        ])
    });

    it('labels every preset', () => {
        for (const preset of PRESETS) {
            expect(animationClassForPreset(preset)).toBe(`amagon-enter-${preset}`)
        }
    });

    it('normalizes preset values', () => {
        expect(normalizeAnimationPreset('fade')).toBe('fade');
        expect(normalizeAnimationPreset('SLIDE-UP')).toBe('slide-up');
        expect(normalizeAnimationPreset('unknown')).toBeUndefined();
        expect(normalizeAnimationPreset('')).toBeUndefined()
    });

    it('normalizes easing values', () => {
        expect(normalizeEasing('ease-in')).toBe('ease-in');
        expect(normalizeEasing(' EASE-OUT ')).toBe('ease-out');
        expect(normalizeEasing('unknown')).toBe('ease-out');
        expect(normalizeEasing(null)).toBe('ease-out')
    });

    it('clamps duration and delay to safe ranges', () => {
        expect(clampDurationMs(50)).toBe(100);
        expect(clampDurationMs(4000)).toBe(3000);
        expect(clampDurationMs(750)).toBe(750);
        expect(clampDelayMs(-100)).toBe(0);
        expect(clampDelayMs(3000)).toBe(2000);
        expect(clampDelayMs(250)).toBe(250)
    });

    it('builds default and custom animations', () => {
        expect(defaultAnimation('fade')).toEqual({
            preset: 'fade',
            durationMs: 600,
            delayMs: 0,
            easing: 'ease-out'
        });
        expect(buildBlockAnimation('bounce', '1200', '300', 'linear')).toEqual({
            preset: 'bounce',
            durationMs: 1200,
            delayMs: 300,
            easing: 'linear'
        })
    })
});

describe('animationPresets presentation', () => {
    it('returns empty presentation for ineligible blocks', () => {
        const block = createBlock('spacer', {
            animation: {preset: 'fade', durationMs: 600, delayMs: 0, easing: 'ease-out'}
        });
        expect(getAnimationPresentation(block)).toEqual({classes: [], styles: {}})
    });

    it('returns empty presentation when no animation exists', () => {
        const block = createBlock('heading');
        expect(getAnimationPresentation(block)).toEqual({classes: [], styles: {}})
    });

    it('builds classes and variables for eligible blocks', () => {
        const block = createBlock('heading', {
            animation: {preset: 'slide-up', durationMs: 500, delayMs: 100, easing: 'ease-in'}
        });
        expect(getAnimationClasses(block.animation)).toEqual([
            'amagon-enter-slide-up',
            'amagon-enter'
        ]);
        expect(buildAnimationStyleVariables(block.animation!)).toEqual({
            '--amagon-enter-duration': '500ms',
            '--amagon-enter-delay': '100ms',
            '--amagon-enter-easing': 'ease-in'
        });
        expect(getAnimationPresentation(block)).toEqual({
            classes: ['amagon-enter-slide-up', 'amagon-enter'],
            styles: {
                '--amagon-enter-duration': '500ms',
                '--amagon-enter-delay': '100ms',
                '--amagon-enter-easing': 'ease-in'
            }
        })
    });

    it('strips animation tokens from classes and styles', () => {
        const result = stripAnimationTokens(
            ['amagon-enter', 'amagon-enter-fade', 'mt-4'],
            {
                '--amagon-enter-duration': '600ms',
                '--amagon-enter-delay': '0ms',
                '--amagon-enter-easing': 'ease-out',
                color: 'red'
            }
        );
        expect(result.classes).toEqual(['mt-4']);
        expect(result.styles).toEqual({color: 'red'})
    });

    it('strips legacy animation styles including shorthand', () => {
        const result = stripLegacyAnimationStyles({
            animation: 'foo 1s ease-out',
            animationName: 'foo',
            animationDuration: '1s',
            color: 'red'
        });
        expect(result).toEqual({color: 'red'})
    });

    it('parses ms and seconds from imported CSS times', () => {
        const animation = animationFromClassNameAndStyles(
            ['amagon-enter-fade'],
            {
                '--amagon-enter-duration': '0.5s',
                '--amagon-enter-delay': '250ms',
                '--amagon-enter-easing': 'ease-in'
            }
        );
        expect(animation).toEqual({
            preset: 'fade',
            durationMs: 500,
            delayMs: 250,
            easing: 'ease-in'
        })
    });

    it('normalizes malformed imported CSS times to defaults', () => {
        const animation = animationFromClassNameAndStyles(
            ['amagon-enter-fade'],
            {
                '--amagon-enter-duration': 'abc',
                '--amagon-enter-delay': '',
                '--amagon-enter-easing': 'unknown'
            }
        );
        expect(animation).toEqual({
            preset: 'fade',
            durationMs: 600,
            delayMs: 0,
            easing: 'ease-out'
        })
    });

    it('clears animation from a block', () => {
        const block = createBlock('paragraph', {
            animation: {preset: 'zoom', durationMs: 400, delayMs: 0, easing: 'ease-out'},
            classes: ['amagon-enter', 'amagon-enter-zoom', 'lead'],
            styles: {
                '--amagon-enter-duration': '400ms',
                animationName: 'old',
                color: 'blue'
            }
        });
        const cleared = clearAnimationFromBlock(block);
        expect(cleared.animation).toBeUndefined();
        expect(cleared.classes).toEqual(['lead']);
        expect(cleared.styles).toEqual({color: 'blue'})
    })
});

describe('animationPresets round-trip', () => {
    it('recovers animation from classes and styles', () => {
        const animation = animationFromClassNameAndStyles(
            ['amagon-enter', 'amagon-enter-bounce', 'mt-4'],
            {
                '--amagon-enter-duration': '800ms',
                '--amagon-enter-delay': '200ms',
                '--amagon-enter-easing': 'linear'
            }
        );
        expect(animation).toEqual({
            preset: 'bounce',
            durationMs: 800,
            delayMs: 200,
            easing: 'linear'
        })
    });

    it('returns undefined when no preset class is present', () => {
        const animation = animationFromClassNameAndStyles(['mt-4'], {
            '--amagon-enter-duration': '600ms'
        });
        expect(animation).toBeUndefined()
    });

    it('uses defaults when variables are missing', () => {
        const animation = animationFromClassNameAndStyles(['amagon-enter-fade'], {});
        expect(animation).toEqual({
            preset: 'fade',
            durationMs: 600,
            delayMs: 0,
            easing: 'ease-out'
        })
    })
});

describe('animationPresets eligibility', () => {
    it('allows common widget roots', () => {
        for (const type of ['heading', 'paragraph', 'button', 'link', 'card', 'image', 'video', 'iframe', 'table', 'container']) {
            expect(isBlockEligibleForAnimation(type)).toBe(true)
        }
    });

    it('blocks excluded types', () => {
        for (const type of [
            'raw-html',
            'spacer',
            'divider',
            'modal',
            'offcanvas',
            'carousel',
            'spinner',
            'progress',
            'icon',
            'input',
            'textarea',
            'select',
            'checkbox',
            'radio',
            'range',
            'file-input',
            'breadcrumb',
            'pagination'
        ]) {
            expect(isBlockEligibleForAnimation(type)).toBe(false)
        }
    });

    it('rejects empty or non-string types', () => {
        expect(isBlockEligibleForAnimation('')).toBe(false);
        expect(isBlockEligibleForAnimation('  ')).toBe(false);
        expect(isBlockEligibleForAnimation('spacer ')).toBe(false)
    });

    it('emits CSS with keyframes for every preset', () => {
        const css = buildAnimationStylesCss();
        for (const preset of PRESETS) {
            expect(css).toContain(`@keyframes amagon-enter-${preset}`);
            expect(css).toContain(`.amagon-enter-${preset} {`)
        }
    });

    it('emits reduced-motion CSS that disables animations', () => {
        const css = buildAnimationStylesCss();
        const reducedMotionIndex = css.indexOf('@media (prefers-reduced-motion: reduce)');
        expect(reducedMotionIndex).toBeGreaterThan(0);
        const reducedBlock = css.slice(reducedMotionIndex);
        expect(reducedBlock).toContain('animation: none !important');
        expect(reducedBlock).toContain('opacity: 1 !important');
        expect(reducedBlock).toContain('translate: 0 0 !important');
        expect(reducedBlock).toContain('scale: 1 !important')
    });

    it('orders base class variables before keyframes and reduced-motion media query', () => {
        const css = buildAnimationStylesCss();
        const baseIndex = css.indexOf('.amagon-enter {');
        const keyframesIndex = css.indexOf('@keyframes amagon-enter-fade');
        const reducedMotionIndex = css.indexOf('@media (prefers-reduced-motion: reduce)');
        expect(baseIndex).toBeGreaterThan(0);
        expect(keyframesIndex).toBeGreaterThan(baseIndex);
        expect(reducedMotionIndex).toBeGreaterThan(keyframesIndex)
    })
});
