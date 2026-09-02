import type { LegacyProjectDocument, ProjectDocumentV1 } from './projectDocumentSchema'

declare const projectSessionIdBrand: unique symbol
declare const recentProjectIdBrand: unique symbol
declare const rendererGenerationBrand: unique symbol
declare const workspaceGenerationBrand: unique symbol

export type ProjectSessionId = string & { readonly [projectSessionIdBrand]: 'ProjectSessionId' }
export type RecentProjectId = string & { readonly [recentProjectIdBrand]: 'RecentProjectId' }
export type RendererGeneration = number & { readonly [rendererGenerationBrand]: 'RendererGeneration' }
export type WorkspaceGeneration = number & { readonly [workspaceGenerationBrand]: 'WorkspaceGeneration' }
export type DurableProjectData = ProjectDocumentV1 | LegacyProjectDocument
export type ProjectSessionKind = 'amg' | 'legacy-json'
export type DirtyTransitionChoice = 'save' | 'discard' | 'cancel'

export type ProjectArchiveError = {
    readonly code: 'ARCHIVE_INVALID' | 'ARCHIVE_LIMIT_EXCEEDED' | 'ARCHIVE_INTEGRITY_FAILED'
    readonly message: string
}

export type ProjectPortabilityError = {
    readonly code: 'PROJECT_NOT_PORTABLE'
    readonly message: string
    readonly offenders: readonly string[]
}

export type ProjectOperationError = ProjectArchiveError | ProjectPortabilityError | {
    readonly code: 'STALE_SESSION'
    readonly expectedSessionId: ProjectSessionId
    readonly activeSessionId?: ProjectSessionId
} | {
    readonly code: 'STALE_RENDERER_GENERATION'
    readonly expected: RendererGeneration
    readonly actual: RendererGeneration
} | {
    readonly code: 'BUSY'
    readonly operation: ProjectOperation
} | {
    readonly code: 'RECENT_NOT_FOUND'
    readonly recentId: RecentProjectId
} | {
    readonly code: 'UNSUPPORTED_IN_BROWSER' | 'PATH_AUTHORITY_FORBIDDEN' | 'INTERNAL'
    readonly message: string
}

export type ProjectOperation = 'new' | 'open' | 'open-recent' | 'save' | 'save-as' | 'close'

export type ProjectProgress = {
    readonly operation: ProjectOperation
    readonly phase: 'waiting' | 'reading' | 'validating' | 'writing' | 'committing' | 'cleaning'
    readonly completed: number
    readonly total?: number
    readonly busy: boolean
}

export type ProjectSession = {
    readonly sessionId: ProjectSessionId
    readonly kind: ProjectSessionKind
    readonly displayPath: string
    readonly data: DurableProjectData
    readonly committedRendererGeneration: RendererGeneration
    readonly committedWorkspaceGeneration: WorkspaceGeneration
    readonly dirty: boolean
}

export type ProjectSessionSuccess = {
    readonly success: true
    readonly session: ProjectSession
}

export type ProjectClosedSuccess = {
    readonly success: true
    readonly sessionId: ProjectSessionId
    readonly kind: ProjectSessionKind
    readonly displayPath: string
    readonly data: DurableProjectData
    readonly committedRendererGeneration: RendererGeneration
    readonly committedWorkspaceGeneration: WorkspaceGeneration
}

export type ProjectCanceled = {
    readonly success: false
    readonly canceled: true
}

export type ProjectFailure = {
    readonly success: false
    readonly canceled?: false
    readonly error: ProjectOperationError
}

export type ProjectSessionResult = ProjectSessionSuccess | ProjectCanceled | ProjectFailure
export type ProjectCloseResult = ProjectClosedSuccess | ProjectCanceled | ProjectFailure

export type ProjectSaveRequest = {
    readonly expectedSessionId: ProjectSessionId
    readonly rendererGeneration: RendererGeneration
    readonly snapshot: DurableProjectData
}

export type ProjectCloseRequest = {
    readonly expectedSessionId: ProjectSessionId
    readonly rendererGeneration: RendererGeneration
    readonly snapshot: DurableProjectData
    readonly dirtyChoice?: DirtyTransitionChoice
}

export type ProjectNewRequest = {
    readonly name: string
    readonly framework: string
}

export type RecentProject = {
    readonly id: RecentProjectId
    readonly name: string
    readonly framework: string
    readonly kind: ProjectSessionKind
    readonly displayPath: string
}

export type RecentProjectsResult = {
    readonly success: true
    readonly projects: readonly RecentProject[]
} | ProjectFailure

export type RemoveRecentResult = {
    readonly success: true
    readonly removedId: RecentProjectId
} | ProjectFailure

export interface ProjectBridge {
    readonly save: (request: ProjectSaveRequest) => Promise<ProjectSessionResult>
    readonly saveAs: (request: ProjectSaveRequest) => Promise<ProjectSessionResult>
    readonly load: () => Promise<ProjectSessionResult>
    readonly openRecent: (recentId: RecentProjectId) => Promise<ProjectSessionResult>
    readonly removeRecent: (recentId: RecentProjectId) => Promise<RemoveRecentResult>
    readonly new: (request: ProjectNewRequest) => Promise<ProjectSessionResult>
    readonly close: (request: ProjectCloseRequest) => Promise<ProjectCloseResult>
    readonly getRecent: () => Promise<RecentProjectsResult>
    readonly getDir: () => Promise<{ readonly success: true; readonly directory: string | null } | ProjectFailure>
    readonly onProgress: (callback: (progress: ProjectProgress) => void) => () => void
}

export type SessionRequest = { readonly expectedSessionId: ProjectSessionId }

export type MutationError = ProjectOperationError | {
    readonly code: 'PARTIAL_MUTATION'
    readonly message: string
    readonly completedItems: readonly string[]
    readonly failedItems: readonly string[]
}

export type MutationSuccess<T> = {
    readonly success: true
    readonly sessionId: ProjectSessionId
    readonly workspaceGeneration: WorkspaceGeneration
    readonly changed: boolean
    readonly value: T
}

export type MutationChangedFailure = {
    readonly success: false
    readonly sessionId: ProjectSessionId
    readonly workspaceGeneration: WorkspaceGeneration
    readonly changed: true
    readonly error: MutationError
}

export type MutationUnchangedFailure = {
    readonly success: false
    readonly sessionId: ProjectSessionId
    readonly workspaceGeneration: WorkspaceGeneration
    readonly changed: false
    readonly canceled?: boolean
    readonly error?: Exclude<MutationError, { readonly code: 'PARTIAL_MUTATION' }>
}

export type MutationResult<T> = MutationSuccess<T> | MutationChangedFailure | MutationUnchangedFailure

export type AssetInfo = {
    readonly name: string
    readonly path: string
    readonly relativePath: string
    readonly type?: 'image' | 'video'
}

export interface AssetMutationBridge {
    readonly selectImage: (request: SessionRequest) => Promise<MutationResult<readonly AssetInfo[]>>
    readonly selectSingleImage: (request: SessionRequest) => Promise<MutationResult<AssetInfo>>
    readonly selectVideo: (request: SessionRequest) => Promise<MutationResult<readonly AssetInfo[]>>
    readonly delete: (request: SessionRequest & { readonly relativePath: string }) => Promise<MutationResult<null>>
    readonly import: (request: SessionRequest & { readonly srcPath: string }) => Promise<MutationResult<AssetInfo>>
}

export interface FontMutationBridge<TFont> {
    readonly importFile: (request: SessionRequest) => Promise<MutationResult<readonly TFont[]>>
    readonly downloadGoogleFont: (request: SessionRequest & {
        readonly family: string
        readonly variants: readonly { readonly weight: string; readonly style: string }[]
    }) => Promise<MutationResult<readonly TFont[]>>
    readonly copySystemFont: (request: SessionRequest & {
        readonly familyName: string
        readonly filePaths: readonly string[]
    }) => Promise<MutationResult<readonly TFont[]>>
    readonly deleteFont: (request: SessionRequest & { readonly relativePath: string }) => Promise<MutationResult<null>>
}

export interface MediaMutationBridge {
    readonly downloadAndImport: (request: SessionRequest & { readonly url: string }) => Promise<MutationResult<AssetInfo>>
}
