import { ProjectSessionIdSchema, parseProjectSessionId, parseWorkspaceGeneration, type MutationResult, type ProjectSessionId } from "../../shared/projects/projectIpcContract";
import { SessionStateError, type ProjectSessionRegistry } from "./projectSession";

const FALLBACK_SESSION_ID = parseProjectSessionId("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

const activeGeneration = (
  sessions: ProjectSessionRegistry,
  expectedSessionId: ProjectSessionId,
) => parseWorkspaceGeneration(
  sessions.active.id === expectedSessionId ? sessions.active.generations.workspace : 0,
);

export const mutationFailure = <T>(
  sessions: ProjectSessionRegistry,
  expectedSessionId: ProjectSessionId,
  error: unknown,
): MutationResult<T> => ({
  success: false,
  sessionId: expectedSessionId,
  workspaceGeneration: activeGeneration(sessions, expectedSessionId),
  changed: false,
  error: error instanceof SessionStateError && (error.code === "stale-session" || error.code === "no-session")
    ? {
        code: "STALE_SESSION",
        expectedSessionId,
        ...(sessions.active.id === null ? {} : { activeSessionId: parseProjectSessionId(sessions.active.id) }),
      }
    : {
        code: "INTERNAL",
        message: error instanceof Error ? error.message : "project mutation failed",
      },
});

export const canceledMutation = <T>(
  sessions: ProjectSessionRegistry,
  expectedSessionId: ProjectSessionId,
): MutationResult<T> => ({
  success: false,
  canceled: true,
  sessionId: expectedSessionId,
  workspaceGeneration: activeGeneration(sessions, expectedSessionId),
  changed: false,
});

export const runMutationBoundary = async <T>(
  sessions: ProjectSessionRegistry,
  request: unknown,
  operation: (expectedSessionId: ProjectSessionId) => Promise<MutationResult<T>>,
): Promise<MutationResult<T>> => {
  let expectedSessionId: ProjectSessionId;
  try {
    if (typeof request !== "object" || request === null || !("expectedSessionId" in request)) {
      throw new TypeError("expectedSessionId is required");
    }
    expectedSessionId = ProjectSessionIdSchema.parse(request.expectedSessionId);
  } catch (error) {
    const activeSessionId = sessions.active.id;
    return mutationFailure(
      sessions,
      activeSessionId === null ? FALLBACK_SESSION_ID : parseProjectSessionId(activeSessionId),
      error,
    );
  }

  try {
    return await operation(expectedSessionId);
  } catch (error) {
    return mutationFailure(sessions, expectedSessionId, error);
  }
};
