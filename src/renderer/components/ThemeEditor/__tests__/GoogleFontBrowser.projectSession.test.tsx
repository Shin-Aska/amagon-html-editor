import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectStore } from "../../../store/projectStore";
import GoogleFontBrowser from "../GoogleFontBrowser";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const commands = vi.hoisted(() => ({
  downloadGoogleFont: vi.fn(async () => ({ ok: true, value: [] })),
}));

vi.mock("../../../project/projectCommands", () => ({ projectCommands: commands }));

describe("GoogleFontBrowser project session", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    commands.downloadGoogleFont.mockClear();
    useProjectStore.setState({ fonts: [] });
    Reflect.defineProperty(window, "api", { configurable: true, value: { fonts: {
      fetchGoogleFontCss: async () => ({ success: false, css: "" }),
      fetchGoogleFontFile: async () => ({ success: false, dataUri: "" }),
    } } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<GoogleFontBrowser />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(window, "api");
  });

  it("downloads selected Google Font variants through the active project session", async () => {
    const chooseFont = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.title?.startsWith("Download "));
    await act(async () => chooseFont?.click());
    const confirm = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.startsWith("Download 1 styles"));

    await act(async () => confirm?.click());

    expect(commands.downloadGoogleFont).toHaveBeenCalledOnce();
  });
});
