import { PROJECT_SCHEMA_VERSION } from "../../shared/projects/amgContract";
import type { ProjectSessionId } from "../../shared/projects/projectIpcContract";
import {
  transformProjectPortability,
  type ProjectPortabilityOffender,
  type ProjectPortabilityMode,
} from "../../shared/projects/projectPortability";
import type { Block, ProjectData } from "../store/types";

export type RendererProjectSessionKind = "amg" | "legacy-json";
export type ProjectSnapshotOperation = "save" | "save-as";

export type PersistedProjectSnapshot = ProjectData & {
  readonly projectSchemaVersion?: typeof PROJECT_SCHEMA_VERSION;
};

type ProjectSnapshotContext = {
  readonly project: ProjectData;
  readonly sessionId: ProjectSessionId;
  readonly sessionKind: RendererProjectSessionKind;
  readonly availableAssetPaths: readonly string[];
  readonly approvedExternalReferences?: readonly string[];
};

export type BuildProjectSnapshotInput = ProjectSnapshotContext & {
  readonly currentPageId: string | null;
  readonly flushedBlocks: readonly Block[];
  readonly customCss: string;
  readonly operation: ProjectSnapshotOperation;
};

export type MaterializeProjectSnapshotInput = Omit<ProjectSnapshotContext, "project"> & {
  readonly project: PersistedProjectSnapshot;
};

export type ProjectSnapshotResult =
  | {
      readonly ok: true;
      readonly project: PersistedProjectSnapshot;
      readonly referencedAssetPaths: readonly string[];
    }
  | {
      readonly ok: false;
      readonly offenders: readonly ProjectPortabilityOffender[];
      readonly referencedAssetPaths: readonly string[];
    };

const persistenceMode = (
  sessionKind: RendererProjectSessionKind,
  operation: ProjectSnapshotOperation,
): ProjectPortabilityMode => {
  if (sessionKind === "legacy-json") {
    return operation === "save" ? "legacy-durable" : "conversion-durable";
  }
  return "bundle-durable";
};

const transform = (
  project: ProjectData,
  context: ProjectSnapshotContext,
  mode: ProjectPortabilityMode,
): ProjectSnapshotResult => {
  const result = transformProjectPortability(project, {
    mode,
    sessionId: context.sessionId,
    availableAssetPaths: context.availableAssetPaths,
    approvedExternalReferences: context.approvedExternalReferences,
  });
  if (!result.ok) {
    return {
      ok: false,
      offenders: result.offenders,
      referencedAssetPaths: result.referencedAssetPaths,
    };
  }

  const durable = mode === "bundle-durable" || mode === "conversion-durable"
    ? { ...result.project, projectSchemaVersion: PROJECT_SCHEMA_VERSION }
    : result.project;
  return {
    ok: true,
    project: durable,
    referencedAssetPaths: result.referencedAssetPaths,
  };
};

export const buildProjectSnapshot = (
  input: BuildProjectSnapshotInput,
): ProjectSnapshotResult => {
  const pages = input.currentPageId === null
    ? input.project.pages
    : input.project.pages.map((page) => (
        page.id === input.currentPageId
          ? { ...page, blocks: structuredClone([...input.flushedBlocks]) }
          : page
      ));
  const merged: ProjectData = {
    ...input.project,
    customCss: input.customCss,
    pages,
  };
  return transform(merged, input, persistenceMode(input.sessionKind, input.operation));
};

export const materializeProjectSnapshot = (
  input: MaterializeProjectSnapshotInput,
): ProjectSnapshotResult => {
  const { projectSchemaVersion: ignoredVersion, ...project } = input.project;
  void ignoredVersion;
  return transform(
    project,
    input,
    input.sessionKind === "amg" ? "bundle-runtime" : "legacy-runtime",
  );
};
