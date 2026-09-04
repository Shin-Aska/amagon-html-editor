import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AssetManager from "../AssetManager";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const commands = vi.hoisted(() => ({
  deleteAsset: vi.fn(),
  downloadMedia: vi.fn(),
  selectImages: vi.fn(async () => ({ ok: true, value: [] })),
  selectVideos: vi.fn(async () => ({ ok: true, value: [] })),
}));
const api = vi.hoisted(() => ({ assets: { list: vi.fn(async () => ({ success: true, assets: [] })) } }));

vi.mock("../../../project/projectCommands", () => ({
  projectCommands: commands,
  useProjectCommandState: () => ({ session: null, busy: null, progress: null, dirty: false, message: null }),
}));
vi.mock("../../../utils/api", () => ({
  getApi: () => api,
}));

describe("AssetManager project session", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    commands.selectImages.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<AssetManager onClose={() => undefined} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("imports images through the session-aware controller before refreshing", async () => {
    const addImages = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Add Images");

    await act(async () => addImages?.click());

    expect(commands.selectImages).toHaveBeenCalledOnce();
  });
});
