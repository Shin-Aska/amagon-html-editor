import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {basename, extname} from 'node:path'
import {z} from 'zod'
import {atomicWriteFile} from './atomicFile'

const recentVersion = 2 as const
const defaultMaximumProjects = 10
const maximumPersistenceBytes = 1024 * 1024
const RecentProjectIdSchema = z.string().uuid().brand<'RecentProjectId'>()
const StoredRecentProjectSchema = z.object({
    id: RecentProjectIdSchema,
    path: z.string().min(1)
}).readonly()
const StoredRecentProjectsV2Schema = z.object({
    version: z.literal(recentVersion),
    projects: z.array(StoredRecentProjectSchema).readonly()
}).readonly()
const LegacyRecentProjectsSchema = z.array(z.string().min(1)).readonly()

type RecentProjectId = z.infer<typeof RecentProjectIdSchema>
type StoredRecentProject = z.infer<typeof StoredRecentProjectSchema>

type RecentState = readonly StoredRecentProject[]

export type RecentProjectInspection = {
    readonly name?: string
    readonly framework?: string
}

export type RecentProjectMetadata = {
    readonly id: RecentProjectId
    readonly name: string
    readonly framework: string | undefined
    readonly displayPath: string
}

export type RecentProjectsStoreOptions = {
    readonly storagePath: string
    readonly maximumProjects?: number
    readonly createId?: () => string
    readonly inspect?: (projectPath: string) => Promise<RecentProjectInspection>
    readonly persist?: (storagePath: string, content: string) => Promise<void>
}

export type RecentProjectsStore = {
    readonly list: () => Promise<readonly RecentProjectMetadata[]>
    readonly add: (projectPath: string) => Promise<void>
    readonly remove: (id: unknown) => Promise<readonly RecentProjectMetadata[]>
    readonly resolvePath: (id: unknown) => Promise<string>
}

export class InvalidRecentProjectIdError extends Error {
    readonly name = 'InvalidRecentProjectIdError'
    constructor() {
        super('Recent project ID is invalid')
    }
}

export class UnknownRecentProjectError extends Error {
    readonly name = 'UnknownRecentProjectError'
    constructor(readonly id: RecentProjectId) {
        super('Recent project ID is not in the main-owned list')
    }
}

export class InvalidGeneratedRecentProjectIdError extends Error {
    readonly name = 'InvalidGeneratedRecentProjectIdError'
    constructor(readonly id: string) {
        super('Generated recent project ID is invalid')
    }
}

function parseId(value: unknown): RecentProjectId {
    const result = RecentProjectIdSchema.safeParse(value)
    if (!result.success) throw new InvalidRecentProjectIdError()
    return result.data
}

function parseStoredState(value: unknown, createId: () => string): RecentState {
    const legacy = LegacyRecentProjectsSchema.safeParse(value)
    if (legacy.success) {
        return Array.from(new Set(legacy.data)).map((projectPath) => {
            const generated = createId()
            const id = RecentProjectIdSchema.safeParse(generated)
            if (!id.success) throw new InvalidGeneratedRecentProjectIdError(generated)
            return {id: id.data, path: projectPath}
        })
    }
    const current = StoredRecentProjectsV2Schema.safeParse(value)
    if (!current.success) return []
    const ids = new Set(current.data.projects.map(({id}) => id))
    const paths = new Set(current.data.projects.map((entry) => entry.path))
    if (ids.size !== current.data.projects.length || paths.size !== current.data.projects.length) return []
    return current.data.projects
}

async function readState(storagePath: string, createId: () => string): Promise<RecentState> {
    let source: string
    try {
        source = await readFile(storagePath, 'utf8')
    } catch (error) {
        if (!(error instanceof Error)) throw error
        return []
    }
    try {
        return parseStoredState(JSON.parse(source), createId)
    } catch (error) {
        if (error instanceof SyntaxError) return []
        throw error
    }
}

async function inspectLegacyJson(projectPath: string): Promise<RecentProjectInspection> {
    if (extname(projectPath).toLowerCase() !== '.json') return {}
    const decoded: unknown = JSON.parse(await readFile(projectPath, 'utf8'))
    if (typeof decoded !== 'object' || decoded === null) return {}
    const settings = Reflect.get(decoded, 'projectSettings')
    if (typeof settings !== 'object' || settings === null) return {}
    const name = Reflect.get(settings, 'name')
    const framework = Reflect.get(settings, 'framework')
    return {
        ...(typeof name === 'string' && name !== '' ? {name} : {}),
        ...(typeof framework === 'string' && framework !== '' ? {framework} : {})
    }
}

function fallbackName(projectPath: string): string {
    return basename(projectPath, extname(projectPath)) || 'Untitled'
}

class FileRecentProjectsStore implements RecentProjectsStore {
    private state: RecentState | undefined
    private loading: Promise<RecentState> | undefined
    private tail: Promise<void> = Promise.resolve()

    constructor(private readonly options: RecentProjectsStoreOptions) {}

    private async currentState(): Promise<RecentState> {
        if (this.state === undefined) {
            this.loading = this.loading
                ?? readState(this.options.storagePath, this.options.createId ?? randomUUID)
            this.state = await this.loading
        }
        return this.state
    }

    private enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
        const result = this.tail.then(operation)
        this.tail = result.then(() => undefined, () => undefined)
        return result
    }

    private async metadata(entry: StoredRecentProject): Promise<RecentProjectMetadata> {
        let inspection: RecentProjectInspection = {}
        try {
            inspection = await (this.options.inspect ?? inspectLegacyJson)(entry.path)
        } catch (error) {
            if (!(error instanceof Error)) throw error
        }
        return {
            id: entry.id,
            name: inspection.name ?? fallbackName(entry.path),
            framework: inspection.framework,
            displayPath: entry.path
        }
    }

    async list(): Promise<readonly RecentProjectMetadata[]> {
        await this.tail
        return Promise.all((await this.currentState()).map((entry) => this.metadata(entry)))
    }

    async add(projectPath: string): Promise<void> {
        return this.enqueue(async () => {
            const current = await this.currentState()
            const existing = current.find((entry) => entry.path === projectPath)
            const generated = existing?.id ?? (this.options.createId ?? randomUUID)()
            const parsedId = RecentProjectIdSchema.safeParse(generated)
            if (!parsedId.success) throw new InvalidGeneratedRecentProjectIdError(generated)
            const id = parsedId.data
            const maximum = this.options.maximumProjects ?? defaultMaximumProjects
            const next = [{id, path: projectPath}, ...current.filter((entry) => entry.path !== projectPath)].slice(0, maximum)
            await this.persist(next)
            this.state = next
        })
    }

    async remove(value: unknown): Promise<readonly RecentProjectMetadata[]> {
        const id = parseId(value)
        await this.enqueue(async () => {
            const current = await this.currentState()
            if (!current.some((entry) => entry.id === id)) throw new UnknownRecentProjectError(id)
            const next = current.filter((entry) => entry.id !== id)
            await this.persist(next)
            this.state = next
        })
        return this.list()
    }

    async resolvePath(value: unknown): Promise<string> {
        const id = parseId(value)
        await this.tail
        const entry = (await this.currentState()).find((candidate) => candidate.id === id)
        if (entry === undefined) throw new UnknownRecentProjectError(id)
        return entry.path
    }

    private async persist(projects: RecentState): Promise<void> {
        const content = JSON.stringify({version: recentVersion, projects})
        const persist = this.options.persist ?? ((storagePath: string, value: string) =>
            atomicWriteFile(storagePath, value, {maxBytes: maximumPersistenceBytes}))
        await persist(this.options.storagePath, content)
    }
}

export function createRecentProjectsStore(options: RecentProjectsStoreOptions): RecentProjectsStore {
    return new FileRecentProjectsStore(options)
}
