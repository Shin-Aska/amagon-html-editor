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

const harness = (initial = project(), overrides: Partial<ProjectCommandDependencies> = {}): Harness => {
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
      repairMissing: vi.fn(),
      listPaths,
      selectImage,
      selectSingleImage: vi.fn(),
      selectVideo: vi.fn(),
      delete: vi.fn(),
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
    commands: createProjectCommands({...dependencies, ...overrides}),
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
  it('pauses autosave and project transitions while the unused asset review is open', async () => {
    let finish: (value: boolean) => void = () => undefined;
    const prepareAssetCleanup = vi.fn(() => new Promise<boolean>(resolve => {finish = resolve;}));
    const test = harness(project(), {prepareAssetCleanup});
    await test.commands.openProject();
    test.edits();
    const reviewing = test.commands.reviewUnusedAssets();
    expect((await test.commands.autosave()).ok).toBe(true);
    expect(test.save).not.toHaveBeenCalled();
    expect((await test.commands.openProject()).ok).toBe(false);
    expect((await test.commands.close('discard')).ok).toBe(false);
    finish(false);
    expect((await reviewing).ok).toBe(true);
    expect(test.commands.state.dirty).toBe(true);
  });

  it('removes unused missing font metadata and restores it on Undo without losing renderer edits', async () => {
    let current = project();
    current.projectSettings.fonts = [{id: 'unused', name: 'Unapplied', fileName: 'unapplied.woff2', relativePath: 'assets/fonts/unapplied.woff2', format: 'woff2', source: 'imported'}];
    const font = current.projectSettings.fonts[0];
    const setFonts = vi.fn((fonts: NonNullable<ProjectData['projectSettings']['fonts']>) => {current = {...current, projectSettings: {...current.projectSettings, fonts}}; test.edits();});
    const cleanupUnused = vi.fn(async () => ({success: true as const, changed: false, sessionId: SESSION, workspaceGeneration: parseWorkspaceGeneration(0), value: {token: 'cleanup', paths: [], fontIds: ['unused'], failed: []}}));
    const undoCleanup = vi.fn(async () => ({success: true as const, changed: false, sessionId: SESSION, workspaceGeneration: parseWorkspaceGeneration(0), value: {paths: [], fontIds: ['unused'], remaining: 0}}));
    const test = harness(current, {readProject: () => ({project: current, currentPageId: 'home', blocks: current.pages[0]?.blocks ?? [], customCss: current.customCss}), setFonts, maintenance: {repairMany: vi.fn(), cleanupUnused, undoCleanup}});
    test.load.mockResolvedValueOnce({success: true, session: {...session(current), kind: 'legacy-json', displayPath: 'legacy.json'}});
    await test.commands.openProject();
    expect((await test.commands.inspectUnusedAssets()).candidates.map(item => item.kind)).toEqual(['missing-entry']);
    expect((await test.commands.cleanupAssets(['missing:assets/fonts/unapplied.woff2'])).ok).toBe(true);
    expect(current.projectSettings.fonts).toEqual([]);
    expect(test.commands.state.dirty).toBe(true);
    expect(test.commands.hasAssetCleanup()).toBe(true);
    expect((await test.commands.undoAssetCleanup()).ok).toBe(true);
    expect(current.projectSettings.fonts).toEqual([font]);
    expect(test.commands.hasAssetCleanup()).toBe(false);
  });

  it("converts a repaired legacy project on manual Save and installs its new AMG session", async () => {
    const prepareLegacyConversion = vi.fn(async () => true);
    const test = harness(project(), {prepareLegacyConversion});
    test.load.mockResolvedValueOnce({success: true, session: {...session(project()), kind: "legacy-json", displayPath: "legacy.json"}});
    await test.commands.openProject();
    test.edits();
    expect((await test.commands.save()).ok).toBe(true);
    expect(prepareLegacyConversion).toHaveBeenCalledOnce();
    expect(test.commands.state.session?.kind).toBe("amg");
    expect(test.installed).toHaveLength(2);
  });

  it("converts after a legacy autosave has committed imported asset changes", async () => {
    const test = harness(project(), {prepareLegacyConversion: async () => true});
    test.load.mockResolvedValueOnce({success: true, session: {...session(project(), 0, 0), kind: "legacy-json"}});
    await test.commands.openProject();
    await test.commands.selectImages();
    test.save.mockResolvedValueOnce({success: true, session: {...session(project(), 0, 1), kind: "legacy-json"}});
    expect((await test.commands.autosave()).ok).toBe(true);
    const nextId = parseProjectSessionId("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
    test.save.mockResolvedValueOnce({success: true, session: {...session(project(), 0, 0), sessionId: nextId}});
    const converted = await test.commands.save();
    expect(converted).toEqual({ok: true, value: undefined});
    expect(test.commands.state.session?.sessionId).toBe(nextId);
    expect(test.commands.state.session?.kind).toBe("amg");
    expect(test.commands.state.dirty).toBe(false);
  });

  it("keeps edits and the legacy session when conversion is canceled", async () => {
    const test = harness(project(), {prepareLegacyConversion: async () => false});
    test.load.mockResolvedValueOnce({success: true, session: {...session(project()), kind: "legacy-json"}});
    await test.commands.openProject();
    test.edits();
    expect(await test.commands.save()).toMatchObject({ok: false, canceled: true});
    expect(test.save).not.toHaveBeenCalled();
    expect(test.commands.state.session?.kind).toBe("legacy-json");
    expect(test.commands.state.dirty).toBe(true);
  });

  it("allows repairs but suppresses autosave and session switches while the dialog is pending", async () => {
    let proceed: (result: boolean) => void = () => undefined;
    const test = harness(project(), {prepareLegacyConversion: () => new Promise(resolve => {proceed = resolve;})});
    test.load.mockResolvedValueOnce({success: true, session: {...session(project()), kind: "legacy-json"}});
    await test.commands.openProject();
    test.edits();
    const pending = test.commands.save();
    expect((await test.commands.autosave()).ok).toBe(true);
    expect((await test.commands.close("discard")).ok).toBe(false);
    expect((await test.commands.openProject()).ok).toBe(false);
    expect((await test.commands.selectImages()).ok).toBe(true);
    expect(test.save).not.toHaveBeenCalled();
    proceed(false);
    await pending;
  });

  it("rechecks assets restored outside the application before conversion", async () => {
    const test = harness(project("app-media://project-asset/assets/Missing Image.png"));
    test.load.mockResolvedValueOnce({success: true, session: {...session(project("app-media://project-asset/assets/Missing Image.png")), kind: "legacy-json"}});
    await test.commands.openProject();
    expect(await test.commands.inspectConversion()).toMatchObject({ok: false, offenders: [{code: "missing-asset", reference: "assets/Missing Image.png"}]});
    test.listPaths.mockResolvedValue(["assets/Missing Image.png"]);
    expect((await test.commands.inspectConversion()).ok).toBe(true);
  });

  it("keeps the project open when closing with Save cancels conversion", async () => {
    const test = harness(project(), {prepareLegacyConversion: async () => false});
    test.load.mockResolvedValueOnce({success: true, session: {...session(project()), kind: "legacy-json"}});
    await test.commands.openProject();
    test.edits();
    expect(await test.commands.close("save")).toMatchObject({ok: false, canceled: true});
    expect(test.close).not.toHaveBeenCalled();
    expect(test.commands.state.dirty).toBe(true);
  });

  it("installs legacy projects with missing assets and reports the filenames", async () => {
    const initial = project("app-media://project-asset/assets/Absent Image.png");
    const test = harness(initial);
    test.load.mockResolvedValueOnce({ success: true, session: { ...session(initial), kind: "legacy-json" } });
    expect((await test.commands.openProject()).ok).toBe(true);
    expect(test.installed).toHaveLength(1);
    expect(test.commands.state.message).toMatchObject({
      tone: "info", title: "Project opened with missing assets",
      persistent: true,
      detail: expect.stringContaining("assets/Absent Image.png"),
    });
    test.edits();
    expect((await test.commands.save()).ok).toBe(true);
    expect(test.save).toHaveBeenCalledOnce();
    expect((await test.commands.saveAs()).ok).toBe(false);
    expect(test.save).toHaveBeenCalledOnce();
  });

  it('keeps the opening notice bounded for 10,000 missing assets', async () => {
    const initial = project();
    const block = initial.pages[0]?.blocks[0];
    if (!block) throw new Error('Missing fixture block');
    block.props.images = Array.from({length: 10000}, (_, index) => `assets/missing-${index}.png`);
    const test = harness(initial);
    test.load.mockResolvedValueOnce({success: true, session: {...session(initial), kind: 'legacy-json'}});
    expect((await test.commands.openProject()).ok).toBe(true);
    expect(test.commands.state.message?.detail).toContain('10,000 missing assets');
    expect(test.commands.state.message?.detail.length).toBeLessThan(1000);
    const inspection = await test.commands.inspectConversion();
    expect(inspection.ok).toBe(false);
    if (inspection.ok) throw new Error('Missing references incorrectly passed conversion');
    expect(inspection.offenders).toHaveLength(10000);
  });

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
      workspaceGeneration: 1,
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
    test.progress({operation: 'save', phase: 'cleaning', completed: 4, total: 4, busy: false});
    expect(test.commands.state.busy).toBeNull();
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
        repairMissing: vi.fn(),
        listPaths: async () => [], selectImage: vi.fn(), selectSingleImage: vi.fn(), selectVideo: vi.fn(), delete: vi.fn(),
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
