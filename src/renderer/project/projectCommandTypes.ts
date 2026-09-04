import type {
  AssetInfo,
  AssetMutationBridge,
  DirtyTransitionChoice,
  FontMutationBridge,
  MediaMutationBridge,
  MutationResult,
  ProjectBridge,
  ProjectOperation,
  ProjectProgress,
  ProjectSession,
  RecentProjectId,
} from "../../shared/projects/projectIpcContract";
import type { FontAsset, ProjectData } from "../store/types";

export type ProjectCommandMessage = {
  readonly tone: "error" | "info" | "success";
  readonly title: string;
  readonly detail: string;
  readonly locations: readonly string[];
};

export type ProjectCommandState = {
  readonly session: ProjectSession | null;
  readonly busy: ProjectOperation | null;
  readonly progress: ProjectProgress | null;
  readonly dirty: boolean;
  readonly message: ProjectCommandMessage | null;
};

export type ProjectCommandResult<T = undefined> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly canceled: boolean; readonly message: ProjectCommandMessage };

type SnapshotSource = {
  readonly project: ProjectData;
  readonly currentPageId: string | null;
  readonly blocks: ProjectData["pages"][number]["blocks"];
  readonly customCss: string;
};

export type AssetCommands = AssetMutationBridge & {
  readonly listPaths: () => Promise<readonly string[]>;
};

export type ProjectCommandDependencies = {
  readonly project: ProjectBridge;
  readonly assets: AssetCommands;
  readonly fonts: FontMutationBridge<FontAsset>;
  readonly mediaSearch: MediaMutationBridge;
  readonly readProject: () => SnapshotSource;
  readonly installProject: (project: ProjectData, displayPath: string) => void;
  readonly closeProject: () => void;
  readonly markSaved: () => void;
  readonly markDirty: () => void;
  readonly subscribeRendererEdits: (listener: () => void) => () => void;
  readonly notify: (message: ProjectCommandMessage) => void;
  readonly chooseDirtyTransition?: () => DirtyTransitionChoice;
};

export interface ProjectCommands {
  readonly state: ProjectCommandState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly openProject: () => Promise<ProjectCommandResult>;
  readonly openRecent: (recentId: RecentProjectId) => Promise<ProjectCommandResult>;
  readonly newProject: (request: { readonly name: string; readonly framework: string }) => Promise<ProjectCommandResult>;
  readonly save: () => Promise<ProjectCommandResult>;
  readonly saveAs: () => Promise<ProjectCommandResult>;
  readonly autosave: () => Promise<ProjectCommandResult>;
  readonly close: (choice?: DirtyTransitionChoice) => Promise<ProjectCommandResult>;
  readonly getRecent: ProjectBridge["getRecent"];
  readonly removeRecent: ProjectBridge["removeRecent"];
  readonly selectImages: () => Promise<ProjectCommandResult<readonly AssetInfo[]>>;
  readonly selectSingleImage: () => Promise<ProjectCommandResult<AssetInfo>>;
  readonly selectVideos: () => Promise<ProjectCommandResult<readonly AssetInfo[]>>;
  readonly deleteAsset: (relativePath: string) => Promise<ProjectCommandResult<null>>;
  readonly importAsset: (srcPath: string) => Promise<ProjectCommandResult<AssetInfo>>;
  readonly importFonts: () => Promise<ProjectCommandResult<readonly FontAsset[]>>;
  readonly copySystemFont: (familyName: string, filePaths: readonly string[]) => Promise<ProjectCommandResult<readonly FontAsset[]>>;
  readonly downloadGoogleFont: (family: string, variants: readonly { readonly weight: string; readonly style: string }[]) => Promise<ProjectCommandResult<readonly FontAsset[]>>;
  readonly deleteFont: (relativePath: string) => Promise<ProjectCommandResult<null>>;
  readonly downloadMedia: (url: string) => Promise<ProjectCommandResult<AssetInfo>>;
  readonly dispose: () => void;
}

export type MutationPerformer<T> = (
  sessionId: ProjectSession["sessionId"],
) => Promise<MutationResult<T>>;
