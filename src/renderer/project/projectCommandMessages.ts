import type { ProjectOperationError } from "../../shared/projects/projectIpcContract";
import type { ProjectCommandMessage } from "./projectCommandTypes";

export const operationErrorMessage = (error: ProjectOperationError): ProjectCommandMessage => {
  switch (error.code) {
    case "ARCHIVE_INVALID": return { tone: "error", title: "Project is corrupted", detail: error.message, locations: [] };
    case "ARCHIVE_LIMIT_EXCEEDED": return { tone: "error", title: "Project exceeds safe capacity", detail: error.message, locations: [] };
    case "ARCHIVE_INTEGRITY_FAILED": return { tone: "error", title: "Project integrity check failed", detail: error.message, locations: [] };
    case "PROJECT_NOT_PORTABLE": return { tone: "error", title: "Project contains non-portable references", detail: error.message, locations: error.offenders };
    case "STALE_SESSION": return { tone: "error", title: "Project changed in another operation", detail: "Retry from the currently open project.", locations: [] };
    case "STALE_RENDERER_GENERATION": return { tone: "error", title: "Newer edits are still unsaved", detail: "Retry Save after the current edit finishes.", locations: [] };
    case "STALE_WORKSPACE_GENERATION": return { tone: "error", title: "Project files changed in another operation", detail: "Retry from the current project file state.", locations: [] };
    case "BUSY": return { tone: "info", title: "Project operation in progress", detail: `Wait for ${error.operation} to finish.`, locations: [] };
    case "RECENT_NOT_FOUND": return { tone: "error", title: "Recent project not found", detail: "Remove the missing entry or open the project manually.", locations: [] };
    case "UNSUPPORTED_IN_BROWSER":
    case "PATH_AUTHORITY_FORBIDDEN":
    case "INTERNAL": return { tone: "error", title: "Project operation failed", detail: error.message, locations: [] };
  }
};

export const canceledMessage = (): ProjectCommandMessage => ({
  tone: "info",
  title: "Operation canceled",
  detail: "No project changes were applied.",
  locations: [],
});
