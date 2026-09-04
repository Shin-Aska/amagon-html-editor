import { describe, expect, it, vi } from "vitest";
import {
  parseProjectSessionId,
  parseRendererGeneration,
  parseWorkspaceGeneration,
  type AssetInfo,
  type MutationResult,
  type ProjectProgress,
  type ProjectSession,
} from "../../shared/projects/projectIpcContract";
import { ProjectDocumentV1Schema } from "../../shared/projects/projectDocumentSchema";
import { createDefaultTheme, type ProjectData } from "../store/types";
import {
  createProjectCommands,
  type ProjectCommandDependencies,
} from "./projectCommands";
import { createLegacyBrowserProjectBridge, mergeRuntimeAssetPaths } from "./projectCommandRuntime";

const SESSION = parseProjectSessionId("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");

const project = (src = ""): ProjectData => ({
  customCss: "",
  projectSettings: {
    name: "Commands",
    framework: "vanilla",
    theme: createDefaultTheme(),
    globalStyles: {},
  },
  pages: [{
    id: "home",
    title: "Home",
    slug: "index",
    blocks: [{ id: "image", type: "image", props: { src }, styles: {}, classes: [], children: [] }],
    meta: {},
  }],
  userBlocks: [],
});

const session = (
  data: ProjectData,
  renderer = 0,
  workspace = 0,
): ProjectSession => ({
  sessionId: SESSION,
  kind: "amg",
  displayPath: "C:\\Projects\\commands.amg",
  data: ProjectDocumentV1Schema.parse({ ...data, projectSchemaVersion: 1 }),
  committedRendererGeneration: parseRendererGeneration(renderer),
  committedWorkspaceGeneration: parseWorkspaceGeneration(workspace),
  dirty: false,
});

type Harness = {
  readonly commands: ReturnType<typeof createProjectCommands>;
  readonly edits: () => void;
  readonly progress: (value: ProjectProgress) => void;
  readonly installed: ProjectData[];
  readonly markedSaved: ReturnType<typeof vi.fn>;
  readonly close: ReturnType<typeof vi.fn>;
  readonly listPaths: ReturnType<typeof vi.fn>;
  readonly load: ReturnType<typeof vi.fn>;
  readonly save: ReturnType<typeof vi.fn>;
  readonly selectImage: ReturnType<typeof vi.fn>;
};

const harness = (initial = project()): Harness => {
  let editListener: () => void = () => undefined;
  let progressListener: (value: ProjectProgress) => void = () => undefined;
  const installed: ProjectData[] = [];
  const markedSaved = vi.fn();
  const listPaths = vi.fn(async () => [] as readonly string[]);
  const load = vi.fn(async () => ({ success: true as const, session: session(initial) }));
  const close = vi.fn(async () => ({ success: true as const, ...session(initial) }));
  const save = vi.fn(async () => ({ success: true as const, session: session(initial, 1, 0) }));
  const selectImage = vi.fn<() => Promise<MutationResult<readonly AssetInfo[]>>>(async () => ({
    success: true,
    sessionId: SESSION,
    workspaceGeneration: parseWorkspaceGeneration(1),
    changed: true,
    value: [{ name: "hero.png", path: "runtime-hero", relativePath: "images/hero.png", type: "image" }],
  }));
  const dependencies: ProjectCommandDependencies = {
    project: {
      save,
      saveAs: save,
      load,
      openRecent: vi.fn(async () => ({ success: true as const, session: session(initial) })),
      removeRecent: vi.fn(async (recentId) => ({ success: true as const, removedId: recentId })),
      new: vi.fn(async () => ({ success: true as const, session: session(initial) })),
      close,
      getRecent: vi.fn(async () => ({ success: true as const, projects: [] })),
      getDir: vi.fn(async () => ({ success: true as const, directory: "C:\\workspace" })),
      onProgress: (callback) => {
        progressListener = callback;
        return () => undefined;
      },
    },
    assets: {
      listPaths,
      selectImage,
      selectSingleImage: vi.fn(),
      selectVideo: vi.fn(),
      delete: vi.fn(),
      import: vi.fn(),
    },
    fonts: {
      importFile: vi.fn(),
      downloadGoogleFont: vi.fn(),
      copySystemFont: vi.fn(),
      deleteFont: vi.fn(),
    },
    mediaSearch: { downloadAndImport: vi.fn() },
    readProject: () => ({
      project: initial,
      currentPageId: "home",
      blocks: initial.pages[0]?.blocks ?? [],
      customCss: initial.customCss,
    }),
    installProject: (data) => installed.push(data),
    closeProject: vi.fn(),
    markSaved: markedSaved,
    markDirty: vi.fn(),
    subscribeRendererEdits: (listener) => {
      editListener = listener;
      return () => undefined;
    },
    notify: vi.fn(),
  };
  return {
    commands: createProjectCommands(dependencies),
    edits: () => editListener(),
    progress: (value) => progressListener(value),
    installed,
    markedSaved,
    close,
    listPaths,
    load,
    save,
    selectImage,
  };
};

describe("project commands", () => {
  it("merges canonical font paths into the runtime portability inventory", () => {
    expect(mergeRuntimeAssetPaths(
      { success: true, assets: [{ relativePath: "assets/hero.png" }] },
      { success: true, fonts: [{ relativePath: "assets/fonts/body.woff2" }, { relativePath: "assets/hero.png" }] },
    )).toEqual(["assets/fonts/body.woff2", "assets/hero.png"]);
    expect(mergeRuntimeAssetPaths(
      { success: false, assets: [{ relativePath: "assets/ignored.png" }] },
      { success: false, fonts: [{ relativePath: "assets/fonts/ignored.woff2" }] },
    )).toEqual([]);
  });

  it("installs a loaded project only after main confirms activation", async () => {
    const test = harness();

    const outcome = await test.commands.openProject();

    expect(outcome.ok).toBe(true);
    expect(test.installed).toHaveLength(1);
    expect(test.commands.state.session?.sessionId).toBe(SESSION);
  });

  it("keeps an edit made during save dirty instead of marking a stale snapshot clean", async () => {
    const test = harness();
    await test.commands.openProject();
    test.markedSaved.mockClear();
    test.edits();
    let resolveSave: ((value: { readonly success: true; readonly session: ProjectSession }) => void) | undefined;
    test.save.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));

    const saving = test.commands.save();
    test.edits();
    resolveSave?.({ success: true, session: session(project(), 1, 0) });
    await saving;

    expect(test.commands.state.dirty).toBe(true);
    expect(test.markedSaved).not.toHaveBeenCalled();
  });

  it("records a workspace-only mutation as dirty and autosaves its generation", async () => {
    const test = harness();
    await test.commands.openProject();

    const mutation = await test.commands.selectImages();
    expect(mutation.ok).toBe(true);
    expect(test.commands.state.dirty).toBe(true);

    test.save.mockResolvedValueOnce({ success: true, session: session(project(), 0, 1) });
    await test.commands.autosave();

    expect(test.commands.state.dirty).toBe(false);
    expect(test.selectImage).toHaveBeenCalledWith({ expectedSessionId: SESSION });
    expect(test.save.mock.calls[0]?.[0]).toEqual({
      expectedSessionId: SESSION,
      rendererGeneration: 0,
      snapshot: expect.any(Object),
    });
  });

  it("reports structured portability locations and preserves dirty state", async () => {
    const source = project();
    const test = harness(source);
    await test.commands.openProject();
    const image = source.pages[0]?.blocks[0];
    if (image !== undefined) Reflect.set(image.props, "src", "blob:ephemeral");
    test.edits();

    const outcome = await test.commands.save();

    expect(outcome.ok).toBe(false);
    expect(test.commands.state.message?.locations).toContain("$.pages[0].blocks[0].props.src");
    expect(test.commands.state.dirty).toBe(true);
    expect(test.save).not.toHaveBeenCalled();
  });

  it("publishes busy progress without allowing a duplicate active operation", async () => {
    const test = harness();
    await test.commands.openProject();

    test.progress({ operation: "save", phase: "writing", completed: 2, total: 4, busy: true });

    expect(test.commands.state.progress).toMatchObject({ phase: "writing", completed: 2 });
    expect(test.commands.state.busy).toBe("save");
  });

  it("preserves the active project and renders capacity failures from main", async () => {
    const test = harness();
    await test.commands.openProject();
    test.load.mockResolvedValueOnce({
      success: false,
      error: { code: "ARCHIVE_LIMIT_EXCEEDED", message: "Archive expands beyond the configured limit." },
    });

    const outcome = await test.commands.openProject();

    expect(outcome.ok).toBe(false);
    expect(test.installed).toHaveLength(1);
    expect(test.commands.state.session?.sessionId).toBe(SESSION);
    expect(test.commands.state.message).toMatchObject({ title: "Project exceeds safe capacity" });
  });

  it("keeps partial workspace mutations dirty and reports failed items", async () => {
    const test = harness();
    await test.commands.openProject();
    test.selectImage.mockResolvedValueOnce({
      success: false,
      sessionId: SESSION,
      workspaceGeneration: parseWorkspaceGeneration(1),
      changed: true,
      error: {
        code: "PARTIAL_MUTATION",
        message: "One of two files failed.",
        completedItems: ["images/hero.png"],
        failedItems: ["images/broken.png"],
      },
    });

    const outcome = await test.commands.selectImages();

    expect(outcome.ok).toBe(false);
    expect(test.commands.state.dirty).toBe(true);
    expect(test.commands.state.message?.locations).toEqual(["images/broken.png"]);
  });

  it("rejects duplicate mutations while the first operation is active", async () => {
    const test = harness();
    await test.commands.openProject();
    let resolveMutation: ((value: MutationResult<readonly AssetInfo[]>) => void) | undefined;
    test.selectImage.mockImplementationOnce(() => new Promise((resolve) => { resolveMutation = resolve; }));

    const first = test.commands.selectImages();
    const duplicate = await test.commands.selectImages();
    resolveMutation?.({
      success: true,
      sessionId: SESSION,
      workspaceGeneration: parseWorkspaceGeneration(1),
      changed: true,
      value: [],
    });
    await first;

    expect(duplicate.ok).toBe(false);
    expect(test.selectImage).toHaveBeenCalledOnce();
  });

  it("carries an import-only workspace generation through close and reopen", async () => {
    const test = harness();
    await test.commands.openProject();
    await test.commands.selectImages();

    const closed = await test.commands.close("save");
    test.load.mockResolvedValueOnce({ success: true, session: session(project(), 0, 1) });
    const reopened = await test.commands.openProject();

    expect(closed.ok).toBe(true);
    expect(reopened.ok).toBe(true);
    expect(test.close).toHaveBeenCalledWith(expect.objectContaining({ dirtyChoice: "save" }));
    expect(test.listPaths).toHaveBeenCalledTimes(3);
    expect(test.commands.state.dirty).toBe(false);
  });

  it.each(["new", "open"] as const)("keeps browser %s and Save on the canonical legacy JSON session", async (activation) => {
    const initial = project();
    const { customCss: _omittedCustomCss, ...withoutCustomCss } = initial;
    const legacyContent = activation === "new"
      ? withoutCustomCss
      : { ...initial, customCss: "body { color: rebeccapurple; }" };
    const legacy = {
      new: vi.fn(async () => ({ success: true as const, content: legacyContent, filePath: "browser-project.json" })),
      load: vi.fn(async () => ({ success: true as const, content: legacyContent, filePath: "browser-project.json" })),
      save: vi.fn(async (_request: { readonly filePath?: string; readonly content: string }) => ({ success: true as const, filePath: "browser-project.json" })),
      saveAs: vi.fn(async (_request: { readonly content: string }) => ({ success: true as const, filePath: "browser-copy.json" })),
    };
    const bridge = createLegacyBrowserProjectBridge(legacy);
    let runtimeProject = initial;
    const commands = createProjectCommands({
      project: bridge,
      assets: {
        listPaths: async () => [], selectImage: vi.fn(), selectSingleImage: vi.fn(), selectVideo: vi.fn(), delete: vi.fn(), import: vi.fn(),
      },
      fonts: { importFile: vi.fn(), downloadGoogleFont: vi.fn(), copySystemFont: vi.fn(), deleteFont: vi.fn() },
      mediaSearch: { downloadAndImport: vi.fn() },
      readProject: () => ({ project: runtimeProject, currentPageId: "home", blocks: runtimeProject.pages[0]?.blocks ?? [], customCss: runtimeProject.customCss }),
      installProject: (installed) => { runtimeProject = installed; }, closeProject: vi.fn(), markSaved: vi.fn(), markDirty: vi.fn(),
      subscribeRendererEdits: () => () => undefined,
      notify: vi.fn(),
    });

    const activated = activation === "new"
      ? await commands.newProject({ name: "Browser", framework: "vanilla" })
      : await commands.openProject();
    const saved = await commands.save();

    expect(activated.ok).toBe(true);
    expect(saved.ok).toBe(true);
    expect(commands.state.session?.kind).toBe("legacy-json");
    const serialized = legacy.save.mock.calls[0]?.[0]?.content;
    expect(serialized).toBeTypeOf("string");
    const savedDocument = JSON.parse(serialized ?? "{}");
    expect(savedDocument).not.toHaveProperty("projectSchemaVersion");
    expect(savedDocument.customCss).toBe(activation === "new" ? "" : "body { color: rebeccapurple; }");
  });
});
