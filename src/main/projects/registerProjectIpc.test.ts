// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parseRecentProjectId } from "../../shared/projects/projectIpcContract";
import { TEST_PROJECT } from "./amgArchiveFixtures";
import type { ProjectPersistenceService } from "./projectServiceTypes";
import {
  PROJECT_IPC_CHANNELS,
  registerProjectIpc,
  type ProjectIpcHandler,
  type ProjectIpcRegistrar,
} from "./registerProjectIpc";

class FakeRegistrar implements ProjectIpcRegistrar {
  readonly handlers = new Map<string, ProjectIpcHandler>();

  handle(channel: string, handler: ProjectIpcHandler): void {
    this.handlers.set(channel, handler);
  }

  removeHandler(channel: string): void {
    this.handlers.delete(channel);
  }
}

const trustedSurface = () => {
  const mainFrame = {};
  const sender = { id: 7, mainFrame };
  return {
    window: { webContents: sender },
    trustedEvent: { sender, senderFrame: mainFrame },
    childFrameEvent: { sender, senderFrame: {} },
    foreignEvent: { sender: { id: 8, mainFrame: {} }, senderFrame: {} },
  };
};

const registerWithActiveWindow = (
  registrar: ProjectIpcRegistrar,
  projectService: ProjectPersistenceService,
  getMainWindow: () => ReturnType<typeof trustedSurface>["window"] | null,
): void => {
  registerProjectIpc(registrar, projectService, getMainWindow);
};

const service = {
  save: async () => ({ success: false, canceled: true } as const),
  saveAs: async () => ({ success: false, canceled: true } as const),
  openProject: async () => ({ success: false, canceled: true } as const),
  openRecent: async () => ({ success: false, canceled: true } as const),
  removeRecent: async () => ({ success: true, removedId: parseRecentProjectId("00000000-0000-4000-8000-000000000001") } as const),
  newProject: async () => ({ success: false, canceled: true } as const),
  close: async () => ({ success: false, canceled: true } as const),
  getRecent: async () => ({ success: true, projects: [] } as const),
  getDirectory: async () => ({ success: true, directory: null } as const),
  resolveAssetRead: async () => ({ filePath: "", release: () => undefined }),
};

describe("project IPC registration", () => {
  it("replaces legacy project handlers without registering path-based load", () => {
    // Given: a registrar containing every legacy authority channel.
    const registrar = new FakeRegistrar();
    registrar.handle("project:loadFile", async () => "legacy");
    registrar.handle("project:save", async () => "legacy");

    // When: the typed project service is registered.
    const trusted = trustedSurface();
    registerProjectIpc(registrar, service, () => trusted.window);

    // Then: only the explicit contract channels remain.
    expect([...registrar.handlers.keys()].sort()).toEqual([...PROJECT_IPC_CHANNELS].sort());
    expect(registrar.handlers.has("project:loadFile")).toBe(false);
  });

  it("rejects path-bearing save payloads before invoking the service", async () => {
    // Given: an observing service and the registered save handler.
    const registrar = new FakeRegistrar();
    let saveCalls = 0;
    const trusted = trustedSurface();
    registerProjectIpc(registrar, {
      ...service,
      save: async () => {
        saveCalls += 1;
        return { success: false, canceled: true } as const;
      },
    }, () => trusted.window);
    const handler = registrar.handlers.get("project:save");
    if (handler === undefined) throw new TypeError("save handler missing");

    // When: renderer-controlled destination authority is included.
    const result = await handler(trusted.trustedEvent, {
      expectedSessionId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      rendererGeneration: 1,
      workspaceGeneration: 0,
      snapshot: TEST_PROJECT,
      filePath: "C:\\forged\\target.amg",
    });

    // Then: strict parsing rejects it without calling persistence.
    expect(result).toMatchObject({ success: false, error: { code: "PATH_AUTHORITY_FORBIDDEN" } });
    expect(saveCalls).toBe(0);
  });

  it("parses branded session and generation requests before delegation", async () => {
    // Given: a service that records the canonical save request.
    const registrar = new FakeRegistrar();
    const trusted = trustedSurface();
    let delegated: unknown;
    registerWithActiveWindow(registrar, {
      ...service,
      save: async (request) => {
        delegated = request;
        return { success: false, canceled: true } as const;
      },
    }, () => trusted.window);
    const handler = registrar.handlers.get("project:save");
    if (handler === undefined) throw new TypeError("save handler missing");

    // When: a valid content-only save crosses the IPC boundary.
    const result = await handler(trusted.trustedEvent, {
      expectedSessionId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      rendererGeneration: 3,
      workspaceGeneration: 0,
      snapshot: TEST_PROJECT,
    });

    // Then: delegation receives no path authority and preserves exact generation.
    expect(result).toEqual({ success: false, canceled: true });
    expect(delegated).toMatchObject({
      expectedSessionId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      rendererGeneration: 3,
      workspaceGeneration: 0,
      snapshot: TEST_PROJECT,
    });
  });

  it("requires a complete transition context before activation delegation", async () => {
    const registrar = new FakeRegistrar();
    const trusted = trustedSurface();
    let loadCalls = 0;
    let recentCalls = 0;
    registerWithActiveWindow(registrar, {
      ...service,
      openProject: async () => {
        loadCalls += 1;
        return { success: false, canceled: true } as const;
      },
      openRecent: async () => {
        recentCalls += 1;
        return { success: false, canceled: true } as const;
      },
    }, () => trusted.window);
    const load = registrar.handlers.get("project:load");
    const openRecent = registrar.handlers.get("project:openRecent");
    if (load === undefined || openRecent === undefined) throw new TypeError("activation handler missing");

    const malformedLoad = await load(trusted.trustedEvent, {});
    const forgedRecent = await openRecent(trusted.trustedEvent, "C:\\projects\\forged.amg");
    const initialLoad = await load(trusted.trustedEvent, {
      expectedSessionId: null,
      rendererGeneration: 0,
      workspaceGeneration: 0,
      snapshot: null,
      dirtyChoice: "discard",
    });

    expect(malformedLoad).toMatchObject({ success: false, error: { code: "PATH_AUTHORITY_FORBIDDEN" } });
    expect(forgedRecent).toMatchObject({ success: false, error: { code: "PATH_AUTHORITY_FORBIDDEN" } });
    expect(initialLoad).toEqual({ success: false, canceled: true });
    expect(loadCalls).toBe(1);
    expect(recentCalls).toBe(0);
  });

  it("rejects foreign and child-frame persistence requests before service invocation", async () => {
    // Given: a registered save handler and a dynamic active application window.
    const registrar = new FakeRegistrar();
    const trusted = trustedSurface();
    let saveCalls = 0;
    registerWithActiveWindow(registrar, {
      ...service,
      save: async () => {
        saveCalls += 1;
        return { success: false, canceled: true } as const;
      },
    }, () => trusted.window);
    const handler = registrar.handlers.get("project:save");
    if (handler === undefined) throw new TypeError("save handler missing");
    const request = {
      expectedSessionId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      rendererGeneration: 3,
      snapshot: TEST_PROJECT,
    };

    // When/Then: a foreign WebContents or a child frame attempts persistence.
    await expect(handler(trusted.foreignEvent, request)).rejects.toThrow("trusted application window");
    await expect(handler(trusted.childFrameEvent, request)).rejects.toThrow("trusted main frame");
    expect(saveCalls).toBe(0);
  });

  it("rejects missing active-window and frame representations before read delegation", async () => {
    // Given: a getter that has no active window and a project-directory handler.
    const registrar = new FakeRegistrar();
    const trusted = trustedSurface();
    let directoryCalls = 0;
    let activeWindow: ReturnType<typeof trustedSurface>["window"] | null = null;
    registerWithActiveWindow(registrar, {
      ...service,
      getDirectory: async () => {
        directoryCalls += 1;
        return { success: true, directory: null } as const;
      },
    }, () => activeWindow);
    const handler = registrar.handlers.get("project:getDir");
    if (handler === undefined) throw new TypeError("directory handler missing");

    // When/Then: the window is absent or the otherwise-matching event has no frame.
    await expect(handler(trusted.trustedEvent)).rejects.toThrow("trusted application window");
    activeWindow = trusted.window;
    await expect(handler({ sender: trusted.trustedEvent.sender, senderFrame: null })).rejects.toThrow("trusted main frame");
    expect(directoryCalls).toBe(0);
  });
});
