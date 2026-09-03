import { describe, expect, it, vi } from "vitest";
import type { ProjectData } from "../../renderer/store/types";
import { PROJECT_SCHEMA_VERSION } from "./amgContract";
import { parseProjectSessionId } from "./projectIpcContract";
import { parseLegacyProjectDocument, parseProjectDocumentV1 } from "./projectDocumentSchema";
import {
  scanProjectPortability,
  transformProjectPortability,
} from "./projectPortability";

const SESSION_A = parseProjectSessionId("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
const SESSION_B = parseProjectSessionId("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");

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

  it("scans the readonly parsed legacy document shape without an assertion seam", () => {
    // Given
    const document = parseLegacyProjectDocument(createProject());

    // When
    const scan = scanProjectPortability(document, {
      mode: "legacy-durable",
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
  });

  it("transforms parsed v1 and legacy documents while preserving their readonly input shapes", () => {
    // Given
    const v1 = parseProjectDocumentV1({ projectSchemaVersion: PROJECT_SCHEMA_VERSION, ...createProject() });
    const legacy = parseLegacyProjectDocument(createProject());
    const v1Original = structuredClone(v1);
    const legacyOriginal = structuredClone(legacy);
    const availableAssetPaths = [
      "assets/bg.png",
      "assets/body.png",
      "assets/fonts/fixture.woff2",
      "assets/image.png",
      "assets/large.png",
      "assets/mask.svg",
      "assets/poster.png",
      "assets/small.png",
      "assets/top.png",
    ];

    // When
    const transformedV1 = transformProjectPortability(v1, {
      mode: "bundle-durable",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    const transformedLegacy = transformProjectPortability(legacy, {
      mode: "legacy-durable",
      sessionId: SESSION_A,
      availableAssetPaths,
    });

    // Then
    expect(transformedV1.ok).toBe(true);
    expect(transformedLegacy.ok).toBe(true);
    expect(JSON.stringify(transformedV1)).not.toContain(SESSION_A);
    expect(JSON.stringify(transformedLegacy)).not.toContain(SESSION_A);
    expect(v1).toEqual(v1Original);
    expect(legacy).toEqual(legacyOriginal);
  });

  it("validates canonical stored bundle and legacy forms without accepting runtime identity", () => {
    // Given
    const availableAssetPaths = [
      "assets/bg.png",
      "assets/body.png",
      "assets/fonts/fixture.woff2",
      "assets/image.png",
      "assets/large.png",
      "assets/mask.svg",
      "assets/poster.png",
      "assets/small.png",
      "assets/top.png",
    ];
    const durable = transformProjectPortability(createProject(), {
      mode: "bundle-durable",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    expect(durable.ok).toBe(true);
    if (!durable.ok) return;
    const legacyExternal = structuredClone(durable.project);
    const legacyBlock = legacyExternal.pages[0]?.blocks[0];
    if (legacyBlock) legacyBlock.props = { src: "C:\\legacy\\photo.png" };
    const nonCanonical = structuredClone(durable.project);
    const nonCanonicalBlock = nonCanonical.pages[0]?.blocks[0];
    if (nonCanonicalBlock) nonCanonicalBlock.props = { src: "assets/image%2Epng" };
    const withStoredReference = (reference: string): ProjectData => {
      const project = structuredClone(durable.project);
      const block = project.pages[0]?.blocks[0];
      if (block) block.props = { src: reference };
      return project;
    };

    // When
    const bundleStored = scanProjectPortability(durable.project, {
      mode: "bundle-stored",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    const runtimeRejected = scanProjectPortability(createProject(), {
      mode: "bundle-stored",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    const legacyStored = scanProjectPortability(legacyExternal, {
      mode: "legacy-stored",
      sessionId: SESSION_A,
      availableAssetPaths,
      approvedExternalReferences: ["C:\\legacy\\photo.png"],
    });
    const nonCanonicalStored = scanProjectPortability(nonCanonical, {
      mode: "bundle-stored",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    const rejectedReferences = [
      ["blob:temporary", "blob"],
      ["file:///C:/legacy/photo.png", "external-local"],
      ["C:\\legacy\\photo.png", "external-local"],
      ["app-media://absolute/C:/legacy/photo.png", "external-local"],
      [`app-media://project-asset/${SESSION_B}/assets/image.png`, "unexpected-reference-form"],
      ["assets/missing.png", "missing-asset"],
    ] as const;
    const rejectedScans = rejectedReferences.map(([reference, code]) => ({
      code,
      scan: scanProjectPortability(
        withStoredReference(reference),
        { mode: "bundle-stored", sessionId: SESSION_A, availableAssetPaths },
      ),
    }));
    const allowedNetwork = ["https://example.test/image.png", "data:image/png;base64,AAAA"].map((reference) => (
      scanProjectPortability(withStoredReference(reference), {
        mode: "bundle-stored",
        sessionId: SESSION_A,
        availableAssetPaths,
      })
    ));
    const secret = structuredClone(durable.project);
    secret.publisherConfig = { providerId: "fixture", encryptedCredentials: "forbidden" };
    const secretStored = scanProjectPortability(secret, {
      mode: "bundle-stored",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    const identityStored = scanProjectPortability(withStoredReference(SESSION_A), {
      mode: "bundle-stored",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    const foreignIdentityStored = scanProjectPortability(withStoredReference(SESSION_B), {
      mode: "bundle-stored",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    const foreignKey = structuredClone(durable.project);
    const foreignKeyBlock = foreignKey.pages[0]?.blocks[0];
    if (foreignKeyBlock) foreignKeyBlock.props = { [SESSION_B]: "safe" };
    const foreignKeyStored = scanProjectPortability(foreignKey, {
      mode: "legacy-stored",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    const hashStored = scanProjectPortability(withStoredReference("a".repeat(64)), {
      mode: "bundle-stored",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    const proseStored = scanProjectPortability(withStoredReference(`foreign token ${SESSION_B} in prose`), {
      mode: "legacy-stored",
      sessionId: SESSION_A,
      availableAssetPaths,
    });
    const unapprovedLegacy = scanProjectPortability(legacyExternal, {
      mode: "legacy-stored",
      sessionId: SESSION_A,
      availableAssetPaths,
    });

    // Then
    expect(bundleStored.offenders).toEqual([]);
    expect(runtimeRejected.offenders).toContainEqual(expect.objectContaining({
      code: "unexpected-reference-form",
    }));
    expect(legacyStored.offenders).toEqual([]);
    expect(nonCanonicalStored.offenders).toContainEqual(expect.objectContaining({
      code: "invalid-reference",
      reference: "assets/image%2Epng",
    }));
    rejectedScans.forEach(({ code, scan }) => {
      expect(scan.offenders).toContainEqual(expect.objectContaining({ code }));
    });
    allowedNetwork.forEach((scan) => expect(scan.offenders).toEqual([]));
    expect(secretStored.offenders).toContainEqual(expect.objectContaining({ code: "credential" }));
    expect(identityStored.offenders).toContainEqual(expect.objectContaining({ code: "session-identity" }));
    expect(foreignIdentityStored.offenders).toContainEqual(expect.objectContaining({ code: "session-identity" }));
    expect(foreignKeyStored.offenders).toContainEqual(expect.objectContaining({ code: "session-identity" }));
    expect(hashStored.offenders).toEqual([]);
    expect(proseStored.offenders).toEqual([]);
    expect(unapprovedLegacy.offenders).toContainEqual(expect.objectContaining({ code: "external-local" }));
    expect(JSON.stringify(durable.project)).not.toContain(SESSION_A);
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
