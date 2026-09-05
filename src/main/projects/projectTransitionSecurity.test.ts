// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  parseProjectSessionId,
  parseRendererGeneration,
  parseWorkspaceGeneration,
} from "../../shared/projects/projectIpcContract";
import { TEST_PROJECT } from "./amgArchiveFixtures";
import { createProjectService, type ProjectDialogPort, type ProjectServiceFiles } from "./projectService";
import { ProjectSessionRegistry } from "./projectSession";
import type { RecentProjectsStore } from "./recentProjects";

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

const initialTransition = {
  expectedSessionId: null,
  rendererGeneration: parseRendererGeneration(0),
  workspaceGeneration: parseWorkspaceGeneration(0),
  snapshot: null,
  dirtyChoice: "discard" as const,
};

const activeTransition = (
  sessionId: ReturnType<typeof parseProjectSessionId>,
  workspaceGeneration = 0,
  dirtyChoice: "discard" | "cancel" = "discard",
) => ({
  expectedSessionId: sessionId,
  rendererGeneration: parseRendererGeneration(0),
  workspaceGeneration: parseWorkspaceGeneration(workspaceGeneration),
  snapshot: null,
  dirtyChoice,
});

type SaveSelection = Awaited<ReturnType<ProjectDialogPort["showSave"]>>;

const createHarness = () => {
  const sessions = new ProjectSessionRegistry();
  const saveSelections: Array<Promise<SaveSelection>> = [];
  const openSelections: Array<Awaited<ReturnType<ProjectDialogPort["showOpen"]>>> = [];
  const counters = {
    saveDialogs: 0,
    openDialogs: 0,
    workspaces: 0,
    writes: 0,
    recents: 0,
    activations: 0,
    retirements: 0,
    directoryChanges: 0,
    aborts: 0,
  };
  const archives = new Map<string, typeof TEST_PROJECT>();
  let workspace = 0;
  const files: ProjectServiceFiles = {
    openAmg: async (filePath) => {
      const project = archives.get(filePath);
      if (project === undefined) throw new TypeError("missing test archive");
      counters.workspaces += 1;
      workspace += 1;
      return {
        project,
        workspace: {
          path: `C:\\owned\\opened-${workspace}`,
          rootPath: "C:\\owned",
          sentinelPath: `C:\\owned\\opened-${workspace}\\.amagon-workspace.json`,
          ownership: "app",
        },
      };
    },
    readLegacy: async () => TEST_PROJECT,
    writeAmg: async ({ targetPath, project }) => {
      counters.writes += 1;
      archives.set(targetPath, project);
    },
    writeLegacy: async () => {
      counters.writes += 1;
    },
    createWorkspace: async () => {
      counters.workspaces += 1;
      workspace += 1;
      return {
        path: `C:\\owned\\candidate-${workspace}`,
        rootPath: "C:\\owned",
        sentinelPath: `C:\\owned\\candidate-${workspace}\\.amagon-workspace.json`,
        ownership: "app",
      };
    },
    listAssetPaths: async () => [],
    cleanupWorkspace: async () => {
      counters.retirements += 1;
    },
  };
  const recents: RecentProjectsStore = {
    list: async () => [],
    add: async () => {
      counters.recents += 1;
    },
    remove: async () => [],
    resolvePath: async () => "C:\\projects\\recent.amg",
  };
  const dialogs: ProjectDialogPort = {
    showSave: async () => {
      counters.saveDialogs += 1;
      return await (saveSelections.shift() ?? Promise.resolve({ canceled: true }));
    },
    showOpen: async () => {
      counters.openDialogs += 1;
      return openSelections.shift() ?? { canceled: true, filePaths: [] };
    },
  };
  const originalActivate = sessions.activate.bind(sessions);
  sessions.activate = (next) => {
    counters.activations += 1;
    originalActivate(next);
  };
  const service = createProjectService({
    userDataPath: "C:\\user",
    documentsPath: "C:\\documents",
    dialogs,
    recents,
    files,
    sessions,
    onDirectoryChange: () => {
      counters.directoryChanges += 1;
    },
    abortSessionTransfers: () => {
      counters.aborts += 1;
    },
  });
  return { service, sessions, saveSelections, openSelections, counters, archives };
};

describe("project transition authorization", () => {
  it("serializes overlapping public New and Open operations and rejects the stale second request before its dialog", async () => {
    const test = createHarness();
    const firstDialog = deferred<SaveSelection>();
    test.saveSelections.push(firstDialog.promise);
    test.openSelections.push({ canceled: false, filePaths: ["C:\\projects\\second.amg"] });

    const first = test.service.newProject({ name: "First", framework: "vanilla", ...initialTransition });
    const second = test.service.openProject(initialTransition);
    firstDialog.resolve({ canceled: false, filePath: "C:\\projects\\first.amg" });
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toMatchObject({ success: true, session: { displayPath: "C:\\projects\\first.amg" } });
    expect(secondResult).toMatchObject({ success: false, error: { code: "STALE_SESSION" } });
    expect(test.counters.saveDialogs).toBe(1);
    expect(test.counters.openDialogs).toBe(0);
    expect(test.counters.writes).toBe(1);
    expect(test.counters.activations).toBe(1);
  });

  it("honors main-owned Cancel before a dirty replacement creates any side effect", async () => {
    const test = createHarness();
    test.saveSelections.push(Promise.resolve({ canceled: false, filePath: "C:\\projects\\active.amg" }));
    const created = await test.service.newProject({ name: "Active", framework: "vanilla", ...initialTransition });
    if (!created.success) throw new TypeError("project creation failed");
    test.sessions.active.updateRendererGeneration(created.session.sessionId, 1);
    const before = structuredClone(test.counters);

    const canceled = await test.service.newProject({
      name: "Canceled",
      framework: "vanilla",
      expectedSessionId: created.session.sessionId,
      rendererGeneration: parseRendererGeneration(1),
      workspaceGeneration: parseWorkspaceGeneration(0),
      snapshot: null,
      dirtyChoice: "cancel",
    });

    expect(canceled).toEqual({ success: false, canceled: true });
    expect(test.counters).toEqual(before);
    expect(test.sessions.active.id).toBe(created.session.sessionId);
  });

  it("keeps Save As authoritative across its dialog while a public replacement waits", async () => {
    const test = createHarness();
    test.saveSelections.push(Promise.resolve({ canceled: false, filePath: "C:\\projects\\active.amg" }));
    const created = await test.service.newProject({ name: "Active", framework: "vanilla", ...initialTransition });
    if (!created.success) throw new TypeError("project creation failed");
    const saveAsDialog = deferred<SaveSelection>();
    test.saveSelections.push(saveAsDialog.promise, Promise.resolve({ canceled: false, filePath: "C:\\projects\\replacement.amg" }));

    const saving = test.service.saveAs({
      expectedSessionId: created.session.sessionId,
      rendererGeneration: parseRendererGeneration(0),
      workspaceGeneration: created.session.committedWorkspaceGeneration,
      snapshot: created.session.data,
    });
    const replacing = test.service.newProject({
      name: "Replacement",
      framework: "vanilla",
      ...activeTransition(created.session.sessionId),
    });
    saveAsDialog.resolve({ canceled: false, filePath: "C:\\projects\\copy.amg" });
    const [saved, replaced] = await Promise.all([saving, replacing]);

    expect(saved).toMatchObject({ success: true, session: { displayPath: "C:\\projects\\copy.amg" } });
    expect(replaced).toMatchObject({ success: false, error: { code: "STALE_SESSION" } });
    expect(test.counters.saveDialogs).toBe(2);
    expect(test.archives.has("C:\\projects\\replacement.amg")).toBe(false);
  });

  it("rejects a stale workspace close before aborting transfers or closing the active session", async () => {
    const test = createHarness();
    test.saveSelections.push(Promise.resolve({ canceled: false, filePath: "C:\\projects\\active.amg" }));
    const created = await test.service.newProject({ name: "Active", framework: "vanilla", ...initialTransition });
    if (!created.success) throw new TypeError("project creation failed");
    test.sessions.active.recordWorkspaceMutation(created.session.sessionId);
    const before = structuredClone(test.counters);

    const closed = await test.service.close({
      expectedSessionId: created.session.sessionId,
      rendererGeneration: parseRendererGeneration(0),
      workspaceGeneration: parseWorkspaceGeneration(0),
      snapshot: null,
      dirtyChoice: "discard",
    });

    expect(closed).toMatchObject({ success: false, error: { code: "STALE_WORKSPACE_GENERATION" } });
    expect(test.counters).toEqual(before);
    expect(test.sessions.active.id).toBe(created.session.sessionId);
  });
});
