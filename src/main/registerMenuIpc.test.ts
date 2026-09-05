import { describe, expect, it, vi } from "vitest";
import { registerMenuIpc } from "./registerMenuIpc";

describe("menu IPC registration", () => {
  it("rebuilds the current window menu", () => {
    const handlers = new Map<string, (event: unknown, loaded: boolean) => void>();
    const first = { id: 1 };
    const second = { id: 2 };
    let current = first;
    const buildMenu = vi.fn((window: { readonly id: number }, loaded: boolean) => ({ window, loaded }));
    const setApplicationMenu = vi.fn();
    registerMenuIpc({
      handle: (channel, handler) => handlers.set(channel, handler),
      getMainWindow: () => current,
      buildMenu,
      setApplicationMenu,
    });
    current = second;
    expect(handlers.get("menu:setProjectLoaded")?.({}, true)).toBeUndefined();
    expect(buildMenu).toHaveBeenCalledWith(second, true);
    expect(setApplicationMenu).toHaveBeenCalledWith({ window: second, loaded: true });
  });

  it("leaves a null window as a no-op", () => {
    const handlers = new Map<string, (event: unknown, loaded: boolean) => void>();
    const buildMenu = vi.fn();
    const setApplicationMenu = vi.fn();
    registerMenuIpc({
      handle: (channel, handler) => handlers.set(channel, handler),
      getMainWindow: () => null,
      buildMenu,
      setApplicationMenu,
    });
    expect(handlers.get("menu:setProjectLoaded")?.({}, false)).toBeUndefined();
    expect(buildMenu).not.toHaveBeenCalled();
    expect(setApplicationMenu).not.toHaveBeenCalled();
  });
});
