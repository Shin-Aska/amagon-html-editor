import { describe, expect, it, vi } from "vitest";
import { createTrustedIpcTestFixture, type TestIpcEvent } from "./__tests__/trustedIpcTestFixture";
import { registerMenuIpc } from "./registerMenuIpc";

describe("menu IPC registration", () => {
  it("rejects foreign, child-frame, missing-frame, and missing-window requests before menu mutation", async () => {
    for (const state of ["foreign", "child", "missing-frame", "missing-window"] as const) {
      const ipc = createTrustedIpcTestFixture();
      const handlers = new Map<string, (event: TestIpcEvent, loaded: boolean) => void>();
      const buildMenu = vi.fn();
      const setApplicationMenu = vi.fn();
      registerMenuIpc({
        handle: (channel, handler) => handlers.set(channel, handler),
        getMainWindow: state === "missing-window" ? () => null : () => ipc.mainWindow,
        buildMenu,
        setApplicationMenu,
      });
      const event = state === "foreign" ? ipc.foreignEvent
        : state === "child" ? ipc.childFrameEvent
          : state === "missing-frame" ? ipc.missingFrameEvent
            : ipc.trustedEvent;
      const handler = handlers.get("menu:setProjectLoaded");
      await expect(Promise.resolve().then(() => handler?.(event, true))).rejects.toThrow("trusted");
      expect(buildMenu).not.toHaveBeenCalled();
      expect(setApplicationMenu).not.toHaveBeenCalled();
    }
  });

  it("rebuilds the current window menu", () => {
    const handlers = new Map<string, (event: TestIpcEvent, loaded: boolean) => void>();
    const first = createTrustedIpcTestFixture();
    const second = createTrustedIpcTestFixture();
    let current = first.mainWindow;
    const buildMenu = vi.fn((window: typeof first.mainWindow, loaded: boolean) => ({ window, loaded }));
    const setApplicationMenu = vi.fn();
    registerMenuIpc({
      handle: (channel, handler) => handlers.set(channel, handler),
      getMainWindow: () => current,
      buildMenu,
      setApplicationMenu,
    });
    current = second.mainWindow;
    expect(handlers.get("menu:setProjectLoaded")?.(second.trustedEvent, true)).toBeUndefined();
    expect(buildMenu).toHaveBeenCalledWith(second.mainWindow, true);
    expect(setApplicationMenu).toHaveBeenCalledWith({ window: second.mainWindow, loaded: true });
  });

  it("rejects when the current main window is missing", () => {
    const handlers = new Map<string, (event: TestIpcEvent, loaded: boolean) => void>();
    const buildMenu = vi.fn();
    const setApplicationMenu = vi.fn();
    registerMenuIpc({
      handle: (channel, handler) => handlers.set(channel, handler),
      getMainWindow: () => null,
      buildMenu,
      setApplicationMenu,
    });
    const ipc = createTrustedIpcTestFixture();
    expect(() => handlers.get("menu:setProjectLoaded")?.(ipc.trustedEvent, false)).toThrow("trusted application window");
    expect(buildMenu).not.toHaveBeenCalled();
    expect(setApplicationMenu).not.toHaveBeenCalled();
  });
});
