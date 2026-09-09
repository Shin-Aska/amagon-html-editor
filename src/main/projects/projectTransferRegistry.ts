import type { ProjectSessionId } from "../../shared/projects/projectIpcContract";

export type ProjectTransferRegistry = {
  readonly run: <T>(
    sessionId: ProjectSessionId,
    transfer: (signal: AbortSignal) => Promise<T>,
  ) => Promise<T>;
  readonly abortSession: (sessionId: ProjectSessionId) => void;
  readonly activeCount: (sessionId: ProjectSessionId) => number;
};

export const runCancellableTransferBatch = async <TItem, TResult>(
  signal: AbortSignal,
  items: readonly TItem[],
  transfer: (item: TItem, signal: AbortSignal, index: number) => Promise<TResult>,
): Promise<readonly TResult[]> => {
  const results: TResult[] = [];
  for (const [index, item] of items.entries()) {
    if (signal.aborted) throw new DOMException("canceled", "AbortError");
    results.push(await transfer(item, signal, index));
  }
  return results;
};

export const createProjectTransferRegistry = (): ProjectTransferRegistry => {
  const active = new Map<ProjectSessionId, Set<AbortController>>();

  return {
    async run(sessionId, transfer) {
      const controller = new AbortController();
      const controllers = active.get(sessionId) ?? new Set<AbortController>();
      controllers.add(controller);
      active.set(sessionId, controllers);
      try {
        return await transfer(controller.signal);
      } finally {
        controllers.delete(controller);
        if (controllers.size === 0) active.delete(sessionId);
      }
    },
    abortSession(sessionId) {
      const controllers = active.get(sessionId);
      if (controllers === undefined) return;
      for (const controller of controllers) controller.abort();
    },
    activeCount: (sessionId) => active.get(sessionId)?.size ?? 0,
  };
};
