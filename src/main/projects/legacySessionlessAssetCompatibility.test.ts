// @vitest-environment node

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { LegacyProjectDocument } from "../../shared/projects/projectDocumentSchema";
import { scanProjectPortability, transformProjectPortability } from "../../shared/projects/projectPortability";
import { TEST_PROJECT } from "./amgArchiveFixtures";
import { createDefaultProjectServiceFiles } from "./projectServiceFiles";
import { stageLegacyProject } from "./projectServiceOpen";
import { ProjectSessionRegistry } from "./projectSession";

const roots: string[] = [];
const LEGACY_HERO = "app-media://project-asset/assets/Hero Image.png";
const LEGACY_GALLERY = "app-media://project-asset/assets/gallery.png";

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const createLegacyProject = (
  heroReference = LEGACY_HERO,
  galleryReference = LEGACY_GALLERY,
  periods: readonly string[] = ["/mo", "/year"],
): LegacyProjectDocument => {
  const { projectSchemaVersion: ignoredVersion, ...project } = structuredClone(TEST_PROJECT);
  void ignoredVersion;
  return {
    ...project,
    pages: [{
      id: "home",
      title: "Home",
      slug: "index",
      meta: {},
      blocks: [{
        id: "media",
        type: "slideshow",
        props: {
          slides: [{ src: heroReference }],
          images: [{ url: galleryReference }],
        },
        styles: {},
        classes: [],
        children: [],
      }, {
        id: "pricing",
        type: "pricing",
        props: { plans: periods.map((period) => ({ period })) },
        styles: {},
        classes: [],
        children: [],
      }],
    }],
  };
};

describe("legacy sessionless project assets", () => {
  it("opens historical JSON and materializes its assets for the active session", async () => {
    // Given: a pre-session-ID project whose referenced assets exist beside project.json.
    const root = await mkdtemp(path.join(tmpdir(), "amagon-legacy-sessionless-"));
    roots.push(root);
    const projectPath = path.join(root, "project.json");
    await mkdir(path.join(root, "assets"));
    await Promise.all([
      writeFile(projectPath, JSON.stringify(createLegacyProject()), "utf8"),
      writeFile(path.join(root, "assets", "Hero Image.png"), "hero", "utf8"),
      writeFile(path.join(root, "assets", "gallery.png"), "gallery", "utf8"),
    ]);

    // When: the real legacy persistence adapter stages and renderer materializes it.
    const state = await stageLegacyProject(projectPath, {
      userDataPath: root,
      files: createDefaultProjectServiceFiles(),
      sessions: new ProjectSessionRegistry(),
    });
    const sessionId = state.session.id;
    if (sessionId === null) throw new TypeError("legacy session has no identity");
    const materialized = transformProjectPortability(state.data, {
      mode: "legacy-runtime",
      sessionId,
      availableAssetPaths: ["assets/gallery.png", "assets/Hero Image.png"],
    });

    // Then: opening succeeds and both old references become current-session URLs.
    expect(materialized.ok).toBe(true);
    if (!materialized.ok) return;
    const serialized = JSON.stringify(materialized.project);
    expect(serialized).toContain(`app-media://project-asset/${sessionId}/assets/Hero%20Image.png`);
    expect(serialized).toContain(`app-media://project-asset/${sessionId}/assets/gallery.png`);
  });

  it.each([
    "APP-MEDIA://project-asset/assets/hero.png",
    "app-media://project-asset/session_A1/assets/hero.png",
    "app-media://project-asset/assets/%2e%2e/secret.png",
    "app-media://other-authority/assets/hero.png",
    "/etc/passwd",
  ])("still rejects unsafe or non-historical stored form %s", (reference) => {
    // Given: a legacy document using a form other than the exact historical shape.
    const project = createLegacyProject(reference);

    // When: stored legacy portability is checked.
    const scan = scanProjectPortability(project, {
      mode: "legacy-stored",
      sessionId: "session_A1",
      availableAssetPaths: ["assets/hero.png"],
    });

    // Then: the reference remains outside the accepted compatibility boundary.
    expect(scan.offenders.length).toBeGreaterThan(0);
  });

  it.each([
    ["legacy-durable", false],
    ["legacy-runtime", false],
    ["legacy-stored", false],
    ["conversion-durable", false],
    ["bundle-durable", true],
    ["bundle-runtime", true],
    ["bundle-stored", true],
  ] as const)("enforces the historical-reference boundary in %s mode", (mode, rejected) => {
    const scan = scanProjectPortability(createLegacyProject(), {
      mode,
      sessionId: "session_A1",
      availableAssetPaths: ["assets/Hero Image.png", "assets/gallery.png"],
    });

    expect(scan.offenders.length > 0).toBe(rejected);
  });

  it.each([
    "/etc/passwd",
    "../secret.png",
    "app-media://project-asset/session_A1/assets/secret.png",
  ])("does not treat an unsafe period value as display text: %s", (period) => {
    const project = createLegacyProject(
      "https://example.com/hero.png",
      "https://example.com/gallery.png",
      [period],
    );

    const scan = scanProjectPortability(project, {
      mode: "bundle-stored",
      sessionId: "session_A1",
      availableAssetPaths: [],
    });

    expect(scan.offenders).toContainEqual(expect.objectContaining({
      location: "$.pages[0].blocks[1].props.plans[0].period",
    }));
  });
});
