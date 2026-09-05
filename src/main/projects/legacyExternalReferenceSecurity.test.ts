// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseRendererGeneration, parseWorkspaceGeneration } from "../../shared/projects/projectIpcContract";
import { parseLegacyProjectDocument, type LegacyProjectDocument } from "../../shared/projects/projectDocumentSchema";
import { registerAssetReadIpc, type AssetReadIpcContext } from "../registerAssetReadIpc";
import { TEST_PROJECT } from "./amgArchiveFixtures";
import { createProjectService } from "./projectService";
import { createDefaultProjectServiceFiles } from "./projectServiceFiles";
import { stageLegacyProject } from "./projectServiceOpen";
import { ProjectSessionRegistry } from "./projectSession";
import { createRecentProjectsStore } from "./recentProjects";

type Handler = Parameters<AssetReadIpcContext["handle"]>[1];

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const legacyProject = (reference: string): LegacyProjectDocument => ({
  ...structuredClone(TEST_PROJECT),
  pages: [{
    id: "page",
    title: "Page",
    slug: "page",
    meta: {},
    blocks: [{
      id: "image",
      type: "image",
      props: { src: reference },
      styles: {},
      classes: [],
      children: [],
    }],
  }],
});

const createFixture = async (kind: "absolute" | "file-url" | "app-media-absolute" | "uppercase-app-media-absolute") => {
  const root = await mkdtemp(path.join(tmpdir(), "amagon-legacy-authority-"));
  roots.push(root);
  const secretPath = path.join(root, "secret.txt");
  const projectPath = path.join(root, "legacy.json");
  const reference = kind === "absolute"
    ? secretPath
    : kind === "file-url"
      ? pathToFileURL(secretPath).href
      : `${kind === "uppercase-app-media-absolute" ? "APP-MEDIA" : "app-media"}://absolute/${secretPath.split("\\").join("/")}`;
  const project = legacyProject(reference);
  await writeFile(secretPath, "secret", "utf8");
  await writeFile(projectPath, JSON.stringify(project), "utf8");
  return { root, projectPath, reference };
};

describe("legacy external reference authority", () => {
  it.each(["absolute", "file-url", "app-media-absolute", "uppercase-app-media-absolute"] as const)(
    "does not derive %s read authority from document strings",
    async (kind) => {
      // Given: an attacker-controlled legacy document containing an external-local reference.
      const fixture = await createFixture(kind);
      const sessions = new ProjectSessionRegistry();

      // When: the legacy document is staged for activation.
      const state = await stageLegacyProject(fixture.projectPath, {
        userDataPath: fixture.root,
        files: createDefaultProjectServiceFiles(),
        sessions,
      });

      // Then: opening the document grants no local-file read authority.
      expect(state.approvedExternalReferences).toEqual([]);
    },
  );

  it.each(["absolute", "file-url", "app-media-absolute", "uppercase-app-media-absolute"] as const)(
    "blocks both asset-read IPC paths for an unapproved %s reference while ordinary Save preserves it",
    async (kind) => {
      // Given: a legacy project opened through the real persistence service.
      const fixture = await createFixture(kind);
      const sessions = new ProjectSessionRegistry();
      const service = createProjectService({
        userDataPath: fixture.root,
        documentsPath: fixture.root,
        dialogs: {
          showOpen: async () => ({ canceled: false, filePaths: [fixture.projectPath] }),
          showSave: async () => ({ canceled: true }),
        },
        recents: createRecentProjectsStore({ storagePath: path.join(fixture.root, "recents.json") }),
        sessions,
      });
      const opened = await service.openProject({
        expectedSessionId: null,
        rendererGeneration: parseRendererGeneration(0),
        workspaceGeneration: parseWorkspaceGeneration(0),
        snapshot: null,
        dirtyChoice: "discard",
      });
      if (!opened.success) throw new Error("legacy open failed");
      const handlers = new Map<string, Handler>();
      const mainFrame = {};
      const sender = { id: 1, mainFrame };
      const event = { sender, senderFrame: mainFrame };
      const stat = vi.fn(async () => ({ size: 6 }));
      const diskRead = vi.fn(async () => Buffer.from("secret"));
      registerAssetReadIpc({
        handle: (channel, handler) => handlers.set(channel, handler),
        getMainWindow: () => ({ webContents: sender }),
        sessions,
        getProjectService: () => service,
        exists: () => false,
        readDirectory: async () => [],
        stat,
        readFile: diskRead,
        buildRuntimeAssetUrl: () => "unused",
        getMimeType: () => "text/plain",
      });

      // When: both renderer-visible asset bridges receive the document-derived reference.
      const base64Handler = handlers.get("assets:readFileAsBase64");
      const assetHandler = handlers.get("assets:readAsset");
      if (base64Handler === undefined || assetHandler === undefined) throw new Error("asset handler missing");
      const base64 = await base64Handler(event, fixture.reference);
      const asset = await assetHandler(event, fixture.reference);

      // Then: neither bridge reaches disk IO, while an ordinary legacy Save keeps the string intact.
      expect(base64).toMatchObject({ success: false });
      expect(asset).toMatchObject({ success: false });
      expect(stat).not.toHaveBeenCalled();
      expect(diskRead).not.toHaveBeenCalled();
      const saved = await service.save({
        expectedSessionId: opened.session.sessionId,
        rendererGeneration: parseRendererGeneration(1),
        workspaceGeneration: opened.session.committedWorkspaceGeneration,
        snapshot: opened.session.data,
      });
      expect(saved.success).toBe(true);
      const stored = parseLegacyProjectDocument(JSON.parse(await readFile(fixture.projectPath, "utf8")));
      expect(stored.pages[0]?.blocks[0]?.props["src"]).toBe(fixture.reference);
    },
  );
});
