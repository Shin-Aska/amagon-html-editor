// @vitest-environment node
import { describe, expect, it } from "vitest";
import { TEST_PROJECT } from "../../main/projects/amgArchiveFixtures";
import type { LegacyProjectDocument } from "./projectDocumentSchema";
import { reviewProjectAssetUsage } from "./projectAssetUsage";

const font = (name: string, relativePath = `assets/fonts/${name}.woff2`) => ({
  id: name,
  name,
  fileName: `${name}.woff2`,
  relativePath,
  format: "woff2" as const,
  source: "imported" as const,
});
const project = (
  extras: Partial<LegacyProjectDocument> = {},
): LegacyProjectDocument => ({ ...TEST_PROJECT, ...extras });
describe("conservative unused project asset review", () => {
  it("keeps resources whose dependencies are inside linked CSS or SVG files", () => {
    const input = project({ customCss: "@import url(assets/site.css);" });
    expect(
      reviewProjectAssetUsage(
        input,
        ["assets/site.css", "assets/used-by-css.png"],
        "test",
      ).candidates,
    ).toEqual([]);
  });
  it("retains fonts when CSS escaping makes the applied family uncertain", () => {
    const input = project({
      customCss: "body {font-family: F\\6f nt}",
      projectSettings: {
        ...TEST_PROJECT.projectSettings,
        fonts: [font("Font")],
      },
    });
    expect(
      reviewProjectAssetUsage(input, ["assets/fonts/Font.woff2"], "test")
        .candidates,
    ).toEqual([]);
  });
  it("protects quoted relative asset paths with spaces in extension templates", () => {
    const input = project({
      sectionTemplates: [
        {
          id: "template",
          name: "Template",
          html: '<img src="./assets/with space.png">',
        },
      ],
    });
    expect(
      reviewProjectAssetUsage(
        input,
        ["assets/with space.png", "assets/unused.png"],
        "test",
      ).candidates.map((item) => item.relativePath),
    ).toEqual(["assets/unused.png"]);
  });
  it("offers unused files and missing font entries without offering a referenced missing image", () => {
    const input = project({
      customCss: ".hero { background: url(assets/missing.png); }",
      projectSettings: {
        ...TEST_PROJECT.projectSettings,
        fonts: [font("Unapplied")],
      },
    });
    expect(
      reviewProjectAssetUsage(input, ["assets/unused.png"], "test").candidates,
    ).toEqual([
      {
        key: "file:assets/unused.png",
        kind: "file",
        relativePath: "assets/unused.png",
        fontIds: [],
      },
      {
        key: "missing:assets/fonts/Unapplied.woff2",
        kind: "missing-entry",
        relativePath: "assets/fonts/Unapplied.woff2",
        fontIds: ["Unapplied"],
      },
    ]);
  });
  it("keeps every weight of an applied family and removes associated metadata with an unused font file", () => {
    const input = project({
      customCss: '.heading {font: 700 20px "Applied Family"}',
      projectSettings: {
        ...TEST_PROJECT.projectSettings,
        fonts: [
          font("Applied Family"),
          { ...font("Applied Family", "assets/fonts/bold.woff2"), id: "bold" },
          font("Unused"),
        ],
      },
    });
    expect(
      reviewProjectAssetUsage(input, ["assets/fonts/Unused.woff2"], "test")
        .candidates,
    ).toEqual([
      {
        key: "file:assets/fonts/Unused.woff2",
        kind: "file",
        relativePath: "assets/fonts/Unused.woff2",
        fontIds: ["Unused"],
      },
    ]);
  });
  it("protects references and font families in inactive pages, themes, presets and extension templates", () => {
    const input = project({
      projectSettings: {
        ...TEST_PROJECT.projectSettings,
        themes: {
          light: TEST_PROJECT.projectSettings.theme,
          dark: {
            ...TEST_PROJECT.projectSettings.theme,
            typography: {
              ...TEST_PROJECT.projectSettings.theme.typography,
              fontFamily: "Night Family",
            },
            customCss: ".night {mask:url(assets/night.svg)}",
          },
          previewMode: "light",
        },
        fonts: [font("Night Family")],
      },
      pages: [
        {
          id: "inactive",
          title: "Inactive",
          slug: "inactive",
          meta: {},
          blocks: [
            {
              id: "image",
              type: "image",
              props: { src: "assets/page.png" },
              styles: {},
              classes: [],
              children: [],
            },
          ],
        },
      ],
      customPresets: [
        {
          ...TEST_PROJECT.projectSettings.theme,
          customCss: ".preset {background:url(assets/preset.png)}",
        },
      ],
      sectionTemplates: [
        { id: "template", name: "Template", image: "assets/template.png" },
      ],
    });
    expect(
      reviewProjectAssetUsage(
        input,
        [
          "assets/page.png",
          "assets/night.svg",
          "assets/preset.png",
          "assets/template.png",
        ],
        "test",
      ).candidates,
    ).toEqual([]);
  });
  it("keeps a missing font entry if the same file is referenced directly", () => {
    const input = project({
      customCss: "@font-face {src:url(assets/fonts/Unused.woff2)}",
      projectSettings: {
        ...TEST_PROJECT.projectSettings,
        fonts: [font("Unused")],
      },
    });
    expect(reviewProjectAssetUsage(input, [], "test").candidates).toEqual([]);
  });
  it("keeps fonts governed by unresolved CSS variables", () => {
    const input = project({
      customCss: "body {font-family:var(--chosen-family)}",
      projectSettings: {
        ...TEST_PROJECT.projectSettings,
        fonts: [font("Unused")],
      },
    });
    const review = reviewProjectAssetUsage(
      input,
      ["assets/unused.png"],
      "test",
    );
    expect(review.candidates.map((item) => item.relativePath)).toEqual([
      "assets/unused.png",
    ]);
    expect(review.explanation).toContain("CSS variables");
  });
  it("disables automatic cleanup when event code can compute runtime paths", () => {
    const input = project({
      pages: [
        {
          id: "one",
          title: "One",
          slug: "",
          meta: {},
          blocks: [
            {
              id: "dynamic",
              type: "html",
              props: {},
              styles: {},
              classes: [],
              children: [],
              events: { click: "loadAsset(userChoice)" },
            },
          ],
        },
      ],
    });
    expect(
      reviewProjectAssetUsage(input, ["assets/unknown.png"], "test"),
    ).toMatchObject({
      candidates: [],
      explanation: expect.stringContaining("dynamically"),
    });
  });
  it("handles 10,000 assets and preserves literal percent filenames", () => {
    const paths = Array.from(
      { length: 10000 },
      (_, index) => `assets/file-${index}.png`,
    );
    const input = project({
      customCss: ".a {background:url(assets/literal%2520name.png)}",
    });
    const review = reviewProjectAssetUsage(
      input,
      [...paths, "assets/literal%20name.png", "assets/literal name.png"],
      "test",
    );
    expect(review.candidates).toHaveLength(10001);
    expect(review.candidates.at(-1)?.relativePath).toBe(
      "assets/literal name.png",
    );
  });
});
