import type { ProjectSessionId } from "../../shared/projects/projectIpcContract";
import type { ProjectCommandResult } from "./projectCommandTypes";

const skipped = (): ProjectCommandResult => ({ ok: true, value: undefined });
type Pending = {
  readonly sessionId: ProjectSessionId;
  readonly promise: Promise<ProjectCommandResult>;
  readonly resolve: (result: ProjectCommandResult) => void;
};

/** One pending tick, scoped to its original project; no polling or idle timer. */
export class DeferredProjectAutosave {
  private pending: Pending | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private readonly context: {
      readonly getSessionId: () => ProjectSessionId | null;
      readonly blocked: () => boolean;
      readonly save: () => Promise<ProjectCommandResult>;
    },
  ) {}

  defer(sessionId: ProjectSessionId): Promise<ProjectCommandResult> {
    if (this.pending?.sessionId === sessionId) return this.pending.promise;
    this.pending?.resolve(skipped());
    let resolve: Pending["resolve"] = () => undefined;
    const promise = new Promise<ProjectCommandResult>((finish) => {
      resolve = finish;
    });
    this.pending = { sessionId, promise, resolve };
    return promise;
  }

  flush(): void {
    if (!this.pending || this.timer !== null || this.context.blocked()) return;
    // Let the importer publish font metadata before capturing the next snapshot.
    this.timer = setTimeout(() => {
      this.timer = null;
      const pending = this.pending;
      if (!pending || this.context.blocked()) return;
      this.pending = null;
      if (this.context.getSessionId() !== pending.sessionId) {
        pending.resolve(skipped());
        return;
      }
      void this.context.save().then(pending.resolve, (error) =>
        pending.resolve({
          ok: false,
          canceled: false,
          message: {
            tone: "error",
            title: "Autosave failed",
            detail:
              error instanceof Error
                ? error.message
                : "Could not complete autosave.",
            locations: [],
          },
        }),
      );
    }, 0);
  }

  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending?.resolve(skipped());
    this.pending = null;
  }
}
