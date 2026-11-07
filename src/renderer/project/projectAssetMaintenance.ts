import { LegacyProjectDocumentSchema } from "../../shared/projects/projectDocumentSchema";
import { reviewProjectAssetUsage } from "../../shared/projects/projectAssetUsage";
import type {
  ProjectSession,
  RendererGeneration,
  WorkspaceGeneration,
} from "../../shared/projects/projectIpcContract";
import type { FontAsset } from "../store/types";
import { buildProjectSnapshot } from "./projectSnapshot";
import type {
  MutationPerformer,
  ProjectCommandDependencies,
  ProjectCommandResult,
  ProjectCommands,
} from "./projectCommandTypes";

type Context = {
  readonly dependencies: ProjectCommandDependencies;
  readonly getSession: () => ProjectSession | null;
  readonly getGenerations: () =>
    | {
        rendererGeneration: RendererGeneration;
        workspaceGeneration: WorkspaceGeneration;
      }
    | undefined;
  readonly runMutation: <T>(
    perform: MutationPerformer<T>,
  ) => Promise<ProjectCommandResult<T>>;
};
export function createAssetMaintenanceCommands({
  dependencies,
  getSession,
  getGenerations,
  runMutation,
}: Context): Pick<
  ProjectCommands,
  | "inspectUnusedAssets"
  | "repairAssets"
  | "cleanupAssets"
  | "undoAssetCleanup"
  | "hasAssetCleanup"
> {
  let undo: {
    sessionId: ProjectSession["sessionId"];
    token: string;
    fonts: FontAsset[];
  } | null = null;
  const bridge = () => {
    if (!dependencies.maintenance)
      throw new Error("Asset maintenance is available in the desktop app.");
    return dependencies.maintenance;
  };
  const snapshot = async () => {
    const session = getSession();
    if (!session) throw new Error("Open a project first.");
    const paths = await dependencies.assets.listPaths(session.sessionId);
    if (getSession()?.sessionId !== session.sessionId)
      throw new Error("Project changed. Recheck assets.");
    const source = dependencies.readProject();
    // Read-only inspection permits missing references; actual .amg Save remains strict.
    const built = buildProjectSnapshot({
      ...source,
      flushedBlocks: source.blocks,
      sessionId: session.sessionId,
      sessionKind: "legacy-json",
      operation: "save",
      availableAssetPaths: paths,
    });
    if (!built.ok)
      throw new Error(
        "Resolve invalid references before reviewing unused assets.",
      );
    return {
      session,
      project: LegacyProjectDocumentSchema.parse(built.project),
      paths,
    };
  };
  return {
    hasAssetCleanup: () =>
      undo !== null && undo.sessionId === getSession()?.sessionId,
    inspectUnusedAssets: async () => {
      const { project, paths, session } = await snapshot();
      return reviewProjectAssetUsage(project, paths, session.sessionId);
    },
    repairAssets: (paths) =>
      runMutation((expectedSessionId) =>
        bridge().repairMany({ expectedSessionId, relativePaths: paths }),
      ),
    cleanupAssets: async (keys) => {
      const { session, project } = await snapshot();
      const generation = getGenerations();
      if (!generation) throw new Error("No project is active.");
      const originalFonts =
        dependencies.readProject().project.projectSettings.fonts ?? [];
      const result = await runMutation((expectedSessionId) =>
        bridge().cleanupUnused({
          expectedSessionId,
          snapshot: project,
          workspaceGeneration: generation.workspaceGeneration,
          keys,
        }),
      );
      if (!result.ok) return result;
      const removed = new Set(result.value.fontIds);
      if (removed.size || result.value.paths.length)
        undo = {
          sessionId: session.sessionId,
          token: result.value.token,
          fonts: originalFonts.filter((font) => removed.has(font.id)),
        };
      if (
        getSession()?.sessionId !== session.sessionId ||
        getGenerations()?.rendererGeneration !== generation.rendererGeneration
      ) {
        const restored = await runMutation((expectedSessionId) =>
          bridge().undoCleanup({
            expectedSessionId,
            token: result.value.token,
          }),
        );
        if (restored.ok && restored.value.remaining === 0) {
          undo = null;
          throw new Error(
            "Project changed during cleanup. Files were restored; recheck before continuing.",
          );
        }
        throw new Error(
          "Project changed during cleanup. Some files remain in project trash. Use Undo cleanup to restore them before continuing.",
        );
      }
      if (removed.size)
        dependencies.setFonts?.(
          originalFonts.filter((font) => !removed.has(font.id)),
        );
      return result;
    },
    undoAssetCleanup: async () => {
      const record = undo;
      if (!record || getSession()?.sessionId !== record.sessionId)
        throw new Error("There is no cleanup to undo in this project.");
      const result = await runMutation((expectedSessionId) =>
        bridge().undoCleanup({ expectedSessionId, token: record.token }),
      );
      if (result.ok) {
        const current =
          dependencies.readProject().project.projectSettings.fonts ?? [];
        const ids = new Set(current.map((font) => font.id));
        const restoredIds = new Set(result.value.fontIds);
        const restored = record.fonts.filter(
          (font) => restoredIds.has(font.id) && !ids.has(font.id),
        );
        if (restored.length) dependencies.setFonts?.([...current, ...restored]);
        undo = result.value.remaining
          ? {
              ...record,
              fonts: record.fonts.filter((font) => !restoredIds.has(font.id)),
            }
          : null;
      }
      return result;
    },
  };
}
