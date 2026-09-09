import { z } from 'zod'

export const AMG_MARKER = 'amagon-project' as const
export const AMG_FORMAT_VERSION = 1 as const
export const PROJECT_SCHEMA_VERSION = 1 as const
export const AMG_MANIFEST_PATH = 'manifest.json' as const
export const AMG_PROJECT_PATH = 'project.json' as const

export const AMG_COMPRESSION_METHODS = ['store', 'deflate'] as const

export const AMG_FIXED_LIMITS = {
    payloadEntries: 10_000,
    totalZipEntries: 10_001,
    projectJsonBytes: 16_777_216,
    manifestJsonBytes: 8_388_608,
    assetBytes: 2_147_483_648,
    totalUncompressedPayloadBytes: 4_294_967_296,
    archiveBytes: 4_362_076_160,
    centralDirectoryBytes: 16_777_216,
    archivePathBytes: 1_024,
    streamChunkBytes: 1_048_576,
    queuedStreamBytes: 16_777_216,
    concurrentPayloadStreams: 1,
} as const

export type AmgLimitName = keyof typeof AMG_FIXED_LIMITS

export const AMG_ERROR_CODES = {
    INVALID_MANIFEST: 'AMG_INVALID_MANIFEST',
    UNSUPPORTED_FORMAT_VERSION: 'AMG_UNSUPPORTED_FORMAT_VERSION',
    UNSUPPORTED_PROJECT_SCHEMA_VERSION: 'AMG_UNSUPPORTED_PROJECT_SCHEMA_VERSION',
    INVALID_PROJECT_DOCUMENT: 'AMG_INVALID_PROJECT_DOCUMENT',
    CREDENTIALS_FORBIDDEN: 'AMG_CREDENTIALS_FORBIDDEN',
    LIMIT_EXCEEDED: 'AMG_LIMIT_EXCEEDED',
} as const

export type AmgErrorCode = (typeof AMG_ERROR_CODES)[keyof typeof AMG_ERROR_CODES]

type AmgErrorDetails = {
    readonly limitName?: AmgLimitName
    readonly actual?: number
    readonly cause?: unknown
}

export class AmgContractError extends Error {
    readonly name = 'AmgContractError'
    readonly code: AmgErrorCode
    readonly limitName?: AmgLimitName
    readonly actual?: number
    readonly cause?: unknown

    constructor(code: AmgErrorCode, message: string, details: AmgErrorDetails = {}) {
        super(message)
        this.code = code
        this.limitName = details.limitName
        this.actual = details.actual
        this.cause = details.cause
    }
}

export function assertAmgLimit(limitName: AmgLimitName, actual: number): void {
    const limit = AMG_FIXED_LIMITS[limitName]
    if (actual <= limit) return

    throw new AmgContractError(
        AMG_ERROR_CODES.LIMIT_EXCEEDED,
        `${limitName} exceeds the AMG v1 limit`,
        { limitName, actual },
    )
}

const utf8Length = (value: string): number => new TextEncoder().encode(value).byteLength

export const AmgManifestEntryV1Schema = z.object({
    path: z.string().min(1).refine(
        (path) => utf8Length(path) <= AMG_FIXED_LIMITS.archivePathBytes,
        'archive path exceeds the AMG v1 UTF-8 byte limit',
    ),
    uncompressedBytes: z.number().int().nonnegative(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/u),
    compression: z.enum(AMG_COMPRESSION_METHODS),
}).strict().readonly()

export type AmgManifestEntryV1 = z.infer<typeof AmgManifestEntryV1Schema>

export const AmgManifestV1Schema = z.object({
    marker: z.literal(AMG_MARKER),
    formatVersion: z.literal(AMG_FORMAT_VERSION),
    projectSchemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    projectPath: z.literal(AMG_PROJECT_PATH),
    entries: z.array(AmgManifestEntryV1Schema).min(1).readonly(),
}).strict().superRefine((manifest, context) => {
    const paths = manifest.entries.map((entry) => entry.path)
    if (paths[0] !== AMG_PROJECT_PATH) {
        context.addIssue({ code: 'custom', message: 'project.json must be the first payload entry' })
    }

    if (new Set(paths).size !== paths.length || paths.includes(AMG_MANIFEST_PATH)) {
        context.addIssue({ code: 'custom', message: 'manifest paths must be unique and exclude manifest.json' })
    }

    const assets = paths.slice(1)
    const orderedAssets = [...assets].sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
    if (assets.some((path, index) => path !== orderedAssets[index] || !path.startsWith('assets/'))) {
        context.addIssue({ code: 'custom', message: 'asset payload entries must be ordered assets/** paths' })
    }

    const projectEntry = manifest.entries[0]
    if (projectEntry && projectEntry.uncompressedBytes > AMG_FIXED_LIMITS.projectJsonBytes) {
        context.addIssue({ code: 'custom', message: 'project.json exceeds its AMG v1 limit' })
    }

    if (manifest.entries.slice(1).some((entry) => entry.uncompressedBytes > AMG_FIXED_LIMITS.assetBytes)) {
        context.addIssue({ code: 'custom', message: 'an asset exceeds its AMG v1 limit' })
    }

    const totalBytes = manifest.entries.reduce((total, entry) => total + entry.uncompressedBytes, 0)
    if (manifest.entries.length > AMG_FIXED_LIMITS.payloadEntries
        || manifest.entries.length + 1 > AMG_FIXED_LIMITS.totalZipEntries
        || totalBytes > AMG_FIXED_LIMITS.totalUncompressedPayloadBytes) {
        context.addIssue({ code: 'custom', message: 'manifest payload exceeds an AMG v1 aggregate limit' })
    }
}).readonly()

export type AmgManifestV1 = z.infer<typeof AmgManifestV1Schema>

const isRecord = (input: unknown): input is Readonly<Record<string, unknown>> => (
    typeof input === 'object' && input !== null && !Array.isArray(input)
)

export function parseAmgManifest(input: unknown): AmgManifestV1 {
    let candidate = input
    if (typeof input === 'string') {
        assertAmgLimit('manifestJsonBytes', utf8Length(input))
        try {
            candidate = JSON.parse(input)
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new AmgContractError(
                    AMG_ERROR_CODES.INVALID_MANIFEST,
                    'manifest.json is not valid JSON',
                    { cause: error },
                )
            }
            throw error
        }
    }

    if (isRecord(candidate) && candidate['formatVersion'] !== undefined
        && candidate['formatVersion'] !== AMG_FORMAT_VERSION) {
        throw new AmgContractError(
            AMG_ERROR_CODES.UNSUPPORTED_FORMAT_VERSION,
            'unsupported AMG format version',
        )
    }
    if (isRecord(candidate) && candidate['projectSchemaVersion'] !== undefined
        && candidate['projectSchemaVersion'] !== PROJECT_SCHEMA_VERSION) {
        throw new AmgContractError(
            AMG_ERROR_CODES.UNSUPPORTED_PROJECT_SCHEMA_VERSION,
            'unsupported project schema version',
        )
    }

    const result = AmgManifestV1Schema.safeParse(candidate)
    if (result.success) return result.data

    throw new AmgContractError(
        AMG_ERROR_CODES.INVALID_MANIFEST,
        'manifest.json does not satisfy the AMG v1 contract',
        { cause: result.error },
    )
}
