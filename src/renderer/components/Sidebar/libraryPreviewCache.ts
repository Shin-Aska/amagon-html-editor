interface CachedPreview {
    readonly key: string
    readonly frame: HTMLIFrameElement
    revision: string | null
    owner: HTMLElement | null
}

interface PreviewPresentation {
    readonly title: string
    readonly width: number
    readonly viewport: number
    readonly sandbox: string
    readonly revision: string
    readonly render: () => string
}

export class LibraryPreviewCache {
    private readonly entries = new Map<string, CachedPreview>()
    private readonly frames = new Set<CachedPreview>()
    private parking: HTMLDivElement | null = null

    constructor(private capacity: number) {}

    setCapacity(capacity: number): void {
        this.capacity = capacity
        this.trim()
    }

    show(key: string, target: HTMLElement, presentation: PreviewPresentation): () => void {
        let entry = this.entries.get(key)
        if (entry && entry.revision !== presentation.revision) {
            this.entries.delete(key)
            this.destroy(entry)
            entry = undefined
        }
        if (!entry) {
            const frame = target.ownerDocument.createElement('iframe')
            frame.className = 'library-preview-frame'
            frame.tabIndex = -1
            frame.setAttribute('aria-hidden', 'true')
            frame.referrerPolicy = 'no-referrer'
            entry = {key, frame, revision: null, owner: null}
            this.frames.add(entry)
        }
        this.entries.delete(key)
        this.entries.set(key, entry)
        entry.owner = target
        const {frame} = entry
        frame.title = presentation.title
        frame.setAttribute('sandbox', presentation.sandbox)
        frame.style.width = `${presentation.viewport}px`
        frame.style.height = `${presentation.viewport / 2}px`
        frame.style.transform = `scale(${presentation.width / presentation.viewport})`
        if (entry.revision !== presentation.revision) {
            frame.srcdoc = presentation.render()
            entry.revision = presentation.revision
        }
        if (frame.parentElement !== target) {
            if (frame.isConnected && typeof target.moveBefore === 'function') target.moveBefore(frame, null)
            else target.append(frame)
        }
        this.trim()
        const shown = entry
        return () => this.release(shown, target)
    }

    clear(): void {
        for (const entry of this.frames) entry.frame.remove()
        this.frames.clear()
        this.entries.clear()
        this.parking?.remove()
        this.parking = null
    }

    private trim(): void {
        while (this.entries.size > this.capacity) {
            const oldest = this.entries.values().next().value
            if (!oldest) break
            this.entries.delete(oldest.key)
            if (!oldest.owner) this.destroy(oldest)
        }
    }

    private destroy(entry: CachedPreview): void {
        entry.frame.remove()
        this.frames.delete(entry)
    }

    private release(entry: CachedPreview, target: HTMLElement): void {
        if (entry.owner !== target) return
        entry.owner = null
        if (this.entries.get(entry.key) === entry && entry.frame.isConnected
            && typeof target.moveBefore === 'function') {
            if (!this.parking) {
                this.parking = target.ownerDocument.createElement('div')
                this.parking.className = 'library-preview-cache'
                this.parking.hidden = true
                this.parking.setAttribute('aria-hidden', 'true')
                target.ownerDocument.body.append(this.parking)
            }
            this.parking.moveBefore(entry.frame, null)
        } else {
            if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key)
            this.destroy(entry)
        }
    }
}
