import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, lstat, mkdir, open, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createWelcomeBlocks } from "../../shared/welcomeBlocks";
import { PROJECT_SCHEMA_VERSION } from "../../shared/projects/amgContract";
import {
  parseLegacyProjectDocument,
  parseProjectDocumentV1,
  type LegacyProjectDocument,
  type ProjectDocumentV1,
} from "../../shared/projects/projectDocumentSchema";
import {
  extractAmgArchive,
  inspectAmgArchiveMetadata,
  type AmgArchiveCandidate,
} from "./amgArchiveReader";
import { writeAmgArchive } from "./amgArchiveWriter";
import { resolveArchivePath, resolveExistingArchiveFile } from "./archivePath";
import { readLegacyJsonProject, saveLegacyJsonProject } from "./legacyJsonProject";
import {
  cleanupOwnedWorkspace,
  createOwnedWorkspaceCandidate,
  type OwnedWorkspace,
} from "./projectWorkspace";

export type CreateWorkspaceCopy = {
  readonly sourceWorkspacePath: string;
  readonly assetPaths: readonly string[];
};

export type WriteAmgRequest = {
  readonly targetPath: string;
  readonly workspacePath: string;
  readonly project: ProjectDocumentV1;
};

export interface ProjectServiceFiles {
  readonly openAmg: (filePath: string, userDataPath: string) => Promise<Pick<AmgArchiveCandidate, "workspace" | "project">>;
  readonly readLegacy: (filePath: string) => Promise<LegacyProjectDocument>;
  readonly writeAmg: (request: WriteAmgRequest) => Promise<void>;
  readonly writeLegacy: (filePath: string, project: LegacyProjectDocument) => Promise<void>;
  readonly createWorkspace: (
    userDataPath: string,
    project: ProjectDocumentV1,
    copy?: CreateWorkspaceCopy,
  ) => Promise<OwnedWorkspace>;
  readonly listAssetPaths: (workspacePath: string) => Promise<readonly string[]>;
  readonly cleanupWorkspace: (userDataPath: string, workspacePath: string) => Promise<void>;
}

export class ProjectServiceFileError extends Error {
  readonly name = "ProjectServiceFileError";

  constructor(readonly code: "unsafe-asset" | "cleanup", message: string) {
    super(message);
  }
}

const isMissing = (error: unknown): boolean => (
  error instanceof Error && "code" in error && error.code === "ENOENT"
);

const copyAllowedAssets = async (
  sourceWorkspacePath: string,
  targetWorkspacePath: string,
  assetPaths: readonly string[],
): Promise<void> => {
  for (const assetPath of assetPaths) {
    const sourcePath = await resolveExistingArchiveFile(sourceWorkspacePath, assetPath);
    const targetPath = resolveArchivePath(targetWorkspacePath, assetPath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(sourcePath, targetPath, constants.COPYFILE_EXCL);
  }
};

const createWorkspace = async (
  userDataPath: string,
  project: ProjectDocumentV1,
  copy?: CreateWorkspaceCopy,
): Promise<OwnedWorkspace> => createOwnedWorkspaceCandidate(userDataPath, async (workspace) => {
  await mkdir(path.join(workspace.path, "assets"));
  await writeFile(
    path.join(workspace.path, "project.json"),
    JSON.stringify(parseProjectDocumentV1(project)),
    { encoding: "utf8", flag: "wx" },
  );
  if (copy !== undefined) {
    await copyAllowedAssets(copy.sourceWorkspacePath, workspace.path, copy.assetPaths);
  }
});

const listAssetPaths = async (workspacePath: string): Promise<readonly string[]> => {
  const assetRoot = path.join(workspacePath, "assets");
  try {
    const rootStats = await lstat(assetRoot);
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
      throw new ProjectServiceFileError("unsafe-asset", "assets root is not a regular directory");
    }
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const assets: string[] = [];
  const walk = async (directory: string, relativeDirectory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = relativeDirectory.length === 0
        ? entry.name
        : `${relativeDirectory}/${entry.name}`;
      const filePath = path.join(directory, entry.name);
      const stats = await lstat(filePath);
      if (stats.isSymbolicLink()) {
        throw new ProjectServiceFileError("unsafe-asset", "asset inventory crosses a link");
      }
      if (stats.isDirectory()) {
        await walk(filePath, relativePath);
      } else if (stats.isFile()) {
        assets.push(`assets/${relativePath}`);
      } else {
        throw new ProjectServiceFileError("unsafe-asset", "asset inventory contains a non-file");
      }
    }
  };
  await walk(assetRoot, "");
  return assets.sort();
};

export const createDefaultProjectServiceFiles = (): ProjectServiceFiles => ({
  openAmg: async (filePath, userDataPath) => {
    const archive = await open(filePath, "r");
    try {
      return await extractAmgArchive({ archive, userDataPath });
    } finally {
      await archive.close();
    }
  },
  readLegacy: readLegacyJsonProject,
  writeAmg: writeAmgArchive,
  writeLegacy: saveLegacyJsonProject,
  createWorkspace,
  listAssetPaths,
  cleanupWorkspace: async (userDataPath, workspacePath) => {
    const result = await cleanupOwnedWorkspace({
      userDataPath,
      workspacePath,
      activeReadLeases: 0,
      ownership: "app",
    });
    if (result.kind !== "removed") {
      throw new ProjectServiceFileError("cleanup", "owned workspace cleanup was not confirmed");
    }
  },
});

export const createInitialProjectDocument = (
  name: string,
  framework: string,
): ProjectDocumentV1 => parseProjectDocumentV1({
  projectSchemaVersion: PROJECT_SCHEMA_VERSION,
  customCss: "",
  projectSettings: {
    name,
    framework,
    theme: {
      name: "Default",
      colors: {
        primary: "#1e66f5",
        secondary: "#6c757d",
        accent: "#7c3aed",
        background: "#ffffff",
        surface: "#f8f9fa",
        text: "#212529",
        textMuted: "#6c757d",
        border: "#dee2e6",
        success: "#198754",
        warning: "#ffc107",
        danger: "#dc3545",
      },
      typography: {
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        headingFontFamily: "inherit",
        baseFontSize: "16px",
        lineHeight: "1.6",
        headingLineHeight: "1.2",
      },
      spacing: { baseUnit: "8px", scale: [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8] },
      borders: { radius: "6px", width: "1px", color: "#dee2e6" },
      customCss: "",
    },
    globalStyles: {},
  },
  pages: [{
    id: `page_${randomUUID()}`,
    title: "Home",
    slug: "index",
    tags: ["nav"],
    blocks: createWelcomeBlocks(name),
    meta: {
      charset: "UTF-8",
      viewport: "width=device-width, initial-scale=1.0",
      description: "",
    },
  }],
  folders: [],
  userBlocks: [],
});

export const validateLegacySnapshot = (input: unknown): LegacyProjectDocument => (
  parseLegacyProjectDocument(input)
);

export const inspectProjectMetadata = async (filePath: string): Promise<{
  readonly name?: string;
  readonly framework?: string;
}> => {
  if (path.extname(filePath).toLowerCase() === ".amg") {
    const archive = await open(filePath, "r");
    try {
      return await inspectAmgArchiveMetadata({ archive });
    } finally {
      await archive.close();
    }
  }
  const project = await readLegacyJsonProject(filePath);
  return {
    name: project.projectSettings.name,
    framework: project.projectSettings.framework,
  };
};
