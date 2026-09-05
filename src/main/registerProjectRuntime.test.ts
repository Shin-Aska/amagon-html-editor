import * as path from "path";
import { describe, expect, it, vi } from "vitest";
import type { GoogleFontsService } from "./googleFontsTransport";
import type { LifecycleController } from "./projects/projectLifecycle";
import type { ProjectPersistenceService, ProjectServiceOptions } from "./projects/projectServiceTypes";
import { createDefaultProjectServiceFiles } from "./projects/projectServiceFiles";
import { ProjectSessionRegistry } from "./projects/projectSession";
import { createProjectTransferRegistry } from "./projects/projectTransferRegistry";
import type { RecentProjectsStore } from "./projects/recentProjects";
import { registerProjectRuntime, type ProjectRuntimeContext } from "./registerProjectRuntime";

type WindowToken = { readonly id: string };
type TestHandler = (event: unknown, argument: unknown) => unknown;

const serviceStub = (): ProjectPersistenceService => ({
  save: vi.fn(),
  saveAs: vi.fn(),
  openProject: vi.fn(),
  openRecent: vi.fn(),
  removeRecent: vi.fn(),
  newProject: vi.fn(),
  close: vi.fn(),
  getRecent: vi.fn(),
  getDirectory: vi.fn(),
  resolveAssetRead: vi.fn(),
});

const recentStoreStub = (): RecentProjectsStore => ({
  list: vi.fn(),
  add: vi.fn(),
  remove: vi.fn(),
  resolvePath: vi.fn(),
});

const setup = () => {
  const sessions = new ProjectSessionRegistry();
  const transfers = createProjectTransferRegistry();
  const projectFiles = createDefaultProjectServiceFiles();
  const service = serviceStub();
  const recents = recentStoreStub();
  const handlers = new Map<string, TestHandler>();
  const calls: string[] = [];
  const directoryCalls: string[] = [];
  const saveDialogCalls: [WindowToken | null, unknown][] = [];
  const openDialogCalls: [WindowToken | null, unknown][] = [];
  let currentWindow: WindowToken | null = null;
  let lifecycle: Pick<LifecycleController, "finish"> | null = null;
  let serviceOptions: ProjectServiceOptions | null = null;
  let resourceContext: Parameters<ProjectRuntimeContext<WindowToken>["registerProjectResources"]>[0] | null = null;
  let registeredService: ProjectPersistenceService | null = null;
  const googleFonts: GoogleFontsService = {
    fetchText: vi.fn(async () => "css"),
    cacheFile: vi.fn(async () => ({ filePath: "font", mimeType: "font/woff2" })),
    isAllowedUrl: () => true,
    maxResponseBytes: 1234,
  };
  const context: ProjectRuntimeContext<WindowToken> = {
    userDataPath: path.join("C:", "user-data"),
    documentsPath: path.join("C:", "documents"),
    sessions,
    transfers,
    projectFiles,
    autosave: {
      start: () => { directoryCalls.push("start"); },
      stop: () => { directoryCalls.push("stop"); },
    },
    googleFonts,
    getMainWindow: () => currentWindow,
    getLifecycleController: () => lifecycle,
    setCurrentProjectDirectory: (directory) => { directoryCalls.push(`set:${directory}`); },
    showSaveDialog: async (window, options) => {
      saveDialogCalls.push([window, options]);
      return { canceled: false, filePath: "project.amg" };
    },
    showOpenDialog: async (window, options) => {
      openDialogCalls.push([window, options]);
      return { canceled: false, filePaths: ["project.amg"] };
    },
    inspectProjectMetadata: vi.fn(async () => ({})),
    resolveSystemFontPath: vi.fn(async () => null),
    createRecentProjectsStore: vi.fn(() => recents),
    createProjectService: vi.fn((options) => {
      calls.push("service");
      serviceOptions = options;
      return service;
    }),
    registerProjectIpc: vi.fn((_registrar, registered) => {
      calls.push("project");
      registeredService = registered;
    }),
    registerProjectResources: vi.fn((registered) => {
      calls.push("resources");
      resourceContext = registered;
    }),
    handle: (channel, handler) => {
      calls.push(`handle:${channel}`);
      handlers.set(channel, (event, argument) => Reflect.apply(handler, undefined, [event, argument]));
    },
    removeHandler: vi.fn(),
  };
  const returned = registerProjectRuntime(context);
  const options = (): ProjectServiceOptions => {
    if (serviceOptions === null) throw new Error("service options were not captured");
    return serviceOptions;
  };
  const resources = () => {
    if (resourceContext === null) throw new Error("resource context was not captured");
    return resourceContext;
  };
  return {
    sessions, transfers, projectFiles, service, recents, handlers, calls, directoryCalls,
    saveDialogCalls, openDialogCalls, googleFonts, returned, options, resources,
    registeredService: () => registeredService,
    setWindow: (window: WindowToken | null) => { currentWindow = window; },
    setLifecycle: (controller: Pick<LifecycleController, "finish"> | null) => { lifecycle = controller; },
  };
};

describe("project runtime composition", () => {
  it("returns one singleton service and preserves dependency identities", () => {
    const current = setup();
    expect(current.returned).toBe(current.service);
    expect(current.registeredService()).toBe(current.service);
    expect(current.options().sessions).toBe(current.sessions);
    expect(current.options().files).toBe(current.projectFiles);
    expect(current.resources().sessions).toBe(current.sessions);
    expect(current.resources().transfers).toBe(current.transfers);
    expect(current.resources().projectFiles).toBe(current.projectFiles);
    expect(current.resources().googleFontsMaxBytes).toBe(current.googleFonts.maxResponseBytes);
  });

  it("preserves project, resource, and lifecycle registration order", () => {
    const current = setup();
    expect(current.calls).toEqual(["service", "project", "resources", "handle:project:finish-lifecycle-close"]);
  });

  it("updates directory before starting or stopping autosave", () => {
    const current = setup();
    current.options().onDirectoryChange?.("C:/project");
    current.options().onDirectoryChange?.(null);
    expect(current.directoryCalls).toEqual(["set:C:/project", "start", "set:null", "stop"]);
  });

  it("chooses null window and current window dialog overloads lazily", async () => {
    const current = setup();
    const saveRequest = { title: "Save", defaultPath: "project.amg", filters: [{ name: "AMG", extensions: ["amg"] }] };
    const openRequest = { title: "Open", filters: [{ name: "AMG", extensions: ["amg"] }] };
    await current.options().dialogs.showSave(saveRequest);
    await current.options().dialogs.showOpen(openRequest);
    const window = { id: "main" };
    current.setWindow(window);
    await current.options().dialogs.showSave(saveRequest);
    await current.options().dialogs.showOpen(openRequest);
    expect(current.saveDialogCalls.map(([value]) => value)).toEqual([null, window]);
    expect(current.openDialogCalls.map(([value]) => value)).toEqual([null, window]);
    expect(current.openDialogCalls[0][1]).toEqual({ ...openRequest, properties: ["openFile"] });
  });

  it("null window resource getter remains lazy", () => {
    const current = setup();
    expect(current.resources().getMainWindow()).toBeNull();
    const window = { id: "later" };
    current.setWindow(window);
    expect(current.resources().getMainWindow()).toBe(window);
  });

  it("uses the current lifecycle and returns false when absent", () => {
    const current = setup();
    const handler = current.handlers.get("project:finish-lifecycle-close");
    if (handler === undefined) throw new Error("lifecycle handler missing");
    const result = { requestId: "request", reason: "quit", proceed: true };
    expect(handler({}, result)).toBe(false);
    const finish = vi.fn(() => true);
    current.setLifecycle({ finish });
    expect(handler({}, result)).toBe(true);
    expect(finish).toHaveBeenCalledWith(result);
  });
});
