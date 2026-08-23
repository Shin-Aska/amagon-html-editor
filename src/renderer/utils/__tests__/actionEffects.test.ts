import {describe, expect, it, vi} from 'vitest'
import {createBlock} from '../../store/types'
import {
    actionEffectClassForPreset,
    actionEffectFromClassNames,
    buildActionEffectRuntimeScript,
    buildActionEffectStylesCss,
    clearActionEffectFromBlock,
    getActionEffectClasses,
    isBlockEligibleForActionEffect,
    stripActionEffectTokens
} from '../actionEffects'
import {triggerActionEffectFromTarget} from '../actionEffects'
import {cloneBlockTree} from '../../templates/templateFactories'

describe('action effect presets', () => {
    it('marks only genuinely activatable widgets as eligible', () => {
        const eligible = ['button', 'link', 'social-links', 'back-to-top'];
        for (const type of eligible) {
            expect(isBlockEligibleForActionEffect(type)).toBe(true)
        }

        const excluded = ['heading', 'paragraph', 'container', 'card', 'image', 'icon', 'input', 'checkbox', 'raw-html'];
        for (const type of excluded) {
            expect(isBlockEligibleForActionEffect(type)).toBe(false)
        }
    });

    it('builds stable preset classes', () => {
        expect(actionEffectClassForPreset('pulse')).toBe('amagon-action-pulse');
        expect(getActionEffectClasses({preset: 'shake'})).toEqual(['amagon-action-shake', 'amagon-action'])
    });

    it('ignores unknown preset names during import', () => {
        expect(actionEffectFromClassNames(['amagon-action', 'amagon-action-pop'])).toEqual({preset: 'pop'});
        expect(actionEffectFromClassNames(['amagon-action', 'amagon-action-spin'])).toBeUndefined()
    });

    it('strips generated classes from custom class storage', () => {
        expect(stripActionEffectTokens(['btn', 'amagon-action', 'amagon-action-press'])).toEqual(['btn'])
    });

    it('clears action effect metadata and generated classes from a block', () => {
        const block = createBlock('button', {
            classes: ['btn', 'amagon-action', 'amagon-action-press'],
            actionEffect: {preset: 'press'}
        });

        const cleared = clearActionEffectFromBlock(block);

        expect(cleared.classes).toEqual(['btn']);
        expect(cleared.actionEffect).toBeUndefined()
    });

    it('generates replayable action CSS with a reduced-motion fallback', () => {
        const css = buildActionEffectStylesCss();

        expect(css).toContain('.amagon-action-press.amagon-action-active');
        expect(css).toContain('@keyframes amagon-action-press');
        expect(css).toContain('@media (prefers-reduced-motion: reduce)');
        expect(css).toContain('animation: none !important')
    });

    it('supports full and reduced editor preview overrides', () => {
        const fullCss = buildActionEffectStylesCss('full');
        const reducedCss = buildActionEffectStylesCss('reduced');

        expect(fullCss).not.toContain('@media (prefers-reduced-motion: reduce)');
        expect(fullCss).not.toContain('animation: none !important');
        expect(reducedCss).not.toContain('@media (prefers-reduced-motion: reduce)');
        expect(reducedCss).toContain('animation: none !important')
    });

    it('generates a delegated pointer and keyboard activation runtime', () => {
        const runtime = buildActionEffectRuntimeScript();

        expect(runtime).toContain("addEventListener('pointerdown'");
        expect(runtime).toContain("addEventListener('click'");
        expect(runtime).toContain("addEventListener('keydown'");
        expect(runtime).toContain("event.key !== 'Enter' && event.key !== ' '");
        expect(runtime).toContain('event.detail !== 0');
        expect(runtime).toContain('amagon-action-active')
    });

    it('clears the active class after the longest preset duration', () => {
        const button = document.createElement('button');
        const label = document.createElement('span');
        button.className = 'amagon-action amagon-action-press';
        button.style.animationName = 'amagon-action-press';
        button.appendChild(label);

        vi.useFakeTimers();
        try {
            triggerActionEffectFromTarget(label);
            expect(button.classList.contains('amagon-action-active')).toBe(true);

            vi.advanceTimersByTime(399);
            expect(button.classList.contains('amagon-action-active')).toBe(true);
            vi.advanceTimersByTime(1);
            expect(button.classList.contains('amagon-action-active')).toBe(false)
        } finally {
            vi.useRealTimers()
        }
    });

    it('does not let an older cleanup timer cancel a replay', () => {
        const button = document.createElement('button');
        button.className = 'amagon-action amagon-action-press';
        button.style.animationName = 'amagon-action-press';

        vi.useFakeTimers();
        try {
            triggerActionEffectFromTarget(button);
            vi.advanceTimersByTime(300);
            triggerActionEffectFromTarget(button);

            vi.advanceTimersByTime(100);
            expect(button.classList.contains('amagon-action-active')).toBe(true);
            vi.advanceTimersByTime(300);
            expect(button.classList.contains('amagon-action-active')).toBe(false)
        } finally {
            vi.useRealTimers()
        }
    });

    it('cleans up immediately when reduced motion disables the animation', async () => {
        const button = document.createElement('button');
        button.className = 'amagon-action amagon-action-press';

        triggerActionEffectFromTarget(button);
        expect(button.classList.contains('amagon-action-active')).toBe(true);

        await Promise.resolve();
        expect(button.classList.contains('amagon-action-active')).toBe(false)
    });

    it('runs the generated runtime for pointer and keyboard activation', () => {
        const frame = document.createElement('iframe');
        document.body.appendChild(frame);
        const frameWindow = frame.contentWindow;
        const frameDocument = frame.contentDocument;
        if (!frameWindow || !frameDocument) {
            throw new Error('Expected an iframe document for runtime verification')
        }
        const runtimeWindow = frameWindow as Window & typeof globalThis;

        const button = frameDocument.createElement('button');
        button.className = 'amagon-action amagon-action-pop';
        frameDocument.body.appendChild(button);
        runtimeWindow.eval(buildActionEffectRuntimeScript());

        button.dispatchEvent(new runtimeWindow.MouseEvent('pointerdown', {bubbles: true}));
        expect(button.classList.contains('amagon-action-active')).toBe(true);

        button.dispatchEvent(new runtimeWindow.KeyboardEvent('keydown', {bubbles: true, key: 'Enter'}));
        expect(button.classList.contains('amagon-action-active')).toBe(true);

        frame.remove()
    });

    it('preserves action effects through production cloning', () => {
        const original = createBlock('button', {actionEffect: {preset: 'pop'}});

        const cloned = cloneBlockTree(original);

        expect(cloned.actionEffect).toEqual(original.actionEffect);
        expect(cloned.actionEffect).not.toBe(original.actionEffect)
    })
});
