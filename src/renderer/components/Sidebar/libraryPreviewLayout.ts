const DESKTOP_WIDGETS = new Set([
    'navbar', 'hero', 'footer', 'pricing-table', 'cta-section',
    'stats-section', 'team-grid', 'gallery', 'timeline', 'logo-cloud',
    'process-steps', 'newsletter', 'comparison-table', 'contact-card', 'cookie-banner'
])
const PANEL_WIDGETS = new Set([
    'card', 'feature-card', 'testimonial', 'accordion', 'tabs', 'table', 'page-list', 'pagination',
    'modal', 'offcanvas', 'countdown', 'before-after', 'map-embed', 'raw-html', 'iframe'
])

export function widgetPreviewViewport(type: string): number {
    if (type.startsWith('template:') || DESKTOP_WIDGETS.has(type)) return 1024
    return PANEL_WIDGETS.has(type) ? 480 : 220
}

// Serialized into an opaque iframe: keep all runtime dependencies inside this function.
export function fitLibraryWidget(): void {
    const root = document.querySelector<HTMLElement>('[data-library-widget]')
    if (!root) return
    let scheduled = false

    const measure = (element: Element): DOMRect[] => {
        const style = getComputedStyle(element)
        if (style.display === 'none' || style.visibility === 'hidden') return []
        const box = element.getBoundingClientRect()
        const isUnpaintedWrapper = element.tagName === 'DIV' && style.display === 'block'
            && style.backgroundColor === 'rgba(0, 0, 0, 0)' && style.backgroundImage === 'none'
            && ['top', 'right', 'bottom', 'left'].every(side =>
                style.getPropertyValue(`border-${side}-width`) === '0px'
                && style.getPropertyValue(`padding-${side}`) === '0px')
        if (isUnpaintedWrapper || box.width === 0 || box.height === 0) {
            const children: DOMRect[] = []
            for (const child of element.childNodes) {
                if (child instanceof Element) children.push(...measure(child))
                else if (child instanceof Text && child.textContent?.trim()) {
                    const range = document.createRange()
                    range.selectNode(child)
                    children.push(...range.getClientRects())
                }
            }
            if (children.length) return children
        }
        return box.width > 0 && box.height > 0 ? [box] : []
    }
    const fit = (): void => {
        scheduled = false
        // Keep a containing block for fixed-position widgets while measuring and fitting.
        root.style.transform = 'translate(0px, 0px)'
        const rectangles = [...root.children].flatMap(measure)
        if (!rectangles.length) return
        const left = Math.min(...rectangles.map(rect => rect.left))
        const top = Math.min(...rectangles.map(rect => rect.top))
        const width = Math.max(...rectangles.map(rect => rect.right)) - left
        const height = Math.max(...rectangles.map(rect => rect.bottom)) - top
        const inset = 16
        const scale = Math.min((innerWidth - inset * 2) / width,
            (innerHeight - inset * 2) / height, innerWidth / 220)
        const x = (innerWidth - width * scale) / 2 - left * scale
        const y = (innerHeight - height * scale) / 2 - top * scale
        root.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
    }
    const schedule = (): void => {
        if (scheduled) return
        scheduled = true
        requestAnimationFrame(fit)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(root)
    for (const child of root.children) observer.observe(child)
    window.addEventListener('resize', schedule)
    window.addEventListener('load', schedule)
    document.addEventListener('load', schedule, true)
    document.fonts.addEventListener('loadingdone', schedule)
    void document.fonts.ready.then(schedule)
    schedule()
}
