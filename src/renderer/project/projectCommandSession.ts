import { z } from "zod";
import { LegacyProjectDocumentSchema, ProjectDocumentV1Schema } from "../../shared/projects/projectDocumentSchema";
import type { ProjectSession } from "../../shared/projects/projectIpcContract";
import type { ProjectData } from "../store/types";
import { materializeProjectSnapshot } from "./projectSnapshot";
import {
  createProjectSaveCoordinator,
  type CoordinatorSaveResponse,
  type ProjectSaveCoordinator,
} from "./projectSaveCoordinator";
import { operationErrorMessage } from "./projectCommandMessages";
import type {
  ProjectCommandDependencies,
  ProjectCommandMessage,
  ProjectCommandResult,
  ProjectCommandState,
} from "./projectCommandTypes";

const RendererProjectSchema = z.custom<ProjectData>(
  (value) => LegacyProjectDocumentSchema.safeParse(value).success,
  { message: "Project data is not compatible with the renderer" },
);

export type ProjectCommandSessionRuntime = {
  coordinator: ProjectSaveCoordinator | null;
  installing: boolean;
  latestSaveSession: ProjectSession | null;
  availableAssetPaths: readonly string[];
};

type ProjectSessionInstallationHooks = {
  readonly createSnapshot: Parameters<typeof createProjectSaveCoordinator>[0]["createSnapshot"];
  readonly fail: (message: ProjectCommandMessage) => ProjectCommandResult<never>;
  readonly unexpected: (error: unknown) => ProjectCommandResult<never>;
  readonly publish: (patch: Partial<ProjectCommandState>) => void;
};

export class ProjectCommandSessionInstaller {
  constructor(
    private readonly runtime: ProjectCommandSessionRuntime,
    private readonly dependencies: ProjectCommandDependencies,
    private readonly hooks: ProjectSessionInstallationHooks,
  ) {}

  async install(session: ProjectSession): Promise<ProjectCommandResult> {
    try {
      this.runtime.availableAssetPaths = await this.dependencies.assets.listPaths();
      const materialized = materializeProjectSnapshot({
        project: RendererProjectSchema.parse(session.data),
        sessionId: session.sessionId,
        sessionKind: session.kind,
        availableAssetPaths: this.runtime.availableAssetPaths,
      });
      if (!materialized.ok) return this.hooks.fail({
        tone: "error",
        title: "Project contains invalid asset references",
        detail: "Fix the listed locations before continuing.",
        locations: materialized.offenders.map((item) => item.location),
      });
      this.runtime.installing = true;
      this.dependencies.installProject(materialized.project, session.displayPath);
      this.dependencies.markSaved();
      this.runtime.installing = false;
      this.runtime.coordinator = createProjectSaveCoordinator({
        sessionId: session.sessionId,
        rendererGeneration: session.committedRendererGeneration,
        committedRendererGeneration: session.committedRendererGeneration,
        workspaceGeneration: session.committedWorkspaceGeneration,
        committedWorkspaceGeneration: session.committedWorkspaceGeneration,
        createSnapshot: this.hooks.createSnapshot,
        executeSave: async (invocation): Promise<CoordinatorSaveResponse> => {
          const snapshot = session.kind === "legacy-json" && invocation.kind !== "save-as"
            ? LegacyProjectDocumentSchema.parse(invocation.snapshot)
            : ProjectDocumentV1Schema.parse(invocation.snapshot);
          const result = invocation.kind === "save-as"
            ? await this.dependencies.project.saveAs({
                expectedSessionId: invocation.expectedSessionId,
                rendererGeneration: invocation.rendererGeneration,
                workspaceGeneration: invocation.workspaceGeneration,
                snapshot,
              })
            : await this.dependencies.project.save({
                expectedSessionId: invocation.expectedSessionId,
                rendererGeneration: invocation.rendererGeneration,
                workspaceGeneration: invocation.workspaceGeneration,
                snapshot,
              });
          if (!result.success) {
            if (result.canceled) return { success: false, error: { code: "CANCELED" } };
            const detail = operationErrorMessage(result.error).detail;
            return { success: false, error: { code: result.error.code, message: detail } };
          }
          this.runtime.latestSaveSession = result.session;
          return {
            success: true,
            sessionId: invocation.kind === "save-as" ? invocation.expectedSessionId : result.session.sessionId,
            rendererGeneration: result.session.committedRendererGeneration,
            workspaceGeneration: result.session.committedWorkspaceGeneration,
          };
        },
      });
      this.runtime.latestSaveSession = null;
      this.hooks.publish({ session, dirty: false, message: null });
      return { ok: true, value: undefined };
    } catch (error) {
      this.runtime.installing = false;
      return this.hooks.unexpected(error);
    }
  }
}
