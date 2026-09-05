import type {
  DurableProjectData,
  ProjectCloseRequest,
  ProjectCloseResult,
  ProjectNewRequest,
  ProjectOpenRecentRequest,
  ProjectSaveRequest,
  ProjectSessionId,
  ProjectSessionResult,
  ProjectTransitionRequest,
  RecentProjectsResult,
  RemoveRecentResult,
} from "../../shared/projects/projectIpcContract";
import type { RecentProjectsStore } from "./recentProjects";
import type { ProjectSession, ProjectSessionRegistry } from "./projectSession";
import type { ProjectServiceFiles } from "./projectServiceFiles";

export type ProjectSaveDialogRequest = {
  readonly title: string;
  readonly defaultPath: string;
  readonly filters: readonly { readonly name: string; readonly extensions: readonly string[] }[];
};

export type ProjectOpenDialogRequest = {
  readonly title: string;
  readonly filters: readonly { readonly name: string; readonly extensions: readonly string[] }[];
};

export interface ProjectDialogPort {
  readonly showSave: (request: ProjectSaveDialogRequest) => Promise<{
    readonly canceled: boolean;
    readonly filePath?: string;
  }>;
  readonly showOpen: (request: ProjectOpenDialogRequest) => Promise<{
    readonly canceled: boolean;
    readonly filePaths: readonly string[];
  }>;
}

export type ActiveProjectState = {
  readonly session: ProjectSession;
  readonly data: DurableProjectData;
  readonly approvedExternalReferences: readonly string[];
};

export type ActiveProjectStateStore = {
  current: ActiveProjectState | null;
};

export type ProjectServiceOptions = {
  readonly userDataPath: string;
  readonly documentsPath: string;
  readonly dialogs: ProjectDialogPort;
  readonly recents: RecentProjectsStore;
  readonly files?: ProjectServiceFiles;
  readonly sessions?: ProjectSessionRegistry;
  readonly onDirectoryChange?: (directory: string | null) => void;
  readonly abortSessionTransfers?: (sessionId: ProjectSessionId) => void;
};

export interface ProjectPersistenceService {
  readonly save: (request: ProjectSaveRequest) => Promise<ProjectSessionResult>;
  readonly saveAs: (request: ProjectSaveRequest) => Promise<ProjectSessionResult>;
  readonly openProject: (request: ProjectTransitionRequest) => Promise<ProjectSessionResult>;
  readonly openRecent: (request: ProjectOpenRecentRequest) => Promise<ProjectSessionResult>;
  readonly removeRecent: (recentId: unknown) => Promise<RemoveRecentResult>;
  readonly newProject: (request: ProjectNewRequest) => Promise<ProjectSessionResult>;
  readonly close: (request: ProjectCloseRequest) => Promise<ProjectCloseResult>;
  readonly getRecent: () => Promise<RecentProjectsResult>;
  readonly getDirectory: () => Promise<{ readonly success: true; readonly directory: string | null }>;
  readonly resolveAssetRead: (reference: string) => Promise<{
    readonly filePath: string;
    readonly release: () => void;
  }>;
}

export type ProjectServiceRuntime = {
  readonly userDataPath: string;
  readonly files: ProjectServiceFiles;
  readonly sessions: ProjectSessionRegistry;
  readonly abortSessionTransfers?: (sessionId: ProjectSessionId) => void;
};
