import {describe, expect, it, vi} from 'vitest'
import {createElement, act, useState} from 'react'
import {createRoot} from 'react-dom/client'
import userEvent from '@testing-library/user-event'
import {AnimationEditor, HoverEffectEditor} from '../StyleEditors'
import type {BlockAnimation, BlockHoverEffect} from '../../../store/types'

(globalThis as unknown as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

function renderIntoContainer(element: React.ReactElement): {container: HTMLElement; unmount: () => void} {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(element));
    return {
        container,
        unmount() {
            act(() => root.unmount());
            document.body.removeChild(container)
        }
    }
}

function queryBySelector(container: HTMLElement, selector: string): HTMLElement | null {
    return container.querySelector(selector)
}

function mustSelect(container: HTMLElement, selector: string): HTMLElement {
    const el = queryBySelector(container, selector);
    if (!el) {
        throw new Error(`Selector "${selector}" not found in:\n${container.innerHTML.slice(0, 2000)}`)
    }
    return el
}

function presetRadio(container: HTMLElement, label: string): HTMLInputElement {
    const radios = Array.from(container.querySelectorAll('input[type="radio"][name="animation-preset"]')) as HTMLInputElement[];
    const found = radios.find((radio) => radio.parentElement?.textContent?.trim() === label);
    if (!found) {
        throw new Error(`Preset radio "${label}" not found`)
    }
    return found
}

function hoverEffectRadio(container: HTMLElement, label: string): HTMLInputElement {
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"][name="hover-effect-preset"]'));
    const found = radios.find((radio) => radio.parentElement?.textContent?.trim() === label);
    if (!found) {
        throw new Error(`Hover effect radio "${label}" not found`)
    }
    return found
}

function ControlledAnimationEditor({
    initialAnimation,
    onChange
}: {
    initialAnimation: BlockAnimation
    onChange: (animation?: BlockAnimation) => void
}): JSX.Element {
    const [animation, setAnimation] = useState<BlockAnimation | undefined>(initialAnimation);
    return createElement(AnimationEditor, {
        eligible: true,
        animation,
        onChange: (nextAnimation) => {
            setAnimation(nextAnimation);
            onChange(nextAnimation)
        }
    })
}

function ControlledHoverEffectEditor({
    initialHoverEffect,
    onChange
}: {
    initialHoverEffect: BlockHoverEffect
    onChange: (hoverEffect?: BlockHoverEffect) => void
}): JSX.Element {
    const [hoverEffect, setHoverEffect] = useState<BlockHoverEffect | undefined>(initialHoverEffect);
    return createElement(HoverEffectEditor, {
        eligible: true,
        hoverEffect,
        onChange: (nextHoverEffect) => {
            setHoverEffect(nextHoverEffect);
            onChange(nextHoverEffect)
        }
    })
}

describe('AnimationEditor', () => {
    it('renders the preset grid with None selected by default', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(AnimationEditor, {eligible: true, onChange})
        );

        const grid = mustSelect(container, '[role="radiogroup"]');
        expect(grid).not.toBeNull();
        const radios = Array.from(container.querySelectorAll('input[type="radio"][name="animation-preset"]')) as HTMLInputElement[];
        expect(radios.length).toBe(8);
        expect(presetRadio(container, 'None').checked).toBe(true);
        unmount()
    });

    it('selects a preset and exposes timing controls', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(AnimationEditor, {
                eligible: true,
                animation: {preset: 'fade', durationMs: 600, delayMs: 0, easing: 'ease-out'},
                onChange
            })
        );

        expect(presetRadio(container, 'Fade').checked).toBe(true);
        expect(mustSelect(container, '#animation-duration') as HTMLInputElement).toBeTruthy();
        expect(mustSelect(container, '#animation-delay') as HTMLInputElement).toBeTruthy();
        expect(mustSelect(container, '#animation-easing') as HTMLSelectElement).toBeTruthy();
        expect((mustSelect(container, '#animation-easing') as HTMLSelectElement).value).toBe('ease-out');
        unmount()
    });

    it('fires onChange with the selected preset', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(AnimationEditor, {eligible: true, onChange})
        );

        const bounce = presetRadio(container, 'Bounce');
        act(() => {
            bounce.click();
        });

        const call = onChange.mock.calls[0][0] as BlockAnimation;
        expect(call.preset).toBe('bounce');
        expect(call.durationMs).toBe(600);
        expect(call.delayMs).toBe(0);
        expect(call.easing).toBe('ease-out');
        unmount()
    });

    it('clears animation when None is selected', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(AnimationEditor, {
                eligible: true,
                animation: {preset: 'zoom', durationMs: 400, delayMs: 100, easing: 'ease-in'},
                onChange
            })
        );

        const none = presetRadio(container, 'None');
        act(() => none.click());

        expect(onChange).toHaveBeenCalledWith(undefined);
        unmount()
    });

    it('updates duration on change', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(AnimationEditor, {
                eligible: true,
                animation: {preset: 'slide-up', durationMs: 600, delayMs: 0, easing: 'ease-out'},
                onChange
            })
        );

        const duration = mustSelect(container, '#animation-duration') as HTMLInputElement;
        act(() => {
            const prototype = Object.getPrototypeOf(duration);
            const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
            descriptor?.set?.call(duration, '800');
            duration.dispatchEvent(new Event('input', {bubbles: true}))
        });

        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({durationMs: 800}));
        unmount()
    });

    it('shows an ineligible message when not eligible', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(AnimationEditor, {eligible: false, onChange})
        );

        expect(container.textContent).toContain('does not support entrance animations');
        unmount()
    });

    it('does not fire onChange when not eligible', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(AnimationEditor, {eligible: false, onChange})
        );

        const radios = container.querySelectorAll('input[type="radio"][name="animation-preset"]');
        expect(radios.length).toBe(0);
        expect(onChange).not.toHaveBeenCalled();
        unmount()
    });

    it('references the group label from the radiogroup', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(AnimationEditor, {eligible: true, onChange})
        );

        const grid = mustSelect(container, '[role="radiogroup"]') as HTMLElement;
        expect(grid.getAttribute('aria-labelledby')).toBe('animation-preset-label');
        unmount()
    });

    it('uses native radio inputs for a single tab stop and keyboard group behavior', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(AnimationEditor, {eligible: true, onChange})
        );

        const radios = Array.from(container.querySelectorAll('input[type="radio"][name="animation-preset"]')) as HTMLInputElement[];
        expect(radios.length).toBe(8);
        expect(new Set(radios.map((r) => r.name)).size).toBe(1);
        expect(radios.filter((r) => r.tabIndex === 0).length).toBeGreaterThanOrEqual(1);
        unmount()
    });

    it('only checks one preset at a time', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(AnimationEditor, {
                eligible: true,
                animation: {preset: 'bounce', durationMs: 400, delayMs: 0, easing: 'ease-out'},
                onChange
            })
        );

        const checked = Array.from(container.querySelectorAll('input[type="radio"][name="animation-preset"]:checked')) as HTMLInputElement[];
        expect(checked.length).toBe(1);
        expect(checked[0].parentElement?.textContent?.trim()).toBe('Bounce');
        unmount()
    });

    it('orders native radios so Arrow key navigation moves through presets predictably', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(AnimationEditor, {eligible: true, onChange})
        );

        const expectedLabels = ['None', 'Fade', 'Slide Up', 'Slide Left', 'Slide Right', 'Scale', 'Zoom', 'Bounce'];
        const radios = Array.from(container.querySelectorAll('input[type="radio"][name="animation-preset"]')) as HTMLInputElement[];
        const labels = radios.map((radio) => radio.parentElement?.textContent?.trim());
        expect(labels).toEqual(expectedLabels);
        expect(radios.every((radio) => radio.tabIndex === 0)).toBe(true);
        unmount()
    });

    it('moves checked state and focus with Arrow keys in the native preset radio group', async () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(ControlledAnimationEditor, {
                initialAnimation: {preset: 'fade', durationMs: 600, delayMs: 0, easing: 'ease-out'},
                onChange
            })
        );

        const user = userEvent.setup();
        const fade = presetRadio(container, 'Fade');
        const slideUp = presetRadio(container, 'Slide Up');

        act(() => fade.focus());
        expect(document.activeElement).toBe(fade);

        await act(async () => {
            await user.keyboard('{ArrowRight}')
        });

        expect(document.activeElement).toBe(slideUp);
        expect(slideUp.checked).toBe(true);
        expect(fade.checked).toBe(false);
        expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({preset: 'slide-up'}));
        unmount()
    })
});

describe('HoverEffectEditor', () => {
    it('renders the preset grid with None selected by default', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(HoverEffectEditor, {eligible: true, onChange})
        );

        const grid = mustSelect(container, '[role="radiogroup"]');
        expect(grid).not.toBeNull();
        const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"][name="hover-effect-preset"]'));
        expect(radios.length).toBe(8);
        expect(hoverEffectRadio(container, 'None').checked).toBe(true);
        unmount()
    });

    it('fires onChange with the selected hover preset', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(HoverEffectEditor, {eligible: true, onChange})
        );

        const glow = hoverEffectRadio(container, 'Glow');
        act(() => glow.click());

        expect(onChange).toHaveBeenCalledWith({preset: 'glow'});
        unmount()
    });

    it('clears hover effect when None is selected', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(HoverEffectEditor, {
                eligible: true,
                hoverEffect: {preset: 'shadow'},
                onChange
            })
        );

        const none = hoverEffectRadio(container, 'None');
        act(() => none.click());

        expect(onChange).toHaveBeenCalledWith(undefined);
        unmount()
    });

    it('shows an ineligible message when not eligible', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(HoverEffectEditor, {eligible: false, onChange})
        );

        expect(container.textContent).toContain('does not support hover effects');
        const radios = container.querySelectorAll('input[type="radio"][name="hover-effect-preset"]');
        expect(radios.length).toBe(0);
        expect(onChange).not.toHaveBeenCalled();
        unmount()
    });

    it('references the group label from the radiogroup', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(HoverEffectEditor, {eligible: true, onChange})
        );

        const grid = mustSelect(container, '[role="radiogroup"]');
        expect(grid.getAttribute('aria-labelledby')).toBe('hover-effect-preset-label');
        unmount()
    });

    it('orders native radios so Arrow key navigation moves through hover presets predictably', () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(HoverEffectEditor, {eligible: true, onChange})
        );

        const expectedLabels = ['None', 'Lift', 'Grow', 'Glow', 'Shadow', 'Fade', 'Underline', 'Dim'];
        const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"][name="hover-effect-preset"]'));
        const labels = radios.map((radio) => radio.parentElement?.textContent?.trim());
        expect(labels).toEqual(expectedLabels);
        expect(radios.every((radio) => radio.tabIndex === 0)).toBe(true);
        unmount()
    });

    it('moves checked state and focus with Arrow keys in the hover radio group', async () => {
        const onChange = vi.fn();
        const {container, unmount} = renderIntoContainer(
            createElement(ControlledHoverEffectEditor, {
                initialHoverEffect: {preset: 'lift'},
                onChange
            })
        );

        const user = userEvent.setup();
        const lift = hoverEffectRadio(container, 'Lift');
        const grow = hoverEffectRadio(container, 'Grow');

        act(() => lift.focus());
        expect(document.activeElement).toBe(lift);

        await act(async () => {
            await user.keyboard('{ArrowRight}')
        });

        expect(document.activeElement).toBe(grow);
        expect(grow.checked).toBe(true);
        expect(lift.checked).toBe(false);
        expect(onChange).toHaveBeenLastCalledWith({preset: 'grow'});
        unmount()
    })
});
