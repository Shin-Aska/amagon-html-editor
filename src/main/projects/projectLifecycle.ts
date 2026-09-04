export type LifecycleReason = "window-close" | "quit";

export type LifecycleRequest = {
  readonly requestId: string;
  readonly reason: LifecycleReason;
};

export type LifecycleResult = LifecycleRequest & {
  readonly proceed: boolean;
};

type LifecycleControllerOptions = {
  readonly send: (request: LifecycleRequest) => void;
  readonly closeWindow: () => void;
  readonly quit: () => void;
  readonly createRequestId: () => string;
  readonly timeoutMs?: number;
};

export type LifecycleController = {
  readonly request: (reason: LifecycleReason) => void;
  readonly finish: (result: LifecycleResult) => boolean;
  readonly canCloseWindow: () => boolean;
  readonly canQuit: () => boolean;
};

export type FocusableWindow = {
  readonly isMinimized: () => boolean;
  readonly restore: () => void;
  readonly focus: () => void;
};

export const focusSecondInstance = (window: FocusableWindow | null): void => {
  if (window === null) return;
  if (window.isMinimized()) window.restore();
  window.focus();
};

export const createLifecycleController = (
  options: LifecycleControllerOptions,
): LifecycleController => {
  let pending: LifecycleRequest | null = null;
  let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  let windowCloseAllowed = false;
  let quitAllowed = false;

  const clearPendingTimeout = (): void => {
    if (pendingTimeout !== null) clearTimeout(pendingTimeout);
    pendingTimeout = null;
  };

  return {
    request(reason) {
      if (pending !== null) return;
      pending = { requestId: options.createRequestId(), reason };
      try {
        options.send(pending);
        pendingTimeout = setTimeout(() => {
          pending = null;
          pendingTimeout = null;
        }, options.timeoutMs ?? 30_000);
      } catch (error) {
        pending = null;
        clearPendingTimeout();
        throw error;
      }
    },
    finish(result) {
      if (
        pending === null
        || pending.requestId !== result.requestId
        || pending.reason !== result.reason
      ) return false;
      pending = null;
      clearPendingTimeout();
      if (!result.proceed) return true;
      if (result.reason === "quit") {
        quitAllowed = true;
        windowCloseAllowed = true;
        options.quit();
      } else {
        windowCloseAllowed = true;
        options.closeWindow();
      }
      return true;
    },
    canCloseWindow: () => windowCloseAllowed,
    canQuit: () => quitAllowed,
  };
};
