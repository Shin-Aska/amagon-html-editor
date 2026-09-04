// @vitest-environment node

import { mkdir, mkdtemp, readdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseProjectSessionId } from "../../shared/projects/projectIpcContract";
import { copyFilesAtomically, inventoryWithHashes, runFileCopyMutation, runProjectMutation } from "./projectMutation";
import { runMutationBoundary } from "./projectMutationBoundary";
import { ProjectSession, ProjectSessionRegistry } from "./projectSession";

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

const fixture = async () => {
  const workspacePath = await mkdtemp(path.join(os.tmpdir(), "amagon-concurrency-"));
  roots.push(workspacePath);
  await mkdir(path.join(workspacePath, "assets"));
  const sessions = new ProjectSessionRegistry();
  const session = ProjectSession.createAmg({ sourcePath: "project.amg", workspacePath });
  sessions.activate(session);
  if (session.id === null) throw new TypeError("fixture session has no id");
  const expectedSessionId = parseProjectSessionId(session.id);
  const listInventory = async () => (await import("node:fs/promises")).readdir(path.join(workspacePath, "assets"));
  return { workspacePath, sessions, session, expectedSessionId, listInventory };
};

describe("project session concurrency", () => {
  it("serializes a mutation behind an in-flight save in FIFO order", async () => {
    const test = await fixture();
    const order: string[] = [];
    let releaseSave: () => void = () => undefined;
    const held = new Promise<void>((resolve) => { releaseSave = resolve; });
    const save = test.sessions.runMutation(test.expectedSessionId, async () => {
      order.push("save-start");
      await held;
      order.push("save-end");
    });
    const mutation = runProjectMutation({
      sessions: test.sessions,
      expectedSessionId: test.expectedSessionId,
      listInventory: test.listInventory,
    }, async () => {
      order.push("asset");
      await writeFile(path.join(test.workspacePath, "assets", "one.txt"), "one");
      return "done";
    });
    await Promise.resolve();
    expect(order).toEqual(["save-start"]);
    releaseSave();
    await save;
    const result = await mutation;
    expect(order).toEqual(["save-start", "save-end", "asset"]);
    expect(result).toMatchObject({ success: true, changed: true, workspaceGeneration: 1 });
  });

  it("echoes the generation on rollback and increments it when a side effect remains", async () => {
    const test = await fixture();
    const unchanged = await runProjectMutation({
      sessions: test.sessions,
      expectedSessionId: test.expectedSessionId,
      listInventory: test.listInventory,
    }, async () => { throw new Error("before promotion"); });
    expect(unchanged).toMatchObject({ success: false, changed: false, workspaceGeneration: 0 });

    const changed = await runProjectMutation({
      sessions: test.sessions,
      expectedSessionId: test.expectedSessionId,
      listInventory: test.listInventory,
    }, async () => {
      await writeFile(path.join(test.workspacePath, "assets", "retained.txt"), "retained");
      throw new Error("rollback failed");
    });
    expect(changed).toMatchObject({ success: false, changed: true, workspaceGeneration: 1 });
  });

  it("detects a same-size overwrite and rolls back a staged multi-file import failure", async () => {
    const test = await fixture();
    const target = path.join(test.workspacePath, "assets", "same.txt");
    await writeFile(target, "aaaa");
    const before = await inventoryWithHashes(test.workspacePath, ["assets/same.txt"]);
    await writeFile(target, "bbbb");
    const after = await inventoryWithHashes(test.workspacePath, ["assets/same.txt"]);
    expect(after).not.toEqual(before);

    const source = path.join(test.workspacePath, "source.txt");
    await writeFile(source, "source");
    await expect(copyFilesAtomically(test.workspacePath, "assets", [source, path.join(test.workspacePath, "missing.txt")])).rejects.toThrow();
    expect(await test.listInventory()).toEqual(["same.txt"]);
  });

  it("returns a typed unchanged failure for a stale queued mutation", async () => {
    const test = await fixture();
    const next = ProjectSession.createAmg({ sourcePath: "next.amg", workspacePath: test.workspacePath });
    test.sessions.activate(next);

    const result = await runProjectMutation({
      sessions: test.sessions,
      expectedSessionId: test.expectedSessionId,
      listInventory: test.listInventory,
    }, async () => "unreachable");

    expect(result).toMatchObject({
      success: false,
      sessionId: test.expectedSessionId,
      workspaceGeneration: 0,
      changed: false,
      error: { code: "STALE_SESSION", expectedSessionId: test.expectedSessionId },
    });
  });

  it("propagates complete and incomplete second-promotion rollback through the mutation boundary", async () => {
    const test = await fixture();
    const firstSource = path.join(test.workspacePath, "asset-a.txt");
    const secondSource = path.join(test.workspacePath, "asset-b.txt");
    await writeFile(firstSource, "asset-a");
    await writeFile(secondSource, "asset-b");

    let promotions = 0;
    const rolledBack = await runMutationBoundary(test.sessions, { expectedSessionId: test.expectedSessionId }, async (expectedSessionId) => (
      runFileCopyMutation({ ...test, expectedSessionId }, test.workspacePath, "assets", [firstSource, secondSource], (files) => files, {
          promote: async (source, destination) => {
            promotions += 1;
            if (promotions === 2) throw new Error("injected second promotion failure");
            await rename(source, destination);
          },
          remove: rm,
      })
    ));
    expect(rolledBack).toMatchObject({ success: false, changed: false, workspaceGeneration: 0 });
    expect(await test.listInventory()).toEqual([]);

    promotions = 0;
    const fontInventory = async () => readdir(path.join(test.workspacePath, "assets", "fonts")).catch(() => [] as string[]);
    const retained = await runMutationBoundary(test.sessions, { expectedSessionId: test.expectedSessionId }, async (expectedSessionId) => (
      runFileCopyMutation(
        { sessions: test.sessions, expectedSessionId, listInventory: fontInventory },
        test.workspacePath,
        "assets/fonts",
        [firstSource, secondSource],
        (files) => files,
        {
          promote: async (source, destination) => {
            promotions += 1;
            if (promotions === 2) throw new Error("injected font promotion failure");
            await rename(source, destination);
          },
          remove: async (target, options) => {
            if (typeof target === "string" && target.endsWith(path.join("assets", "fonts", "asset-a.txt"))) {
              throw new Error("injected rollback failure");
            }
            await rm(target, options);
          },
        },
      )
    ));
    expect(retained).toMatchObject({
      success: false,
      changed: true,
      workspaceGeneration: 1,
      error: { code: "PARTIAL_MUTATION" },
    });
    expect(await fontInventory()).toEqual(["asset-a.txt"]);
  });

  it("returns typed unchanged failures for malformed mutation requests and paths", async () => {
    const test = await fixture();
    const malformedRequest = await runMutationBoundary(test.sessions, {}, async () => {
      throw new Error("unreachable");
    });
    expect(malformedRequest).toMatchObject({ success: false, changed: false, workspaceGeneration: 0, error: { code: "INTERNAL" } });

    const malformedPath = await runMutationBoundary(test.sessions, { expectedSessionId: test.expectedSessionId }, async () => {
      throw new TypeError("relativePath is invalid");
    });
    expect(malformedPath).toMatchObject({
      success: false,
      sessionId: test.expectedSessionId,
      changed: false,
      workspaceGeneration: 0,
      error: { code: "INTERNAL", message: "relativePath is invalid" },
    });
  });
});
