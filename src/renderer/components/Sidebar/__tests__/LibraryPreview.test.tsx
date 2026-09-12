import {act} from 'react'
import {createRoot} from 'react-dom/client'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {LibraryPreview} from '../LibraryPreview'
import {LibraryPreviewCacheProvider} from '../LibraryPreviewCacheProvider'
import {useAppSettingsStore} from '../../../store/appSettingsStore'
import {useEditorStore} from '../../../store/editorStore'
import {useProjectStore} from '../../../store/projectStore'
import {createBlock, type Page} from '../../../store/types'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
vi.mock('../../../project/projectCommands', () => ({useProjectCommandState: () => ({session: null})}))

describe('live page preview lifecycle', () => {
    let root: ReturnType<typeof createRoot>
    let container: HTMLDivElement
    let visibility: (visible: boolean) => void
    const heading = createBlock('heading', {props: {text: 'Original', level: 1}})
    const page: Page = {id: 'live-page', title: 'Home', slug: 'index', meta: {}, blocks: [heading]}

    beforeEach(() => {
        useAppSettingsStore.setState({libraryPreviewMode: 'live', libraryPreviewCacheSlots: 0})
        vi.useFakeTimers()
        vi.stubGlobal('ResizeObserver', class {
            observe(): void {}
            disconnect(): void {}
        })
        vi.stubGlobal('IntersectionObserver', class {
            constructor(callback: (entries: readonly {isIntersecting: boolean}[]) => void) {
                visibility = visible => callback([{isIntersecting: visible}])
            }
            observe(): void {}
            disconnect(): void {}
        })
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 280, 140))
        useEditorStore.setState({blocks: [heading], pageBlocksBackup: null, activeTabEditBlockId: null, activeTabIndex: null, customCss: ''})
        useProjectStore.setState({pages: [page], currentPageId: page.id, userBlocks: []})
        container = document.createElement('div')
        document.body.append(container)
        root = createRoot(container)
        act(() => root.render(<LibraryPreviewCacheProvider><LibraryPreview kind="page" page={page}/></LibraryPreviewCacheProvider>))
    })

    afterEach(() => {
        act(() => root.unmount())
        container.remove()
        vi.useRealTimers()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    const text = (container: HTMLElement): string => {
        const srcDoc = container.querySelector('iframe')?.srcdoc ?? ''
        return new DOMParser().parseFromString(srcDoc, 'text/html').body.textContent ?? ''
    }

    it('does not mount offscreen frames and releases them when caching is disabled', () => {
        // Given
        expect(container.querySelector('iframe')).toBeNull()
        // When
        act(() => visibility(true))
        // Then
        expect(text(container)).toContain('Original')
        // When
        act(() => visibility(false))
        // Then
        expect(container.querySelector('iframe')).toBeNull()
    })

    it('coalesces unsaved edits and shows the latest content', () => {
        // Given
        act(() => visibility(true))
        // When
        act(() => {
            useEditorStore.getState().updateBlock(heading.id, {props: {text: 'First edit'}})
            useEditorStore.getState().updateBlock(heading.id, {props: {text: 'Latest edit'}})
        })
        // Then
        expect(text(container)).toContain('Original')
        act(() => vi.advanceTimersByTime(150))
        expect(text(container)).toContain('Latest edit')
        expect(text(container)).not.toContain('First edit')
    })

    it('keeps the surrounding page when editing the contents of a nested tab', () => {
        // Given
        const nested = createBlock('heading', {props: {text: 'Nested original', level: 2}})
        const tabs = createBlock('tabs', {props: {tabs: [{id: 'one', label: 'One', blocks: [nested]}]}})
        act(() => {
            useEditorStore.setState({blocks: [heading, tabs]})
            visibility(true)
            useEditorStore.getState().enterTabEditMode(tabs.id, 0)
        })
        // When
        act(() => useEditorStore.getState().updateBlock(nested.id, {props: {text: 'Nested edited'}}))
        act(() => vi.advanceTimersByTime(150))
        // Then
        expect(text(container)).toContain('Original')
        expect(text(container)).toContain('Nested edited')
    })
})
