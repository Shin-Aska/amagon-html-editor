import { describe, expect, it } from 'vitest'
import {
    AMG_ERROR_CODES,
    AMG_FIXED_LIMITS,
    AMG_FORMAT_VERSION,
    AMG_MARKER,
    AMG_PROJECT_PATH,
    AMG_MANIFEST_PATH,
    AmgContractError,
    PROJECT_SCHEMA_VERSION,
    assertAmgLimit,
    parseAmgManifest,
} from './amgContract'

const HASH = 'a'.repeat(64)

const createManifest = () => ({
    marker: AMG_MARKER,
    formatVersion: AMG_FORMAT_VERSION,
    projectSchemaVersion: PROJECT_SCHEMA_VERSION,
    projectPath: AMG_PROJECT_PATH,
    entries: [
        { path: AMG_PROJECT_PATH, uncompressedBytes: 128, sha256: HASH, compression: 'deflate' },
        { path: 'assets/images/logo.png', uncompressedBytes: 256, sha256: HASH, compression: 'store' }
    ]
})

describe('AMG v1 manifest contract', () => {
    it('parses the complete strict immutable ordered manifest', () => {
        // Given
        const manifest = createManifest()

        // When
        const parsed = parseAmgManifest(manifest)

        // Then
        expect(parsed).toEqual(manifest)
        expect(Object.isFrozen(parsed)).toBe(true)
        expect(Object.isFrozen(parsed.entries)).toBe(true)
    })

    it.each([
        ['wrong marker', { marker: 'other-project' }, AMG_ERROR_CODES.INVALID_MANIFEST],
        ['format version', { formatVersion: 2 }, AMG_ERROR_CODES.UNSUPPORTED_FORMAT_VERSION],
        ['project schema version', { projectSchemaVersion: 2 }, AMG_ERROR_CODES.UNSUPPORTED_PROJECT_SCHEMA_VERSION],
    ])('rejects %s', (_name, patch, code) => {
        // Given
        const manifest = { ...createManifest(), ...patch }

        // When
        const parse = () => parseAmgManifest(manifest)

        // Then
        expect(parse).toThrowError(expect.objectContaining({ code }))
    })

    it('rejects duplicate manifest entry paths', () => {
        // Given
        const manifest = createManifest()
        manifest.entries.push({ ...manifest.entries[1] })

        // When
        const parse = () => parseAmgManifest(manifest)

        // Then
        expect(parse).toThrowError(expect.objectContaining({
            code: AMG_ERROR_CODES.INVALID_MANIFEST
        }))
    })

    it('rejects uppercase or malformed SHA-256 values', () => {
        // Given
        const manifest = createManifest()
        manifest.entries[0] = { ...manifest.entries[0], sha256: HASH.toUpperCase() }

        // When
        const parse = () => parseAmgManifest(manifest)

        // Then
        expect(parse).toThrowError(AmgContractError)
    })

    it('rejects manifest.json as a payload entry', () => {
        // Given
        const manifest = createManifest()
        manifest.entries.push({
            path: AMG_MANIFEST_PATH, uncompressedBytes: 1, sha256: HASH, compression: 'store'
        })

        // When
        const parse = () => parseAmgManifest(manifest)

        // Then
        expect(parse).toThrowError(expect.objectContaining({
            code: AMG_ERROR_CODES.INVALID_MANIFEST
        }))
    })

    it('rejects payload entries that are not in canonical order', () => {
        // Given
        const manifest = createManifest()
        manifest.entries.push({
            path: 'assets/a.txt', uncompressedBytes: 1, sha256: HASH, compression: 'store'
        })

        // When
        const parse = () => parseAmgManifest(manifest)

        // Then
        expect(parse).toThrowError(expect.objectContaining({
            code: AMG_ERROR_CODES.INVALID_MANIFEST
        }))
    })
})

describe('AMG fixed v1 limits', () => {
    it.each(Object.entries(AMG_FIXED_LIMITS))(
        'accepts %s at its exact limit and rejects limit + 1',
        (limitName, limit) => {
            // Given
            const typedLimitName = limitName as keyof typeof AMG_FIXED_LIMITS

            // When
            const atLimit = () => assertAmgLimit(typedLimitName, limit)
            const overLimit = () => assertAmgLimit(typedLimitName, limit + 1)

            // Then
            expect(atLimit).not.toThrow()
            expect(overLimit).toThrowError(expect.objectContaining({
                code: AMG_ERROR_CODES.LIMIT_EXCEEDED,
                limitName: typedLimitName,
                actual: limit + 1
            }))
        }
    )
})
