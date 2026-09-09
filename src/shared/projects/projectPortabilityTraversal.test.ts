import { describe, expect, it } from "vitest";
import { createBlock, createDefaultTheme, type ProjectData } from "../../renderer/store/types";
import { scanProjectPortability } from "./projectPortability";

const projectWithReference = (reference: string): ProjectData => ({
  customCss: `.page { background-image: url("${reference}"); }`,
  projectSettings: {
    name: "Relative reference fixture",
    framework: "vanilla",
    theme: createDefaultTheme(),
    globalStyles: {},
  },
  pages: [{
    id: "page",
    title: "Page",
    slug: "index",
    meta: {},
    blocks: [createBlock("html", {
      props: { src: reference },
      content: `<img src="${reference}">`,
    })],
  }],
  userBlocks: [],
});

describe("relative asset traversal portability", () => {
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
  ])("rejects dot-segment reference %s on every persisted asset surface", (reference) => {
    // Given: a project-controlled relative reference on CSS, block props, and raw HTML surfaces.
    const project = projectWithReference(reference);

    // When: both bundled and legacy persistence paths scan the project.
    const scans = (["bundle-stored", "legacy-stored"] as const).map((mode) => scanProjectPortability(project, {
      mode,
      sessionId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      availableAssetPaths: [],
    }));

    // Then: every path rejects the reference instead of treating it as an ordinary web-relative asset.
    for (const scan of scans) {
      expect(scan.offenders).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "invalid-reference", reference }),
      ]));
    }
  });

  it("preserves an intentional non-dot web-relative reference", () => {
    // Given: an ordinary site-relative image reference.
    const project = projectWithReference("images/photo.png");

    // When: bundled persistence scans it.
    const scan = scanProjectPortability(project, {
      mode: "bundle-stored",
      sessionId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      availableAssetPaths: [],
    });

    // Then: the existing web-relative workflow remains valid.
    expect(scan.offenders).toEqual([]);
  });

  it.each(["../../secret.png", "%2e%2e/secret.png"])(
    "rejects dot-segment reference %s inside raw HTML CSS",
    (reference) => {
      // Given: raw HTML whose only asset reference is inside inline CSS.
      const project = projectWithReference("safe-label");
      const block = project.pages[0]?.blocks[0];
      project.customCss = "";
      if (block) {
        block.props = {};
        block.content = `<style>.hero { background: url("${reference}"); }</style>`;
      }

      // When: bundled persistence scans the raw HTML block.
      const scan = scanProjectPortability(project, {
        mode: "bundle-stored",
        sessionId: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        availableAssetPaths: [],
      });

      // Then: the CSS reference is rejected at the raw HTML content location.
      expect(scan.offenders).toContainEqual({
        code: "invalid-reference",
        location: "$.pages[0].blocks[0].content",
        reference,
      });
    },
  );
});
