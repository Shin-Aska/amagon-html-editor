import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseMediaDownloadId, type MediaDownloadId } from "../../../../shared/projects/projectIpcContract";
import AssetPicker from "../AssetPicker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const commands = vi.hoisted(() => ({
  downloadMedia: vi.fn(async (downloadId: MediaDownloadId) => ({
    ok: true,
    value: { name: "remote.png", path: `runtime:${downloadId}`, relativePath: "images/remote.png", type: "image" },
  })),
}));
const api = vi.hoisted(() => ({ assets: { list: vi.fn(async () => ({ success: true, assets: [] })) } }));

vi.mock("../../../project/projectCommands", () => ({ projectCommands: commands }));
vi.mock("../../../utils/api", () => ({
  getApi: () => api,
}));
vi.mock("../MediaSearchPanel", () => ({
  default: ({ onSelect }: { readonly onSelect: (items: readonly { readonly downloadId: MediaDownloadId }[]) => void }) => (
    <button onClick={() => onSelect([{ downloadId: parseMediaDownloadId("A".repeat(43)) }])}>Choose web media</button>
  ),
}));

describe("AssetPicker project session", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    commands.downloadMedia.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <AssetPicker mode="single-image" onSelect={() => undefined} onCancel={() => undefined} />,
    ));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("downloads web media through the active project session", async () => {
    const webTab = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Web Search");
    await act(async () => webTab?.click());
    const choose = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent === "Choose web media");

    await act(async () => choose?.click());

    expect(commands.downloadMedia).toHaveBeenCalledWith(parseMediaDownloadId("A".repeat(43)));
  });
});
