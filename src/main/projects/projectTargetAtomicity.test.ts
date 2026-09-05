// @vitest-environment node

import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseRendererGeneration,
  parseWorkspaceGeneration,
} from "../../shared/projects/projectIpcContract";
import { createProjectService } from "./projectService";
import { createDefaultProjectServiceFiles } from "./projectServiceFiles";
import type { RecentProjectsStore } from "./recentProjects";

class RecentPersistFault extends Error {
  readonly name = "RecentPersistFault";
}

const targetExists = async (targetPath: string): Promise<boolean> => stat(targetPath).then(
  () => true,
  (error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  },
);

describe("project target atomicity", () => {
  it.each([
    { failure: "recents", operation: "new", priorTarget: "absent" },
    { failure: "recents", operation: "new", priorTarget: "existing" },
    { failure: "recents", operation: "save-as", priorTarget: "absent" },
    { failure: "recents", operation: "save-as", priorTarget: "existing" },
    { failure: "directory", operation: "new", priorTarget: "existing" },
    { failure: "directory", operation: "save-as", priorTarget: "existing" },
  ] as const)("restores an $priorTarget target when $operation fails during $failure", async ({ failure, operation, priorTarget }) => {
    // Given: a real active project and a target with known absent or byte-exact prior state.
    const root = await mkdtemp(path.join(tmpdir(), "amg-target-atomicity-"));
    try {
      const userDataPath = path.join(root, "user-data");
      const documentsPath = path.join(root, "documents");
      const priorPath = path.join(root, "prior.amg");
      const targetPath = path.join(root, "candidate.amg");
      await mkdir(userDataPath, { recursive: true });
      await mkdir(documentsPath, { recursive: true });
      const priorBytes = Buffer.from("pre-existing target bytes\n", "utf8");
      if (priorTarget === "existing") await writeFile(targetPath, priorBytes);
      let failRecents = false;
      let failDirectory = false;
      const recentPaths: string[] = [];
      const recents: RecentProjectsStore = {
        list: async () => [],
        add: async (projectPath) => {
          if (failRecents) throw new RecentPersistFault("recent persistence failed");
          recentPaths.push(projectPath);
        },
        remove: async () => [],
        resolvePath: async () => priorPath,
      };
      const saveTargets = [priorPath, targetPath];
      const service = createProjectService({
        userDataPath,
        documentsPath,
        recents,
        dialogs: {
          showSave: async () => ({ canceled: false, filePath: saveTargets.shift() }),
          showOpen: async () => ({ canceled: true, filePaths: [] }),
        },
        onDirectoryChange: () => {
          if (failDirectory) throw new RecentPersistFault("directory activation failed");
        },
      });
      const created = await service.newProject({
        expectedSessionId: null,
        rendererGeneration: parseRendererGeneration(0),
        workspaceGeneration: parseWorkspaceGeneration(0),
        snapshot: null,
        dirtyChoice: "discard",
        name: "Prior",
        framework: "vanilla",
      });
      if (!created.success) throw new RecentPersistFault("prior project setup failed");
      const priorDirectory = (await service.getDirectory()).directory;
      if (priorDirectory === null) throw new RecentPersistFault("prior workspace setup failed");
      const workspaceSentinel = await readFile(path.join(priorDirectory, ".amagon-workspace.json"));
      failRecents = failure === "recents";
      failDirectory = failure === "directory";

      // When: archive output succeeds, then recents persistence rejects the transition.
      const failed = operation === "new"
        ? await service.newProject({
            expectedSessionId: created.session.sessionId,
            rendererGeneration: created.session.committedRendererGeneration,
            workspaceGeneration: created.session.committedWorkspaceGeneration,
            snapshot: null,
            dirtyChoice: "discard",
            name: "Candidate",
            framework: "vanilla",
          })
        : await service.saveAs({
            expectedSessionId: created.session.sessionId,
            rendererGeneration: parseRendererGeneration(1),
            workspaceGeneration: created.session.committedWorkspaceGeneration,
            snapshot: created.session.data,
          });

      // Then: the target and active project are exactly as they were before the attempt.
      expect(failed).toMatchObject({ success: false, error: { code: "INTERNAL" } });
      expect((await service.getDirectory()).directory).toBe(priorDirectory);
      expect(await readFile(path.join(priorDirectory, ".amagon-workspace.json"))).toEqual(workspaceSentinel);
      if (priorTarget === "existing") {
        expect(await readFile(targetPath)).toEqual(priorBytes);
      } else {
        expect(await targetExists(targetPath)).toBe(false);
      }
      expect((await readdir(root)).some((entry) => entry.endsWith(".amagon-rollback"))).toBe(false);
      expect(recentPaths).toEqual(failure === "recents" ? [priorPath] : [priorPath, targetPath]);
      if (operation === "save-as") {
        const unchangedSession = await service.save({
          expectedSessionId: created.session.sessionId,
          rendererGeneration: created.session.committedRendererGeneration,
          workspaceGeneration: created.session.committedWorkspaceGeneration,
          snapshot: created.session.data,
        });
        expect(unchangedSession.success).toBe(true);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);

  it("keeps the committed replacement when retirement cleanup fails", async () => {
    // Given: a real active project whose old workspace cleanup will fail after replacement commit.
    const root = await mkdtemp(path.join(tmpdir(), "amg-target-retirement-"));
    try {
      const userDataPath = path.join(root, "user-data");
      const targetPaths = [path.join(root, "prior.amg"), path.join(root, "replacement.amg")];
      const defaultFiles = createDefaultProjectServiceFiles();
      let rejectedWorkspace: string | null = null;
      const service = createProjectService({
        userDataPath,
        documentsPath: root,
        dialogs: {
          showSave: async () => ({ canceled: false, filePath: targetPaths.shift() }),
          showOpen: async () => ({ canceled: true, filePaths: [] }),
        },
        recents: {
          list: async () => [],
          add: async () => undefined,
          remove: async () => [],
          resolvePath: async () => path.join(root, "prior.amg"),
        },
        files: {
          ...defaultFiles,
          cleanupWorkspace: async (ownerPath, workspacePath) => {
            if (workspacePath === rejectedWorkspace) throw new RecentPersistFault("retirement cleanup failed");
            await defaultFiles.cleanupWorkspace(ownerPath, workspacePath);
          },
        },
      });
      const prior = await service.newProject({
        expectedSessionId: null,
        rendererGeneration: parseRendererGeneration(0),
        workspaceGeneration: parseWorkspaceGeneration(0),
        snapshot: null,
        dirtyChoice: "discard",
        name: "Prior",
        framework: "vanilla",
      });
      if (!prior.success) throw new RecentPersistFault("prior project setup failed");
      rejectedWorkspace = (await service.getDirectory()).directory;

      // When: the replacement commits, activates, and only old-workspace retirement fails.
      const replacement = await service.newProject({
        expectedSessionId: prior.session.sessionId,
        rendererGeneration: prior.session.committedRendererGeneration,
        workspaceGeneration: prior.session.committedWorkspaceGeneration,
        snapshot: null,
        dirtyChoice: "discard",
        name: "Replacement",
        framework: "vanilla",
      });

      // Then: the committed archive and replacement session remain the successful outcome.
      expect(replacement).toMatchObject({ success: true, session: { displayPath: path.join(root, "replacement.amg") } });
      expect((await service.getDirectory()).directory).not.toBe(rejectedWorkspace);
      expect(await targetExists(path.join(root, "replacement.amg"))).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 15_000);
});
