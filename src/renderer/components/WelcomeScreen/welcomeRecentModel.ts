import {z} from 'zod'
import type {ProjectCommandResult} from '../../project/projectCommands'
import type {ProjectOperationError, RecentProject, RecentProjectId} from '../../../shared/projects/projectIpcContract'
import {LegacyProjectDocumentSchema, parseLegacyProjectDocument} from '../../../shared/projects/projectDocumentSchema'
import type {ProjectData} from '../../store/types'

export type BrowserRecentProject = {
    readonly path: string
    readonly name: string
    readonly framework?: string
}

export type RecentProjectView =
    | { readonly source: 'electron'; readonly project: RecentProject }
    | { readonly source: 'browser'; readonly project: BrowserRecentProject }

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
)

const trimmedString = (value: unknown): string => (
    typeof value === 'string' ? value.trim() : ''
)

const browserRecentName = (path: string): string => (
    path.split(/[/\\]/).pop()?.replace(/\.json$/i, '') || 'Untitled'
)

export function getFrameworkLabel(framework?: string): string {
    if (framework === 'bootstrap-5') return 'B'
    if (framework === 'tailwind') return 'T'
    return '<>'
}

export function getFrameworkTitle(framework?: string): string {
    if (framework === 'bootstrap-5') return 'Bootstrap 5'
    if (framework === 'tailwind') return 'Tailwind CSS'
    return 'Vanilla HTML/CSS'
}

export function normalizeBrowserRecentProjects(projects: unknown): BrowserRecentProject[] {
    if (!Array.isArray(projects)) return []

    return projects.flatMap((project) => {
        if (typeof project === 'string') {
            const path = project.trim()
            return path ? [{path, name: browserRecentName(path)}] : []
        }

        if (!isRecord(project)) return []

        const path = trimmedString(project.path)
        if (!path) return []

        const framework = trimmedString(project.framework) || undefined
        return [{
            path,
            name: trimmedString(project.name) || browserRecentName(path),
            framework,
        }]
    })
}

const BrowserProjectDataSchema = z.custom<ProjectData>(
    (value): value is ProjectData => LegacyProjectDocumentSchema.safeParse(value).success,
    {message: 'Project data is not compatible with the renderer'},
)

export function parseBrowserRecentProject(content: unknown): ProjectData {
    return BrowserProjectDataSchema.parse(parseLegacyProjectDocument(content))
}

export function commandErrorMessage(result: ProjectCommandResult): string | null {
    if (result.ok || result.canceled) return null
    return result.message.detail
}

export function projectOperationErrorMessage(error: ProjectOperationError): string {
    return 'message' in error ? error.message : 'The recent-project list could not be updated.'
}

export type RecentFailure = {
    readonly id: RecentProjectId
    readonly message: string
}
