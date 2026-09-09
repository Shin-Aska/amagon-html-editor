import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Toolbar from "../Toolbar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const commands = vi.hoisted(() => ({
  autosave: vi.fn(async () => ({ ok: true, value: undefined })),
  openProject: vi.fn(async () => ({ ok: true, value: undefined })),
  save: vi.fn(async () => ({ ok: true, value: undefined })),
}));
const commandState = vi.hoisted(() => ({ busy: null as string | null }));

vi.mock("../../../project/projectCommands", () => ({
  projectCommands: commands,
  useProjectCommandState: () => ({ session: null, busy: commandState.busy, progress: null, dirty: false, message: null }),
}));
vi.mock("../../../utils/api", () => ({
  getApi: () => ({ autosave: { onTick: () => () => undefined } }),
}));

describe("Toolbar project commands", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    commandState.busy = null;
    commands.openProject.mockClear();
    commands.save.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <Toolbar
        leftPanelOpen
        rightPanelOpen
        codeEditorOpen={false}
        editorLayout="standard"
        onToggleLeftPanel={() => undefined}
        onToggleRightPanel={() => undefined}
        onToggleCodeEditor={() => undefined}
        onSetEditorLayout={() => undefined}
        onOpenThemeEditor={() => undefined}
        onOpenPublish={() => undefined}
        onOpenKeyboardShortcuts={() => undefined}
      />,
    ));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("routes toolbar Save and Open clicks through the canonical controller", async () => {
    const save = container.querySelector<HTMLButtonElement>('button[aria-label="Save project"]');
    const open = container.querySelector<HTMLButtonElement>('button[aria-label="Open existing project"]');
    expect(save).not.toBeNull();
    expect(open).not.toBeNull();

    await act(async () => {
      save?.click();
      open?.click();
    });
    await vi.waitFor(() => expect(commands.save).toHaveBeenCalledOnce());

    expect(commands.openProject).toHaveBeenCalledOnce();
  });

  it("disables New, Open, and Save while a canonical project command is busy", async () => {
    commandState.busy = "save";
    await act(async () => root.render(
      <Toolbar
        leftPanelOpen
        rightPanelOpen
        codeEditorOpen={false}
        editorLayout="standard"
        onToggleLeftPanel={() => undefined}
        onToggleRightPanel={() => undefined}
        onToggleCodeEditor={() => undefined}
        onSetEditorLayout={() => undefined}
        onOpenThemeEditor={() => undefined}
        onOpenPublish={() => undefined}
        onOpenKeyboardShortcuts={() => undefined}
      />,
    ));

    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Create new project"]')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Open existing project"]')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Save project"]')?.disabled).toBe(true);
  });
});
