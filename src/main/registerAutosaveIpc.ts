import type { AutosaveController } from "./autosaveController";
import { assertTrustedMainFrame } from "./projects/projectIpcSecurity";

type IpcEvent = Parameters<typeof assertTrustedMainFrame>[0];
type MainWindow = Parameters<typeof assertTrustedMainFrame>[1];
type Handler = (event: IpcEvent, intervalMs?: unknown) => unknown;

export interface AutosaveIpcRegistrar {
  readonly handle: (channel: string, handler: Handler) => void;
}

export const registerAutosaveIpc = (
  registrar: AutosaveIpcRegistrar,
  controller: AutosaveController,
  getMainWindow: () => MainWindow,
): void => {
  registrar.handle("autosave:start", (event, intervalMs?: unknown) => {
    assertTrustedMainFrame(event, getMainWindow());
    controller.start(typeof intervalMs === "number" ? intervalMs || 60_000 : 60_000);
    return { success: true };
  });
  registrar.handle("autosave:stop", (event) => {
    assertTrustedMainFrame(event, getMainWindow());
    controller.stop();
    return { success: true };
  });
};
