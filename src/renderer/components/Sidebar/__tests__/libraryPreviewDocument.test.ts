import {beforeAll, describe, expect, it} from 'vitest'
import {libraryPreviewDocument, type LibraryDocumentOptions} from '../libraryPreviewDocument'
import {widgetPreviewBlocks} from '../libraryPreviewSamples'
import {componentRegistry} from '../../../registry/ComponentRegistry'
import {registerBlocks} from '../../../registry/registerBlocks'
import {createBlock, createDefaultTheme, themeToCSS} from '../../../store/types'
import {getTemplateWidgetDefinitions} from '../../../templates/templateWidgets'

const options: LibraryDocumentOptions = {
    blocks: [], renderOptions: {framework: 'bootstrap-5'},
    themeCss: themeToCSS(createDefaultTheme()), customCss: '',
    themeMode: 'dark', kind: 'page', frameworkBase: 'app-framework://asset/'
}
const parse = (html: string): Document => new DOMParser().parseFromString(html, 'text/html')

describe('passive library document', () => {
    beforeAll(registerBlocks)

    it('renders every registered and template widget without changing its defaults', () => {
        // Given
        const definitions = [...componentRegistry.getAll(), ...getTemplateWidgetDefinitions()]
        const before = JSON.stringify(definitions)
        // When / Then
        for (const widget of definitions) {
            const doc = parse(libraryPreviewDocument({...options, blocks: widgetPreviewBlocks(widget), kind: 'widget'}))
            expect(doc.body.querySelector(':scope > :not(style)'), widget.type).not.toBeNull()
            expect(doc.querySelector('script, iframe, audio, video[src]'), widget.type).toBeNull()
        }
        expect(JSON.stringify(definitions)).toBe(before)
    })

    it('keeps real saved-block text, CSS, and the selected page theme', () => {
        // Given
        const blocks = [createBlock('heading', {props: {text: 'Edited page title', level: 1}})]
        // When
        const doc = parse(libraryPreviewDocument({...options, blocks, customCss: 'h1 { color: tomato; }'}))
        // Then
        expect(doc.querySelector('h1')?.textContent).toBe('Edited page title')
        expect(doc.documentElement.dataset.pageTheme).toBe('dark')
        expect(doc.body.textContent).toContain('h1 { color: tomato; }')
        expect(doc.querySelector('link')?.href).toBe('app-framework://asset/bootstrap/5.3.3/css/bootstrap.min.css')
    })

    it('removes active content, navigation metadata, and automatic media loads', () => {
        // Given
        const blocks = [createBlock('container', {content: '<script>alert(1)</script><meta http-equiv="refresh" content="0;url=https://example.org"><iframe src="https://example.org" title="Map"></iframe><video src="https://example.org/movie.mp4" autoplay><source src="movie.mp4"></video><img src="data:," onerror="alert(2)"><form><input autofocus></form>'})]
        // When
        const doc = parse(libraryPreviewDocument({...options, blocks}))
        // Then
        expect(doc.querySelector('script, iframe, source, [autoplay], [autofocus], [onerror], meta[http-equiv="refresh"]')).toBeNull()
        expect(doc.body.textContent).toContain('Map')
        expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toContain("form-action 'none'")
    })

    it.each(['div', 'html'])('preserves leading custom HTML styles inside %s while removing active head content', tag => {
        // Given
        const blocks = [createBlock('raw-html', {tag, content: '<style>.custom-button { color: tomato; }</style><script>alert(1)</script><link rel="stylesheet" href="https://example.org/style.css"><button class="custom-button">Custom</button>'})]
        // When
        const doc = parse(libraryPreviewDocument({...options, blocks}))
        // Then
        expect([...doc.body.querySelectorAll('style')].map(style => style.textContent)).toContain('.custom-button { color: tomato; }')
        expect(doc.body.querySelector('script, link')).toBeNull()
        expect(doc.body.querySelector('button')?.textContent).toBe('Custom')
    })

    it('keeps project styles after framework styles injected into the head', () => {
        // Given
        const themeCss = '.px-4 { padding-left: 20px; }'
        const customCss = '.px-4 { padding-left: 24px; }'
        // When
        const doc = parse(libraryPreviewDocument({...options, themeCss, customCss, renderOptions: {framework: 'tailwind'}}))
        const compiled = doc.createElement('style')
        compiled.textContent = '.px-4 { padding-left: 16px; }'
        doc.head.append(compiled)
        // Then
        const styles = [...doc.querySelectorAll('style')].map(style => style.textContent)
        expect(styles.indexOf(themeCss)).toBeGreaterThan(styles.indexOf(compiled.textContent))
        expect(styles.indexOf(customCss)).toBeGreaterThan(styles.indexOf(themeCss))
    })

    it('only authorizes the bundled Tailwind compiler when rendering Tailwind', () => {
        // Given
        const blocks = [createBlock('container', {content: '<script nonce="copied">alert(1)</script><button nonce="copied" onclick="alert(2)">Untrusted</button>'})]
        // When
        const doc = parse(libraryPreviewDocument({...options, blocks, renderOptions: {framework: 'tailwind'}}))
        // Then
        expect(doc.scripts).toHaveLength(1)
        expect(doc.scripts[0].src).toBe('app-framework://asset/tailwind/tailwindcss-browser.js')
        const nonce = doc.scripts[0].getAttribute('nonce')
        expect(nonce).toMatch(/^[a-f0-9]{32}$/)
        expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content'))
            .toContain("script-src 'nonce-" + nonce + "'")
        expect(doc.body.querySelector('[nonce], script, [onclick]')).toBeNull()
    })
})
