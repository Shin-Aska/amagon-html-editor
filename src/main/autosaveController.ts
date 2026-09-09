type AutosaveWindow = {
  readonly webContents: {
    readonly send: (channel: string) => void;
  };
};

export interface AutosaveController {
  readonly start: (intervalMs?: number) => void;
  readonly stop: () => void;
}

export interface AutosaveContext {
  readonly getMainWindow: () => AutosaveWindow | null;
  readonly getCurrentProjectDir: () => string | null;
}

export const createAutosaveController = (context: AutosaveContext): AutosaveController => {
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = (): void => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };

  const start = (intervalMs: number = 60_000): void => {
    stop();
    timer = setInterval(() => {
      const window = context.getMainWindow();
      if (window !== null && context.getCurrentProjectDir() !== null) {
        window.webContents.send("auto-save-tick");
      }
    }, intervalMs);
  };

  return { start, stop };
};
