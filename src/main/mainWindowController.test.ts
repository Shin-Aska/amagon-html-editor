import type { BrowserWindowConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import type { LifecycleController } from "./projects/projectLifecycle";
import { createMainWindowController } from "./mainWindowController";

type CloseEvent = { readonly preventDefault: () => void };

const fakeWindow = () => ({
  webContents: { send: vi.fn() },
  loadURL: vi.fn(),
  loadFile: vi.fn(),
  close: vi.fn(),
});

const fakeLifecycle = (): LifecycleController => ({
  request: vi.fn(),
  finish: vi.fn(() => true),
  canCloseWindow: vi.fn(() => false),
  canQuit: vi.fn(() => false),
});

describe("main window controller", () => {
  it("creates and recreates windows with fresh lifecycle ownership", async () => {
    const windows = [fakeWindow(), fakeWindow()];
    const lifecycles = [fakeLifecycle(), fakeLifecycle()];
    const options: BrowserWindowConstructorOptions[] = [];
    const controller = createMainWindowController({
      moduleDirectory: "C:/app/out/main",
      rendererUrl: undefined,
      platform: "win32",
      createRequestId: () => "request",
      quit: vi.fn(),
      stopAutosave: vi.fn(),
      createWindow: (value) => {
        options.push(value);
        const next = windows.shift();
        if (next === undefined) throw new Error("missing fake window");
        return next;
      },
      onClosed: vi.fn(),
      onClose: vi.fn(),
      createLifecycle: vi.fn(() => {
        const next = lifecycles.shift();
        if (next === undefined) throw new Error("missing lifecycle");
        return next;
      }),
    });
    await controller.createWindow();
    const firstLifecycle = controller.getLifecycleController();
    await controller.createWindow();
    expect(controller.getLifecycleController()).not.toBe(firstLifecycle);
    expect(options).toHaveLength(2);
    expect(options[0]).toEqual(expect.objectContaining({ width: 1400, height: 900, title: "Amagon" }));
    expect(controller.getMainWindow()?.loadFile).toHaveBeenCalledWith(expect.stringMatching(/renderer[\\/]index\.html$/));
  });

  it("prevents an unapproved close and requests lifecycle approval", async () => {
    const window = fakeWindow();
    const currentLifecycle = fakeLifecycle();
    let closeListener: ((event: CloseEvent) => void) | undefined;
    const controller = createMainWindowController({
      moduleDirectory: "C:/app/out/main",
      rendererUrl: "http://localhost:5173",
      platform: "linux",
      createRequestId: () => "request",
      quit: vi.fn(),
      stopAutosave: vi.fn(),
      createWindow: () => window,
      onClosed: vi.fn(),
      onClose: (_window, listener) => { closeListener = listener; },
      createLifecycle: () => currentLifecycle,
    });
    await controller.createWindow();
    const preventDefault = vi.fn();
    closeListener?.({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(currentLifecycle.request).toHaveBeenCalledWith("window-close");
    expect(window.loadURL).toHaveBeenCalledWith("http://localhost:5173");
  });

  it("ignores stale closed callbacks after recreation", async () => {
    const first = fakeWindow();
    const second = fakeWindow();
    const windows = [first, second];
    const closedListeners: Array<() => void> = [];
    const stopAutosave = vi.fn();
    const controller = createMainWindowController({
      moduleDirectory: "C:/app/out/main",
      rendererUrl: undefined,
      platform: "win32",
      createRequestId: () => "request",
      quit: vi.fn(),
      stopAutosave,
      createWindow: () => {
        const next = windows.shift();
        if (next === undefined) throw new Error("missing window");
        return next;
      },
      onClosed: (_window, listener) => closedListeners.push(listener),
      onClose: vi.fn(),
      createLifecycle: () => fakeLifecycle(),
    });
    await controller.createWindow();
    await controller.createWindow();
    closedListeners[0]?.();
    expect(controller.getMainWindow()).toBe(second);
    expect(stopAutosave).not.toHaveBeenCalled();
    closedListeners[1]?.();
    expect(controller.getMainWindow()).toBeNull();
    expect(stopAutosave).toHaveBeenCalledOnce();
  });
});
