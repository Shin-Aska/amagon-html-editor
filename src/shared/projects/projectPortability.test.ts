import { describe, expect, it, vi } from "vitest";
import type { ProjectData } from "../../renderer/store/types";
import { PROJECT_SCHEMA_VERSION } from "./amgContract";
import { parseProjectDocumentV1 } from "./projectDocumentSchema";
import {
  scanProjectPortability,
  transformProjectPortability,
} from "./projectPortability";

const SESSION_A = "session_A_123456";
const SESSION_B = "session_B_654321";

const createProject = (): ProjectData => ({
  customCss: `.top { background: url("app-media://project-asset/${SESSION_A}/assets/top.png"); }`,
  projectSettings: {
    name: "Portable fixture",
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
      customCss: `.theme { mask: url('app-media://project-asset/${SESSION_A}/assets/mask.svg'); }`,
      customCssFiles: [
        { id: "css-1", name: "extra", css: ".extra{}", enabled: true },
      ],
    },
    fonts: [
      {
        id: "font-1",
        name: "Fixture",
        fileName: "fixture.woff2",
        relativePath: "assets/fonts/fixture.woff2",
        format: "woff2",
        source: "imported",
      },
    ],
    globalStyles: {
      body: `url(app-media://project-asset/${SESSION_A}/assets/body.png)`,
    },
  },
  pages: [
    {
      id: "page-1",
      title: "Page",
      slug: "page",
      meta: {},
      blocks: [
        {
          id: "block-1",
          type: "html",
          classes: [],
          styles: {
            backgroundImage: `url(app-media://project-asset/${SESSION_A}/assets/bg.png)`,
          },
          props: {
            media: {
              poster: `app-media://project-asset/${SESSION_A}/assets/poster.png`,
            },
          },
          content: `<a href="app-media://project-asset/${SESSION_A}/assets/image.png"><video poster="app-media://project-asset/${SESSION_A}/assets/poster.png" src="app-media://project-asset/${SESSION_A}/assets/image.png" srcset="app-media://project-asset/${SESSION_A}/assets/small.png 1x, app-media://project-asset/${SESSION_A}/assets/large.png 2x"></video></a>`,
          children: [],
        },
      ],
    },
  ],
  userBlocks: [],
});

describe("ProjectData portability characterization", () => {
  it("preserves representative serialization surfaces before transformation exists", () => {
    // Given
    const project = createProject();

    // When
    const serialized = JSON.stringify(project);
    const restored: unknown = JSON.parse(serialized);

    // Then
    expect(restored).toEqual(project);
  });
});

describe("project portability", () => {
  it("round-trips every project-owned reference surface through session-neutral data", () => {
    // Given
    const project = createProject();
    project.projectSettings.theme.customCssFiles = [
      {
        id: "css-1",
        name: "extra",
        enabled: true,
        css: `@font-face { src: url(app-media://project-asset/${SESSION_A}/assets/extra.woff2) }`,
      },
    ];
    project.projectSettings.themes = {
      light: structuredClone(project.projectSettings.theme),
      dark: structuredClone(project.projectSettings.theme),
      previewMode: "device",
    };
    project.customPresets = [structuredClone(project.projectSettings.theme)];
    const availableAssetPaths = [
      "assets/bg.png",
      "assets/body.png",
      "assets/extra.woff2",
      "assets/fonts/fixture.woff2",
      "assets/image.png",
      "assets/large.png",
      "assets/mask.svg",
      "assets/poster.png",
      "assets/small.png",
      "assets/top.png",
    ];

    // When
    const durable = transformProjectPortability(project, {
      mode: "bundle-durable",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    if (!durable.ok) throw new Error(JSON.stringify(durable.offenders));
    const runtime = transformProjectPortability(durable.project, {
      mode: "bundle-runtime",
      sessionId: SESSION_B,
      availableAssetPaths,
    });

    // Then
    expect(runtime.ok).toBe(true);
    expect(JSON.stringify(durable.project)).not.toContain(SESSION_A);
    expect(JSON.stringify(durable.project)).not.toContain("app-media://");
    if (!runtime.ok) return;
    const runtimeJson = JSON.stringify(runtime.project);
    expect(runtimeJson).not.toContain(SESSION_A);
    expect(runtimeJson).toContain(SESSION_B);
    expect(runtime.referencedAssetPaths).toEqual(availableAssetPaths);
  });

  it("preserves network and data references without calling global network APIs", () => {
    // Given
    const project = createProject();
    project.pages[0]?.blocks[0]?.props &&
      Object.assign(project.pages[0].blocks[0].props, {
        data: "data:image/png;base64,AAAA",
        http: "http://example.test/a.png",
        https: "https://example.test/b.png",
      });
    let networkCalls = 0;
    const forbidNetwork = (): never => {
      networkCalls += 1;
      throw new Error("network forbidden");
    };
    vi.stubGlobal("fetch", forbidNetwork);
    vi.stubGlobal("XMLHttpRequest", forbidNetwork);
    vi.stubGlobal("WebSocket", forbidNetwork);

    // When
    const result = transformProjectPortability(project, {
      mode: "bundle-durable",
      sessionId: SESSION_A,
      availableAssetPaths: [
        "assets/bg.png",
        "assets/body.png",
        "assets/fonts/fixture.woff2",
        "assets/image.png",
        "assets/large.png",
        "assets/mask.svg",
        "assets/poster.png",
        "assets/small.png",
        "assets/top.png",
      ],
    });
    vi.unstubAllGlobals();

    // Then
    expect(result.ok).toBe(true);
    expect(networkCalls).toBe(0);
    if (!result.ok) return;
    expect(result.project.pages[0]?.blocks[0]?.props).toMatchObject({
      data: "data:image/png;base64,AAAA",
      http: "http://example.test/a.png",
      https: "https://example.test/b.png",
    });
  });

  it("preserves approved legacy external local references for ordinary JSON but reports conversion blockers", () => {
    // Given
    const references = [
      "C:\\legacy\\photo.png",
      "file:///C:/legacy/photo.png",
      "app-media://absolute/C:/legacy/photo.png",
    ];
    const project = createProject();
    project.pages[0]?.blocks[0]?.props &&
      Object.assign(project.pages[0].blocks[0].props, {
        drive: references[0],
        file: references[1],
        absoluteMedia: references[2],
      });
    const legacyFont = project.projectSettings.fonts?.[0];
    if (legacyFont) {
      legacyFont.source = "system";
      legacyFont.relativePath = references[0] ?? "";
    }

    // When
    const ordinary = transformProjectPortability(project, {
      mode: "legacy-durable",
      sessionId: SESSION_A,
      approvedExternalReferences: references,
      availableAssetPaths: [
        "assets/bg.png",
        "assets/body.png",
        "assets/fonts/fixture.woff2",
        "assets/image.png",
        "assets/large.png",
        "assets/mask.svg",
        "assets/poster.png",
        "assets/small.png",
        "assets/top.png",
      ],
    });
    const conversion = scanProjectPortability(project, {
      mode: "conversion-durable",
      sessionId: SESSION_A,
      availableAssetPaths: [
        "assets/bg.png",
        "assets/body.png",
        "assets/fonts/fixture.woff2",
        "assets/image.png",
        "assets/large.png",
        "assets/mask.svg",
        "assets/poster.png",
        "assets/small.png",
        "assets/top.png",
      ],
    });

    // Then
    expect(ordinary.ok).toBe(true);
    if (ordinary.ok)
      expect(ordinary.project.pages[0]?.blocks[0]?.props).toMatchObject({
        drive: references[0],
        file: references[1],
        absoluteMedia: references[2],
      });
    if (ordinary.ok) expect(ordinary.project.projectSettings.fonts?.[0]?.relativePath).toBe(references[0]);
    expect(
      conversion.offenders.map(({ code, location }) => ({ code, location })),
    ).toEqual([
      {
        code: "external-local",
        location: "$.pages[0].blocks[0].props.absoluteMedia",
      },
      { code: "external-local", location: "$.pages[0].blocks[0].props.drive" },
      { code: "external-local", location: "$.pages[0].blocks[0].props.file" },
      { code: "external-local", location: "$.projectSettings.fonts[0].relativePath" },
      { code: "system-font", location: "$.projectSettings.fonts[0].relativePath" },
    ]);
  });

  it("returns stable offenders for stale, blob, missing, credentials, and system-font references", () => {
    // Given
    const project = createProject();
    project.publisherConfig = {
      providerId: "test",
      encryptedCredentials: "do-not-record",
    };
    project.projectSettings.fonts = [
      {
        id: "font-system",
        name: "System",
        fileName: "system.ttf",
        relativePath: "assets/fonts/system.ttf",
        format: "ttf",
        source: "system",
      },
    ];
    const block = project.pages[0]?.blocks[0];
    if (block) {
      block.props = {
        blob: "blob:https://example.test/id",
        missing: `app-media://project-asset/${SESSION_A}/assets/missing.png`,
        stale: "app-media://project-asset/stale_session_99/assets/stale.png",
        credentialUrl: "https://user:password@example.test/private.png",
      };
      block.styles = {};
      block.content = undefined;
    }
    project.customCss = "";
    project.projectSettings.globalStyles = {};
    project.projectSettings.theme.customCss = "";

    // When
    const result = scanProjectPortability(project, {
      mode: "bundle-durable",
      sessionId: SESSION_A,
      availableAssetPaths: ["assets/fonts/system.ttf"],
    });

    // Then
    expect(
      result.offenders.map(({ code, location }) => ({ code, location })),
    ).toEqual([
      { code: "blob", location: "$.pages[0].blocks[0].props.blob" },
      {
        code: "credential",
        location: "$.pages[0].blocks[0].props.credentialUrl",
      },
      { code: "missing-asset", location: "$.pages[0].blocks[0].props.missing" },
      { code: "stale-session", location: "$.pages[0].blocks[0].props.stale" },
      {
        code: "system-font",
        location: "$.projectSettings.fonts[0].relativePath",
      },
      {
        code: "credential",
        location: "$.publisherConfig.encryptedCredentials",
      },
    ]);
    expect(
      result.offenders.some(
        (offender) => offender.reference === "do-not-record",
      ),
    ).toBe(false);
  });

  it("does not rewrite unrelated strings or interpret malformed CSS and HTML as executable input", () => {
    // Given
    const project = createProject();
    const block = project.pages[0]?.blocks[0];
    if (block) {
      block.props = {
        label: "prefix app-media://project-asset/not-a-token suffix",
      };
      block.styles = { malformed: 'url("unterminated' };
      block.content =
        '<img src=> <script>fetch("https://example.test")</script>';
    }
    project.customCss = "";
    project.projectSettings.globalStyles = {};
    project.projectSettings.theme.customCss = "";
    project.projectSettings.fonts = [];

    // When
    const result = transformProjectPortability(project, {
      mode: "bundle-durable",
      sessionId: SESSION_A,
      availableAssetPaths: [],
    });

    // Then
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.pages[0]?.blocks[0]).toMatchObject(block ?? {});
  });

  it("accepts legacy project-owned references only in conversion and rejects wrong directional forms", () => {
    // Given
    const project = createProject();
    const block = project.pages[0]?.blocks[0];
    if (block)
      block.props = { legacy: "app-media://project-asset/assets/legacy.png" };
    const availableAssetPaths = [
      "assets/bg.png",
      "assets/body.png",
      "assets/fonts/fixture.woff2",
      "assets/image.png",
      "assets/large.png",
      "assets/legacy.png",
      "assets/mask.svg",
      "assets/poster.png",
      "assets/small.png",
      "assets/top.png",
    ];

    // When
    const conversion = transformProjectPortability(project, {
      mode: "conversion-durable",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    const bundle = scanProjectPortability(project, {
      mode: "bundle-durable",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    const wrongDirection = scanProjectPortability(createProject(), {
      mode: "bundle-runtime",
      sessionId: SESSION_B,
      availableAssetPaths,
    });

    // Then
    expect(conversion.ok).toBe(true);
    if (conversion.ok)
      expect(conversion.project.pages[0]?.blocks[0]?.props).toMatchObject({
        legacy: "assets/legacy.png",
      });
    expect(bundle.offenders).toContainEqual(
      expect.objectContaining({
        code: "unexpected-reference-form",
        location: "$.pages[0].blocks[0].props.legacy",
      }),
    );
    expect(wrongDirection.offenders).toContainEqual(
      expect.objectContaining({
        code: "unexpected-reference-form",
        location: "$.customCss",
      }),
    );
  });

  it("scans the readonly parsed v1 document shape without an assertion seam", () => {
    // Given
    const document = parseProjectDocumentV1({ projectSchemaVersion: PROJECT_SCHEMA_VERSION, ...createProject() });
    const original = structuredClone(document);

    // When
    const scan = scanProjectPortability(document, {
      mode: "bundle-durable",
      sessionId: SESSION_A,
      availableAssetPaths: [
        "assets/bg.png",
        "assets/body.png",
        "assets/fonts/fixture.woff2",
        "assets/image.png",
        "assets/large.png",
        "assets/mask.svg",
        "assets/poster.png",
        "assets/small.png",
        "assets/top.png",
      ],
    });

    // Then
    expect(scan.offenders).toEqual([]);
    expect(scan.referencedAssetPaths).toContain("assets/image.png");
    expect(document).toEqual(original);
  });

  it("rejects an app-media URL with an unrecognized authority at a stable location", () => {
    // Given
    const project = createProject();
    const block = project.pages[0]?.blocks[0];
    if (block) block.props = { privateMedia: "app-media://foreign-authority/private" };

    // When
    const scan = scanProjectPortability(project, {
      mode: "bundle-durable",
      sessionId: SESSION_A,
      availableAssetPaths: [
        "assets/bg.png",
        "assets/body.png",
        "assets/fonts/fixture.woff2",
        "assets/image.png",
        "assets/large.png",
        "assets/mask.svg",
        "assets/poster.png",
        "assets/small.png",
        "assets/top.png",
      ],
    });

    // Then
    expect(scan.offenders).toContainEqual({
      code: "invalid-reference",
      location: "$.pages[0].blocks[0].props.privateMedia",
      reference: "app-media://foreign-authority/private",
    });
  });

  it("blocks an active session identity in an unrelated persisted string", () => {
    // Given
    const project = createProject();
    const block = project.pages[0]?.blocks[0];
    if (block) block.props = { note: SESSION_A };

    // When
    const result = transformProjectPortability(project, {
      mode: "bundle-durable",
      sessionId: SESSION_A,
      availableAssetPaths: [
        "assets/bg.png",
        "assets/body.png",
        "assets/fonts/fixture.woff2",
        "assets/image.png",
        "assets/large.png",
        "assets/mask.svg",
        "assets/poster.png",
        "assets/small.png",
        "assets/top.png",
      ],
    });

    // Then
    expect(result.ok).toBe(false);
    expect(result.offenders).toContainEqual({
      code: "session-identity",
      location: "$.pages[0].blocks[0].props.note",
    });
  });
});
