import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleFontPreviewResult } from "../../../utils/googleFontCss";
import { InternetFontPreview } from "../InternetFontPreview";

const preview = vi.hoisted(() => ({ fetch: vi.fn<() => Promise<GoogleFontPreviewResult>>() }));
vi.mock("../../../utils/googleFontCss", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../utils/googleFontCss")>(),
  fetchGoogleFontPreviewCss: preview.fetch,
}));

const font = { family: "Preview Fixture", category: "sans-serif", variants: [{ weight: "400", style: "normal" }], popularity: 1, subsets: ["latin"], lastModified: "" };
const css = '@font-face { font-family: "__gfont_preview_Preview_Fixture"; src: url(data:font/ttf;base64,AA==); }';
const deferred = <T,>() => {
  let resolve: (value: T) => void = () => { throw new Error("deferred promise not initialized"); };
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
};

describe("InternetFontPreview", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let originalFonts: PropertyDescriptor | undefined;
  const load = vi.fn<() => Promise<readonly object[]>>();

  beforeEach(() => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    preview.fetch.mockReset();
    load.mockReset().mockResolvedValue([{}]);
    originalFonts = Object.getOwnPropertyDescriptor(document, "fonts");
    Object.defineProperty(document, "fonts", { configurable: true, value: { load } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (originalFonts) Object.defineProperty(document, "fonts", originalFonts);
    else Reflect.deleteProperty(document, "fonts");
  });

  const render = async () => act(async () => root.render(<InternetFontPreview font={font} />));

  it("shows a placeholder instead of fallback text until the browser font is ready", async () => {
    const response = deferred<GoogleFontPreviewResult>();
    const browser = deferred<readonly object[]>();
    preview.fetch.mockReturnValue(response.promise);
    load.mockReturnValue(browser.promise);
    await render();
    expect(container.textContent).toBe("");
    expect(container.querySelector('[role="status"]')?.getAttribute("aria-label")).toBe(`${font.family}: Loading preview`);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    await act(async () => response.resolve({ success: true, css }));
    expect(container.textContent).toBe("");
    expect(load).toHaveBeenCalledWith('normal 400 16px "__gfont_preview_Preview_Fixture"', font.family);
    await act(async () => browser.resolve([{}]));
    expect(container.textContent).toBe(font.family);
    expect(container.querySelector('[aria-busy="false"]')).not.toBeNull();
  });

  it("shows unavailable when preview fetching fails", async () => {
    preview.fetch.mockResolvedValue({ success: false, error: "offline" });
    await render();
    expect(container.textContent).toBe("");
    expect(container.querySelector('[role="status"]')?.getAttribute("aria-label")).toBe(`${font.family}: Preview unavailable`);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("shows unavailable when browser decoding fails", async () => {
    preview.fetch.mockResolvedValue({ success: true, css });
    load.mockRejectedValue(new Error("font could not be decoded"));
    await render();
    expect(container.textContent).toBe("");
    expect(container.querySelector('[role="status"]')?.getAttribute("aria-label")).toBe(`${font.family}: Preview unavailable`);
  });

  it("does not install a late preview after its row is removed", async () => {
    const response = deferred<GoogleFontPreviewResult>();
    preview.fetch.mockReturnValue(response.promise);
    await render();
    await act(async () => root.render(null));
    await act(async () => response.resolve({ success: true, css }));
    expect(document.getElementById("__gfont_preview_Preview_Fixture")).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
});
