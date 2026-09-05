import { afterEach, describe, expect, it, vi } from "vitest";
import { createAutosaveController } from "./autosaveController";

afterEach(() => vi.useRealTimers());

describe("autosave controller", () => {
  it("emits a tick through the current window and project", () => {
    vi.useFakeTimers();
    const first = { webContents: { send: vi.fn() } };
    const second = { webContents: { send: vi.fn() } };
    let window = first;
    let directory: string | null = "C:/project";
    const controller = createAutosaveController({
      getMainWindow: () => window,
      getCurrentProjectDir: () => directory,
    });
    controller.start(100);
    vi.advanceTimersByTime(100);
    expect(first.webContents.send).toHaveBeenCalledWith("auto-save-tick");
    window = second;
    directory = "C:/other";
    vi.advanceTimersByTime(100);
    expect(second.webContents.send).toHaveBeenCalledWith("auto-save-tick");
  });

  it("restart replaces the prior timer", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    const controller = createAutosaveController({
      getMainWindow: () => ({ webContents: { send } }),
      getCurrentProjectDir: () => "C:/project",
    });
    controller.start(100);
    controller.start(250);
    vi.advanceTimersByTime(249);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledTimes(1);
    controller.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("inactive dependencies and stop emit nothing", () => {
    vi.useFakeTimers();
    const send = vi.fn();
    let directory: string | null = null;
    let hasWindow = false;
    const controller = createAutosaveController({
      getMainWindow: () => hasWindow ? { webContents: { send } } : null,
      getCurrentProjectDir: () => directory,
    });
    controller.start(100);
    vi.advanceTimersByTime(100);
    hasWindow = true;
    vi.advanceTimersByTime(100);
    directory = "C:/project";
    controller.stop();
    controller.stop();
    vi.advanceTimersByTime(100);
    expect(send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
