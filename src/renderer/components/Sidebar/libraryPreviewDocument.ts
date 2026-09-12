import {blockToHtml, type BlockToHtmlOptions} from '../../utils/blockToHtml'

export interface LibraryDocumentOptions {
    readonly blocks: Parameters<typeof blockToHtml>[0]
    readonly renderOptions: BlockToHtmlOptions
    readonly themeCss: string
    readonly customCss: string
    readonly themeMode: 'light' | 'dark' | 'device'
    readonly kind: 'page' | 'widget'
    readonly frameworkBase: string
}

function appendStyle(doc: Document, css: string): void {
    const style = doc.createElement('style')
    style.textContent = css.replace(/<\/style/gi, '<\/style')
    // Body styles stay after the stylesheet Tailwind asynchronously appends to head.
    doc.body.append(style)
}

function passiveContent(html: string): HTMLElement {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('script, meta, base, link, object, embed, audio, source, track').forEach(node => node.remove())
    for (const frame of doc.querySelectorAll('iframe')) {
        const placeholder = doc.createElement('div')
        placeholder.className = 'library-embed'
        placeholder.textContent = frame.title || 'Embedded content'
        frame.replaceWith(placeholder)
    }
    for (const video of doc.querySelectorAll('video')) {
        video.removeAttribute('src')
        video.removeAttribute('autoplay')
        video.preload = 'none'
        if (!video.poster) {
            const placeholder = doc.createElement('div')
            placeholder.className = 'library-embed'
            placeholder.textContent = '▶'
            video.replaceWith(placeholder)
        }
    }
    for (const element of doc.querySelectorAll('*')) {
        for (const attribute of Array.from(element.attributes)) {
            if (/^on/i.test(attribute.name) || ['autofocus', 'srcdoc', 'nonce'].includes(attribute.name)) {
                element.removeAttribute(attribute.name)
            }
        }
    }
    doc.body.prepend(...doc.head.querySelectorAll('style'))
    return doc.body
}

export function libraryPreviewDocument(options: LibraryDocumentOptions): string {
    const doc = document.implementation.createHTMLDocument('Library preview')
    doc.documentElement.lang = 'en'
    doc.documentElement.dataset.pageTheme = options.themeMode
    const nonce = crypto.randomUUID().replace(/-/g, '')
    const csp = doc.createElement('meta')
    csp.httpEquiv = 'Content-Security-Policy'
    csp.content = `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' app-framework: https: http: file:; img-src data: blob: app-media: https: http: file:; font-src data: app-media: app-framework: https: http: file:; media-src 'none'; frame-src 'none'; object-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'`
    doc.head.prepend(csp)
    const charset = doc.createElement('meta')
    charset.setAttribute('charset', 'utf-8')
    doc.head.prepend(charset)
    const viewport = doc.createElement('meta')
    viewport.name = 'viewport'
    viewport.content = 'width=device-width, initial-scale=1'
    doc.head.append(viewport)
    const framework = options.renderOptions.framework
    const link = (path: string): void => {
        const stylesheet = doc.createElement('link')
        stylesheet.rel = 'stylesheet'
        stylesheet.href = options.frameworkBase + path
        doc.head.append(stylesheet)
    }
    if (framework === 'bootstrap-5') link('bootstrap/5.3.3/css/bootstrap.min.css')
    if (framework !== 'vanilla') link('bootstrap-icons/1.11.3/css/bootstrap-icons.min.css')
    if (framework === 'tailwind') {
        const script = doc.createElement('script')
        // Chromium does not serialize the nonce property on this detached document.
        script.setAttribute('nonce', nonce)
        script.src = options.frameworkBase + 'tailwind/tailwindcss-browser.js'
        doc.head.append(script)
    }
    appendStyle(doc, options.themeCss)
    appendStyle(doc, options.customCss)
    appendStyle(doc, `
        * { box-sizing: border-box; }
        html, body { margin: 0; min-height: 100%; }
        body { overflow: hidden; background: var(--theme-bg); color: var(--theme-text); }
        img, video { max-width: 100%; }
        *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
        .library-embed { display: grid; place-items: center; min-height: 100px; border: 1px solid var(--theme-border); background: var(--theme-surface); color: var(--theme-text-muted); }
        ${options.kind === 'widget' ? 'body { padding: 16px; }' : ''}
    `)
    const content = passiveContent(blockToHtml(options.blocks, {
        ...options.renderOptions, includeAnimation: false, includeHoverEffects: false
    }))
    doc.body.append(...Array.from(content.childNodes))
    return '<!doctype html>' + doc.documentElement.outerHTML
}
