// Canvas Runtime Script
// This script is injected into the iframe to handle editor interactions.
// It communicates with the parent editor via postMessage.

type EditorMessage =
  | { type: 'render'; html?: string }
  | { type: 'select'; blockId?: string | null }
  | { type: 'highlight'; blockId?: string | null }
  | { type: 'clearSelection' }
  | { type: 'scrollToElement'; blockId?: string | null }
  | { type: 'setCustomCss'; css?: string }
  | { type: 'setThemeCss'; css?: string }
  | { type: 'setUiTheme'; isDark: boolean }
  | { type: 'toggleLayoutOutlines'; show: boolean }
  | { type: 'dragMove'; x: number; y: number }
  | { type: 'dragEnd' }

interface DropTargetHint {
  targetBlockId: string
  mode: 'inside' | 'before' | 'after'
}

type RuntimeMessage =
  | { type: 'clicked'; blockId?: string; rect?: { top: number; left: number; width: number; height: number; right: number; bottom: number } }
  | { type: 'hovered'; blockId?: string }
  | {
    type: 'contextMenu'
    blockId?: string
    rect?: { top: number; left: number; width: number; height: number; right: number; bottom: number }
    clientX?: number
    clientY?: number
  }
  | { type: 'dropTarget'; dropTarget?: DropTargetHint }
  | { type: 'moveBlock'; blockId: string; dropTarget: DropTargetHint }
  | { type: 'updateText'; blockId: string; text: string }
  | { type: 'keydown'; key: string; code?: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }
  | { type: 'deleteBlock'; blockId: string }
  | { type: 'ready' }

function sendToParent(message: RuntimeMessage): void {
  window.parent.postMessage({ source: 'canvas-runtime', ...message }, '*')
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
    body.show-layout-outlines :is(
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

    body.show-layout-outlines :is(
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

function initRuntime(): void {
  // Inject Highlight.js CSS into the iframe's head dynamically so code blocks inherit colors
  const hljsStyle = document.createElement('link')
  hljsStyle.rel = 'stylesheet'
  hljsStyle.id = 'hljs-theme'
  // Use a default dark theme for now, we can update it dynamically if needed based on `isDark`
  hljsStyle.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css'
  document.head.appendChild(hljsStyle)

  // Listen for messages from the parent editor
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as Partial<EditorMessage> | undefined
    const type = data?.type
    if (!type) return

    switch (type) {
      case 'render':
        if (typeof data.html === 'string') {
          endExistingDrag(true)
          document.body.innerHTML = data.html
          ensureOverlayRoot()
          attachBlockListeners()
          refreshOverlays()
        }
        break
      case 'setCustomCss':
        setCustomCss((data as { css?: string }).css ?? '')
        break
      case 'setThemeCss':
        setThemeCss((data as { css?: string }).css ?? '')
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
          const el = document.querySelector(`[data-block-id="${id}"]`)
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

function attachBlockListeners(): void {
  if (!listenersInstalled) {
    listenersInstalled = true
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
      const blockId = el.dataset.blockId
      if (blockId) {
        const rect = el.getBoundingClientRect()
        sendToParent({
          type: 'clicked',
          blockId,
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
      const blockId = el.dataset.blockId
      if (!blockId) return
      beginTextEditing(el, blockId)
    })

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      const blockId = el.dataset.blockId
      if (blockId) {
        const rect = el.getBoundingClientRect()
        sendToParent({
          type: 'contextMenu',
          blockId,
          clientX: e.clientX,
          clientY: e.clientY,
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
  const rect = target.getBoundingClientRect()
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
    const rect = el.getBoundingClientRect()
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
      const rect = closestChild.getBoundingClientRect()
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

  const rect = target.getBoundingClientRect()
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
  const rect = target.getBoundingClientRect()
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

  const rect = el.getBoundingClientRect()
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
  ro.observe(el)

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
