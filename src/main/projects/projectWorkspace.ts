import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

export const WORKSPACE_SENTINEL_NAME = ".amagon-workspace.json";
const WORKSPACE_ROOT_NAME = "amg-workspaces";
const WORKSPACE_MARKER = "amagon-owned-workspace";
const WORKSPACE_VERSION = 1;

export class ProjectWorkspaceError extends Error {
  readonly name = "ProjectWorkspaceError";

  constructor(
    readonly code: "unsafe-root" | "candidate-rollback",
    message: string,
    readonly originalError?: unknown,
  ) {
    super(message);
  }
}

export type OwnedWorkspace = {
  readonly path: string;
  readonly rootPath: string;
  readonly sentinelPath: string;
  readonly ownership: "app";
};

export type WorkspaceCleanupRequest = {
  readonly userDataPath: string;
  readonly workspacePath: string;
  readonly activeReadLeases: number;
  readonly ownership: "app" | "user";
};

export type WorkspaceCleanupResult =
  | { readonly kind: "removed" }
  | { readonly kind: "deferred"; readonly activeReadLeases: number }
  | { readonly kind: "rejected"; readonly reason: string };

type WorkspaceSentinel = {
  readonly marker: string;
  readonly version: number;
  readonly workspaceName: string;
};

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSentinel(value: string): WorkspaceSentinel | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
  if (!isRecord(parsed) || Object.keys(parsed).length !== 3) return null;
  if (
    parsed["marker"] !== WORKSPACE_MARKER ||
    parsed["version"] !== WORKSPACE_VERSION ||
    typeof parsed["workspaceName"] !== "string"
  ) {
    return null;
  }
  return {
    marker: parsed["marker"],
    version: parsed["version"],
    workspaceName: parsed["workspaceName"],
  };
}

export async function createOwnedWorkspace(
  userDataPath: string,
): Promise<OwnedWorkspace> {
  const rootPath = path.resolve(userDataPath, WORKSPACE_ROOT_NAME);
  await mkdir(rootPath, { recursive: true });
  const rootStats = await lstat(rootPath);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw new ProjectWorkspaceError(
      "unsafe-root",
      "workspace root is not a regular directory",
    );
  }
  const workspacePath = await mkdtemp(path.join(rootPath, "session-"));
  const sentinelPath = path.join(workspacePath, WORKSPACE_SENTINEL_NAME);
  const sentinel: WorkspaceSentinel = {
    marker: WORKSPACE_MARKER,
    version: WORKSPACE_VERSION,
    workspaceName: path.basename(workspacePath),
  };
  await writeFile(sentinelPath, JSON.stringify(sentinel), {
    encoding: "utf8",
    flag: "wx",
  });
  return { path: workspacePath, rootPath, sentinelPath, ownership: "app" };
}

export async function createOwnedWorkspaceCandidate(
  userDataPath: string,
  initialize: (workspace: OwnedWorkspace) => Promise<void>,
): Promise<OwnedWorkspace> {
  const workspace = await createOwnedWorkspace(userDataPath);
  try {
    await initialize(workspace);
    return workspace;
  } catch (error) {
    const cleanup = await cleanupOwnedWorkspace({
      userDataPath,
      workspacePath: workspace.path,
      activeReadLeases: 0,
      ownership: "app",
    });
    if (cleanup.kind !== "removed") {
      throw new ProjectWorkspaceError(
        "candidate-rollback",
        "failed to remove rejected workspace candidate",
        error,
      );
    }
    throw error;
  }
}

export async function cleanupOwnedWorkspace(
  request: WorkspaceCleanupRequest,
): Promise<WorkspaceCleanupResult> {
  if (request.ownership !== "app") {
    return { kind: "rejected", reason: "workspace is not app-owned" };
  }
  if (request.activeReadLeases > 0) {
    return { kind: "deferred", activeReadLeases: request.activeReadLeases };
  }
  if (
    !Number.isSafeInteger(request.activeReadLeases) ||
    request.activeReadLeases < 0
  ) {
    return { kind: "rejected", reason: "read lease count is invalid" };
  }

  const rootPath = path.resolve(request.userDataPath, WORKSPACE_ROOT_NAME);
  const workspacePath = path.resolve(request.workspacePath);
  if (
    path.dirname(workspacePath) !== rootPath ||
    !path.basename(workspacePath).startsWith("session-")
  ) {
    return {
      kind: "rejected",
      reason: "workspace is not a direct owned-root child",
    };
  }

  try {
    const [rootStats, workspaceStats] = await Promise.all([
      lstat(rootPath),
      lstat(workspacePath),
    ]);
    if (
      !rootStats.isDirectory() ||
      rootStats.isSymbolicLink() ||
      !workspaceStats.isDirectory() ||
      workspaceStats.isSymbolicLink()
    ) {
      return {
        kind: "rejected",
        reason: "workspace filesystem type is unsafe",
      };
    }
    const [rootRealPath, workspaceRealPath] = await Promise.all([
      realpath(rootPath),
      realpath(workspacePath),
    ]);
    if (
      path.dirname(workspaceRealPath) !== rootRealPath ||
      path.basename(workspaceRealPath) !== path.basename(workspacePath)
    ) {
      return {
        kind: "rejected",
        reason: "workspace resolves through a reparse point",
      };
    }

    const sentinelPath = path.join(workspacePath, WORKSPACE_SENTINEL_NAME);
    const sentinelStats = await lstat(sentinelPath);
    if (!sentinelStats.isFile() || sentinelStats.isSymbolicLink()) {
      return { kind: "rejected", reason: "workspace sentinel type is unsafe" };
    }
    const sentinel = parseSentinel(await readFile(sentinelPath, "utf8"));
    if (sentinel?.workspaceName !== path.basename(workspacePath)) {
      return { kind: "rejected", reason: "workspace sentinel is invalid" };
    }
    await rm(workspacePath, { recursive: true });
    return { kind: "removed" };
  } catch (error) {
    if (error instanceof Error) {
      return { kind: "rejected", reason: "workspace verification failed" };
    }
    throw error;
  }
}
