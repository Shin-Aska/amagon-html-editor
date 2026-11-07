import type {
  DurableProjectData,
  MutationResult,
  SessionRequest,
  WorkspaceGeneration,
} from "./projectIpcContract";

export type AssetCleanupCandidate = {
  readonly key: string;
  readonly kind: "file" | "missing-entry";
  readonly relativePath: string;
  readonly fontIds: readonly string[];
};
export type AssetUsageReview = {
  readonly candidates: readonly AssetCleanupCandidate[];
  readonly explanation: string | null;
};
export type BatchRepairResult = {
  readonly repaired: readonly string[];
  readonly unmatched: readonly string[];
  readonly failed: readonly string[];
};
export type AssetCleanupResult = {
  readonly token: string;
  readonly paths: readonly string[];
  readonly fontIds: readonly string[];
  readonly failed: readonly string[];
};
export type AssetCleanupUndoResult = {
  readonly paths: readonly string[];
  readonly fontIds: readonly string[];
  readonly remaining: number;
};
export interface AssetMaintenanceBridge {
  readonly repairMany: (
    request: SessionRequest & { readonly relativePaths: readonly string[] },
  ) => Promise<MutationResult<BatchRepairResult>>;
  readonly cleanupUnused: (
    request: SessionRequest & {
      readonly snapshot: DurableProjectData;
      readonly workspaceGeneration: WorkspaceGeneration;
      readonly keys: readonly string[];
    },
  ) => Promise<MutationResult<AssetCleanupResult>>;
  readonly undoCleanup: (
    request: SessionRequest & { readonly token: string },
  ) => Promise<MutationResult<AssetCleanupUndoResult>>;
}
