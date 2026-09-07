import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import TypographyFontPicker from '../TypographyFontPicker';

it('consumes Escape in the font picker instead of dismissing its parent dialog', async () => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const parentEscape = vi.fn();
    window.addEventListener('keydown', parentEscape);
    try {
        await act(async () => root.render(<TypographyFontPicker label="Body Font" value="Existing font" onChange={vi.fn()} />));
        const trigger = container.querySelector<HTMLButtonElement>('.tfp-trigger');
        if (!trigger) throw new TypeError('Missing font trigger');
        await act(async () => trigger.click());
        const search = document.querySelector<HTMLInputElement>('.tfp-search-input');
        if (!search) throw new TypeError('Missing font search');
        const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        await act(async () => search.dispatchEvent(escape));
        expect(document.querySelector('.tfp-dropdown')).toBeNull();
        expect(parentEscape).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(trigger);
    } finally {
        window.removeEventListener('keydown', parentEscape);
        await act(async () => root.unmount());
        container.remove();
    }
});
