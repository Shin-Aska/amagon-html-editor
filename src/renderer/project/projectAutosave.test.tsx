import { describe, expect, it, vi } from "vitest";
import {
  parseProjectSessionId,
  parseRendererGeneration,
  parseWorkspaceGeneration,
  type ProjectSession,
  type MutationResult,
  type AssetInfo,
  type ProjectBridge,
} from "../../shared/projects/projectIpcContract";
import { ProjectDocumentV1Schema } from "../../shared/projects/projectDocumentSchema";
import { createDefaultTheme, type ProjectData } from "../store/types";
import { createProjectCommands, type ProjectCommandDependencies } from "./projectCommands";

const SESSION = parseProjectSessionId("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
const data: ProjectData = {
  customCss: "",
  projectSettings: { name: "Autosave", framework: "vanilla", theme: createDefaultTheme(), globalStyles: {} },
  pages: [{ id: "home", title: "Home", slug: "index", blocks: [], meta: {} }],
  userBlocks: [],
};
const session = (renderer = 0, workspace = 0): ProjectSession => ({
  sessionId: SESSION,
  kind: "amg",
  displayPath: "autosave.amg",
  data: ProjectDocumentV1Schema.parse({ ...data, projectSchemaVersion: 1 }),
  committedRendererGeneration: parseRendererGeneration(renderer),
  committedWorkspaceGeneration: parseWorkspaceGeneration(workspace),
  dirty: false,
});

const setup = (choice: "save" | "discard" | "cancel" = "cancel") => {
  let edit: () => void = () => undefined;
  let snapshotError: Error | null = null;
  const save = vi.fn<ProjectBridge["save"]>(async (request) => ({ success: true, session: session(request.rendererGeneration, 1) }));
  const transition = async (request: Parameters<ProjectBridge["load"]>[0]) => {
    if (request.dirtyChoice === "cancel") return { success: false as const, canceled: true as const };
    if (request.dirtyChoice === "save") {
      const saved = await save(request);
      if (!saved.success) return saved;
    }
    return { success: true as const, session: session() };
  };
  const load = vi.fn<ProjectBridge["load"]>(transition);
  const newProject = vi.fn<ProjectBridge["new"]>(transition);
  const close = vi.fn<ProjectBridge["close"]>(async (request) => {
    if (request.dirtyChoice === "cancel") return { success: false, canceled: true };
    if (request.dirtyChoice === "save") {
      const saved = await save(request);
      if (!saved.success) return saved;
    }
    return { success: true, ...session() };
  });
  const selectImage = vi.fn<() => Promise<MutationResult<readonly AssetInfo[]>>>(async () => ({
    success: true,
    sessionId: SESSION,
    workspaceGeneration: parseWorkspaceGeneration(1),
    changed: true,
    value: [{ name: "asset.png", path: "runtime", relativePath: "assets/asset.png", type: "image" }],
  }));
  const dependencies: ProjectCommandDependencies = {
    project: {
      save,
      saveAs: save,
      load,
      openRecent: vi.fn(async () => ({ success: true as const, session: session() })),
      removeRecent: vi.fn(async (recentId) => ({ success: true as const, removedId: recentId })),
      new: newProject,
      close,
      getRecent: vi.fn(async () => ({ success: true as const, projects: [] })),
      getDir: vi.fn(async () => ({ success: true as const, directory: "workspace" })),
      onProgress: () => () => undefined,
    },
    assets: {
      listPaths: vi.fn(async () => []), selectImage, selectSingleImage: vi.fn(),
      selectVideo: vi.fn(), delete: vi.fn(),
    },
    fonts: { importFile: vi.fn(), downloadGoogleFont: vi.fn(), copySystemFont: vi.fn(), deleteFont: vi.fn() },
    mediaSearch: { downloadAndImport: vi.fn() },
    readProject: () => {
      if (snapshotError !== null) throw snapshotError;
      return { project: data, currentPageId: "home", blocks: [], customCss: "" };
    },
    installProject: vi.fn(), closeProject: vi.fn(), markSaved: vi.fn(), markDirty: vi.fn(), notify: vi.fn(),
    subscribeRendererEdits: (listener) => { edit = listener; return () => undefined; },
    chooseDirtyTransition: () => choice,
  };
  return {
    commands: createProjectCommands(dependencies),
    save,
    load,
    newProject,
    close,
    edit: () => edit(),
    setSnapshotError: (error: Error | null) => { snapshotError = error; },
  };
};

describe("project autosave and dirty transitions", () => {
  it("does not write a clean project on an autosave tick", async () => {
    const test = setup();
    await test.commands.openProject();
    await test.commands.autosave();
    expect(test.save).not.toHaveBeenCalled();
  });

  it("keeps the current dirty session when opening is canceled", async () => {
    const test = setup("cancel");
    await test.commands.openProject();
    test.edit();
    const result = await test.commands.openProject();
    expect(result).toMatchObject({ ok: false, canceled: true });
    expect(test.load).toHaveBeenCalledTimes(2);
    expect(test.commands.state.session?.sessionId).toBe(SESSION);
    expect(test.commands.state.dirty).toBe(true);
  });

  it("saves the exact dirty generation before replacing the session", async () => {
    const test = setup("save");
    await test.commands.openProject();
    test.edit();
    const result = await test.commands.openProject();
    expect(result.ok).toBe(true);
    expect(test.save).toHaveBeenCalledWith(expect.objectContaining({ rendererGeneration: 1, expectedSessionId: SESSION }));
    expect(test.load).toHaveBeenCalledTimes(2);
  });

  it("discards explicitly before New and aborts replacement when Save fails", async () => {
    const discarded = setup("discard");
    await discarded.commands.openProject();
    discarded.edit();
    expect((await discarded.commands.newProject({ name: "Next", framework: "vanilla" })).ok).toBe(true);
    expect(discarded.save).not.toHaveBeenCalled();
    expect(discarded.newProject).toHaveBeenCalledTimes(1);

    const failed = setup("save");
    await failed.commands.openProject();
    failed.edit();
    failed.save.mockResolvedValueOnce({ success: false, error: { code: "INTERNAL", message: "disk full" } });
    expect((await failed.commands.openProject()).ok).toBe(false);
    expect(failed.load).toHaveBeenCalledTimes(2);
    expect(failed.commands.state.dirty).toBe(true);
  });

  it("propagates close choices and autosaves a workspace-only mutation", async () => {
    const canceled = setup("cancel");
    await canceled.commands.openProject();
    canceled.edit();
    expect(await canceled.commands.close()).toMatchObject({ ok: false, canceled: true });
    expect(canceled.close).toHaveBeenCalledTimes(1);

    const saved = setup("save");
    await saved.commands.openProject();
    expect((await saved.commands.selectImages()).ok).toBe(true);
    expect(saved.commands.state.dirty).toBe(true);
    expect((await saved.commands.autosave()).ok).toBe(true);
    expect(saved.save).toHaveBeenCalledWith(expect.objectContaining({ expectedSessionId: SESSION }));
    expect(saved.commands.state.dirty).toBe(false);
  });

  it("recovers after a snapshot failure and ignores autosave after close", async () => {
    const test = setup("discard");
    await test.commands.openProject();
    test.edit();
    test.setSnapshotError(new Error("snapshot unavailable"));
    expect((await test.commands.autosave()).ok).toBe(false);
    expect(test.commands.state.dirty).toBe(true);
    expect(test.save).not.toHaveBeenCalled();

    test.setSnapshotError(null);
    expect((await test.commands.autosave()).ok).toBe(true);
    expect(test.save).toHaveBeenCalledTimes(1);
    test.edit();
    expect((await test.commands.close()).ok).toBe(true);
    expect(test.close).toHaveBeenCalledWith(expect.objectContaining({ dirtyChoice: "discard" }));
    expect((await test.commands.autosave()).ok).toBe(false);
    expect(test.save).toHaveBeenCalledTimes(1);
  });

  it("passes Save and Discard choices through close and keeps failed Save sessions active", async () => {
    const saved = setup("save");
    await saved.commands.openProject();
    saved.edit();
    expect((await saved.commands.close()).ok).toBe(true);
    expect(saved.close).toHaveBeenCalledWith(expect.objectContaining({
      dirtyChoice: "save",
      rendererGeneration: 1,
      expectedSessionId: SESSION,
    }));

    const discarded = setup("discard");
    await discarded.commands.openProject();
    discarded.edit();
    expect((await discarded.commands.close()).ok).toBe(true);
    expect(discarded.close).toHaveBeenCalledWith(expect.objectContaining({ dirtyChoice: "discard" }));

    const failed = setup("save");
    await failed.commands.openProject();
    failed.edit();
    failed.close.mockResolvedValueOnce({ success: false, error: { code: "INTERNAL", message: "disk full" } });
    expect((await failed.commands.close()).ok).toBe(false);
    expect(failed.commands.state.session?.sessionId).toBe(SESSION);
    expect(failed.commands.state.dirty).toBe(true);
  });
});
