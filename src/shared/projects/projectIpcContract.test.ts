import { describe, expect, expectTypeOf, it } from 'vitest'
import type {
    AssetMutationBridge,
    FontMutationBridge,
    MediaMutationBridge,
    MutationResult,
    ProjectBridge,
    ProjectSaveRequest,
    ProjectSessionResult,
    ProjectSessionId,
    RendererGeneration,
    WorkspaceGeneration,
} from './projectIpcContract'
import {
    parseProjectSessionId,
    parseRendererGeneration,
    parseWorkspaceGeneration,
} from './projectIpcContract'
import type {FontAsset} from '../../renderer/store/types'

describe('project IPC contract', () => {
    it('makes ordinary Save content-only and session-bound', () => {
        // Given: the public ordinary-save request and project bridge types
        type SaveHasFilePath = 'filePath' extends keyof ProjectSaveRequest ? true : false
        type BridgeHasLoadFile = 'loadFile' extends keyof ProjectBridge ? true : false
        type RawStringIsSessionId = string extends ProjectSaveRequest['expectedSessionId'] ? true : false
        type RawNumberIsRendererGeneration = number extends ProjectSaveRequest['rendererGeneration'] ? true : false
        type RawNumberIsWorkspaceGeneration = number extends WorkspaceGeneration ? true : false
        type RawStringIsRecentId = string extends Parameters<ProjectBridge['openRecent']>[0] ? true : false

        // When: their authority-bearing keys are inspected by TypeScript
        const saveHasFilePath: SaveHasFilePath = false
        const bridgeHasLoadFile: BridgeHasLoadFile = false
        const rawStringIsSessionId: RawStringIsSessionId = false
        const rawNumberIsRendererGeneration: RawNumberIsRendererGeneration = false
        const rawNumberIsWorkspaceGeneration: RawNumberIsWorkspaceGeneration = false
        const rawStringIsRecentId: RawStringIsRecentId = false

        // Then: neither a destination path nor path-based open exists
        expect(saveHasFilePath).toBe(false)
        expect(bridgeHasLoadFile).toBe(false)
        expect(rawStringIsSessionId).toBe(false)
        expect(rawNumberIsRendererGeneration).toBe(false)
        expect(rawNumberIsWorkspaceGeneration).toBe(false)
        expect(rawStringIsRecentId).toBe(false)
        expectTypeOf<string>().not.toMatchTypeOf<ProjectSessionId>()
        expectTypeOf<number>().not.toMatchTypeOf<RendererGeneration>()
        expectTypeOf<number>().not.toMatchTypeOf<WorkspaceGeneration>()
        expectTypeOf<ProjectSaveRequest>().toHaveProperty('expectedSessionId')
        expectTypeOf<ProjectSaveRequest>().toHaveProperty('rendererGeneration')
        expectTypeOf<ProjectSaveRequest>().toHaveProperty('snapshot')
    })

    it('parses only canonical session identities and generations', () => {
        // Given: main-authored opaque identity and nonnegative safe generations
        const sessionValue = 'session_A_1234567890'

        // When: values cross the trusted renderer contract boundary
        const sessionId = parseProjectSessionId(sessionValue)
        const rendererGeneration = parseRendererGeneration(7)
        const workspaceGeneration = parseWorkspaceGeneration(11)

        // Then: valid values are branded and malformed authority is rejected
        expect(sessionId).toBe(sessionValue)
        expect(rendererGeneration).toBe(7)
        expect(workspaceGeneration).toBe(11)
        expect(() => parseProjectSessionId('short')).toThrow()
        expect(() => parseProjectSessionId('session with spaces')).toThrow()
        expect(() => parseRendererGeneration(-1)).toThrow()
        expect(() => parseRendererGeneration(1.5)).toThrow()
        expect(() => parseWorkspaceGeneration(Number.MAX_SAFE_INTEGER + 1)).toThrow()
    })

    it('binds every asset mutation request to an expected session', () => {
        // Given: every mutating asset bridge operation
        type SelectRequest = Parameters<AssetMutationBridge['selectImage']>[0]
        type DeleteRequest = Parameters<AssetMutationBridge['delete']>[0]
        type ImportRequest = Parameters<AssetMutationBridge['import']>[0]
        type FontImportRequest = Parameters<FontMutationBridge<unknown>['importFile']>[0]
        type FontDownloadRequest = Parameters<FontMutationBridge<unknown>['downloadGoogleFont']>[0]
        type FontCopyRequest = Parameters<FontMutationBridge<unknown>['copySystemFont']>[0]
        type FontDeleteRequest = Parameters<FontMutationBridge<unknown>['deleteFont']>[0]
        type MediaDownloadRequest = Parameters<MediaMutationBridge['downloadAndImport']>[0]

        // When: the requests are checked structurally
        const keys = [
            'expectedSessionId' satisfies keyof SelectRequest,
            'expectedSessionId' satisfies keyof DeleteRequest,
            'expectedSessionId' satisfies keyof ImportRequest,
            'expectedSessionId' satisfies keyof FontImportRequest,
            'expectedSessionId' satisfies keyof FontDownloadRequest,
            'expectedSessionId' satisfies keyof FontCopyRequest,
            'expectedSessionId' satisfies keyof FontDeleteRequest,
            'expectedSessionId' satisfies keyof MediaDownloadRequest,
        ]

        // Then: all mutation entry points require the session binding
        expect(keys).toEqual(Array.from({ length: 8 }, () => 'expectedSessionId'))
    })

    it('distinguishes retained side effects from proven unchanged failures', () => {
        // Given: the exhaustive mutation result union
        type Failure = Extract<MutationResult<never>, { readonly success: false }>
        type Partial = Extract<Failure, { readonly changed: true }>
        type Unchanged = Extract<Failure, { readonly changed: false }>

        // When: retained and absent side effects are selected by the changed discriminant
        const discriminants: readonly [Partial['changed'], Unchanged['changed']] = [true, false]

        // Then: both responses echo session and generation while side effects stay explicit
        expect(discriminants).toEqual([true, false])
        expectTypeOf<Partial>().toHaveProperty('sessionId')
        expectTypeOf<Partial>().toHaveProperty('workspaceGeneration')
        expectTypeOf<Unchanged>().toHaveProperty('sessionId')
        expectTypeOf<Unchanged>().toHaveProperty('workspaceGeneration')
    })

    it('returns materializable session identity from successful project operations', () => {
        // Given: a successful project result type
        type Success = Extract<ProjectSessionResult, { readonly success: true }>

        // When: its session payload is inspected
        type Session = Success['session']

        // Then: identity, durable data, and both committed generations are mandatory
        expectTypeOf<Session>().toHaveProperty('sessionId')
        expectTypeOf<Session>().toHaveProperty('data')
        expectTypeOf<Session>().toHaveProperty('committedRendererGeneration')
        expectTypeOf<Session>().toHaveProperty('committedWorkspaceGeneration')
    })

    it('forbids session-free Electron mutation overloads', () => {
        // Given: the renderer-visible Electron mutation methods
        type FontAllowsNoArgs = ElectronApi['fonts']['importFile'] extends { (): unknown } ? true : false
        type AssetAllowsNoArgs = ElectronApi['assets']['selectImage'] extends { (): unknown } ? true : false
        type MediaAllowsRawUrl = ElectronApi['mediaSearch']['downloadAndImport'] extends {
            (url: string): unknown
        } ? true : false
        type StrictFontSatisfiesGlobal = FontMutationBridge<FontAsset>['importFile'] extends
            ElectronApi['fonts']['importFile'] ? true : false
        type StrictAssetSatisfiesGlobal = AssetMutationBridge['selectImage'] extends
            ElectronApi['assets']['selectImage'] ? true : false
        type StrictMediaSatisfiesGlobal = MediaMutationBridge['downloadAndImport'] extends
            ElectronApi['mediaSearch']['downloadAndImport'] ? true : false

        // When: TypeScript checks the legacy invocation shapes
        const fontAllowsNoArgs: FontAllowsNoArgs = false
        const assetAllowsNoArgs: AssetAllowsNoArgs = false
        const mediaAllowsRawUrl: MediaAllowsRawUrl = false
        const strictFontSatisfiesGlobal: StrictFontSatisfiesGlobal = true
        const strictAssetSatisfiesGlobal: StrictAssetSatisfiesGlobal = true
        const strictMediaSatisfiesGlobal: StrictMediaSatisfiesGlobal = true

        // Then: only expectedSessionId-bound requests remain callable
        expect(fontAllowsNoArgs).toBe(false)
        expect(assetAllowsNoArgs).toBe(false)
        expect(mediaAllowsRawUrl).toBe(false)
        expect(strictFontSatisfiesGlobal).toBe(true)
        expect(strictAssetSatisfiesGlobal).toBe(true)
        expect(strictMediaSatisfiesGlobal).toBe(true)
    })
})
