import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectStore } from "../../../store/projectStore";
import FontManager from "../FontManager";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const commands = vi.hoisted(() => ({
  copySystemFont: vi.fn(),
  deleteFont: vi.fn(),
  downloadGoogleFont: vi.fn(),
  importFonts: vi.fn(async () => ({ ok: true, value: [{
    id: "font-1",
    name: "Fixture Font",
    fileName: "fixture.woff2",
    relativePath: "fonts/fixture.woff2",
    format: "woff2",
    source: "imported",
  }] })),
}));

vi.mock("../../../project/projectCommands", () => ({ projectCommands: commands }));

describe("FontManager project session", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    commands.importFonts.mockClear();
    useProjectStore.setState({ fonts: [], systemFonts: [] });
    Reflect.defineProperty(window, "api", { configurable: true, value: { fonts: {
      checkFileExists: async () => ({ exists: false }),
      listSystem: async () => ({ success: true, fonts: [] }),
      fetchGoogleFontCss: async () => ({ success: false, css: "" }),
      fetchGoogleFontFile: async () => ({ success: false, dataUri: "" }),
    } } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(
      <FontManager
        typography={{ fontFamily: "sans-serif", headingFontFamily: "sans-serif", baseFontSize: "16px", lineHeight: "1.5", headingLineHeight: "1.2" }}
        onTypographyChange={() => undefined}
      />,
    ));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(window, "api");
  });

  it("imports font files through the session-aware controller before updating project metadata", async () => {
    const importButton = [...container.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.includes("Import Font File"));

    await act(async () => importButton?.click());

    expect(commands.importFonts).toHaveBeenCalledOnce();
    expect(useProjectStore.getState().fonts.map((font) => font.id)).toContain("font-1");
  });
});
