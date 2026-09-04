import { useSyncExternalStore } from "react";
import { createProjectCommands } from "./projectCommandController";
import { createRuntimeProjectCommands } from "./projectCommandRuntime";
import type { ProjectCommandState } from "./projectCommandTypes";

export type {
  ProjectCommandDependencies,
  ProjectCommandMessage,
  ProjectCommandResult,
  ProjectCommands,
  ProjectCommandState,
} from "./projectCommandTypes";
export { createProjectCommands };

export const projectCommands = createRuntimeProjectCommands();

export const useProjectCommandState = (): ProjectCommandState => useSyncExternalStore(
  projectCommands.subscribe,
  () => projectCommands.state,
  () => projectCommands.state,
);
