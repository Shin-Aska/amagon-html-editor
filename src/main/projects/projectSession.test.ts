// @vitest-environment node
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRuntimeAssetUrl,
  encodeDurableAssetReference,
} from "../../shared/projects/assetReference";
import {
  ProjectSession,
  ProjectSessionRegistry,
  SessionStateError,
} from "./projectSession";

describe("project session ownership", () => {
  it("serializes mutations in FIFO order", async () => {
    // Given: an active AMG session and a deterministically held first mutation.
    const session = ProjectSession.createAmg({
      sourcePath: "C:/projects/demo.amg",
      workspacePath: "C:/user/amg-workspaces/session-one",
    });
    let releaseFirst: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const order: string[] = [];

    // When: a second mutation is queued before the first is released.
    const first = session.runMutation(session.id, async () => {
      order.push("first-start");
      await firstGate;
      order.push("first-end");
      return 1;
    });
    const second = session.runMutation(session.id, async () => {
      order.push("second");
      return 2;
    });
    await Promise.resolve();
    releaseFirst();

    // Then: the second task runs only after the first task completes.
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });

  it("defers lease drain until the final read releases", async () => {
    // Given: one active read lease for the matching session.
    const session = ProjectSession.createAmg({
      sourcePath: "C:/projects/demo.amg",
      workspacePath: "C:/user/amg-workspaces/session-one",
    });
    const lease = session.acquireReadLease(session.id);
    let drained = false;
    const drain = session.waitForReadLeases().then(() => {
      drained = true;
    });

    // When: the session begins closing while the lease is held.
    session.beginClosing();
    await Promise.resolve();

    // Then: cleanup remains deferred until release, including repeated release.
    expect(drained).toBe(false);
    lease.release();
    lease.release();
    await drain;
    expect(drained).toBe(true);
    expect(session.activeReadLeaseCount).toBe(0);
  });

  it("rejects an old queued request after a new session activates", async () => {
    // Given: an old session whose first mutation blocks its FIFO queue.
    const registry = new ProjectSessionRegistry();
    const oldSession = ProjectSession.createAmg({
      sourcePath: "C:/projects/old.amg",
      workspacePath: "C:/user/amg-workspaces/session-old",
    });
    registry.activate(oldSession);
    let release: () => void = () => undefined;
    let markStarted: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const blocker = registry.runMutation(oldSession.id, async () => {
      markStarted();
      await gate;
    });
    await started;
    const delayed = registry.runMutation(oldSession.id, () => "unsafe-read");

    // When: activation changes before the delayed request enters its mutation.
    registry.activate(
      ProjectSession.createAmg({
        sourcePath: "C:/projects/new.amg",
        workspacePath: "C:/user/amg-workspaces/session-new",
      }),
    );
    release();
    await blocker;

    // Then: the old request never executes against the new workspace.
    await expect(delayed).rejects.toThrow(SessionStateError);
  });

  it("tracks and commits renderer and workspace generations", () => {
    // Given: an active session with uncommitted document and workspace changes.
    const session = ProjectSession.createLegacyJson({
      sourcePath: "C:/projects/demo.json",
      workspacePath: "C:/projects",
    });
    session.updateRendererGeneration(session.id, 3);
    session.recordWorkspaceMutation(session.id);

    // When: the exact generations are committed.
    session.commitGenerations(session.id, {
      rendererGeneration: 3,
      workspaceGeneration: 1,
    });

    // Then: both dirty dimensions return to their committed baselines.
    expect(session.generations).toEqual({
      renderer: 3,
      committedRenderer: 3,
      workspace: 1,
      committedWorkspace: 1,
    });
    expect(session.isDirty).toBe(false);
  });

  it("rejects stale session and generation commits", () => {
    // Given: an active session at renderer generation two.
    const session = ProjectSession.createAmg({
      sourcePath: "C:/projects/demo.amg",
      workspacePath: "C:/user/amg-workspaces/session-one",
    });
    session.updateRendererGeneration(session.id, 2);

    // When: callers present a different identity or an old generation.
    const staleSession = () => session.recordWorkspaceMutation("stale-session");
    const staleGeneration = () =>
      session.commitGenerations(session.id, {
        rendererGeneration: 1,
        workspaceGeneration: 0,
      });

    // Then: neither stale authority can mutate committed state.
    expect(staleSession).toThrow(SessionStateError);
    expect(staleGeneration).toThrow(SessionStateError);
    expect(session.generations.committedRenderer).toBe(0);
  });

  it("leases a canonical asset only for the matching active session", async () => {
    // Given: one active session with a percent-encoded nested asset.
    const workspacePath = await mkdtemp(
      path.join(tmpdir(), "amg-session-assets-"),
    );
    await mkdir(path.join(workspacePath, "assets", "Horse Show"), {
      recursive: true,
    });
    await writeFile(
      path.join(workspacePath, "assets", "Horse Show", "photo.png"),
      "image",
    );
    const registry = new ProjectSessionRegistry();
    const session = ProjectSession.createAmg({
      sourcePath: path.join(workspacePath, "demo.amg"),
      workspacePath,
    });
    registry.activate(session);
    const runtimeUrl = buildRuntimeAssetUrl(
      session.id ?? "",
      encodeDurableAssetReference("assets/Horse Show/photo.png"),
    );

    // When: the URL is resolved and a later old-session URL is retried.
    const resolved = await registry.resolveRuntimeAsset(runtimeUrl);
    resolved.lease.release();
    registry.activate(
      ProjectSession.createAmg({
        sourcePath: path.join(workspacePath, "new.amg"),
        workspacePath,
      }),
    );
    const stale = registry.resolveRuntimeAsset(runtimeUrl);

    // Then: the first read is contained and the stale request gains no lease.
    expect(resolved.filePath).toBe(
      path.join(workspacePath, "assets", "Horse Show", "photo.png"),
    );
    await expect(stale).rejects.toThrow(SessionStateError);
    expect(session.activeReadLeaseCount).toBe(0);
  });
});
