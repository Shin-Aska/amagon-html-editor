import { describe, expect, expectTypeOf, it } from "vitest";
import {
  parseProjectSessionId,
  type ProjectSessionId,
} from "../../shared/projects/projectIpcContract";
import type { ProjectData } from "../store/types";
import {
  buildProjectSnapshot,
  materializeProjectSnapshot,
  type BuildProjectSnapshotInput,
} from "./projectSnapshot";

const SESSION_A = parseProjectSessionId("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
const SESSION_B = parseProjectSessionId("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
const ASSET_PATH = "assets/nested/hero image.png";
const DURABLE_REFERENCE = "assets/nested/hero%20image.png";

const projectFixture = (): ProjectData => ({
  customCss: "stale top-level css",
  projectSettings: {
    name: "Snapshot fixture",
    framework: "vanilla",
    theme: {
      name: "Fixture",
      colors: {
        primary: "#000",
        secondary: "#111",
        accent: "#222",
        background: "#fff",
        surface: "#eee",
        text: "#111",
        textMuted: "#777",
        border: "#ccc",
        success: "#080",
        warning: "#fa0",
        danger: "#d00",
      },
      typography: {
        fontFamily: "Fixture",
        headingFontFamily: "Fixture",
        baseFontSize: "16px",
        lineHeight: "1.5",
        headingLineHeight: "1.2",
      },
      spacing: { baseUnit: "4px", scale: [1] },
      borders: { radius: "2px", width: "1px", color: "#ccc" },
      customCss: "",
    },
    globalStyles: {},
  },
  pages: [
    {
      id: "page-1",
      title: "Page",
      slug: "page",
      meta: { description: "preserved" },
      blocks: [],
    },
  ],
  folders: [{ id: "folder-1", name: "Folder" }],
  userBlocks: [],
  customPresets: [],
  themePacks: [{ id: "pack-1", name: "Pack" }],
  sectionTemplates: [{ id: "section-1", name: "Section" }],
  pageTemplates: [{ id: "page-template-1", name: "Page template" }],
  appliedThemePackId: "pack-1",
  publisherConfig: { providerId: "publisher-1" },
});

describe("project snapshot", () => {
  it("requires a canonical opaque session identity", () => {
    // Given
    type RawSessionIsAccepted = string extends BuildProjectSnapshotInput["sessionId"] ? true : false;

    // When
    const rawSessionIsAccepted: RawSessionIsAccepted = false;

    // Then
    expect(rawSessionIsAccepted).toBe(false);
    expectTypeOf<string>().not.toMatchTypeOf<ProjectSessionId>();
  });

  it("merges flushed blocks and independent custom CSS before durable rematerialization", () => {
    // Given
    const project = projectFixture();
    const runtimeReference = `app-media://project-asset/${SESSION_A}/assets/nested/hero%20image.png`;
    const flushedBlocks = [
      {
        id: "block-1",
        type: "image",
        props: { src: runtimeReference, nested: { poster: runtimeReference } },
        styles: { backgroundImage: `url('${runtimeReference}')` },
        classes: [],
        children: [],
      },
    ];

    // When
    const snapshot = buildProjectSnapshot({
      project,
      currentPageId: "page-1",
      flushedBlocks,
      customCss: `body { background: url('${runtimeReference}') }`,
      sessionId: SESSION_A,
      sessionKind: "amg",
      operation: "save",
      availableAssetPaths: [ASSET_PATH],
    });

    // Then
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.project.pages[0]?.blocks).toEqual(flushedBlocks.map((block) => ({
      ...block,
      props: { src: DURABLE_REFERENCE, nested: { poster: DURABLE_REFERENCE } },
      styles: { backgroundImage: `url('${DURABLE_REFERENCE}')` },
    })));
    expect(snapshot.project.customCss).toBe(`body { background: url('${DURABLE_REFERENCE}') }`);
    expect(snapshot.project.folders).toEqual(project.folders);
    expect(snapshot.project.publisherConfig).toEqual(project.publisherConfig);
    expect(snapshot.project.projectSchemaVersion).toBe(1);
    expect(JSON.stringify(snapshot.project)).not.toContain(SESSION_A);

    const reopened = materializeProjectSnapshot({
      project: snapshot.project,
      sessionId: SESSION_B,
      sessionKind: "amg",
      availableAssetPaths: [ASSET_PATH],
    });
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    const serialized = JSON.stringify(reopened.project);
    expect(serialized).not.toContain(SESSION_A);
    expect(serialized).toContain(SESSION_B);
    expect(reopened.project.customCss).toContain(SESSION_B);
  });

  it("preserves approved legacy external references only for ordinary JSON save", () => {
    // Given
    const project = projectFixture();
    project.pages[0]?.blocks.push({
      id: "legacy-image",
      type: "image",
      props: { src: "C:/legacy/images/hero.png" },
      styles: {},
      classes: [],
      children: [],
    });
    const input = {
      project,
      currentPageId: null,
      flushedBlocks: [],
      customCss: "legacy top-level css",
      sessionId: SESSION_A,
      sessionKind: "legacy-json" as const,
      availableAssetPaths: [],
      approvedExternalReferences: ["C:/legacy/images/hero.png"],
    };

    // When
    const ordinary = buildProjectSnapshot({ ...input, operation: "save" });
    const conversion = buildProjectSnapshot({ ...input, operation: "save-as" });

    // Then
    expect(ordinary.ok).toBe(true);
    expect(conversion.ok).toBe(false);
    if (!ordinary.ok || conversion.ok) return;
    expect(ordinary.project.pages[0]?.blocks[0]?.props["src"]).toBe("C:/legacy/images/hero.png");
    expect(ordinary.project.customCss).toBe("legacy top-level css");
    expect("projectSchemaVersion" in ordinary.project).toBe(false);
    expect(conversion.offenders).toContainEqual(expect.objectContaining({ code: "external-local" }));
    const reopened = materializeProjectSnapshot({
      project: ordinary.project,
      sessionId: SESSION_B,
      sessionKind: "legacy-json",
      availableAssetPaths: [],
      approvedExternalReferences: ["C:/legacy/images/hero.png"],
    });
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.project.customCss).toBe("legacy top-level css");
  });
});
