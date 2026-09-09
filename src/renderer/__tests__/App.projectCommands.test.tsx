import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectStore } from "../store/projectStore";
import App from "../App";
import type { MenuAction } from "../../shared/menuContract";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const commandMocks = vi.hoisted(() => ({
  close: vi.fn(async () => ({ ok: true, value: undefined })),
  openProject: vi.fn(async () => ({ ok: true, value: undefined })),
  save: vi.fn(async () => ({ ok: true, value: undefined })),
  saveAs: vi.fn(async () => ({ ok: true, value: undefined })),
}));
const testBridge = vi.hoisted(() => {
  const state: { action: (value: MenuAction) => void } = { action: () => undefined };
  const api = {
    menu: {
      setProjectLoaded: async () => undefined,
      onAction: (callback: (action: MenuAction) => void) => {
        state.action = callback;
        return () => undefined;
      },
    },
    publish: {
      getProviders: async () => [],
      getCredentials: async () => ({}),
      saveCredentials: async () => ({ success: true }),
      deleteCredentials: async () => ({ success: true }),
      validate: async () => ({ ok: true, issues: [] }),
      publish: async () => ({ success: true, warnings: [] }),
      onProgress: () => () => undefined,
      offProgress: () => undefined,
    },
  } satisfies Pick<ElectronApi, "menu" | "publish">;

  return { api, state };
});
const commandState = vi.hoisted(() => ({
  busy: null as string | null,
  progress: null as null | { busy: boolean; operation: string; phase: string; completed?: number; total?: number },
  message: null as null | { tone: string; title: string; detail: string; locations: string[] },
}));

vi.mock("../project/projectCommands", () => ({
  projectCommands: commandMocks,
  useProjectCommandState: () => ({ session: null, dirty: false, ...commandState }),
}));
vi.mock("../utils/api", () => ({
  getApi: () => testBridge.api,
}));
vi.mock("../components/WelcomeScreen/WelcomeScreen", () => ({ default: () => <div>Welcome</div> }));

describe("App project commands", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    commandState.busy = null;
    commandState.progress = null;
    commandState.message = null;
    commandMocks.close.mockClear();
    commandMocks.openProject.mockClear();
    commandMocks.save.mockClear();
    commandMocks.saveAs.mockClear();
    useProjectStore.setState({ isProjectLoaded: false });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<App />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("routes Electron menu save, open, and close through the canonical controller", async () => {
    await act(async () => {
      testBridge.state.action("save");
      testBridge.state.action("save-as");
      testBridge.state.action("open-project");
      testBridge.state.action("close-project");
    });

    await vi.waitFor(() => expect(commandMocks.save).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(commandMocks.saveAs).toHaveBeenCalledOnce());
    expect(commandMocks.openProject).toHaveBeenCalledOnce();
    expect(commandMocks.close).toHaveBeenCalledOnce();
  });

  it("renders busy progress and structured errors in the viewport notification layer", async () => {
    commandState.busy = "open";
    commandState.progress = { busy: true, operation: "open", phase: "extract", completed: 3, total: 8 };
    commandState.message = {
      tone: "error",
      title: "Portable project blocked",
      detail: "Resolve the listed durable references before retrying.",
      locations: ["pages/home/blocks/hero/backgroundImage"],
    };
    await act(async () => root.render(<App />));

    const layer = container.querySelector(".project-command-feedback");
    expect(layer).not.toBeNull();
    expect(layer?.querySelector('[role="status"]')?.textContent).toContain("3/8");
    expect(layer?.querySelector('[role="alert"]')?.textContent).toContain("pages/home/blocks/hero/backgroundImage");
  });
});
