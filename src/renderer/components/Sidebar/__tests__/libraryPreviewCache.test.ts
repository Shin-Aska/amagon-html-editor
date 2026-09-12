import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {LibraryPreviewCache} from '../libraryPreviewCache'

describe('rendered preview cache', () => {
    let cache: LibraryPreviewCache
    let tile: HTMLDivElement
    const originalMove = Object.getOwnPropertyDescriptor(Element.prototype, 'moveBefore')
    const render = vi.fn(() => '<!doctype html><h1>Preview</h1>')
    const presentation = (revision = 'original') => ({
        title: 'Preview', width: 110, viewport: 220, sandbox: '', revision, render
    })

    beforeEach(() => {
        Object.defineProperty(Element.prototype, 'moveBefore', {
            configurable: true, writable: true,
            value: function moveNodeForCacheUnitTest(this: Element, node: Node, child: Node | null): void {
                this.insertBefore(node, child)
            }
        })
        cache = new LibraryPreviewCache(2)
        tile = document.createElement('div')
        document.body.append(tile)
        render.mockClear()
    })

    afterEach(() => {
        cache.clear()
        document.body.replaceChildren()
        if (originalMove) Object.defineProperty(Element.prototype, 'moveBefore', originalMove)
        else Reflect.deleteProperty(Element.prototype, 'moveBefore')
    })

    const frame = (): HTMLIFrameElement => {
        const value = tile.querySelector('iframe')
        if (!value) throw new Error('Preview is missing')
        return value
    }

    it('reuses the retained frame and skips document generation for unchanged content', () => {
        const release = cache.show('a', tile, presentation())
        const original = frame()
        release()
        expect(original.closest('.library-preview-cache')?.hasAttribute('hidden')).toBe(true)
        cache.show('a', tile, presentation())
        expect(frame()).toBe(original)
        expect(render).toHaveBeenCalledTimes(1)
    })

    it('evicts the least recently used preview after a cache hit updates its position', () => {
        let release = cache.show('a', tile, presentation())
        const a = frame()
        release()
        release = cache.show('b', tile, presentation())
        const b = frame()
        release()
        cache.show('a', tile, presentation())()
        cache.show('c', tile, presentation())()
        expect(a.isConnected).toBe(true)
        expect(b.isConnected).toBe(false)
        expect(document.querySelectorAll('.library-preview-cache iframe')).toHaveLength(2)
    })

    it('replaces stale rendered frames when their content revision changes', () => {
        const release = cache.show('a', tile, presentation())
        const original = frame()
        release()
        cache.show('a', tile, presentation('edited'))()
        expect(original.isConnected).toBe(false)
        expect(render).toHaveBeenCalledTimes(2)
        expect(document.querySelectorAll('iframe')).toHaveLength(1)
    })

    it('retains 64 previews and evicts the oldest when the 65th arrives', () => {
        cache.setCapacity(64)
        const releaseFirst = cache.show('0', tile, presentation())
        const first = frame()
        releaseFirst()
        for (let index = 1; index < 64; index++) cache.show(String(index), tile, presentation())()
        expect(first.isConnected).toBe(true)
        expect(document.querySelectorAll('iframe')).toHaveLength(64)
        cache.show('64', tile, presentation())()
        expect(first.isConnected).toBe(false)
        expect(document.querySelectorAll('iframe')).toHaveLength(64)
    })

    it('immediately releases older retained entries when capacity is reduced', () => {
        cache.show('a', tile, presentation())()
        cache.show('b', tile, presentation())()
        cache.setCapacity(1)
        expect(document.querySelectorAll('iframe')).toHaveLength(1)
        cache.show('b', tile, presentation())()
        expect(render).toHaveBeenCalledTimes(2)
        cache.show('a', tile, presentation())()
        expect(render).toHaveBeenCalledTimes(3)
    })

    it('keeps visible previews usable below the visible count and destroys them on release', () => {
        cache.setCapacity(1)
        const otherTile = document.createElement('div')
        document.body.append(otherTile)
        const releaseA = cache.show('a', tile, presentation())
        const a = frame()
        const releaseB = cache.show('b', otherTile, presentation())
        expect(a.parentElement).toBe(tile)
        expect(otherTile.querySelector('iframe')).not.toBeNull()
        releaseA()
        expect(a.isConnected).toBe(false)
        releaseB()
        expect(document.querySelectorAll('.library-preview-cache iframe')).toHaveLength(1)
    })

    it('retains nothing at zero slots and clears active and parked frames on disposal', () => {
        cache.setCapacity(0)
        const release = cache.show('a', tile, presentation())
        expect(frame().isConnected).toBe(true)
        release()
        expect(document.querySelector('iframe')).toBeNull()
        cache.setCapacity(2)
        cache.show('a', tile, presentation())()
        cache.show('b', tile, presentation())
        cache.clear()
        expect(document.querySelector('iframe, .library-preview-cache')).toBeNull()
    })

    it('releases frames when the browser cannot move them without reloading', () => {
        Reflect.set(Element.prototype, 'moveBefore', undefined)
        cache.show('a', tile, presentation())()
        expect(document.querySelector('iframe')).toBeNull()
        cache.show('a', tile, presentation())()
        expect(render).toHaveBeenCalledTimes(2)
    })
})
