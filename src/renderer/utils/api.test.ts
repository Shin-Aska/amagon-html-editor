import { afterEach, describe, expect, it, vi } from 'vitest'
import mockApi, {
    getApi,
    getLegacyBrowserAssetMutations,
    getLegacyBrowserFontMutations,
    getLegacyBrowserMediaMutation,
    getLegacyBrowserProjectApi,
} from './api'

describe('project API boundaries', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        localStorage.clear()
        Reflect.deleteProperty(window, 'api')
    })

    it('downloads project.json when saving legacy JSON', async () => {
        // Given: the browser download surface and a legacy JSON document
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
        const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:project-json')
        const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

        // When: Save As is requested in browser mode
        const result = await mockApi.project.saveAs({ content: '{"pages":[]}' })

        // Then: a JSON-only project download is produced under the legacy filename
        expect(result).toMatchObject({ success: true, filePath: 'project.json' })
        expect(createObjectUrl).toHaveBeenCalledOnce()
        expect(click).toHaveBeenCalledOnce()
        expect(revokeObjectUrl).toHaveBeenCalledWith('blob:project-json')
    })

    it('opens parsed JSON through a JSON-only browser picker', async () => {
        // Given: a JSON file chosen through the browser picker
        let acceptedTypes = ''
        vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
            acceptedTypes = this.accept
            Object.defineProperty(this, 'files', {
                configurable: true,
                value: [new File(['{"pages":[]}'], 'legacy.json', { type: 'application/json' })],
            })
            void this.onchange?.(new Event('change'))
        })

        // When: Open is requested in browser mode
        const result = await mockApi.project.load()

        // Then: only JSON is advertised and the selected document is parsed
        expect(acceptedTypes).toBe('.json')
        expect(result).toMatchObject({
            success: true,
            filePath: 'legacy.json',
            content: { pages: [] },
        })
    })

    it('rejects AMG files without loading archive support', async () => {
        // Given: an AMG-named file forced past the JSON-only picker filter
        vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
            Object.defineProperty(this, 'files', {
                configurable: true,
                value: [new File(['{}'], 'bundle.amg', { type: 'application/octet-stream' })],
            })
            void this.onchange?.(new Event('change'))
        })

        // When: Open receives the unsupported file in browser mode
        const result = await mockApi.project.load()

        // Then: the mock reports a typed unsupported-format failure
        expect(result).toMatchObject({
            success: false,
            code: 'UNSUPPORTED_IN_BROWSER',
        })
    })

    it('rejects a renderer-controlled absolute ordinary-save path', async () => {
        // Given: an untrusted legacy caller supplying an absolute destination
        const save = Reflect.get(mockApi.project, 'save')

        // When: ordinary Save is invoked with path authority
        const result = await Reflect.apply(save, undefined, [{
            filePath: 'C:\\outside\\project.json',
            content: '{"pages":[]}',
        }])

        // Then: browser mode refuses the path-controlled save
        expect(result).toMatchObject({
            success: false,
            code: 'PATH_AUTHORITY_FORBIDDEN',
        })
        expect(localStorage.getItem('project:C:\\outside\\project.json')).toBeNull()
    })

    it('does not inherit browser path authority into the Electron facade', async () => {
        // Given: a strict Electron project bridge with an observable session-bound Save
        const save = vi.fn(async () => ({
            success: true,
            session: {
                sessionId: 'main-session',
                kind: 'amg',
                displayPath: 'project.amg',
                data: {},
                committedRendererGeneration: 4,
                committedWorkspaceGeneration: 9,
                dirty: false,
            },
        }))
        const project = {
            save,
            saveAs: save,
            load: vi.fn(),
            openRecent: vi.fn(),
            removeRecent: vi.fn(),
            new: vi.fn(),
            close: vi.fn(),
            getRecent: vi.fn(),
            getDir: vi.fn(),
            onProgress: vi.fn(),
        }
        Object.defineProperty(window, 'api', {
            configurable: true,
            value: { project, assets: {}, fonts: {}, mediaSearch: {} },
        })

        // When: the renderer resolves and invokes the Electron-facing facade
        const runtimeApi = getApi()
        const saveRequest = {
            expectedSessionId: 'main-session',
            rendererGeneration: 4,
            snapshot: {},
        }
        const result = await Reflect.apply(Reflect.get(runtimeApi.project, 'save'), undefined, [saveRequest])

        // Then: the exact strict bridge is used without browser-only path methods
        expect(Reflect.has(runtimeApi.project, 'loadFile')).toBe(false)
        expect(save).toHaveBeenCalledWith(saveRequest)
        expect(result).toMatchObject({
            success: true,
            session: {
                sessionId: 'main-session',
                committedRendererGeneration: 4,
                committedWorkspaceGeneration: 9,
            },
        })
    })

    it('preserves strict stale-session and forged-recent error shapes', async () => {
        // Given: a strict Electron bridge returning main-authored typed failures
        const staleSession = {
            success: false,
            error: {
                code: 'STALE_SESSION',
                expectedSessionId: 'stale-session',
                activeSessionId: 'active-session',
            },
        }
        const forgedRecent = {
            success: false,
            error: {
                code: 'RECENT_NOT_FOUND',
                recentId: 'recent-opaque-42',
            },
        }
        const save = vi.fn(async () => staleSession)
        const openRecent = vi.fn(async () => forgedRecent)
        Object.defineProperty(window, 'api', {
            configurable: true,
            value: {
                project: { save, openRecent },
            },
        })

        // When: session-bound Save and opaque recent-open cross the facade
        const runtimeApi = getApi()
        const saveResult = await Reflect.apply(Reflect.get(runtimeApi.project, 'save'), undefined, [{
            expectedSessionId: 'stale-session',
            rendererGeneration: 5,
            snapshot: {},
        }])
        const recentResult = await Reflect.apply(
            Reflect.get(runtimeApi.project, 'openRecent'),
            undefined,
            ['recent-opaque-42'],
        )

        // Then: the facade echoes structured main errors without path reinterpretation
        expect(saveResult).toEqual(staleSession)
        expect(recentResult).toEqual(forgedRecent)
        expect(openRecent).toHaveBeenCalledWith('recent-opaque-42')
    })

    it('returns an explicit unavailable result for legacy Electron-only callers', async () => {
        // Given: Electron is active without a renderer-owned project session
        Object.defineProperty(window, 'api', {
            configurable: true,
            value: { project: {}, assets: {}, fonts: {}, mediaSearch: {} },
        })

        // When: unmigrated project and mutation callsites enter browser-only boundaries
        const results = await Promise.all([
            getLegacyBrowserProjectApi().save({ filePath: 'C:\\outside\\project.json', content: '{}' }),
            getLegacyBrowserAssetMutations().selectImage(),
            getLegacyBrowserFontMutations().importFile(),
            getLegacyBrowserMediaMutation().downloadAndImport('https://example.invalid/image.png'),
        ])

        // Then: every call fails explicitly without inventing session identity or filesystem authority
        expect(results).toHaveLength(4)
        for (const result of results) {
            expect(result).toMatchObject({ success: false, code: 'PROJECT_SESSION_REQUIRED' })
            expect(Reflect.has(result, 'sessionId')).toBe(false)
        }
        expect(localStorage.length).toBe(0)
    })
})
