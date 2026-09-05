import { retireState } from "./projectServiceState";
import type {
  ActiveProjectState,
  ActiveProjectStateStore,
  ProjectServiceRuntime,
} from "./projectServiceTypes";
import { rollbackProjectTarget, type ProjectTargetTransaction } from "./projectTargetTransaction";

export type ProjectTargetReplacement = {
  readonly active: ActiveProjectStateStore;
  readonly next: ActiveProjectState;
  readonly previous: ActiveProjectState | null;
  readonly prepare: () => Promise<void>;
  readonly retainedWorkspacePath?: string;
  readonly runtime: ProjectServiceRuntime;
  readonly targetTransaction: ProjectTargetTransaction;
  readonly onDirectoryChange?: (directory: string | null) => void;
};

export const commitProjectTargetReplacement = async (
  replacement: ProjectTargetReplacement,
): Promise<void> => {
  let directoryPrepared = false;
  try {
    await replacement.prepare();
    directoryPrepared = true;
    replacement.onDirectoryChange?.(replacement.next.session.workspacePath);
    await replacement.targetTransaction.commit();
    replacement.runtime.sessions.activate(replacement.next.session);
    replacement.active.current = replacement.next;
    try {
      await retireState(
        replacement.previous,
        replacement.runtime,
        replacement.retainedWorkspacePath,
      );
    } catch (error) {
      console.error("[ProjectService] committed replacement cleanup failed:", error);
    }
  } catch (error) {
    return rollbackProjectTarget(replacement.targetTransaction, error, [
      async () => {
        if (directoryPrepared) {
          replacement.onDirectoryChange?.(replacement.previous?.session.workspacePath ?? null);
        }
      },
      async () => {
        if (replacement.active.current !== replacement.next) {
          await retireState(
            replacement.next,
            replacement.runtime,
            replacement.retainedWorkspacePath,
          );
        }
      },
    ]);
  }
};
