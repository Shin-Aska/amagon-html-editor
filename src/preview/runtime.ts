// Canvas Runtime Script
// This script is injected into the iframe to handle editor interactions.
// It communicates with the parent editor via postMessage.

type EditorMessage =
  | { type: 'render'; html?: string }
  | { type: 'setFramework'; framework?: 'bootstrap-5' | 'tailwind' | 'vanilla' }
  | { type: 'select'; blockId?: string | null }
  | { type: 'highlight'; blockId?: string | null }
  | { type: 'clearSelection' }
  | { type: 'scrollToElement'; blockId?: string | null }
  | { type: 'setCustomCss'; css?: string }
  | { type: 'setThemeCss'; css?: string }
  | { type: 'setPageThemeMode'; mode?: 'device' | 'light' | 'dark' }
  | { type: 'setUiTheme'; isDark: boolean }
  | { type: 'toggleLayoutOutlines'; show: boolean }
  | { type: 'dragMove'; x: number; y: number }
  | { type: 'dragEnd' }

interface DropTargetHint {
  targetBlockId: string
  mode: 'inside' | 'before' | 'after'
}

type RuntimeMessage =
  | {
    type: 'clicked'
    blockId?: string
    rect?: { top: number; left: number; width: number; height: number; right: number; bottom: number }
    redirectedFromNestedTabContent?: boolean
  }
  | { type: 'hovered'; blockId?: string }
  | {
    type: 'contextMenu'
    blockId?: string
    rect?: { top: number; left: number; width: number; height: number; right: number; bottom: number }
    clientX?: number
    clientY?: number
    redirectedFromNestedTabContent?: boolean
  }
  | { type: 'dropTarget'; dropTarget?: DropTargetHint }
  | { type: 'moveBlock'; blockId: string; dropTarget: DropTargetHint }
  | { type: 'updateText'; blockId: string; text: string }
  | { type: 'keydown'; key: string; code?: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }
  | { type: 'deleteBlock'; blockId: string }
  | { type: 'debug'; payload: Record<string, unknown> }
  | { type: 'ready' }

function sendToParent(message: RuntimeMessage): void {
  window.parent.postMessage({ source: 'canvas-runtime', ...message }, '*')
}

function sendDebugToParent(stage: string, payload: Record<string, unknown>): void {
  sendToParent({
    type: 'debug',
    payload: {
      stage,
      ...payload
    }
  })
}

function ensureOverlayRoot(): HTMLDivElement {
  let root = document.querySelector<HTMLDivElement>('#editor-overlay-root')
  if (!root) {
    root = document.createElement('div')
    root.id = 'editor-overlay-root'
    root.style.cssText = 'position:fixed; inset:0; pointer-events:none; z-index:99998;'
    document.body.appendChild(root)
  }
  return root
}

let layoutOutlinesEnabled = false
let frameworkReadyPromise: Promise<void> = Promise.resolve()
let latestRenderRequestId = 0

interface VisualRect {
  top: number
  left: number
  width: number
  height: number
  right: number
  bottom: number
}

function toVisualRect(rect: Pick<DOMRectReadOnly, 'top' | 'left' | 'width' | 'height' | 'right' | 'bottom'>): VisualRect {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom
  }
}

function isLayoutNeutralBlock(el: HTMLElement): boolean {
  return el.dataset.editorLayoutNeutral === 'true'
}

function mergeVisualRects(rects: VisualRect[]): VisualRect {
  const top = Math.min(...rects.map((rect) => rect.top))
  const left = Math.min(...rects.map((rect) => rect.left))
  const right = Math.max(...rects.map((rect) => rect.right))
  const bottom = Math.max(...rects.map((rect) => rect.bottom))

  return {
    top,
    left,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  }
}

function getElementVisualRect(el: HTMLElement, visited = new Set<HTMLElement>()): VisualRect | null {
  if (visited.has(el)) return null
  visited.add(el)

  const rect = el.getBoundingClientRect()
  if (!isLayoutNeutralBlock(el) && rect.width > 0 && rect.height > 0) {
    return toVisualRect(rect)
  }

  const childRects = Array.from(el.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .map((child) => getElementVisualRect(child, visited))
    .filter((childRect): childRect is VisualRect => childRect !== null)

  if (childRects.length > 0) {
    return mergeVisualRects(childRects)
  }

  if (rect.width > 0 || rect.height > 0) {
    return toVisualRect(rect)
  }

  return null
}

function getScrollTargetElement(el: HTMLElement, visited = new Set<HTMLElement>()): HTMLElement {
  if (visited.has(el)) return el
  visited.add(el)

  if (!isLayoutNeutralBlock(el)) return el

  for (const child of Array.from(el.children)) {
    if (!(child instanceof HTMLElement)) continue
    const target = getScrollTargetElement(child, visited)
    if (target) return target
  }

  return el
}

function getObservedElements(el: HTMLElement, visited = new Set<HTMLElement>()): HTMLElement[] {
  if (visited.has(el)) return []
  visited.add(el)

  if (!isLayoutNeutralBlock(el)) return [el]

  const observedChildren = Array.from(el.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement)
    .flatMap((child) => getObservedElements(child, visited))

  return observedChildren.length > 0 ? observedChildren : [el]
}

function upsertFrameworkLink(id: string, href: string): Promise<void> {
  const existing = document.querySelector<HTMLLinkElement>(`#${id}`)
  if (existing) {
    if (existing.href === href) {
      if ((existing as HTMLLinkElement).dataset.loaded === 'true') return Promise.resolve()
      return new Promise((resolve) => {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => resolve(), { once: true })
      })
    }
    existing.remove()
  }

  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = href
    link.addEventListener('load', () => {
      link.dataset.loaded = 'true'
      resolve()
    }, { once: true })
    link.addEventListener('error', () => resolve(), { once: true })
    document.head.appendChild(link)
  })
}

function upsertFrameworkScript(id: string, src: string, defer = false): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`#${id}`)
  if (existing) {
    if (existing.src === src) {
      if (existing.dataset.loaded === 'true') return Promise.resolve()
      return new Promise((resolve) => {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => resolve(), { once: true })
      })
    }
    existing.remove()
  }

  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.id = id
    script.src = src
    if (defer) script.defer = true
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    }, { once: true })
    script.addEventListener('error', () => resolve(), { once: true })
    document.head.appendChild(script)
  })
}

function removeFrameworkAsset(id: string): void {
  document.getElementById(id)?.remove()
}

let tailwindHeadObserver: MutationObserver | null = null
let tailwindReorderTimer: number | null = null
let isReorderingEditorCss = false

function ensureEditorCssOrder(): void {
  // Tailwind CDN injects its stylesheet at runtime, which can end up after the
  // theme/custom CSS if those were applied before the script finished loading.
  // Re-appending guarantees our editor-driven styles remain last in cascade.
  if (isReorderingEditorCss) return
  isReorderingEditorCss = true
  const themeEl = document.querySelector<HTMLStyleElement>('style#hoarses-theme-css')
  const customEl = document.querySelector<HTMLStyleElement>('style#html-editor-custom-css')
  const canvasOverridesEl = document.querySelector<HTMLStyleElement>('style#editor-canvas-overrides')
  const outlinesEl = document.querySelector<HTMLStyleElement>('style#editor-layout-outlines-css')

  try {
    if (themeEl) document.head.appendChild(themeEl)
    if (customEl) document.head.appendChild(customEl)
    // Canvas overrides should win over any user CSS for safety in the editor canvas.
    if (canvasOverridesEl) document.head.appendChild(canvasOverridesEl)
    if (outlinesEl) document.head.appendChild(outlinesEl)
  } finally {
    isReorderingEditorCss = false
  }
}

function stopTailwindCssOrdering(): void {
  if (tailwindReorderTimer !== null) {
    window.clearTimeout(tailwindReorderTimer)
    tailwindReorderTimer = null
  }
  tailwindHeadObserver?.disconnect()
  tailwindHeadObserver = null
}

function startTailwindCssOrdering(): void {
  stopTailwindCssOrdering()

  // Tailwind CDN may inject <style> tags after the script 'load' event; observe
  // head mutations and keep our theme/custom overrides last.
  tailwindHeadObserver = new MutationObserver(() => {
    if (isReorderingEditorCss) return
    if (tailwindReorderTimer !== null) window.clearTimeout(tailwindReorderTimer)
    tailwindReorderTimer = window.setTimeout(() => {
      tailwindReorderTimer = null
      ensureEditorCssOrder()
    }, 0)
  })
  tailwindHeadObserver.observe(document.head, { childList: true })

  // A couple of extra ticks to catch async injection even without head mutation
  // (some browsers coalesce mutations in odd ways for script-driven inserts).
  window.setTimeout(ensureEditorCssOrder, 0)
  window.setTimeout(ensureEditorCssOrder, 50)
  window.setTimeout(ensureEditorCssOrder, 250)
}

async function setFramework(framework: 'bootstrap-5' | 'tailwind' | 'vanilla'): Promise<void> {
  removeFrameworkAsset('editor-framework-bootstrap-css')
  removeFrameworkAsset('editor-framework-bootstrap-icons-css')
  removeFrameworkAsset('editor-framework-bootstrap-js')
  removeFrameworkAsset('editor-framework-tailwind-js')
  stopTailwindCssOrdering()

  if (framework === 'bootstrap-5') {
    await Promise.all([
      upsertFrameworkLink('editor-framework-bootstrap-css', 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css'),
      upsertFrameworkLink('editor-framework-bootstrap-icons-css', 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'),
      upsertFrameworkScript('editor-framework-bootstrap-js', 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js', true)
    ])
    ensureEditorCssOrder()
    return
  }

  if (framework === 'tailwind') {
    await Promise.all([
      upsertFrameworkLink('editor-framework-bootstrap-icons-css', 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'),
      upsertFrameworkScript('editor-framework-tailwind-js', 'https://cdn.tailwindcss.com')
    ])
    startTailwindCssOrdering()
    ensureEditorCssOrder()
    return
  }

  // vanilla
  ensureEditorCssOrder()
}

function setLayoutOutlines(show: boolean): void {
  layoutOutlinesEnabled = show
  if (show) {
    document.body.classList.add('show-layout-outlines')
    injectLayoutOutlinesCss()
  } else {
    document.body.classList.remove('show-layout-outlines')
  }
}

function injectLayoutOutlinesCss(): void {
  if (document.getElementById('editor-layout-outlines-css')) return

  const style = document.createElement('style')
  style.id = 'editor-layout-outlines-css'
  style.textContent = `
    body [data-editor-layout-neutral="true"] {
      display: contents !important;
    }

    body.show-layout-outlines :is(
      [data-block-type="form"],
      [data-block-type="container"],
      [data-block-type="row"],
      [data-block-type="column"],
      [data-block-type="section"],
      [data-block-type="header"],
      [data-block-type="footer"],
      [data-block-type="article"],
      [data-block-type="aside"],
      [data-block-type="nav"]
    ) {
      outline: 2px dashed rgba(137, 180, 250, 0.8) !important;
      outline-offset: -2px !important;
      box-shadow: inset 0 0 0 1px rgba(137, 180, 250, 0.25) !important;
      min-height: 40px !important;
      position: relative !important;
    }

    body.show-layout-outlines [data-block-type="column"] {
      min-height: 48px !important;
    }

    body.show-layout-outlines [data-block-type="form"] {
      min-height: 96px !important;
      padding: 28px 16px 16px !important;
      border-radius: 0.5rem !important;
      background: rgba(137, 180, 250, 0.04) !important;
    }

    body.show-layout-outlines :is(
      [data-block-type="form"],
      [data-block-type="container"],
      [data-block-type="row"],
      [data-block-type="column"],
      [data-block-type="section"],
      [data-block-type="header"],
      [data-block-type="footer"],
      [data-block-type="article"],
      [data-block-type="aside"],
      [data-block-type="nav"]
    ) :is(
      [data-block-type="form"],
      [data-block-type="container"],
      [data-block-type="row"],
      [data-block-type="column"],
      [data-block-type="section"],
      [data-block-type="header"],
      [data-block-type="footer"],
      [data-block-type="article"],
      [data-block-type="aside"],
      [data-block-type="nav"]
    ) {
      outline-color: rgba(250, 179, 135, 0.85) !important;
      box-shadow: inset 0 0 0 1px rgba(250, 179, 135, 0.25) !important;
    }

    body.show-layout-outlines :is(
      [data-block-type="form"],
      [data-block-type="container"],
      [data-block-type="row"],
      [data-block-type="column"],
      [data-block-type="section"],
      [data-block-type="header"],
      [data-block-type="footer"],
      [data-block-type="article"],
      [data-block-type="aside"],
      [data-block-type="nav"]
    ) :is(
      [data-block-type="form"],
      [data-block-type="container"],
      [data-block-type="row"],
      [data-block-type="column"],
      [data-block-type="section"],
      [data-block-type="header"],
      [data-block-type="footer"],
      [data-block-type="article"],
      [data-block-type="aside"],
      [data-block-type="nav"]
    ) :is(
      [data-block-type="form"],
      [data-block-type="container"],
      [data-block-type="row"],
      [data-block-type="column"],
      [data-block-type="section"],
      [data-block-type="header"],
      [data-block-type="footer"],
      [data-block-type="article"],
      [data-block-type="aside"],
      [data-block-type="nav"]
    ) {
      outline-color: rgba(166, 227, 161, 0.9) !important;
      box-shadow: inset 0 0 0 1px rgba(166, 227, 161, 0.25) !important;
    }

    body.show-layout-outlines :is(
      [data-block-type="form"],
      [data-block-type="container"],
      [data-block-type="row"],
      [data-block-type="column"],
      [data-block-type="section"],
      [data-block-type="header"],
      [data-block-type="footer"],
      [data-block-type="article"],
      [data-block-type="aside"],
      [data-block-type="nav"]
    )::before {
      content: attr(data-block-type);
      display: inline-block;
      font-size: 10px;
      line-height: 1;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.95);
      background: rgba(17, 17, 27, 0.75);
      padding: 2px 6px;
      border-radius: 0 0 6px 0;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 99;
      pointer-events: none;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-top: none;
      border-left: none;
    }

    .editor-placeholder {
      display: none !important;
    }

    body.show-layout-outlines .editor-placeholder {
      display: flex !important;
      align-items: center;
      justify-content: center;
      min-height: 80px;
      border: 2px dashed rgba(137, 180, 250, 0.6);
      border-radius: 0.375rem;
      color: rgba(137, 180, 250, 0.9);
      font-size: 0.85rem;
      gap: 0.5rem;
      background: rgba(137, 180, 250, 0.06);
      text-align: center;
    }

    .editor-outline-gated {
      display: none !important;
    }

    body.show-layout-outlines .editor-outline-gated {
      display: block !important;
    }
  `
  document.head.appendChild(style)
}

function setThemeCss(css: string): void {
  const trimmed = css.trim()
  const existing = document.querySelector<HTMLStyleElement>('style#hoarses-theme-css')

  if (trimmed.length === 0) {
    existing?.remove()
    return
  }

  if (existing) {
    existing.textContent = trimmed
    return
  }

  const style = document.createElement('style')
  style.id = 'hoarses-theme-css'
  style.textContent = trimmed
  // Insert theme CSS before custom CSS so custom CSS can override
  const customCssEl = document.querySelector('style#html-editor-custom-css')
  if (customCssEl) {
    customCssEl.before(style)
  } else {
    document.head.appendChild(style)
  }
}

function setCustomCss(css: string): void {
  const trimmed = css.trim()
  const existing = document.querySelector<HTMLStyleElement>('style#html-editor-custom-css')

  if (trimmed.length === 0) {
    existing?.remove()
    return
  }

  if (existing) {
    existing.textContent = trimmed
    return
  }

  const style = document.createElement('style')
  style.id = 'html-editor-custom-css'
  style.textContent = trimmed
  document.head.appendChild(style)
}

function setPageThemeMode(mode: 'device' | 'light' | 'dark'): void {
  if (mode === 'device') {
    document.documentElement.setAttribute('data-page-theme', 'device')
    return
  }

  document.documentElement.setAttribute('data-page-theme', mode)
}

function initRuntime(): void {
  // Inject Highlight.js CSS into the iframe's head dynamically so code blocks inherit colors
  const hljsStyle = document.createElement('link')
  hljsStyle.rel = 'stylesheet'
  hljsStyle.id = 'hljs-theme'
  // Use a default dark theme for now, we can update it dynamically if needed based on `isDark`
  hljsStyle.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css'
  document.head.appendChild(hljsStyle)

  // Canvas-only overrides: disable interactive form controls that are only
  // functional at export time (e.g. page-list search/sort/direction inputs).
  const canvasOverrides = document.createElement('style')
  canvasOverrides.id = 'editor-canvas-overrides'
  canvasOverrides.textContent = `
    [data-page-list-search],
    [data-page-list-sort],
    [data-page-list-dir] {
      pointer-events: none;
      user-select: none;
      cursor: default;
    }

    /* Editor baseline heading sizes.
       Some frameworks/resets can normalize headings (or user CSS may flatten them).
       We only apply these when no explicit size utility class is present so the
       editor stays WYSIWYG with Bootstrap/Tailwind utilities. */
    h1:not(.h1):not(.h2):not(.h3):not(.h4):not(.h5):not(.h6):not(.display-1):not(.display-2):not(.display-3):not(.display-4):not(.display-5):not(.display-6):not(.fs-1):not(.fs-2):not(.fs-3):not(.fs-4):not(.fs-5):not(.fs-6) { font-size: 2em; }
    h2:not(.h1):not(.h2):not(.h3):not(.h4):not(.h5):not(.h6):not(.display-1):not(.display-2):not(.display-3):not(.display-4):not(.display-5):not(.display-6):not(.fs-1):not(.fs-2):not(.fs-3):not(.fs-4):not(.fs-5):not(.fs-6) { font-size: 1.5em; }
    h3:not(.h1):not(.h2):not(.h3):not(.h4):not(.h5):not(.h6):not(.display-1):not(.display-2):not(.display-3):not(.display-4):not(.display-5):not(.display-6):not(.fs-1):not(.fs-2):not(.fs-3):not(.fs-4):not(.fs-5):not(.fs-6) { font-size: 1.17em; }
    h4:not(.h1):not(.h2):not(.h3):not(.h4):not(.h5):not(.h6):not(.display-1):not(.display-2):not(.display-3):not(.display-4):not(.display-5):not(.display-6):not(.fs-1):not(.fs-2):not(.fs-3):not(.fs-4):not(.fs-5):not(.fs-6) { font-size: 1em; }
    h5:not(.h1):not(.h2):not(.h3):not(.h4):not(.h5):not(.h6):not(.display-1):not(.display-2):not(.display-3):not(.display-4):not(.display-5):not(.display-6):not(.fs-1):not(.fs-2):not(.fs-3):not(.fs-4):not(.fs-5):not(.fs-6) { font-size: 0.83em; }
    h6:not(.h1):not(.h2):not(.h3):not(.h4):not(.h5):not(.h6):not(.display-1):not(.display-2):not(.display-3):not(.display-4):not(.display-5):not(.display-6):not(.fs-1):not(.fs-2):not(.fs-3):not(.fs-4):not(.fs-5):not(.fs-6) { font-size: 0.67em; }
  `
  document.head.appendChild(canvasOverrides)

  // Listen for messages from the parent editor
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as Partial<EditorMessage> | undefined
    const type = data?.type
    if (!type) return

    switch (type) {
      case 'render':
        if (typeof data.html === 'string') {
          const html = data.html
          const renderRequestId = ++latestRenderRequestId
          void frameworkReadyPromise.finally(() => {
            if (renderRequestId !== latestRenderRequestId) return
            endExistingDrag(true)
            document.body.innerHTML = html
            ensureOverlayRoot()
            attachBlockListeners()
            refreshOverlays()
          })
        }
        break
      case 'setFramework':
        frameworkReadyPromise = setFramework((data as { framework?: 'bootstrap-5' | 'tailwind' | 'vanilla' }).framework ?? 'bootstrap-5')
        break
      case 'setCustomCss':
        setCustomCss((data as { css?: string }).css ?? '')
        break
      case 'setThemeCss':
        setThemeCss((data as { css?: string }).css ?? '')
        break
      case 'setPageThemeMode':
        setPageThemeMode((data as { mode?: 'device' | 'light' | 'dark' }).mode ?? 'device')
        break
      case 'setUiTheme':
        if ((data as { isDark?: boolean }).isDark) {
          document.body.classList.add('dark')
        } else {
          document.body.classList.remove('dark')
        }

        // Clear cached overlays so the floating toolbar regenerates with new theme colors
        const overlays = document.querySelectorAll('.editor-overlay')
        overlays.forEach(o => o.remove())

        refreshOverlays()
        break
      case 'select':
        setSelected((data as { blockId?: string | null }).blockId ?? null)
        break
      case 'highlight':
        setHovered((data as { blockId?: string | null }).blockId ?? null)
        break
      case 'clearSelection':
        setSelected(null)
        setHovered(null)
        break
      case 'scrollToElement':
        if ((data as { blockId?: string | null }).blockId) {
          const id = (data as { blockId: string }).blockId
          const el = document.querySelector<HTMLElement>(`[data-block-id="${id}"]`)
          const scrollTarget = el ? getScrollTargetElement(el) : null
          scrollTarget?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        break
      case 'dragMove': {
        const x = (data as { x: number }).x
        const y = (data as { y: number }).y
        handleDragMove(x, y)
        break
      }
      case 'dragEnd':
        clearDropIndicator()
        clearContainerHoverIndicator()
        publishDropTarget(null)
        break
      case 'toggleLayoutOutlines':
        setLayoutOutlines(Boolean((data as { show?: boolean }).show))
        break
    }
  })

  // Notify parent that runtime is ready
  sendToParent({ type: 'ready' })
}

let listenersInstalled = false
let suppressNextClick = false

let draggingExistingBlockId: string | null = null
let dragCandidateBlockId: string | null = null
let dragPointerId: number | null = null
let dragStartX = 0
let dragStartY = 0
let draggedElement: HTMLElement | null = null
let dragGhostEl: HTMLDivElement | null = null
let bodyUserSelectBefore: string | null = null
let draggedVisibilityBefore: string | null = null
let draggedPointerEventsBefore: string | null = null

const DRAG_START_DISTANCE = 6

function resolveTabSelectionTarget(el: HTMLElement): { target: HTMLElement; redirected: boolean } {
  const tabsRoot = el.closest('[data-block-type="tabs"]') as HTMLElement | null
  if (tabsRoot && tabsRoot !== el) {
    return { target: tabsRoot, redirected: true }
  }

  return { target: el, redirected: false }
}

function getNestedTabContentSelectionTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null

  const panel = target.closest('.tab-pane, [data-tw-tab-panel]') as HTMLElement | null
  if (!panel) return null

  const tabsRoot = panel.closest('[data-block-type="tabs"]') as HTMLElement | null
  if (!tabsRoot?.dataset.blockId) return null

  return tabsRoot
}

function debugTabSelection(eventName: string, target: EventTarget | null, tabsRoot: HTMLElement | null): void {
  const el = target instanceof Element ? target : null
  const payload = {
    eventName,
    targetTag: el?.tagName?.toLowerCase() ?? null,
    targetClasses: el?.className ?? null,
    insidePanel: !!el?.closest?.('.tab-pane, [data-tw-tab-panel]'),
    tabsBlockId: tabsRoot?.dataset.blockId ?? null,
    tabsBlockType: tabsRoot?.dataset.blockType ?? null
  }
  console.debug('[amagon][tabs-warning][runtime]', payload)
  sendDebugToParent('runtime-detect', payload)
}

function shouldBlockNavigationFromTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('a[href], area[href]'))
}

function attachBlockListeners(): void {
  if (!listenersInstalled) {
    listenersInstalled = true
    document.addEventListener('click', (e) => {
      const tabsRoot = getNestedTabContentSelectionTarget(e.target)
      debugTabSelection('document-click-capture', e.target, tabsRoot)
      if (!tabsRoot) return

      e.preventDefault()
      e.stopPropagation()

      const rect = getElementVisualRect(tabsRoot) ?? toVisualRect(tabsRoot.getBoundingClientRect())
      const payload = {
        blockId: tabsRoot.dataset.blockId,
        rect
      }
      console.debug('[amagon][tabs-warning][runtime] posting clicked redirect', payload)
      sendDebugToParent('runtime-post-clicked', payload)
      sendToParent({
        type: 'clicked',
        blockId: tabsRoot.dataset.blockId,
        redirectedFromNestedTabContent: true,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom
        }
      })
    }, true)

    document.addEventListener('dblclick', (e) => {
      const tabsRoot = getNestedTabContentSelectionTarget(e.target)
      debugTabSelection('document-dblclick-capture', e.target, tabsRoot)
      if (!tabsRoot) return

      e.preventDefault()
      e.stopPropagation()

      const rect = getElementVisualRect(tabsRoot) ?? toVisualRect(tabsRoot.getBoundingClientRect())
      const payload = {
        blockId: tabsRoot.dataset.blockId,
        rect
      }
      console.debug('[amagon][tabs-warning][runtime] posting dblclick redirect', payload)
      sendDebugToParent('runtime-post-dblclick', payload)
      sendToParent({
        type: 'clicked',
        blockId: tabsRoot.dataset.blockId,
        redirectedFromNestedTabContent: true,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom
        }
      })
    }, true)

    document.addEventListener('contextmenu', (e) => {
      const tabsRoot = getNestedTabContentSelectionTarget(e.target)
      debugTabSelection('document-contextmenu-capture', e.target, tabsRoot)
      if (!tabsRoot) return

      e.preventDefault()
      e.stopPropagation()

      const rect = getElementVisualRect(tabsRoot) ?? toVisualRect(tabsRoot.getBoundingClientRect())
      const payload = {
        blockId: tabsRoot.dataset.blockId,
        rect,
        clientX: e.clientX,
        clientY: e.clientY
      }
      console.debug('[amagon][tabs-warning][runtime] posting contextmenu redirect', payload)
      sendDebugToParent('runtime-post-contextmenu', payload)
      sendToParent({
        type: 'contextMenu',
        blockId: tabsRoot.dataset.blockId,
        clientX: e.clientX,
        clientY: e.clientY,
        redirectedFromNestedTabContent: true,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom
        }
      })
    }, true)

    document.addEventListener('click', (e) => {
      if (!shouldBlockNavigationFromTarget(e.target)) return
      e.preventDefault()
    }, true)

    document.addEventListener('auxclick', (e) => {
      if (!shouldBlockNavigationFromTarget(e.target)) return
      e.preventDefault()
    }, true)

    document.addEventListener('submit', (e) => {
      e.preventDefault()
    }, true)

    document.body.addEventListener('click', () => {
      sendToParent({ type: 'clicked' })
    })

    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key !== 'Escape') return
        if (!dragCandidateBlockId && !draggingExistingBlockId) return
        e.preventDefault()
        e.stopPropagation()
        endExistingDrag(true)
      },
      true
    )

    window.addEventListener('blur', () => {
      if (!dragCandidateBlockId && !draggingExistingBlockId) return
      endExistingDrag(true)
    })

    window.addEventListener('keydown', (e) => {
      const isCtrl = e.ctrlKey || e.metaKey
      const isBackslash = e.key === '\\' || e.code === 'Backslash' || e.code === 'IntlBackslash'
      const isSlash = e.key === '/' || e.code === 'Slash'

      if (isCtrl && (e.key.toLowerCase() === 's' || isBackslash || isSlash)) {
        e.preventDefault()
        e.stopPropagation()
        sendToParent({
          type: 'keydown',
          key: e.key,
          code: e.code,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey
        })
        return
      }

      if (e.target instanceof HTMLElement && e.target.isContentEditable) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      sendToParent({
        type: 'keydown',
        key: e.key,
        code: e.code,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      })
    }, true)

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return
      if (!dragCandidateBlockId && !draggingExistingBlockId) return
      endExistingDrag(true)
    })

    window.addEventListener('pointerup', (e) => {
      if (dragPointerId !== null && e.pointerId !== dragPointerId) return
      endExistingDrag()
    }, true)

    window.addEventListener('pointercancel', (e) => {
      if (dragPointerId !== null && e.pointerId !== dragPointerId) return
      endExistingDrag(true)
    }, true)

    window.addEventListener('pointermove', (e) => {
      if (dragPointerId !== null && e.pointerId !== dragPointerId) return
      if (!dragCandidateBlockId && !draggingExistingBlockId) return
      onExistingDragPointerMove(e)
    }, true)
  }

  const blocks = document.querySelectorAll<HTMLElement>('[data-block-id]')
  blocks.forEach((el) => {
    if (el.dataset.editorListenersInstalled === '1') return
    el.dataset.editorListenersInstalled = '1'

    el.addEventListener('click', (e) => {
      if (suppressNextClick) {
        suppressNextClick = false
        e.preventDefault()
        e.stopPropagation()
        return
      }

      e.stopPropagation()
      const { target, redirected } = resolveTabSelectionTarget(el)
      const blockId = target.dataset.blockId
      if (blockId) {
        const rect = getElementVisualRect(target) ?? toVisualRect(target.getBoundingClientRect())
        sendToParent({
          type: 'clicked',
          blockId,
          redirectedFromNestedTabContent: redirected,
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            bottom: rect.bottom
          }
        })
      }
    })

    el.addEventListener('mouseenter', () => {
      const blockId = el.dataset.blockId
      if (blockId) {
        sendToParent({ type: 'hovered', blockId })
      }
    })

    el.addEventListener('mouseleave', () => {
      sendToParent({ type: 'hovered' })
    })

    el.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      const { target, redirected } = resolveTabSelectionTarget(el)
      if (redirected) {
        const blockId = target.dataset.blockId
        if (blockId) {
          const rect = getElementVisualRect(target) ?? toVisualRect(target.getBoundingClientRect())
          sendToParent({
            type: 'clicked',
            blockId,
            redirectedFromNestedTabContent: true,
            rect: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              right: rect.right,
              bottom: rect.bottom
            }
          })
        }
        return
      }
      const blockId = el.dataset.blockId
      if (!blockId) return
      beginTextEditing(el, blockId)
    })

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      const { target, redirected } = resolveTabSelectionTarget(el)
      const blockId = target.dataset.blockId
      if (blockId) {
        const rect = getElementVisualRect(target) ?? toVisualRect(target.getBoundingClientRect())
        sendToParent({
          type: 'contextMenu',
          blockId,
          clientX: e.clientX,
          clientY: e.clientY,
          redirectedFromNestedTabContent: redirected,
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            bottom: rect.bottom
          }
        })
      }
    })

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      e.stopPropagation()
      const blockId = el.dataset.blockId
      if (!blockId) return

      dragCandidateBlockId = blockId
      dragPointerId = e.pointerId
      dragStartX = e.clientX
      dragStartY = e.clientY
      draggedElement = el

      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    })
  })
}

function beginTextEditing(el: HTMLElement, blockId: string): void {
  const blockType = el.dataset.blockType || ''
  if (!['heading', 'paragraph', 'button', 'link', 'blockquote'].includes(blockType)) return

  suppressNextClick = true
  el.contentEditable = 'true'
  el.focus()

  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(el)
  selection?.removeAllRanges()
  selection?.addRange(range)

  const onBlur = () => {
    el.contentEditable = 'false'
    el.removeEventListener('blur', onBlur)
    const text = el.innerText || el.textContent || ''
    sendToParent({ type: 'updateText', blockId, text })
  }
  el.addEventListener('blur', onBlur)
}

function beginExistingDrag(): void {
  if (!dragCandidateBlockId || !draggedElement) return
  draggingExistingBlockId = dragCandidateBlockId

  bodyUserSelectBefore = document.body.style.userSelect
  document.body.style.userSelect = 'none'

  draggedVisibilityBefore = draggedElement.style.visibility
  draggedPointerEventsBefore = draggedElement.style.pointerEvents
  draggedElement.style.visibility = 'hidden'
  draggedElement.style.pointerEvents = 'none'

  const ghost = document.createElement('div')
  ghost.className = 'dnd-drag-ghost'
  ghost.style.cssText =
    'position:fixed; z-index:100001; pointer-events:none; padding:6px 8px; border-radius:6px; background:rgba(24,24,37,0.92); border:1px solid rgba(69,71,90,1); color:#cdd6f4; font-size:12px; max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;'
  ghost.textContent = draggedElement.tagName.toLowerCase()
  ensureOverlayRoot().appendChild(ghost)
  dragGhostEl = ghost
}

function endExistingDrag(cancel = false): void {
  if (!dragCandidateBlockId && !draggingExistingBlockId) return

  const movedId = draggingExistingBlockId
  const drop = currentDropHint

  dragCandidateBlockId = null
  draggingExistingBlockId = null
  dragPointerId = null

  if (dragGhostEl) {
    dragGhostEl.remove()
    dragGhostEl = null
  }

  if (draggedElement) {
    draggedElement.style.visibility = draggedVisibilityBefore ?? ''
    draggedElement.style.pointerEvents = draggedPointerEventsBefore ?? ''
    draggedVisibilityBefore = null
    draggedPointerEventsBefore = null
    draggedElement = null
  }

  if (bodyUserSelectBefore !== null) {
    document.body.style.userSelect = bodyUserSelectBefore
    bodyUserSelectBefore = null
  }

  clearDropIndicator()
  clearContainerHoverIndicator()
  publishDropTarget(null)

  if (!cancel && movedId && drop && drop.targetBlockId && drop.targetBlockId !== movedId) {
    sendToParent({ type: 'moveBlock', blockId: movedId, dropTarget: drop })
    suppressNextClick = true
  }
}

function onExistingDragPointerMove(e: PointerEvent): void {
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  const dist = Math.hypot(dx, dy)

  if (!draggingExistingBlockId) {
    if (dist < DRAG_START_DISTANCE) return
    beginExistingDrag()
  }

  if (!draggingExistingBlockId) return

  if (dragGhostEl) {
    dragGhostEl.style.left = `${e.clientX + 12}px`
    dragGhostEl.style.top = `${e.clientY + 12}px`
  }

  const x = e.clientX
  const y = e.clientY
  const outside = x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight
  if (outside) {
    handleDragMove(-1, -1)
    return
  }

  handleDragMove(x, y)
}

let selectedBlockId: string | null = null
let hoveredBlockId: string | null = null

let selectedResizeObserver: ResizeObserver | null = null
let hoveredResizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null
let mutationRaf: number | null = null

function setSelected(blockId: string | null): void {
  selectedBlockId = blockId
  installResizeObserver('selected')
  refreshOverlays()
}

function setHovered(blockId: string | null): void {
  hoveredBlockId = blockId
  installResizeObserver('hovered')
  refreshOverlays()
}

function refreshOverlays(): void {
  renderOverlay(selectedBlockId, 'selected')
  renderOverlay(hoveredBlockId, 'hovered')
  refreshDropIndicator()
}

let currentDropHint: DropTargetHint | null = null
let lastPublishedDropKey: string | null = null
let dropIndicatorEl: HTMLDivElement | null = null
let containerHoverIndicatorEl: HTMLDivElement | null = null
let containerHoverBlockId: string | null = null

function publishDropTarget(hint: DropTargetHint | null): void {
  currentDropHint = hint
  const key = hint ? `${hint.targetBlockId}:${hint.mode}` : null
  if (key === lastPublishedDropKey) return
  lastPublishedDropKey = key

  if (!hint) {
    sendToParent({ type: 'dropTarget' })
    return
  }

  sendToParent({ type: 'dropTarget', dropTarget: hint })
}

function isContainerElement(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase()
  if (tag === 'img' || tag === 'hr' || tag === 'br' || tag === 'input' || tag === 'textarea' || tag === 'select') {
    return false
  }
  if (tag === 'div' || tag === 'section' || tag === 'main' || tag === 'header' || tag === 'footer' || tag === 'nav' || tag === 'article' || tag === 'aside' || tag === 'ul' || tag === 'ol' || tag === 'li' || tag === 'form') {
    return true
  }
  return el.children.length > 0
}

function computeDropHint(target: HTMLElement, x: number, y: number): DropTargetHint {
  const rect = getElementVisualRect(target) ?? toVisualRect(target.getBoundingClientRect())
  const yRel = y - rect.top
  const container = isContainerElement(target)

  let mode: 'inside' | 'before' | 'after'
  if (!container) {
    mode = yRel < rect.height / 2 ? 'before' : 'after'
  } else {
    const zone = Math.max(10, rect.height * 0.25)
    if (yRel < zone) mode = 'before'
    else if (yRel > rect.height - zone) mode = 'after'
    else mode = 'inside'
  }

  const id = target.dataset.blockId
  return { targetBlockId: id ?? '', mode }
}

function findClosestChildBlock(container: HTMLElement, y: number, excludeBlockId: string | null): HTMLElement | null {
  const children = Array.from(container.querySelectorAll<HTMLElement>(':scope > [data-block-id]'))
  const candidates = excludeBlockId ? children.filter((el) => el.dataset.blockId !== excludeBlockId) : children
  if (candidates.length === 0) return null

  let bestEl: HTMLElement | null = null
  let bestDist = Infinity

  for (const el of candidates) {
    const rect = getElementVisualRect(el) ?? toVisualRect(el.getBoundingClientRect())
    const centerY = rect.top + rect.height / 2
    const dist = Math.abs(y - centerY)
    if (dist < bestDist) {
      bestDist = dist
      bestEl = el
    }
  }

  return bestEl
}

function handleDragMove(x: number, y: number): void {
  if (x < 0 || y < 0) {
    clearDropIndicator()
    clearContainerHoverIndicator()
    publishDropTarget(null)
    return
  }

  const el = document.elementFromPoint(x, y)
  let target = el instanceof Element ? (el.closest('[data-block-id]') as HTMLElement | null) : null

  // If we're dragging an existing block, ignore targets that are inside the dragged block subtree
  if (draggingExistingBlockId && draggedElement && target) {
    while (target && draggedElement.contains(target)) {
      target = target.parentElement?.closest('[data-block-id]') as HTMLElement | null
    }
  }
  if (!target || !target.dataset.blockId) {
    clearDropIndicator()
    clearContainerHoverIndicator()
    publishDropTarget(null)
    return
  }

  const rawHint = computeDropHint(target, x, y)
  if (rawHint.mode === 'inside' && isContainerElement(target)) {
    renderContainerHoverIndicator(target)
  } else {
    clearContainerHoverIndicator()
  }

  let hint = rawHint
  let indicatorTarget = target

  if (hint.mode === 'inside' && isContainerElement(target)) {
    const closestChild = findClosestChildBlock(target, y, draggingExistingBlockId)
    const childId = closestChild?.dataset.blockId
    if (closestChild && childId) {
      const rect = getElementVisualRect(closestChild) ?? toVisualRect(closestChild.getBoundingClientRect())
      const centerY = rect.top + rect.height / 2
      hint = { targetBlockId: childId, mode: y < centerY ? 'before' : 'after' }
      indicatorTarget = closestChild
    }
  }

  if (!hint.targetBlockId) {
    clearDropIndicator()
    clearContainerHoverIndicator()
    publishDropTarget(null)
    return
  }

  publishDropTarget(hint)
  renderDropIndicator(indicatorTarget, hint.mode)
}

function clearContainerHoverIndicator(): void {
  containerHoverIndicatorEl?.remove()
  containerHoverIndicatorEl = null
  containerHoverBlockId = null
}

function renderContainerHoverIndicator(target: HTMLElement): void {
  const id = target.dataset.blockId
  if (!id) {
    clearContainerHoverIndicator()
    return
  }

  const rect = getElementVisualRect(target) ?? toVisualRect(target.getBoundingClientRect())
  const indicator = containerHoverIndicatorEl ?? document.createElement('div')
  indicator.className = 'dnd-container-hover-indicator'
  indicator.style.pointerEvents = 'none'
  indicator.style.position = 'fixed'
  indicator.style.zIndex = '99999'
  indicator.style.left = `${rect.left}px`
  indicator.style.top = `${rect.top}px`
  indicator.style.width = `${rect.width}px`
  indicator.style.height = `${rect.height}px`
  indicator.style.border = '2px solid rgba(166, 227, 161, 0.55)'
  indicator.style.background = 'rgba(166, 227, 161, 0.03)'
  indicator.style.borderRadius = '4px'

  if (!containerHoverIndicatorEl) {
    ensureOverlayRoot().appendChild(indicator)
    containerHoverIndicatorEl = indicator
  }

  containerHoverBlockId = id
}

function clearDropIndicator(): void {
  dropIndicatorEl?.remove()
  dropIndicatorEl = null
}

function refreshDropIndicator(): void {
  if (!currentDropHint) return
  const el = document.querySelector<HTMLElement>(`[data-block-id="${currentDropHint.targetBlockId}"]`)
  if (!el) {
    clearDropIndicator()
    return
  }
  renderDropIndicator(el, currentDropHint.mode)
}

function renderDropIndicator(target: HTMLElement, mode: 'inside' | 'before' | 'after'): void {
  const rect = getElementVisualRect(target) ?? toVisualRect(target.getBoundingClientRect())
  const indicator = dropIndicatorEl ?? document.createElement('div')
  indicator.className = 'dnd-drop-indicator'
  indicator.style.pointerEvents = 'none'
  indicator.style.position = 'fixed'
  indicator.style.zIndex = '100000'

  if (mode === 'inside') {
    indicator.style.left = `${rect.left}px`
    indicator.style.top = `${rect.top}px`
    indicator.style.width = `${rect.width}px`
    indicator.style.height = `${rect.height}px`
    indicator.style.border = '2px dashed rgba(166, 227, 161, 0.9)'
    indicator.style.background = 'rgba(166, 227, 161, 0.06)'
    indicator.style.borderRadius = '4px'
  } else {
    const y = mode === 'before' ? rect.top : rect.bottom
    indicator.style.left = `${rect.left}px`
    indicator.style.top = `${y - 1}px`
    indicator.style.width = `${rect.width}px`
    indicator.style.height = '2px'
    indicator.style.border = 'none'
    indicator.style.borderRadius = '0'
    indicator.style.background = 'rgba(137, 180, 250, 0.95)'
  }

  if (!dropIndicatorEl) {
    ensureOverlayRoot().appendChild(indicator)
    dropIndicatorEl = indicator
  }
}

function renderOverlay(blockId: string | null, mode: 'selected' | 'hovered'): void {
  const className = `editor-overlay editor-overlay--${mode}`
  const existing = document.querySelector<HTMLDivElement>(`.${className.replace(/\s+/g, '.')}`)

  if (!blockId) {
    existing?.remove()
    return
  }

  const el = document.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`)
  if (!el) {
    existing?.remove()
    return
  }

  const rect = getElementVisualRect(el)
  if (!rect) {
    existing?.remove()
    return
  }
  const overlay = existing ?? document.createElement('div')
  overlay.className = className
  overlay.style.cssText = `
    position: fixed;
    top: ${rect.top}px;
    left: ${rect.left}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    pointer-events: none;
    z-index: 99999;
    border: ${mode === 'selected' ? '2px solid #89b4fa' : '1px dashed #74c7ec'};
    background: ${mode === 'selected' ? 'rgba(137, 180, 250, 0.05)' : 'transparent'};
    transition: all 0.05s ease;
  `

  if (mode === 'selected') {
    ensureResizeHandles(overlay)
    const toolbar = overlay.querySelector('.action-toolbar') as HTMLElement
    if (toolbar) {
      if (rect.top < 32) {
        toolbar.style.top = '4px'
      } else {
        toolbar.style.top = '-28px'
      }
    }
  } else {
    overlay.replaceChildren()
  }

  if (!existing) {
    ensureOverlayRoot().appendChild(overlay)
  }
}

function ensureResizeHandles(overlay: HTMLDivElement): void {
  if (overlay.childElementCount > 0) return

  const handleStyle = (x: string, y: string) =>
    `position:absolute; width:8px; height:8px; background:#89b4fa; border:1px solid rgba(0,0,0,0.3); border-radius:2px; ${x}; ${y}; pointer-events:none;`

  const tl = document.createElement('div')
  tl.setAttribute('style', handleStyle('left:-5px', 'top:-5px'))
  const tr = document.createElement('div')
  tr.setAttribute('style', handleStyle('right:-5px', 'top:-5px'))
  const bl = document.createElement('div')
  bl.setAttribute('style', handleStyle('left:-5px', 'bottom:-5px'))
  const br = document.createElement('div')
  br.setAttribute('style', handleStyle('right:-5px', 'bottom:-5px'))

  overlay.appendChild(tl)
  overlay.appendChild(tr)
  overlay.appendChild(bl)
  overlay.appendChild(br)

  // Floating Actions
  const isDark = document.body.classList.contains('dark') ||
    (!document.body.classList.contains('light') && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const bg = isDark ? '#1e1e2e' : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
  const editColor = isDark ? '#cba6f7' : '#1e66f5'
  const deleteColor = isDark ? '#f38ba8' : '#d20f39'
  const editHover = isDark ? 'rgba(203, 166, 247, 0.15)' : 'rgba(30, 102, 245, 0.15)'
  const deleteHover = isDark ? 'rgba(243, 139, 168, 0.15)' : 'rgba(210, 15, 57, 0.15)'
  const shadow = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'

  const actionToolbar = document.createElement('div')
  actionToolbar.className = 'action-toolbar'
  actionToolbar.setAttribute('style', `position:absolute; top:-28px; right:0; background:${bg}; border:1px solid ${border}; border-radius:6px; padding:2px; display:flex; gap:2px; pointer-events:auto; box-shadow:0 4px 6px ${shadow}; z-index: 1000000;`)

  const deleteBtn = document.createElement('div')
  deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${deleteColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`
  deleteBtn.setAttribute('style', 'width:22px; height:22px; display:flex; align-items:center; justify-content:center; cursor:pointer; background:transparent; border-radius:4px; transition:background 0.2s;')
  deleteBtn.onmouseenter = () => deleteBtn.style.background = deleteHover
  deleteBtn.onmouseleave = () => deleteBtn.style.background = 'transparent'
  deleteBtn.onclick = (e) => {
    e.stopPropagation()
    const blockId = selectedBlockId
    if (!blockId) return
    sendToParent({
      type: 'deleteBlock',
      blockId
    })
  }

  const editBtn = document.createElement('div')
  editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${editColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`
  editBtn.setAttribute('style', 'width:22px; height:22px; display:flex; align-items:center; justify-content:center; cursor:pointer; background:transparent; border-radius:4px; transition:background 0.2s;')
  editBtn.onmouseenter = () => editBtn.style.background = editHover
  editBtn.onmouseleave = () => editBtn.style.background = 'transparent'
  editBtn.onclick = (e) => {
    e.stopPropagation()
    const blockId = selectedBlockId
    if (!blockId) return
    const el = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement
    if (el) {
      beginTextEditing(el, blockId)
    }
  }

  const selectedEl = selectedBlockId ? document.querySelector(`[data-block-id="${selectedBlockId}"]`) as HTMLElement : null
  const selectedType = selectedEl?.dataset.blockType || ''
  if (['heading', 'paragraph', 'button', 'link', 'blockquote'].includes(selectedType)) {
    actionToolbar.appendChild(editBtn)
  }

  actionToolbar.appendChild(deleteBtn)
  overlay.appendChild(actionToolbar)
}

function installResizeObserver(mode: 'selected' | 'hovered'): void {
  if (typeof ResizeObserver === 'undefined') return

  const blockId = mode === 'selected' ? selectedBlockId : hoveredBlockId
  const selector = blockId ? `[data-block-id="${blockId}"]` : null
  const el = selector ? document.querySelector<HTMLElement>(selector) : null

  const existing = mode === 'selected' ? selectedResizeObserver : hoveredResizeObserver
  existing?.disconnect()

  if (!el) {
    if (mode === 'selected') selectedResizeObserver = null
    else hoveredResizeObserver = null
    return
  }

  const ro = new ResizeObserver(() => refreshOverlays())
  for (const target of getObservedElements(el)) {
    ro.observe(target)
  }

  if (mode === 'selected') selectedResizeObserver = ro
  else hoveredResizeObserver = ro
}

function installMutationObserver(): void {
  if (typeof MutationObserver === 'undefined') return
  if (mutationObserver) return

  mutationObserver = new MutationObserver((mutations) => {
    const overlayRoot = document.querySelector('#editor-overlay-root')
    const hasRelevantMutation = mutations.some((m) => {
      if (!(m.target instanceof Node)) return true
      if (!overlayRoot) return true
      return !overlayRoot.contains(m.target)
    })

    if (!hasRelevantMutation) return
    if (mutationRaf !== null) return

    mutationRaf = window.requestAnimationFrame(() => {
      mutationRaf = null
      refreshOverlays()
    })
  })
  mutationObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true
  })
}

function installOverlayRefreshHandlers(): void {
  const refresh = () => refreshOverlays()
  window.addEventListener('scroll', refresh, true)
  window.addEventListener('resize', refresh)
  ensureOverlayRoot()
  installMutationObserver()
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRuntime)
} else {
  initRuntime()
}

installOverlayRefreshHandlers()
