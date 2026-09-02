// @vitest-environment node
import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  cleanupOwnedWorkspace,
  createOwnedWorkspace,
  createOwnedWorkspaceCandidate,
  WORKSPACE_SENTINEL_NAME,
} from "./projectWorkspace";

describe("owned project workspace", () => {
  it("creates a direct child with a versioned sentinel and removes it", async () => {
    // Given: a unique user-data root.
    const userDataPath = await mkdtemp(path.join(tmpdir(), "amg-user-data-"));

    // When: an owned workspace is created and then cleaned with zero leases.
    const workspace = await createOwnedWorkspace(userDataPath);
    const sentinel = JSON.parse(
      await readFile(
        path.join(workspace.path, WORKSPACE_SENTINEL_NAME),
        "utf8",
      ),
    );
    const cleanup = await cleanupOwnedWorkspace({
      userDataPath,
      workspacePath: workspace.path,
      activeReadLeases: 0,
      ownership: "app",
    });

    // Then: ownership is explicit, versioned, and deletion is acknowledged.
    expect(path.dirname(workspace.path)).toBe(workspace.rootPath);
    expect(path.basename(workspace.path)).toMatch(/^session-/);
    expect(sentinel).toEqual({
      marker: "amagon-owned-workspace",
      version: 1,
      workspaceName: path.basename(workspace.path),
    });
    expect(cleanup).toEqual({ kind: "removed" });
  });

  it("defers cleanup while a read lease is active", async () => {
    // Given: an owned workspace with one active lease.
    const userDataPath = await mkdtemp(path.join(tmpdir(), "amg-user-data-"));
    const workspace = await createOwnedWorkspace(userDataPath);

    // When: cleanup is requested before release.
    const cleanup = await cleanupOwnedWorkspace({
      userDataPath,
      workspacePath: workspace.path,
      activeReadLeases: 1,
      ownership: "app",
    });

    // Then: the workspace remains and reports deterministic deferral.
    expect(cleanup).toEqual({ kind: "deferred", activeReadLeases: 1 });
    expect(await readFile(workspace.sentinelPath, "utf8")).toContain(
      "amagon-owned-workspace",
    );
  });

  it.each(["legacy", "outside", "forged", "reparse"])(
    "rejects unsafe cleanup candidate %s",
    async (candidateKind) => {
      // Given: one candidate that is not a verified owned direct child.
      const userDataPath = await mkdtemp(path.join(tmpdir(), "amg-user-data-"));
      const workspace = await createOwnedWorkspace(userDataPath);
      let workspacePath = workspace.path;
      let ownership: "app" | "user" = "app";
      if (candidateKind === "legacy") {
        ownership = "user";
      } else if (candidateKind === "outside") {
        workspacePath = await mkdtemp(path.join(tmpdir(), "amg-outside-"));
      } else if (candidateKind === "forged") {
        await writeFile(workspace.sentinelPath, '{"marker":"forged"}');
      } else {
        const target = await mkdtemp(
          path.join(tmpdir(), "amg-reparse-target-"),
        );
        const rootPath = path.join(userDataPath, "amg-workspaces");
        await mkdir(rootPath, { recursive: true });
        workspacePath = path.join(rootPath, "session-reparse");
        await symlink(target, workspacePath, "junction");
      }

      // When: cleanup evaluates the candidate's ownership and filesystem shape.
      const cleanup = await cleanupOwnedWorkspace({
        userDataPath,
        workspacePath,
        activeReadLeases: 0,
        ownership,
      });

      // Then: deletion fails closed without treating the candidate as removed.
      expect(cleanup.kind).toBe("rejected");
    },
  );

  it("rolls back a workspace candidate when initialization fails", async () => {
    // Given: a unique user-data root and an initialization failure.
    const userDataPath = await mkdtemp(path.join(tmpdir(), "amg-user-data-"));
    let candidatePath = "";

    // When: candidate initialization rejects before activation.
    const create = createOwnedWorkspaceCandidate(
      userDataPath,
      async (workspace) => {
        candidatePath = workspace.path;
        throw new Error("injected initialization failure");
      },
    );

    // Then: the error propagates and the owned candidate is removed.
    await expect(create).rejects.toThrow("injected initialization failure");
    await expect(lstat(candidatePath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
