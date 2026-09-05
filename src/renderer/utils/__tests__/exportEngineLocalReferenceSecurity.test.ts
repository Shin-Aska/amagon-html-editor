import { afterEach, describe, expect, it, vi } from "vitest";
import { createBlock, createDefaultTheme, type ProjectData } from "../../store/types";

const readAsset = vi.hoisted(() => vi.fn(async () => ({ success: false, error: "denied" })));

vi.mock("../api", () => ({
  getApi: () => ({ assets: { readAsset } }),
}));

import { exportProject } from "../exportEngine";

afterEach(() => {
  readAsset.mockClear();
  vi.unstubAllGlobals();
});

const projectWithImage = (reference: string): ProjectData => ({
  customCss: "",
  projectSettings: {
    name: "Untrusted legacy project",
    framework: "vanilla",
    theme: createDefaultTheme(),
    globalStyles: {},
  },
  pages: [{
    id: "page",
    title: "Page",
    slug: "index",
    meta: {},
    blocks: [createBlock("image", { props: { src: reference, alt: "external" } })],
  }],
  userBlocks: [],
});

describe("export asset authority", () => {
  it.each([
    "file:///C:/private/secret.png",
    "C:\\private\\secret.png",
    "app-media://absolute/C:/private/secret.png",
    "APP-MEDIA://absolute/C:/private/secret.png",
  ])("routes local reference %s through the authorized asset bridge", async (reference) => {
    // Given: a document-derived local reference and a direct fetch that would disclose sentinel bytes.
    const directFetch = vi.fn(async () => new Response(new Uint8Array([115, 101, 99, 114, 101, 116]), {
      status: 200,
      headers: { "content-type": "image/png" },
    }));
    vi.stubGlobal("fetch", directFetch);

    // When: the renderer exports with its production default asset resolver.
    const files = await exportProject(projectWithImage(reference));

    // Then: local access is delegated to the main-owned authority boundary and no direct fetch occurs.
    expect(readAsset).toHaveBeenCalledWith(reference);
    expect(directFetch).not.toHaveBeenCalled();
    expect(files.some((file) => file.path.startsWith("assets/"))).toBe(false);
  });

  it("keeps Blob asset resolution on the browser fetch path", async () => {
    // Given: an ordinary browser-owned Blob asset and a successful fetch response.
    const reference = "blob:https://example.test/image";
    const networkFetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/png" },
    }));
    vi.stubGlobal("fetch", networkFetch);

    // When: the renderer exports with its production default asset resolver.
    const files = await exportProject(projectWithImage(reference));

    // Then: the Blob URL is fetched directly and does not consume local-file authority.
    expect(networkFetch).toHaveBeenCalledWith(reference);
    expect(readAsset).not.toHaveBeenCalled();
    expect(files.some((file) => file.path.startsWith("assets/"))).toBe(true);
  });
});
