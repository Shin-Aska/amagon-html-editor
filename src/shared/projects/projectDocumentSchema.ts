import { z } from 'zod'
import {
    AMG_ERROR_CODES,
    AmgContractError,
    PROJECT_SCHEMA_VERSION,
} from './amgContract'

const StringMapSchema = z.record(z.string(), z.string()).readonly()
const UnknownMapSchema = z.record(z.string(), z.unknown()).readonly()

const ThemeSchema = z.object({
    name: z.string(),
    isCustom: z.boolean().optional(),
    colors: z.object({
        primary: z.string(),
        secondary: z.string(),
        accent: z.string(),
        background: z.string(),
        surface: z.string(),
        text: z.string(),
        textMuted: z.string(),
        border: z.string(),
        success: z.string(),
        warning: z.string(),
        danger: z.string(),
    }).passthrough().readonly(),
    typography: z.object({
        fontFamily: z.string(),
        headingFontFamily: z.string(),
        baseFontSize: z.string(),
        lineHeight: z.string(),
        headingLineHeight: z.string(),
    }).passthrough().readonly(),
    spacing: z.object({
        baseUnit: z.string(),
        scale: z.array(z.number()).readonly(),
    }).passthrough().readonly(),
    borders: z.object({
        radius: z.string(),
        width: z.string(),
        color: z.string(),
    }).passthrough().readonly(),
    componentTokens: UnknownMapSchema.optional(),
    customCss: z.string(),
    customCssFiles: z.array(z.object({
        id: z.string(),
        name: z.string(),
        css: z.string(),
        enabled: z.boolean(),
    }).passthrough().readonly()).readonly().optional(),
}).passthrough().readonly()

const FontAssetSchema = z.object({
    id: z.string(),
    name: z.string(),
    fileName: z.string(),
    relativePath: z.string(),
    format: z.enum(['ttf', 'otf', 'woff', 'woff2']),
    weight: z.string().optional(),
    style: z.string().optional(),
    source: z.enum(['system', 'imported', 'google-fonts']),
}).passthrough().readonly()

const ProjectSettingsSchema = z.object({
    name: z.string(),
    framework: z.enum(['bootstrap-5', 'tailwind', 'vanilla']),
    theme: ThemeSchema,
    themes: z.object({
        light: ThemeSchema,
        dark: ThemeSchema,
        previewMode: z.enum(['device', 'light', 'dark']),
    }).passthrough().readonly().optional(),
    fonts: z.array(FontAssetSchema).readonly().optional(),
    componentTokens: UnknownMapSchema.optional(),
    globalStyles: StringMapSchema,
}).passthrough().readonly()

type ParsedBlock = {
    readonly id: string
    readonly type: string
    readonly props: Readonly<Record<string, unknown>>
    readonly styles: Readonly<Record<string, string>>
    readonly classes: readonly string[]
    readonly children: readonly ParsedBlock[]
    readonly [key: string]: unknown
}

const BlockSchema: z.ZodType<ParsedBlock> = z.lazy(() => z.object({
    id: z.string(),
    type: z.string(),
    tag: z.string().optional(),
    props: UnknownMapSchema,
    styles: StringMapSchema,
    classes: z.array(z.string()).readonly(),
    animation: z.object({
        preset: z.enum(['fade', 'slide-up', 'slide-left', 'slide-right', 'scale', 'zoom', 'bounce']),
        durationMs: z.number(),
        delayMs: z.number(),
        easing: z.enum(['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out']),
    }).passthrough().readonly().optional(),
    hoverEffect: z.object({ preset: z.enum(['lift', 'grow', 'glow', 'shadow', 'fade', 'underline', 'dim']) })
        .passthrough().readonly().optional(),
    actionEffect: z.object({ preset: z.enum(['press', 'pop', 'pulse', 'shake']) })
        .passthrough().readonly().optional(),
    events: StringMapSchema.optional(),
    content: z.string().optional(),
    children: z.array(BlockSchema).readonly(),
    locked: z.boolean().optional(),
}).passthrough().readonly())

const PageSchema = z.object({
    id: z.string(),
    title: z.string(),
    pageTitle: z.string().optional(),
    slug: z.string(),
    tags: z.array(z.string()).readonly().optional(),
    folderId: z.string().optional(),
    blocks: z.array(BlockSchema).readonly(),
    meta: StringMapSchema,
    fullWidthFormControls: z.boolean().optional(),
}).passthrough().readonly()

const UserBlockSchema = z.object({
    id: z.string(),
    label: z.string(),
    icon: z.string().optional(),
    category: z.string().optional(),
    content: BlockSchema,
}).passthrough().readonly()

const NamedExtensionSchema = z.object({ id: z.string(), name: z.string() }).passthrough().readonly()

const PublisherConfigSchema = z.object({
    providerId: z.string(),
    lastPublishedUrl: z.string().optional(),
    lastPublishedAt: z.string().optional(),
}).passthrough().readonly()

const ProjectDataFields = {
    customCss: z.string(),
    projectSettings: ProjectSettingsSchema,
    pages: z.array(PageSchema).readonly(),
    folders: z.array(z.object({
        id: z.string(),
        name: z.string(),
        tags: z.array(z.string()).readonly().optional(),
    }).passthrough().readonly()).readonly().optional(),
    userBlocks: z.array(UserBlockSchema).readonly(),
    customPresets: z.array(ThemeSchema).readonly().optional(),
    themePacks: z.array(NamedExtensionSchema).readonly().optional(),
    sectionTemplates: z.array(NamedExtensionSchema).readonly().optional(),
    pageTemplates: z.array(NamedExtensionSchema).readonly().optional(),
    appliedThemePackId: z.string().nullable().optional(),
    isProjectLoaded: z.boolean().optional(),
    publisherConfig: PublisherConfigSchema.optional(),
} as const

export const ProjectDocumentV1Schema = z.object({
    projectSchemaVersion: z.literal(PROJECT_SCHEMA_VERSION),
    ...ProjectDataFields,
}).passthrough().readonly()

export const LegacyProjectDocumentSchema = z.object(ProjectDataFields)
    .passthrough().readonly()

export type ProjectDocumentV1 = z.infer<typeof ProjectDocumentV1Schema>
export type LegacyProjectDocument = z.infer<typeof LegacyProjectDocumentSchema>

const isRecord = (input: unknown): input is Readonly<Record<string, unknown>> => (
    typeof input === 'object' && input !== null && !Array.isArray(input)
)

const hasCredentials = (input: unknown): boolean => {
    if (!isRecord(input)) return false
    const publisherConfig = input['publisherConfig']
    return isRecord(publisherConfig) && 'encryptedCredentials' in publisherConfig
}

const rejectUnsupportedVersion = (input: unknown): void => {
    if (!isRecord(input) || input['projectSchemaVersion'] === undefined) return
    if (input['projectSchemaVersion'] === PROJECT_SCHEMA_VERSION) return

    throw new AmgContractError(
        AMG_ERROR_CODES.UNSUPPORTED_PROJECT_SCHEMA_VERSION,
        'unsupported project schema version',
    )
}

export function parseProjectDocumentV1(input: unknown): ProjectDocumentV1 {
    rejectUnsupportedVersion(input)
    if (hasCredentials(input)) {
        throw new AmgContractError(
            AMG_ERROR_CODES.CREDENTIALS_FORBIDDEN,
            'publisher credentials must not be stored in a project document',
        )
    }

    const result = ProjectDocumentV1Schema.safeParse(input)
    if (result.success) return result.data

    throw new AmgContractError(
        AMG_ERROR_CODES.INVALID_PROJECT_DOCUMENT,
        'project.json does not satisfy the project schema v1 contract',
        { cause: result.error },
    )
}

export function parseLegacyProjectDocument(input: unknown): LegacyProjectDocument {
    rejectUnsupportedVersion(input)
    if (hasCredentials(input)) {
        throw new AmgContractError(
            AMG_ERROR_CODES.CREDENTIALS_FORBIDDEN,
            'publisher credentials must not be stored in a project document',
        )
    }

    const candidate = isRecord(input) && input['customCss'] === undefined
        ? { ...input, customCss: '' }
        : input
    const result = LegacyProjectDocumentSchema.safeParse(candidate)
    if (result.success) return result.data

    throw new AmgContractError(
        AMG_ERROR_CODES.INVALID_PROJECT_DOCUMENT,
        'legacy project JSON is invalid',
        { cause: result.error },
    )
}
