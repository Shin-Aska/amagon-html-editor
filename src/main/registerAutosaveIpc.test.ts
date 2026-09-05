import { describe, expect, it, vi } from "vitest";
import type { AutosaveController } from "./autosaveController";
import { registerAutosaveIpc } from "./registerAutosaveIpc";

describe("autosave IPC registration", () => {
  it("registers start and stop with exact success shapes", () => {
    const handlers = new Map<string, (...args: readonly unknown[]) => unknown>();
    const controller: AutosaveController = { start: vi.fn(), stop: vi.fn() };
    registerAutosaveIpc({ handle: (channel, handler) => handlers.set(channel, handler) }, controller);
    expect([...handlers.keys()]).toEqual(["autosave:start", "autosave:stop"]);
    expect(handlers.get("autosave:start")?.({}, 0)).toEqual({ success: true });
    expect(controller.start).toHaveBeenCalledWith(60_000);
    expect(handlers.get("autosave:stop")?.()).toEqual({ success: true });
    expect(controller.stop).toHaveBeenCalledOnce();
  });
});
