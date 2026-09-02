import {readFile} from 'node:fs/promises'
import {atomicWriteFile} from './atomicFile'
import type {AtomicWriteOptions} from './atomicFile'
import {parseLegacyProjectDocument} from '../../shared/projects/projectDocumentSchema'
import type {LegacyProjectDocument} from '../../shared/projects/projectDocumentSchema'

export type LegacyProjectValidator<Project> = (value: unknown) => Project

export class LegacyProjectValidationError extends Error {
    readonly name = 'LegacyProjectValidationError'

    constructor(readonly reason: 'syntax' | 'schema', readonly originalError: Error) {
        super(`Legacy project failed ${reason} validation`)
    }
}

function normalizeCustomCss(value: unknown): unknown {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
    if (Object.prototype.hasOwnProperty.call(value, 'customCss')) return value
    return {...value, customCss: ''}
}

export function parseLegacyJsonProject(source: string): LegacyProjectDocument
export function parseLegacyJsonProject<Project>(
    source: string,
    validate: LegacyProjectValidator<Project>
): Project
export function parseLegacyJsonProject(
    source: string,
    validate: LegacyProjectValidator<unknown> = parseLegacyProjectDocument
): unknown {
    let decoded: unknown
    try {
        decoded = JSON.parse(source)
    } catch (error) {
        if (!(error instanceof Error)) throw error
        throw new LegacyProjectValidationError('syntax', error)
    }
    try {
        return validate(normalizeCustomCss(decoded))
    } catch (error) {
        if (!(error instanceof Error)) throw error
        throw new LegacyProjectValidationError('schema', error)
    }
}

export function readLegacyJsonProject(filePath: string): Promise<LegacyProjectDocument>
export function readLegacyJsonProject<Project>(
    filePath: string,
    validate: LegacyProjectValidator<Project>
): Promise<Project>
export async function readLegacyJsonProject(
    filePath: string,
    validate: LegacyProjectValidator<unknown> = parseLegacyProjectDocument
): Promise<unknown> {
    return parseLegacyJsonProject(await readFile(filePath, 'utf8'), validate)
}

export function saveLegacyJsonProject(
    filePath: string,
    project: LegacyProjectDocument,
    options?: Partial<AtomicWriteOptions>
): Promise<void>
export function saveLegacyJsonProject<Project>(
    filePath: string,
    project: Project,
    validate: LegacyProjectValidator<Project>,
    options?: Partial<AtomicWriteOptions>
): Promise<void>
export async function saveLegacyJsonProject(
    filePath: string,
    project: unknown,
    validatorOrOptions: LegacyProjectValidator<unknown> | Partial<AtomicWriteOptions> = {},
    injectedOptions: Partial<AtomicWriteOptions> = {}
): Promise<void> {
    const validate = typeof validatorOrOptions === 'function'
        ? validatorOrOptions
        : parseLegacyProjectDocument
    const options = typeof validatorOrOptions === 'function' ? injectedOptions : validatorOrOptions
    let validated: unknown
    try {
        validated = validate(normalizeCustomCss(project))
    } catch (error) {
        if (!(error instanceof Error)) throw error
        throw new LegacyProjectValidationError('schema', error)
    }
    const content = JSON.stringify(validated, null, 2)
    await atomicWriteFile(filePath, content, {
        maxBytes: options.maxBytes ?? Buffer.byteLength(content),
        ...(options.fileSystem === undefined ? {} : {fileSystem: options.fileSystem}),
        ...(options.createId === undefined ? {} : {createId: options.createId})
    })
}
