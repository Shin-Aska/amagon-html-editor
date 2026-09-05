// @vitest-environment node

import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRuntimeAssetUrl } from "../../shared/projects/assetReference";
import { APP_MEDIA_PRIVILEGES, createProjectMediaHandler } from "./projectMediaProtocol";
import { createLifecycleController, focusSecondInstance } from "./projectLifecycle";
import { ProjectSession, ProjectSessionRegistry } from "./projectSession";
import { cleanupStaleOwnedWorkspaces, createOwnedWorkspace } from "./projectWorkspace";
import { initializeProjectStartup } from "./projectStartup";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const workspaceFixture = async () => {
  const userDataPath = await mkdtemp(path.join(os.tmpdir(), "amagon-lifecycle-"));
  temporaryRoots.push(userDataPath);
  const workspace = await createOwnedWorkspace(userDataPath);
  await mkdir(path.join(workspace.path, "assets"));
  await writeFile(path.join(workspace.path, "assets", "video.bin"), Buffer.from("0123456789"));
  const sessions = new ProjectSessionRegistry();
  const session = ProjectSession.createAmg({ sourcePath: path.join(userDataPath, "sample.amg"), workspacePath: workspace.path });
  sessions.activate(session);
  if (session.id === null) throw new TypeError("fixture session has no id");
  return { userDataPath, workspace, sessions, sessionId: session.id };
};

describe("project lifecycle", () => {
  it("runs privileged registration once before acquiring the startup lock", () => {
    const calls: string[] = [];
    const locked = initializeProjectStartup({
      registerScheme: (scheme, privileges) => calls.push(`register:${scheme}:${JSON.stringify(privileges)}`),
      requestSingleInstanceLock: () => { calls.push("lock"); return true; },
      quit: () => calls.push("quit"),
    });
    expect(locked).toBe(true);
    expect(calls).toEqual([
      `register:app-media:${JSON.stringify(APP_MEDIA_PRIVILEGES)}`,
      "lock",
    ]);

    const secondCalls: string[] = [];
    expect(initializeProjectStartup({
      registerScheme: () => secondCalls.push("register"),
      requestSingleInstanceLock: () => { secondCalls.push("lock"); return false; },
      quit: () => secondCalls.push("quit"),
    })).toBe(false);
    expect(secondCalls).toEqual(["register", "lock", "quit"]);
  });

  it("registers the media scheme with the required streaming privileges", () => {
    expect(APP_MEDIA_PRIVILEGES).toEqual({ standard: true, secure: true, supportFetchAPI: true, stream: true });
  });

  it("allows exactly one close re-entry only after the renderer accepts", () => {
    const sent: string[] = [];
    let closes = 0;
    const lifecycle = createLifecycleController({
      createRequestId: () => "request-1",
      send: (request) => sent.push(request.reason),
      closeWindow: () => { closes += 1; },
      quit: () => undefined,
    });
    lifecycle.request("window-close");
    lifecycle.request("window-close");
    expect(sent).toEqual(["window-close"]);
    expect(lifecycle.finish({ requestId: "request-1", reason: "window-close", proceed: false })).toBe(true);
    expect(lifecycle.canCloseWindow()).toBe(false);
    lifecycle.request("window-close");
    expect(lifecycle.finish({ requestId: "request-1", reason: "window-close", proceed: true })).toBe(true);
    expect(closes).toBe(1);
    expect(lifecycle.canCloseWindow()).toBe(true);
  });

  it("allows exactly one quit re-entry and ignores stale or rejected results", () => {
    const sent: string[] = [];
    let quits = 0;
    let nextId = 0;
    const lifecycle = createLifecycleController({
      createRequestId: () => `request-${++nextId}`,
      send: (request) => sent.push(`${request.reason}:${request.requestId}`),
      closeWindow: () => undefined,
      quit: () => { quits += 1; },
    });

    lifecycle.request("quit");
    expect(lifecycle.finish({ requestId: "stale", reason: "quit", proceed: true })).toBe(false);
    expect(lifecycle.canQuit()).toBe(false);
    expect(quits).toBe(0);
    expect(lifecycle.finish({ requestId: "request-1", reason: "quit", proceed: false })).toBe(true);
    expect(lifecycle.canQuit()).toBe(false);

    lifecycle.request("quit");
    expect(lifecycle.finish({ requestId: "request-2", reason: "quit", proceed: true })).toBe(true);
    expect(sent).toEqual(["quit:request-1", "quit:request-2"]);
    expect(lifecycle.canQuit()).toBe(true);
    expect(lifecycle.canCloseWindow()).toBe(true);
    expect(quits).toBe(1);
  });

  it("abandons an unanswered lifecycle request without authorizing termination", () => {
    vi.useFakeTimers();
    try {
      const sent: string[] = [];
      const lifecycle = createLifecycleController({
        createRequestId: () => `request-${sent.length + 1}`,
        send: (request) => sent.push(request.requestId),
        closeWindow: () => { throw new Error("must not close"); },
        quit: () => { throw new Error("must not quit"); },
        timeoutMs: 1_000,
      });
      lifecycle.request("window-close");
      vi.advanceTimersByTime(1_000);
      expect(lifecycle.canCloseWindow()).toBe(false);
      expect(lifecycle.canQuit()).toBe(false);
      lifecycle.request("window-close");
      expect(sent).toEqual(["request-1", "request-2"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("focuses the existing window for a second instance without routing files", () => {
    const calls: string[] = [];
    focusSecondInstance({
      isMinimized: () => true,
      restore: () => calls.push("restore"),
      focus: () => calls.push("focus"),
    });
    expect(calls).toEqual(["restore", "focus"]);
  });

  it("serves HEAD and bounded byte ranges while rejecting stale session URLs", async () => {
    const fixture = await workspaceFixture();
    const handler = createProjectMediaHandler({ sessions: fixture.sessions, mimeType: () => "application/octet-stream", chunkBytes: 2 });
    const url = buildRuntimeAssetUrl(fixture.sessionId, "assets/video.bin");

    const head = await handler(new Request(url, { method: "HEAD" }));
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("10");
    expect(head.headers.get("accept-ranges")).toBe("bytes");

    const range = await handler(new Request(url, { headers: { Range: "bytes=3-6" } }));
    expect(range.status).toBe(206);
    expect(range.headers.get("content-range")).toBe("bytes 3-6/10");
    expect(await range.text()).toBe("3456");
    expect(fixture.sessions.active.activeReadLeaseCount).toBe(0);

    expect(await (await handler(new Request(url, { headers: { Range: "bytes=-3" } }))).text()).toBe("789");
    expect(await (await handler(new Request(url, { headers: { Range: "bytes=7-" } }))).text()).toBe("789");
    const unsatisfiable = await handler(new Request(url, { headers: { Range: "bytes=20-30" } }));
    expect(unsatisfiable.status).toBe(416);
    expect(unsatisfiable.headers.get("content-range")).toBe("bytes */10");

    const full = await handler(new Request(url));
    expect(full.status).toBe(200);
    expect(full.headers.get("content-length")).toBe("10");
    expect(await full.text()).toBe("0123456789");
    expect(fixture.sessions.active.activeReadLeaseCount).toBe(0);

    const streaming = await handler(new Request(url));
    expect(fixture.sessions.active.activeReadLeaseCount).toBe(1);
    const closingSession = fixture.sessions.active;
    fixture.sessions.activate(ProjectSession.createAmg({ sourcePath: "next.amg", workspacePath: fixture.workspace.path }));
    let drained = false;
    const leaseDrain = closingSession.waitForReadLeases().then(() => { drained = true; });
    await Promise.resolve();
    expect(drained).toBe(false);
    await streaming.body?.cancel();
    await leaseDrain;
    expect(drained).toBe(true);
    expect(closingSession.activeReadLeaseCount).toBe(0);

    expect((await handler(new Request(url))).status).toBe(403);
  });

  it("rejects encoded traversal, Windows separators, and linked asset paths", async () => {
    const fixture = await workspaceFixture();
    const handler = createProjectMediaHandler({ sessions: fixture.sessions, mimeType: () => "application/octet-stream" });
    const prefix = `app-media://project-asset/${fixture.sessionId}/assets/`;
    expect((await handler(new Request(`${prefix}%2e%2e/video.bin`))).status).toBe(403);
    expect((await handler(new Request(`${prefix}folder%5cvideo.bin`))).status).toBe(403);

    const outside = path.join(fixture.userDataPath, "outside");
    await mkdir(outside);
    await writeFile(path.join(outside, "secret.bin"), "secret");
    await symlink(outside, path.join(fixture.workspace.path, "assets", "linked"), "junction");
    const linked = buildRuntimeAssetUrl(fixture.sessionId, "assets/linked/secret.bin");
    expect((await handler(new Request(linked))).status).toBe(403);
  });

  it("handles zero-length files and unsatisfiable zero-length ranges", async () => {
    const fixture = await workspaceFixture();
    await writeFile(path.join(fixture.workspace.path, "assets", "empty.bin"), "");
    const handler = createProjectMediaHandler({ sessions: fixture.sessions, mimeType: () => "application/octet-stream" });
    const url = buildRuntimeAssetUrl(fixture.sessionId, "assets/empty.bin");
    const full = await handler(new Request(url));
    expect(full.status).toBe(200);
    expect(full.headers.get("content-length")).toBe("0");
    expect((await handler(new Request(url, { headers: { Range: "bytes=0-" } }))).status).toBe(416);
  });

  it("removes only sentinel-verified owned workspaces on startup", async () => {
    const fixture = await workspaceFixture();
    const unowned = path.join(fixture.userDataPath, "amg-workspaces", "session-unowned");
    await mkdir(unowned);
    await writeFile(path.join(unowned, "keep.txt"), "keep");

    const results = await cleanupStaleOwnedWorkspaces(fixture.userDataPath);
    expect(results.map((result) => result.kind)).toContain("removed");
    expect(await readFile(path.join(unowned, "keep.txt"), "utf8")).toBe("keep");
  });
});
