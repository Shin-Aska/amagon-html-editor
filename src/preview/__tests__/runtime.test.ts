import {afterEach, describe, expect, it} from 'vitest'
import {buildAnimationStylesCss} from '../../renderer/utils/animationPresets'
import {handleEditorMessage} from '../runtime'

function sendRuntimeMessage(data: object): void {
    handleEditorMessage(new MessageEvent('message', {data}))
}

afterEach(() => {
    document.querySelector('#amagon-enter-animations')?.remove();
    document.querySelector('#html-editor-custom-css')?.remove();
    document.querySelector('#hoarses-theme-css')?.remove()
})

describe('preview runtime animation CSS delivery', () => {
    it('delivers animation CSS before custom CSS through the production message handler', () => {
        const animationCss = buildAnimationStylesCss();

        sendRuntimeMessage({type: 'setAnimationCss', css: animationCss});
        sendRuntimeMessage({type: 'setCustomCss', css: '.custom-rule { color: rebeccapurple; }'});

        const styles = Array.from(document.head.querySelectorAll('style'));
        const animationIndex = styles.findIndex((style) => style.id === 'amagon-enter-animations');
        const customIndex = styles.findIndex((style) => style.id === 'html-editor-custom-css');
        const animationStyle = document.head.querySelector<HTMLStyleElement>('#amagon-enter-animations');

        expect(animationIndex).toBeGreaterThanOrEqual(0);
        expect(customIndex).toBeGreaterThan(animationIndex);
        expect(animationStyle?.textContent).toContain('@keyframes amagon-enter-fade');
        expect(animationStyle?.textContent).toContain('@media (prefers-reduced-motion: reduce)')
    })

    it('keeps animation CSS before custom CSS when the custom message arrives first', () => {
        sendRuntimeMessage({type: 'setCustomCss', css: '.custom-rule { color: teal; }'});
        sendRuntimeMessage({type: 'setAnimationCss', css: buildAnimationStylesCss()});

        const styles = Array.from(document.head.querySelectorAll('style'));
        const animationIndex = styles.findIndex((style) => style.id === 'amagon-enter-animations');
        const customIndex = styles.findIndex((style) => style.id === 'html-editor-custom-css');

        expect(animationIndex).toBeGreaterThanOrEqual(0);
        expect(customIndex).toBeGreaterThan(animationIndex)
    })

    it('keeps theme CSS before animation and hover CSS regardless of message order', () => {
        sendRuntimeMessage({type: 'setAnimationCss', css: buildAnimationStylesCss()});
        sendRuntimeMessage({type: 'setThemeCss', css: '.btn-primary:hover { filter: brightness(0.9); }'});

        const styles = Array.from(document.head.querySelectorAll('style'));
        const themeIndex = styles.findIndex((style) => style.id === 'hoarses-theme-css');
        const animationIndex = styles.findIndex((style) => style.id === 'amagon-enter-animations');

        expect(themeIndex).toBeGreaterThanOrEqual(0);
        expect(animationIndex).toBeGreaterThan(themeIndex)
    })
})
