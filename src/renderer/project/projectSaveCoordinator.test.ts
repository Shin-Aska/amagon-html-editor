import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  parseProjectSessionId,
  parseRendererGeneration,
  parseWorkspaceGeneration,
  type ProjectSessionId,
  type RendererGeneration,
  type WorkspaceGeneration,
} from "../../shared/projects/projectIpcContract";
import {
  createProjectSaveCoordinator,
  type CoordinatorSaveInvocation,
  type CoordinatorSaveResponse,
  type ProjectSaveCoordinatorOptions,
} from "./projectSaveCoordinator";

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
};

const deferred = <T>(): Deferred<T> => {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};

const SESSION_A = parseProjectSessionId("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
const SESSION_B = parseProjectSessionId("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
const renderer = (value: number): RendererGeneration => parseRendererGeneration(value);
const workspace = (value: number): WorkspaceGeneration => parseWorkspaceGeneration(value);

const snapshot = {
  customCss: "",
  projectSettings: {
    name: "Coordinator fixture",
    framework: "vanilla" as const,
    theme: {
      name: "Fixture",
      colors: { primary: "", secondary: "", accent: "", background: "", surface: "", text: "", textMuted: "", border: "", success: "", warning: "", danger: "" },
      typography: { fontFamily: "", headingFontFamily: "", baseFontSize: "", lineHeight: "", headingLineHeight: "" },
      spacing: { baseUnit: "", scale: [] },
      borders: { radius: "", width: "", color: "" },
      customCss: "",
    },
    globalStyles: {},
  },
  pages: [],
  userBlocks: [],
};

const success = (
  invocation: CoordinatorSaveInvocation,
  workspaceGeneration: number,
): CoordinatorSaveResponse => ({
  success: true,
  sessionId: invocation.expectedSessionId,
  rendererGeneration: invocation.rendererGeneration,
  workspaceGeneration: workspace(workspaceGeneration),
});

describe("project save coordinator", () => {
  it("passes the canonical save kind to snapshot creation for persistence-mode routing", async () => {
    // Given
    const snapshotKinds: string[] = [];
    const coordinator = createProjectSaveCoordinator({
      sessionId: SESSION_A,
      rendererGeneration: renderer(1),
      committedRendererGeneration: renderer(0),
      workspaceGeneration: workspace(0),
      committedWorkspaceGeneration: workspace(0),
      createSnapshot: (kind) => {
        snapshotKinds.push(kind);
        return { ok: true, project: snapshot, referencedAssetPaths: [] };
      },
      executeSave: async (invocation) => success(invocation, 0),
    });

    // When
    await coordinator.requestAutosave();
    await coordinator.requestSave();
    await coordinator.requestSaveAs();

    // Then
    expect(snapshotKinds).toEqual(["autosave", "save", "save-as"]);
  });

  it("requires canonical authority types at every coordinator boundary", () => {
    // Given
    type RawSessionIsAccepted = string extends ProjectSaveCoordinatorOptions["sessionId"] ? true : false;
    type RawRendererIsAccepted = number extends ProjectSaveCoordinatorOptions["rendererGeneration"] ? true : false;
    type RawWorkspaceIsAccepted = number extends ProjectSaveCoordinatorOptions["workspaceGeneration"] ? true : false;

    // When
    const rawSessionIsAccepted: RawSessionIsAccepted = false;
    const rawRendererIsAccepted: RawRendererIsAccepted = false;
    const rawWorkspaceIsAccepted: RawWorkspaceIsAccepted = false;

    // Then
    expect(rawSessionIsAccepted).toBe(false);
    expect(rawRendererIsAccepted).toBe(false);
    expect(rawWorkspaceIsAccepted).toBe(false);
    expectTypeOf<string>().not.toMatchTypeOf<ProjectSessionId>();
    expectTypeOf<number>().not.toMatchTypeOf<RendererGeneration>();
    expectTypeOf<number>().not.toMatchTypeOf<WorkspaceGeneration>();
  });

  it("derives dirty state from renderer and partial workspace mutation generations", () => {
    // Given
    const coordinator = createProjectSaveCoordinator({
      sessionId: SESSION_A,
      rendererGeneration: renderer(2),
      committedRendererGeneration: renderer(2),
      workspaceGeneration: workspace(4),
      committedWorkspaceGeneration: workspace(4),
      createSnapshot: () => ({ ok: true, project: snapshot, referencedAssetPaths: [] }),
      executeSave: async (invocation) => success(invocation, 4),
    });
    const partial = {
      success: false,
      sessionId: SESSION_A,
      workspaceGeneration: workspace(5),
      changed: true,
      error: {
        code: "PARTIAL_MUTATION",
        message: "one file remained",
        completedItems: ["asset-a"],
        failedItems: ["asset-b"],
      },
    };

    // When
    const mutation = coordinator.recordMutation(partial);

    // Then
    expect(coordinator.state).toMatchObject({ dirty: true, workspaceGeneration: 5 });

    // When
    coordinator.recordRendererEdit(renderer(3));

    // Then
    expect(mutation.accepted).toBe(true);
    expect(coordinator.state).toMatchObject({
      dirty: true,
      rendererGeneration: 3,
      committedRendererGeneration: 2,
      workspaceGeneration: 5,
      committedWorkspaceGeneration: 4,
    });
  });

  it("rejects stale mutation observations without replacing the latest workspace generation", () => {
    // Given
    const coordinator = createProjectSaveCoordinator({
      sessionId: SESSION_A,
      rendererGeneration: renderer(0),
      committedRendererGeneration: renderer(0),
      workspaceGeneration: workspace(4),
      committedWorkspaceGeneration: workspace(4),
      createSnapshot: () => ({ ok: true, project: snapshot, referencedAssetPaths: [] }),
      executeSave: async (invocation) => success(invocation, 4),
    });

    // When
    const foreign = coordinator.recordMutation({ sessionId: SESSION_B, workspaceGeneration: workspace(6), changed: true });
    const regressed = coordinator.recordMutation({ sessionId: SESSION_A, workspaceGeneration: workspace(3), changed: true });

    // Then
    expect(foreign).toEqual({ accepted: false, code: "stale-session" });
    expect(regressed).toEqual({ accepted: false, code: "stale-workspace-generation" });
    expect(coordinator.state).toMatchObject({ dirty: false, workspaceGeneration: 4 });
  });

  it("delivers structured portability offenders without invoking persistence", async () => {
    // Given
    let saveCalls = 0;
    const coordinator = createProjectSaveCoordinator({
      sessionId: SESSION_A,
      rendererGeneration: renderer(1),
      committedRendererGeneration: renderer(0),
      workspaceGeneration: workspace(0),
      committedWorkspaceGeneration: workspace(0),
      createSnapshot: () => ({
        ok: false,
        offenders: [{ code: "external-local", location: "$.pages[0]", reference: "C:/outside.png" }],
        referencedAssetPaths: [],
      }),
      executeSave: async (invocation) => {
        saveCalls += 1;
        return success(invocation, 0);
      },
    });

    // When
    const result = await coordinator.requestSaveAs();

    // Then
    expect(result).toEqual({
      success: false,
      code: "portability",
      offenders: [{ code: "external-local", location: "$.pages[0]", reference: "C:/outside.png" }],
      referencedAssetPaths: [],
    });
    expect(saveCalls).toBe(0);
    expect(coordinator.state.dirty).toBe(true);
  });

  it("commits exact renderer and packed workspace baselines after asset-only autosave", async () => {
    // Given
    const invocations: CoordinatorSaveInvocation[] = [];
    const coordinator = createProjectSaveCoordinator({
      sessionId: SESSION_A,
      rendererGeneration: renderer(7),
      committedRendererGeneration: renderer(7),
      workspaceGeneration: workspace(10),
      committedWorkspaceGeneration: workspace(9),
      createSnapshot: () => ({ ok: true, project: snapshot, referencedAssetPaths: [] }),
      executeSave: async (invocation) => {
        invocations.push(invocation);
        return success(invocation, 10);
      },
    });

    // When
    const result = await coordinator.requestAutosave();

    // Then
    expect(result.success).toBe(true);
    expect(invocations).toHaveLength(1);
    expect(invocations[0]).toMatchObject({ expectedSessionId: SESSION_A, rendererGeneration: 7, kind: "autosave" });
    expect(coordinator.state).toMatchObject({ dirty: false, committedRendererGeneration: 7, committedWorkspaceGeneration: 10 });
  });

  it("keeps edits made during a save dirty while committing the exact saved generation", async () => {
    // Given
    const pending = deferred<CoordinatorSaveResponse>();
    const coordinator = createProjectSaveCoordinator({
      sessionId: SESSION_A,
      rendererGeneration: renderer(1),
      committedRendererGeneration: renderer(0),
      workspaceGeneration: workspace(0),
      committedWorkspaceGeneration: workspace(0),
      createSnapshot: () => ({ ok: true, project: snapshot, referencedAssetPaths: [] }),
      executeSave: () => pending.promise,
    });

    // When
    const saving = coordinator.requestSave();
    await Promise.resolve();
    coordinator.recordRendererEdit(renderer(2));
    pending.resolve({ success: true, sessionId: SESSION_A, rendererGeneration: renderer(1), workspaceGeneration: workspace(0) });
    const result = await saving;

    // Then
    expect(result.success).toBe(true);
    expect(coordinator.state).toMatchObject({ dirty: true, rendererGeneration: 2, committedRendererGeneration: 1 });
  });

  it("rejects stale session and generation responses without clearing dirty state", async () => {
    // Given
    const responses: CoordinatorSaveResponse[] = [
      { success: true, sessionId: SESSION_B, rendererGeneration: renderer(1), workspaceGeneration: workspace(2) },
      { success: true, sessionId: SESSION_A, rendererGeneration: renderer(99), workspaceGeneration: workspace(2) },
    ];
    const coordinator = createProjectSaveCoordinator({
      sessionId: SESSION_A,
      rendererGeneration: renderer(1),
      committedRendererGeneration: renderer(0),
      workspaceGeneration: workspace(2),
      committedWorkspaceGeneration: workspace(0),
      createSnapshot: () => ({ ok: true, project: snapshot, referencedAssetPaths: [] }),
      executeSave: async () => responses.shift() ?? { success: false, error: { code: "missing-response" } },
    });

    // When
    const staleSession = await coordinator.requestSave();
    const staleGeneration = await coordinator.requestSave();

    // Then
    expect(staleSession).toMatchObject({ success: false, code: "stale-session" });
    expect(staleGeneration).toMatchObject({ success: false, code: "stale-renderer-generation" });
    expect(coordinator.state).toMatchObject({ dirty: true, committedRendererGeneration: 0, committedWorkspaceGeneration: 0 });
  });

  it("keeps one save in flight, coalesces autosave ticks, and delivers a queued explicit result", async () => {
    // Given
    vi.useFakeTimers();
    const first = deferred<CoordinatorSaveResponse>();
    const invocations: CoordinatorSaveInvocation[] = [];
    const coordinator = createProjectSaveCoordinator({
      sessionId: SESSION_A,
      rendererGeneration: renderer(1),
      committedRendererGeneration: renderer(0),
      workspaceGeneration: workspace(0),
      committedWorkspaceGeneration: workspace(0),
      createSnapshot: () => ({ ok: true, project: snapshot, referencedAssetPaths: [] }),
      executeSave: (invocation) => {
        invocations.push(invocation);
        return invocations.length === 1 ? first.promise : Promise.resolve(success(invocation, 0));
      },
    });

    // When
    const active = coordinator.requestAutosave();
    await Promise.resolve();
    coordinator.recordRendererEdit(renderer(2));
    const coalescedA = coordinator.requestAutosave();
    const coalescedB = coordinator.requestAutosave();
    const explicit = coordinator.requestSaveAs();
    first.resolve({ success: true, sessionId: SESSION_A, rendererGeneration: renderer(1), workspaceGeneration: workspace(0) });
    const results = await Promise.all([active, coalescedA, coalescedB, explicit]);

    // Then
    expect(results.every((result) => result.success)).toBe(true);
    expect(invocations).toHaveLength(2);
    expect(invocations[1]).toMatchObject({ rendererGeneration: 2, kind: "save-as" });
    expect(coordinator.state.activeRendererGeneration).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
