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

  it.each([
    "../../secret.png",
    "../secret.png",
    " ../secret.png",
    "./secret.png",
    "images/../secret.png",
    "..\\secret.png",
    "%2e%2e/secret.png",
    ".%2e/secret.png",
    "%2e%2e%2fsecret.png",
    "..%5csecret.png",
    "\t..\\secret.png",
    "%252e%252e/secret.png",
    "%25%32%65%25%32%65/secret.png",
  ])("excludes relative traversal %s from export and publish files", async (reference) => {
    // Given: a crafted relative reference whose direct fetch would disclose sentinel bytes.
    const sentinel = new Uint8Array([115, 101, 99, 114, 101, 116]);
    const directFetch = vi.fn(async () => new Response(sentinel, {
      status: 200,
      headers: { "content-type": "image/png" },
    }));
    vi.stubGlobal("fetch", directFetch);

    // When: the renderer creates the exact file array consumed by export and publish.
    const publishFiles = await exportProject(projectWithImage(reference));

    // Then: neither local authority nor browser fetch runs, and no sentinel bytes enter the payload.
    expect(directFetch).not.toHaveBeenCalled();
    expect(readAsset).not.toHaveBeenCalled();
    expect(publishFiles.some((file) => file.path.startsWith("assets/"))).toBe(false);
    expect(JSON.stringify(publishFiles)).not.toContain(reference);
    expect(publishFiles.some((file) => file.content instanceof Uint8Array
      && file.content.join(",") === sentinel.join(","))).toBe(false);
  });

  it("keeps non-dot web-relative assets on the browser fetch path", async () => {
    // Given: an intentional web-relative image reference.
    const reference = "images/photo.png";
    const directFetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/png" },
    }));
    vi.stubGlobal("fetch", directFetch);

    // When: the renderer exports the project.
    const files = await exportProject(projectWithImage(reference));

    // Then: existing non-dot relative asset behavior remains intact.
    expect(directFetch).toHaveBeenCalledWith(reference);
    expect(readAsset).not.toHaveBeenCalled();
    expect(files.some((file) => file.path.startsWith("assets/"))).toBe(true);
  });
});
