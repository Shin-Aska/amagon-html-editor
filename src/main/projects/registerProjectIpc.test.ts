// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parseRecentProjectId } from "../../shared/projects/projectIpcContract";
import { TEST_PROJECT } from "./amgArchiveFixtures.test";
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
};

describe("project IPC registration", () => {
  it("replaces legacy project handlers without registering path-based load", () => {
    // Given: a registrar containing every legacy authority channel.
    const registrar = new FakeRegistrar();
    registrar.handle("project:loadFile", async () => "legacy");
    registrar.handle("project:save", async () => "legacy");

    // When: the typed project service is registered.
    registerProjectIpc(registrar, service);

    // Then: only the explicit contract channels remain.
    expect([...registrar.handlers.keys()].sort()).toEqual([...PROJECT_IPC_CHANNELS].sort());
    expect(registrar.handlers.has("project:loadFile")).toBe(false);
  });

  it("rejects path-bearing save payloads before invoking the service", async () => {
    // Given: an observing service and the registered save handler.
    const registrar = new FakeRegistrar();
    let saveCalls = 0;
    registerProjectIpc(registrar, {
      ...service,
      save: async () => {
        saveCalls += 1;
        return { success: false, canceled: true } as const;
      },
    });
    const handler = registrar.handlers.get("project:save");
    if (handler === undefined) throw new TypeError("save handler missing");

    // When: renderer-controlled destination authority is included.
    const result = await handler({}, {
      expectedSessionId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      rendererGeneration: 1,
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
    let delegated: unknown;
    registerProjectIpc(registrar, {
      ...service,
      save: async (request) => {
        delegated = request;
        return { success: false, canceled: true } as const;
      },
    });
    const handler = registrar.handlers.get("project:save");
    if (handler === undefined) throw new TypeError("save handler missing");

    // When: a valid content-only save crosses the IPC boundary.
    const result = await handler({}, {
      expectedSessionId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      rendererGeneration: 3,
      snapshot: TEST_PROJECT,
    });

    // Then: delegation receives no path authority and preserves exact generation.
    expect(result).toEqual({ success: false, canceled: true });
    expect(delegated).toMatchObject({
      expectedSessionId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      rendererGeneration: 3,
      snapshot: TEST_PROJECT,
    });
  });
});
