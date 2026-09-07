import type { Block, ProjectData, ProjectTheme } from "../../renderer/store/types";
import type { LegacyProjectDocument, ProjectDocumentV1 } from "./projectDocumentSchema";

export type ProjectPortabilityMode = "bundle-durable" | "bundle-runtime" | "bundle-stored" | "conversion-durable" | "legacy-durable" | "legacy-runtime" | "legacy-stored";

export type ProjectPortabilityOffenderCode = "blob" | "credential" | "external-local" | "invalid-reference" | "missing-asset" | "session-identity" | "stale-session" | "system-font" | "unexpected-reference-form";

export type ProjectPortabilityOffender = {
  readonly code: ProjectPortabilityOffenderCode;
  readonly location: string;
  readonly reference?: string;
};

export type ProjectPortabilityOptions = {
  readonly mode: ProjectPortabilityMode;
  readonly sessionId: string;
  readonly availableAssetPaths: readonly string[];
  readonly approvedExternalReferences?: readonly string[];
};

export type ProjectPortabilityScan = {
  readonly offenders: readonly ProjectPortabilityOffender[];
  readonly referencedAssetPaths: readonly string[];
};

export type ProjectPortabilityResult<Project extends PortabilityProject = PortabilityProject> =
  | ({
      readonly ok: true;
      readonly project: Project;
    } & ProjectPortabilityScan)
  | ({ readonly ok: false } & ProjectPortabilityScan);

export type PortabilityProject = ProjectData | ProjectDocumentV1 | LegacyProjectDocument;
export type PortabilityBlock = Block | ProjectDocumentV1["pages"][number]["blocks"][number];
export type PortabilityTheme = ProjectTheme | ProjectDocumentV1["projectSettings"]["theme"];

export type ScanState = {
  readonly options: ProjectPortabilityOptions;
  readonly available: ReadonlySet<string>;
  readonly approvedExternal: ReadonlySet<string>;
  readonly offenders: ProjectPortabilityOffender[];
  readonly referencedAssets: Set<string>;
};
