import { z } from "zod";
import {
  ProjectSessionIdSchema,
  RecentProjectIdSchema,
  RendererGenerationSchema,
  type ProjectFailure,
} from "../../shared/projects/projectIpcContract";
import {
  LegacyProjectDocumentSchema,
  ProjectDocumentV1Schema,
} from "../../shared/projects/projectDocumentSchema";
import type { ProjectPersistenceService } from "./projectServiceTypes";
import { assertTrustedMainFrame } from "./projectIpcSecurity";

type IpcEvent = Parameters<typeof assertTrustedMainFrame>[0];
type MainWindow = Parameters<typeof assertTrustedMainFrame>[1];

const DurableProjectSchema = z.union([ProjectDocumentV1Schema, LegacyProjectDocumentSchema]);
const SaveRequestFields = {
  expectedSessionId: ProjectSessionIdSchema,
  rendererGeneration: RendererGenerationSchema,
  snapshot: DurableProjectSchema,
} as const;
const SaveRequestSchema = z.object(SaveRequestFields).strict().readonly();
const CloseRequestSchema = z.object({
  ...SaveRequestFields,
  dirtyChoice: z.enum(["save", "discard", "cancel"]).optional(),
}).strict().readonly();
const NewRequestSchema = z.object({ name: z.string().min(1), framework: z.string().min(1) }).strict().readonly();

export const PROJECT_IPC_CHANNELS = [
  "project:save",
  "project:saveAs",
  "project:load",
  "project:openRecent",
  "project:removeRecent",
  "project:new",
  "project:close",
  "project:getRecent",
  "project:getDir",
] as const;

const REMOVED_PROJECT_CHANNELS = [...PROJECT_IPC_CHANNELS, "project:loadFile"] as const;

export type ProjectIpcHandler = (event: IpcEvent, argument?: unknown) => Promise<unknown> | unknown;

export interface ProjectIpcRegistrar {
  readonly handle: (channel: string, handler: ProjectIpcHandler) => void;
  readonly removeHandler: (channel: string) => void;
}

const boundaryFailure = (): ProjectFailure => ({
  success: false,
  error: {
    code: "PATH_AUTHORITY_FORBIDDEN",
    message: "renderer path authority is forbidden",
  },
});

const parsed = (
  getMainWindow: () => MainWindow,
  parseInput: (input: unknown) => Promise<unknown> | unknown,
): ProjectIpcHandler => async (event, input) => {
  assertTrustedMainFrame(event, getMainWindow());
  try {
    return await parseInput(input);
  } catch (error) {
    if (error instanceof z.ZodError) return boundaryFailure();
    throw error;
  }
};

export const registerProjectIpc = (
  registrar: ProjectIpcRegistrar,
  service: ProjectPersistenceService,
  getMainWindow: () => MainWindow,
): void => {
  REMOVED_PROJECT_CHANNELS.forEach((channel) => registrar.removeHandler(channel));
  registrar.handle("project:save", parsed(getMainWindow, (input) => service.save(SaveRequestSchema.parse(input))));
  registrar.handle("project:saveAs", parsed(getMainWindow, (input) => service.saveAs(SaveRequestSchema.parse(input))));
  registrar.handle("project:load", parsed(getMainWindow, () => service.openProject()));
  registrar.handle("project:openRecent", parsed(getMainWindow, (input) => service.openRecent(RecentProjectIdSchema.parse(input))));
  registrar.handle("project:removeRecent", parsed(getMainWindow, (input) => service.removeRecent(RecentProjectIdSchema.parse(input))));
  registrar.handle("project:new", parsed(getMainWindow, (input) => service.newProject(NewRequestSchema.parse(input))));
  registrar.handle("project:close", parsed(getMainWindow, (input) => service.close(CloseRequestSchema.parse(input))));
  registrar.handle("project:getRecent", parsed(getMainWindow, () => service.getRecent()));
  registrar.handle("project:getDir", parsed(getMainWindow, () => service.getDirectory()));
};
