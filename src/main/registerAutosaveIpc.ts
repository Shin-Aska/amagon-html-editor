import type { AutosaveController } from "./autosaveController";

type Handler = (...args: readonly unknown[]) => unknown;

export interface AutosaveIpcRegistrar {
  readonly handle: (channel: string, handler: Handler) => void;
}

export const registerAutosaveIpc = (
  registrar: AutosaveIpcRegistrar,
  controller: AutosaveController,
): void => {
  registrar.handle("autosave:start", (_event, intervalMs?: unknown) => {
    controller.start(typeof intervalMs === "number" ? intervalMs || 60_000 : 60_000);
    return { success: true };
  });
  registrar.handle("autosave:stop", () => {
    controller.stop();
    return { success: true };
  });
};
