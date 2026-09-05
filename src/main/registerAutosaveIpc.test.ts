import { describe, expect, it, vi } from "vitest";
import type { AutosaveController } from "./autosaveController";
import { createTrustedIpcTestFixture, type TestIpcEvent } from "./__tests__/trustedIpcTestFixture";
import { registerAutosaveIpc } from "./registerAutosaveIpc";

const setup = (getMainWindow?: () => ReturnType<typeof createTrustedIpcTestFixture>["mainWindow"] | null) => {
  const ipc = createTrustedIpcTestFixture();
  const handlers = new Map<string, (event: TestIpcEvent, intervalMs?: unknown) => unknown>();
  const controller: AutosaveController = { start: vi.fn(), stop: vi.fn() };
  registerAutosaveIpc({
    handle: (channel, handler) => handlers.set(channel, handler),
  }, controller, getMainWindow ?? (() => ipc.mainWindow));
  return { ipc, handlers, controller };
};

describe("autosave IPC registration", () => {
  it("rejects foreign, child-frame, missing-frame, and missing-window requests before timer mutation", async () => {
    for (const state of ["foreign", "child", "missing-frame", "missing-window"] as const) {
      const current = setup(state === "missing-window" ? () => null : undefined);
      const event = state === "foreign" ? current.ipc.foreignEvent
        : state === "child" ? current.ipc.childFrameEvent
          : state === "missing-frame" ? current.ipc.missingFrameEvent
            : current.ipc.trustedEvent;
      for (const handler of current.handlers.values()) {
        await expect(Promise.resolve().then(() => handler(event, 1))).rejects.toThrow("trusted");
      }
      expect(current.controller.start).not.toHaveBeenCalled();
      expect(current.controller.stop).not.toHaveBeenCalled();
    }
  });

  it("registers start and stop with exact success shapes", () => {
    const current = setup();
    expect([...current.handlers.keys()]).toEqual(["autosave:start", "autosave:stop"]);
    expect(current.handlers.get("autosave:start")?.(current.ipc.trustedEvent, 0)).toEqual({ success: true });
    expect(current.controller.start).toHaveBeenCalledWith(60_000);
    expect(current.handlers.get("autosave:stop")?.(current.ipc.trustedEvent)).toEqual({ success: true });
    expect(current.controller.stop).toHaveBeenCalledOnce();
  });
});
