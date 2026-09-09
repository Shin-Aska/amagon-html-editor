import type { BrowserWindowConstructorOptions } from "electron";
import * as path from "path";
import type { LifecycleController } from "./projects/projectLifecycle";
import { createLifecycleController } from "./projects/projectLifecycle";

type CloseEvent = { readonly preventDefault: () => void };

export interface ManagedWindow {
  readonly webContents: { readonly send: (channel: string, payload: unknown) => void };
  readonly loadURL: (url: string) => unknown;
  readonly loadFile: (filePath: string) => unknown;
  readonly close: () => void;
}

export interface MainWindowController<TWindow extends ManagedWindow> {
  readonly createWindow: () => Promise<void>;
  readonly getMainWindow: () => TWindow | null;
  readonly getLifecycleController: () => LifecycleController | null;
}

export interface MainWindowContext<TWindow extends ManagedWindow> {
  readonly moduleDirectory: string;
  readonly rendererUrl: string | undefined;
  readonly platform: NodeJS.Platform;
  readonly createRequestId: () => string;
  readonly quit: () => void;
  readonly stopAutosave: () => void;
  readonly createWindow: (options: BrowserWindowConstructorOptions) => TWindow;
  readonly onClosed: (window: TWindow, listener: () => void) => void;
  readonly onClose: (window: TWindow, listener: (event: CloseEvent) => void) => void;
  readonly createLifecycle?: typeof createLifecycleController;
}

export const createMainWindowController = <TWindow extends ManagedWindow>(
  context: MainWindowContext<TWindow>,
): MainWindowController<TWindow> => {
  let mainWindow: TWindow | null = null;
  let lifecycleController: LifecycleController | null = null;

  const createWindow = async (): Promise<void> => {
    const createdWindow = context.createWindow({
      width: 1400,
      height: 900,
      minWidth: 900,
      minHeight: 600,
      title: "Amagon",
      icon: path.join(
        context.moduleDirectory,
        context.platform === "win32" ? "../../assets/app.ico" : "../../assets/app.png",
      ),
      webPreferences: {
        preload: path.join(context.moduleDirectory, "../preload/index.mjs"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });
    mainWindow = createdWindow;
    if (context.rendererUrl) createdWindow.loadURL(context.rendererUrl);
    else createdWindow.loadFile(path.join(context.moduleDirectory, "../renderer/index.html"));

    const lifecycle = (context.createLifecycle ?? createLifecycleController)({
      createRequestId: context.createRequestId,
      send: (request) => createdWindow.webContents.send("project:lifecycle-close-request", request),
      closeWindow: () => createdWindow.close(),
      quit: context.quit,
    });
    lifecycleController = lifecycle;
    context.onClosed(createdWindow, () => {
      if (mainWindow !== createdWindow) return;
      mainWindow = null;
      lifecycleController = null;
      context.stopAutosave();
    });
    context.onClose(createdWindow, (event) => {
      if (lifecycle.canCloseWindow()) return;
      event.preventDefault();
      lifecycle.request("window-close");
    });
  };

  return {
    createWindow,
    getMainWindow: () => mainWindow,
    getLifecycleController: () => lifecycleController,
  };
};
