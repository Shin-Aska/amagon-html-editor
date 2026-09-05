import * as path from "path";
import type { AutosaveController } from "./autosaveController";
import type { GoogleFontsService } from "./googleFontsTransport";
import type { LifecycleController, LifecycleResult } from "./projects/projectLifecycle";
import type { ProjectIpcRegistrar } from "./projects/registerProjectIpc";
import type { ProjectPersistenceService, ProjectServiceOptions } from "./projects/projectServiceTypes";
import type { ProjectServiceFiles } from "./projects/projectServiceFiles";
import type { ProjectSessionRegistry } from "./projects/projectSession";
import type { ProjectTransferRegistry } from "./projects/projectTransferRegistry";
import type { RecentProjectInspection, RecentProjectsStore, RecentProjectsStoreOptions } from "./projects/recentProjects";
import type { ProjectSessionId } from "../shared/projects/projectIpcContract";

interface SaveOptions {
  readonly title: string;
  readonly defaultPath: string;
  readonly filters: { name: string; extensions: string[] }[];
}

interface OpenOptions {
  readonly title: string;
  readonly filters: { name: string; extensions: string[] }[];
  readonly properties: ["openFile"];
}

interface DialogResult {
  readonly canceled: boolean;
  readonly filePath?: string;
  readonly filePaths?: readonly string[];
}

interface ProjectResourceRegistration<TWindow> {
  readonly sessions: ProjectSessionRegistry;
  readonly transfers: ProjectTransferRegistry;
  readonly projectFiles: ProjectServiceFiles;
  readonly getMainWindow: () => TWindow | null;
  readonly resolveSystemFontPath: (familyName: string) => Promise<string | null>;
  readonly fetchGoogleFontsText: GoogleFontsService["fetchText"];
  readonly googleFontsMaxBytes: number;
}

export interface ProjectRuntimeContext<TWindow> {
  readonly userDataPath: string;
  readonly documentsPath: string;
  readonly sessions: ProjectSessionRegistry;
  readonly transfers: ProjectTransferRegistry;
  readonly projectFiles: ProjectServiceFiles;
  readonly autosave: AutosaveController;
  readonly googleFonts: GoogleFontsService;
  readonly getMainWindow: () => TWindow | null;
  readonly getLifecycleController: () => Pick<LifecycleController, "finish"> | null;
  readonly setCurrentProjectDirectory: (directory: string | null) => void;
  readonly showSaveDialog: (window: TWindow | null, options: SaveOptions) => Promise<DialogResult>;
  readonly showOpenDialog: (window: TWindow | null, options: OpenOptions) => Promise<DialogResult>;
  readonly inspectProjectMetadata: (projectPath: string) => Promise<RecentProjectInspection>;
  readonly resolveSystemFontPath: (familyName: string) => Promise<string | null>;
  readonly createRecentProjectsStore: (options: RecentProjectsStoreOptions) => RecentProjectsStore;
  readonly createProjectService: (options: ProjectServiceOptions) => ProjectPersistenceService;
  readonly registerProjectIpc: (registrar: ProjectIpcRegistrar, service: ProjectPersistenceService) => void;
  readonly registerProjectResources: (context: ProjectResourceRegistration<TWindow>) => void;
  readonly handle: <TArgument>(channel: string, handler: (event: unknown, argument: TArgument) => unknown) => void;
  readonly removeHandler: (channel: string) => void;
}

export const registerProjectRuntime = <TWindow>(
  context: ProjectRuntimeContext<TWindow>,
): ProjectPersistenceService => {
  const service = context.createProjectService({
    userDataPath: context.userDataPath,
    documentsPath: context.documentsPath,
    dialogs: {
      showSave: async (request) => context.showSaveDialog(context.getMainWindow(), {
        title: request.title,
        defaultPath: request.defaultPath,
        filters: request.filters.map((filter) => ({ name: filter.name, extensions: [...filter.extensions] })),
      }),
      showOpen: async (request) => {
        const result = await context.showOpenDialog(context.getMainWindow(), {
          title: request.title,
          filters: request.filters.map((filter) => ({ name: filter.name, extensions: [...filter.extensions] })),
          properties: ["openFile"],
        });
        return { canceled: result.canceled, filePaths: result.filePaths ?? [] };
      },
    },
    recents: context.createRecentProjectsStore({
      storagePath: path.join(context.userDataPath, "recent-projects.json"),
      inspect: context.inspectProjectMetadata,
    }),
    sessions: context.sessions,
    files: context.projectFiles,
    abortSessionTransfers: (sessionId: ProjectSessionId) => context.transfers.abortSession(sessionId),
    onDirectoryChange: (directory) => {
      context.setCurrentProjectDirectory(directory);
      if (directory === null) context.autosave.stop();
      else context.autosave.start();
    },
  });

  context.registerProjectIpc({
    handle: (channel, handler) => context.handle(channel, (event, argument) => handler(event, argument)),
    removeHandler: context.removeHandler,
  }, service);
  context.registerProjectResources({
    sessions: context.sessions,
    transfers: context.transfers,
    projectFiles: context.projectFiles,
    getMainWindow: context.getMainWindow,
    resolveSystemFontPath: context.resolveSystemFontPath,
    fetchGoogleFontsText: (url, options) => context.googleFonts.fetchText(url, options),
    googleFontsMaxBytes: context.googleFonts.maxResponseBytes,
  });
  context.handle<LifecycleResult>("project:finish-lifecycle-close", (_event, result) => (
    context.getLifecycleController()?.finish(result) ?? false
  ));
  return service;
};
