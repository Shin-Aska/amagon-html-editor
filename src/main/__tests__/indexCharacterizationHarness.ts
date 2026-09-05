import { vi } from "vitest";

export type CapturedHandler = (...args: readonly unknown[]) => unknown;

type WindowListener = (...args: readonly unknown[]) => void;

const state = vi.hoisted(() => ({
  appListeners: new Map<string, (...args: readonly unknown[]) => void>(),
  handlers: new Map<string, (...args: readonly unknown[]) => unknown>(),
  protocols: [] as string[],
  removedHandlers: [] as string[],
  sequence: [] as string[],
  timers: [] as Array<() => void>,
  windows: [] as Array<{
    readonly webContents: {
      readonly id: number;
      readonly mainFrame: object;
      readonly send: ReturnType<typeof vi.fn>;
    };
    readonly listeners: Map<string, WindowListener>;
  }>,
  readyCallbacks: [] as Array<() => Promise<void> | void>,
}));

vi.mock("electron", () => {
  class BrowserWindow {
    static getAllWindows(): readonly BrowserWindow[] {
      return state.windows as unknown as readonly BrowserWindow[];
    }

    readonly listeners = new Map<string, WindowListener>();
    readonly webContents = {
      id: state.windows.length + 1,
      mainFrame: {},
      send: vi.fn(),
    };

    constructor(readonly options: unknown) {
      state.sequence.push("window:create");
      state.windows.push(this);
    }

    loadURL(url: string): void {
      state.sequence.push(`window:loadURL:${url}`);
    }

    loadFile(file: string): void {
      state.sequence.push(`window:loadFile:${file}`);
    }

    on(event: string, listener: WindowListener): void {
      this.listeners.set(event, listener);
    }

    close(): void {}
    isMinimized(): boolean { return false; }
    restore(): void {}
    focus(): void {}
  }

  return {
    app: {
      getAppPath: () => "C:/app",
      getPath: (name: string) => `C:/amagon-test/${name}`,
      getVersion: () => "1.9.0-test",
      isPackaged: false,
      on: (event: string, listener: (...args: readonly unknown[]) => void) => {
        state.appListeners.set(event, listener);
        state.sequence.push(`app:on:${event}`);
      },
      quit: vi.fn(),
      requestSingleInstanceLock: () => true,
      whenReady: () => ({
        then: (callback: () => Promise<void> | void) => {
          state.readyCallbacks.push(callback);
          state.sequence.push("app:whenReady");
          return Promise.resolve();
        },
      }),
    },
    BrowserWindow,
    dialog: {
      showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] })),
      showSaveDialog: vi.fn(async () => ({ canceled: true })),
    },
    ipcMain: {
      handle: (channel: string, handler: (...args: readonly unknown[]) => unknown) => {
        state.handlers.set(channel, handler);
        state.sequence.push(`ipc:${channel}`);
      },
      removeHandler: (channel: string) => state.removedHandlers.push(channel),
    },
    Menu: { buildFromTemplate: vi.fn((template: unknown) => template), setApplicationMenu: vi.fn() },
    net: { fetch: vi.fn() },
    protocol: {
      handle: (scheme: string) => {
        state.protocols.push(scheme);
        state.sequence.push(`protocol:${scheme}`);
      },
      registerSchemesAsPrivileged: () => state.sequence.push("protocol:privileged"),
    },
    shell: { openExternal: vi.fn(), openPath: vi.fn(async () => "") },
  };
});

vi.mock("../projects/projectWorkspace", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../projects/projectWorkspace")>()),
  cleanupStaleOwnedWorkspaces: vi.fn(async () => state.sequence.push("cleanup:stale")),
}));

vi.mock("font-list", () => ({ getFonts: vi.fn(async () => ["Arial"]) }));

export const loadCharacterizedEntrypoint = async () => {
  vi.resetModules();
  state.appListeners.clear();
  state.handlers.clear();
  state.protocols.length = 0;
  state.removedHandlers.length = 0;
  state.sequence.length = 0;
  state.timers.length = 0;
  state.windows.length = 0;
  state.readyCallbacks.length = 0;
  await import("../index");
  const ready = state.readyCallbacks.shift();
  if (ready === undefined) throw new Error("main entrypoint did not register app readiness");
  await ready();
  return state;
};

export const handlerFor = (channel: string): CapturedHandler => {
  const handler = state.handlers.get(channel);
  if (handler === undefined) throw new Error(`Missing handler: ${channel}`);
  return handler;
};

export const untrustedEvent = () => ({ sender: { id: 404, mainFrame: {} }, senderFrame: {} });
