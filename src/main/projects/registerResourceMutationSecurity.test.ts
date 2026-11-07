// @vitest-environment node

import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronState = vi.hoisted(() => {
  const mainFrame = {};
  const sender = { id: 1, mainFrame };
  return {
    sender,
    handlers: new Map<string, (...arguments_: readonly unknown[]) => unknown>(),
    showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] as string[] })),
    downloadMedia: vi.fn(),
  };
});

vi.mock("electron", () => ({
  BrowserWindow: class BrowserWindow {
    readonly webContents = electronState.sender;
  },
  dialog: { showOpenDialog: electronState.showOpenDialog },
  ipcMain: {
    handle: (channel: string, handler: (...arguments_: readonly unknown[]) => unknown) => electronState.handlers.set(channel, handler),
    removeHandler: (channel: string) => electronState.handlers.delete(channel),
  },
}));

vi.mock("../mediaDownload", () => ({ downloadAndImportMedia: electronState.downloadMedia }));

import { BrowserWindow } from "electron";
import { parseProjectSessionId } from "../../shared/projects/projectIpcContract";
import { registerAssetMutationIpc } from "./registerAssetMutationIpc";
import {registerAssetMaintenanceIpc} from './registerAssetMaintenanceIpc';
import {TEST_PROJECT} from './amgArchiveFixtures';
import { registerFontMutationIpc } from "./registerFontMutationIpc";
import type { ProjectResourceContext } from "./projectResourceContext";
import { ProjectSession, ProjectSessionRegistry } from "./projectSession";
import { createProjectTransferRegistry } from "./projectTransferRegistry";

const roots: string[] = [];

const createContext = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-resource-security-"));
  roots.push(root);
  const workspacePath = path.join(root, "workspace");
  await mkdir(workspacePath);
  const sessions = new ProjectSessionRegistry();
  const session = ProjectSession.createLegacyJson({ sourcePath: path.join(root, "legacy.json"), workspacePath });
  sessions.activate(session);
  if (session.id === null) throw new TypeError("fixture session has no id");
  const abortSession = vi.fn();
  const transfers = createProjectTransferRegistry();
  const context: ProjectResourceContext = {
    sessions,
    transfers: { ...transfers, abortSession },
    projectFiles: { listAssetPaths: vi.fn(async () => []) },
    getMainWindow: () => new BrowserWindow(),
    resolveSystemFontPath: vi.fn(async () => null),
    fetchGoogleFontsText: vi.fn(async () => "src: url(https://fonts.gstatic.com/font.woff2)"),
    googleFontsMaxBytes: 1024,
  };
  return { root, workspacePath, sessions, sessionId: parseProjectSessionId(session.id), context, abortSession };
};

const invoke = async (channel: string, request: unknown): Promise<unknown> => {
  const handler = electronState.handlers.get(channel);
  if (handler === undefined) throw new TypeError(`missing handler: ${channel}`);
  return handler({ sender: electronState.sender, senderFrame: electronState.sender.mainFrame }, request);
};

beforeEach(() => {
  electronState.handlers.clear();
  electronState.showOpenDialog.mockReset();
  electronState.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
  electronState.downloadMedia.mockReset();
});

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("resource mutation security", () => {
  it('rechecks cleanup usage and workspace generation before moving files, then supports Undo', async () => {
    const fixture = await createContext();
    const {createDefaultProjectServiceFiles} = await import('./projectServiceFiles');
    registerAssetMaintenanceIpc({...fixture.context, projectFiles: createDefaultProjectServiceFiles()});
    await mkdir(path.join(fixture.workspacePath, 'assets'));
    await writeFile(path.join(fixture.workspacePath, 'assets/used.png'), 'used');
    await writeFile(path.join(fixture.workspacePath, 'assets/unused.png'), 'unused');
    const snapshot = {...TEST_PROJECT, customCss: '.used {background:url(assets/used.png)}'};
    const request = {expectedSessionId: fixture.sessionId, snapshot, workspaceGeneration: 0};
    expect(await invoke('assets:cleanupUnused', {...request, keys: ['file:assets/used.png']})).toMatchObject({success: false, changed: false});
    expect(await invoke('assets:cleanupUnused', {...request, workspaceGeneration: 1, keys: ['file:assets/unused.png']})).toMatchObject({success: false, changed: false});
    const result = await invoke('assets:cleanupUnused', {...request, keys: ['file:assets/unused.png']});
    expect(result).toMatchObject({success: true, changed: true, workspaceGeneration: 1, value: {paths: ['assets/unused.png'], fontIds: [], failed: []}});
    if (typeof result !== 'object' || result === null || !('value' in result) || typeof result.value !== 'object' || result.value === null || !('token' in result.value)) throw new Error('Missing cleanup token');
    expect(await invoke('assets:undoCleanup', {expectedSessionId: fixture.sessionId, token: result.value.token})).toMatchObject({success: true, changed: true, workspaceGeneration: 2, value: {paths: ['assets/unused.png'], remaining: 0}});
    expect(await readFile(path.join(fixture.workspacePath, 'assets/unused.png'), 'utf8')).toBe('unused');
    expect(await readFile(path.join(fixture.workspacePath, 'assets/used.png'), 'utf8')).toBe('used');
  });

  it('rejects stale batch repair after the picker and does not write to a retired workspace', async () => {
    const fixture = await createContext();
    registerAssetMaintenanceIpc(fixture.context);
    const source = path.join(fixture.root, 'missing.png');
    await writeFile(source, 'replacement');
    electronState.showOpenDialog.mockImplementationOnce(async () => {
      fixture.sessions.activate(ProjectSession.createLegacyJson({sourcePath: path.join(fixture.root, 'other.json'), workspacePath: fixture.workspacePath}));
      return {canceled: false, filePaths: [source]};
    });
    expect(await invoke('assets:repairMany', {expectedSessionId: fixture.sessionId, relativePaths: ['assets/missing.png']})).toMatchObject({success: false, changed: false, error: {code: 'STALE_SESSION'}});
    await expect(readFile(path.join(fixture.workspacePath, 'assets/missing.png'))).rejects.toMatchObject({code: 'ENOENT'});
  });

  it('cancels batch repair and rejects traversal before opening a picker', async () => {
    const fixture = await createContext();
    registerAssetMaintenanceIpc(fixture.context);
    expect(await invoke('assets:repairMany', {expectedSessionId: fixture.sessionId, relativePaths: ['assets/../outside.png']})).toMatchObject({success: false, changed: false});
    expect(electronState.showOpenDialog).not.toHaveBeenCalled();
    expect(await invoke('assets:repairMany', {expectedSessionId: fixture.sessionId, relativePaths: ['assets/missing.png']})).toMatchObject({success: false, canceled: true, changed: false});
  });

  it("inventories nested media, fonts and other assets for the current session", async () => {
    const fixture = await createContext();
    const paths = ["assets/nested/hero.png", "assets/fonts/nested/font.woff2", "assets/theme.css"];
    for (const relativePath of paths) {
      await mkdir(path.dirname(path.join(fixture.workspacePath, relativePath)), {recursive: true});
      await writeFile(path.join(fixture.workspacePath, relativePath), "fixture");
    }
    const {createDefaultProjectServiceFiles} = await import("./projectServiceFiles");
    registerAssetMutationIpc({...fixture.context, projectFiles: createDefaultProjectServiceFiles()});
    expect(await invoke("assets:listPaths", {expectedSessionId: fixture.sessionId})).toEqual({success: true, sessionId: fixture.sessionId, paths: [...paths].sort()});
    expect(await invoke("assets:listPaths", {expectedSessionId: parseProjectSessionId("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB")})).toMatchObject({success: false});
  });

  it("repairs an exact missing filename through a picker without replacing existing assets", async () => {
    const fixture = await createContext();
    const source = path.join(fixture.root, "replacement.png");
    await writeFile(source, "replacement bytes");
    const {createDefaultProjectServiceFiles} = await import("./projectServiceFiles");
    registerAssetMutationIpc({...fixture.context, projectFiles: createDefaultProjectServiceFiles()});
    electronState.showOpenDialog.mockResolvedValue({canceled: false, filePaths: [source]});
    const relativePath = "assets/nested/Missing %20.png";
    const result = await invoke("assets:repairMissing", {expectedSessionId: fixture.sessionId, relativePath});
    expect(result).toMatchObject({success: true, changed: true, workspaceGeneration: 1, value: {
      relativePath, path: `app-media://project-asset/${fixture.sessionId}/assets/nested/Missing%20%2520.png`,
    }});
    expect(await readFile(path.join(fixture.workspacePath, relativePath), "utf8")).toBe("replacement bytes");
    await writeFile(source, "different bytes");
    expect(await invoke("assets:repairMissing", {expectedSessionId: fixture.sessionId, relativePath})).toMatchObject({success: false, changed: false});
    expect(await readFile(path.join(fixture.workspacePath, relativePath), "utf8")).toBe("replacement bytes");
    expect(electronState.showOpenDialog).toHaveBeenCalledTimes(1);
  });

  it.each(["../outside.png", "assets/../outside.png", "other/file.png"])("rejects a repair target outside assets: %s", async relativePath => {
    const fixture = await createContext();
    registerAssetMutationIpc(fixture.context);
    expect(await invoke("assets:repairMissing", {expectedSessionId: fixture.sessionId, relativePath})).toMatchObject({success: false, changed: false});
    expect(electronState.showOpenDialog).not.toHaveBeenCalled();
  });

  it("cancels repair without changing the workspace", async () => {
    const fixture = await createContext();
    registerAssetMutationIpc(fixture.context);
    expect(await invoke("assets:repairMissing", {expectedSessionId: fixture.sessionId, relativePath: "assets/missing.png"})).toMatchObject({success: false, canceled: true, changed: false});
    expect(await readdir(fixture.workspacePath)).toEqual([]);
  });

  it("does not repair a retired session after the file picker returns", async () => {
    const fixture = await createContext();
    registerAssetMutationIpc(fixture.context);
    electronState.showOpenDialog.mockImplementationOnce(async () => {
      fixture.sessions.activate(ProjectSession.createLegacyJson({sourcePath: path.join(fixture.root, "other.json"), workspacePath: fixture.workspacePath}));
      return {canceled: false, filePaths: [path.join(fixture.root, "replacement.png")]};
    });
    expect(await invoke("assets:repairMissing", {expectedSessionId: fixture.sessionId, relativePath: "assets/missing.png"})).toMatchObject({success: false, changed: false, error: {code: "STALE_SESSION"}});
    expect(await readdir(fixture.workspacePath)).toEqual([]);
  });

  it("refuses repair through a workspace junction", async () => {
    const fixture = await createContext();
    const outside = path.join(fixture.root, "outside");
    await mkdir(outside);
    await symlink(outside, path.join(fixture.workspacePath, "assets"), "junction");
    registerAssetMutationIpc(fixture.context);
    expect(await invoke("assets:repairMissing", {expectedSessionId: fixture.sessionId, relativePath: "assets/missing.png"})).toMatchObject({success: false, changed: false});
    expect(await readdir(outside)).toEqual([]);
    expect(electronState.showOpenDialog).not.toHaveBeenCalled();
  });

  it.each([
    ["with space.png", "with%20space.png"],
    ["100%.png", "100%25.png"],
    ["literal%20name.png", "literal%2520name.png"],
    ["café.png", "caf%C3%A9.png"],
    ["hash#name.png", "hash%23name.png"],
    ["literal%2Fname.png", "literal%252Fname.png"],
  ])("imports literal filename %s through every media picker", async (fileName, encodedName) => {
    const fixture = await createContext();
    const sourcePath = path.join(fixture.root, fileName);
    await writeFile(sourcePath, "media bytes");
    registerAssetMutationIpc(fixture.context);
    electronState.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [sourcePath] });
    for (const channel of ["assets:selectImage", "assets:selectSingleImage", "assets:selectVideo"]) {
      const result = await invoke(channel, { expectedSessionId: fixture.sessionId });
      const expectedAsset = {
        name: fileName,
        path: `app-media://project-asset/${fixture.sessionId}/assets/${encodedName}`,
        relativePath: `assets/${fileName}`,
      };
      expect(result).toMatchObject({
        success: true,
        value: channel === "assets:selectSingleImage" ? expectedAsset : [expectedAsset],
      });
      expect(await readFile(path.join(fixture.workspacePath, "assets", fileName), "utf8")).toBe("media bytes");
      await rm(path.join(fixture.workspacePath, "assets", fileName));
    }
  });

  it("classifies a physically copied system font as a portable import", async () => {
    const fixture = await createContext();
    const sourcePath = path.join(fixture.root, "impact.ttf");
    await writeFile(sourcePath, "font bytes");
    registerFontMutationIpc({ ...fixture.context, resolveSystemFontPath: async () => sourcePath });
    const result = await invoke("fonts:copySystemFont", {
      expectedSessionId: fixture.sessionId, familyName: "Impact",
    });
    expect(result).toMatchObject({ success: true, value: [{
      name: "Impact", source: "imported", relativePath: "assets/fonts/impact.ttf",
    }] });
    expect(await readFile(path.join(fixture.workspacePath, "assets/fonts/impact.ttf"), "utf8")).toBe("font bytes");
  });

  it.each([
    ["assets:selectImage", registerAssetMutationIpc],
    ["fonts:importFile", registerFontMutationIpc],
  ])("rejects a stale %s request before opening its picker", async (channel, register) => {
    // Given: an active project and a request naming a foreign session.
    const fixture = await createContext();
    register(fixture.context);
    const foreignSessionId = parseProjectSessionId("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");

    // When: the foreign renderer invokes a native picker mutation.
    const result = await invoke(channel, { expectedSessionId: foreignSessionId });

    // Then: validation stops the request before dialog, inventory, transfer, or write side effects.
    expect(result).toMatchObject({ success: false, changed: false, error: { code: "STALE_SESSION" } });
    expect(electronState.showOpenDialog).not.toHaveBeenCalled();
    expect(fixture.context.projectFiles.listAssetPaths).not.toHaveBeenCalled();
    expect(fixture.abortSession).not.toHaveBeenCalled();
  });

  it.each([
    ["assets:delete", registerAssetMutationIpc, "assets", "assets/victim.txt"],
    ["fonts:deleteFont", registerFontMutationIpc, "assets/fonts", "assets/fonts/victim.txt"],
  ])("rejects %s through a junction without changing the outside sentinel", async (channel, register, linkedDirectory, relativePath) => {
    // Given: an active legacy workspace whose mutation directory redirects outside.
    const fixture = await createContext();
    const outside = path.join(fixture.root, "outside-delete");
    const linkedParent = path.dirname(path.join(fixture.workspacePath, ...linkedDirectory.split("/")));
    await mkdir(linkedParent, { recursive: true });
    await mkdir(outside);
    await writeFile(path.join(outside, "victim.txt"), "outside sentinel");
    await symlink(outside, path.join(fixture.workspacePath, ...linkedDirectory.split("/")), "junction");
    register(fixture.context);

    // When: deletion names the lexically valid project-relative asset.
    const result = await invoke(channel, {
      expectedSessionId: fixture.sessionId,
      relativePath,
    });

    // Then: the mutation fails and never renames or removes the outside file.
    expect(result).toMatchObject({ success: false, changed: false });
    expect(await readFile(path.join(outside, "victim.txt"), "utf8")).toBe("outside sentinel");
    expect(await readdir(outside)).toEqual(["victim.txt"]);
  });

  it.each([
    ["assets:delete", registerAssetMutationIpc, "assets", "assets/removable.txt"],
    ["fonts:deleteFont", registerFontMutationIpc, "assets/fonts", "assets/fonts/removable.txt"],
  ])("keeps regular %s behavior compatible", async (channel, register, targetDirectory, relativePath) => {
    // Given: a regular project asset or font selected for deletion.
    const fixture = await createContext();
    const directory = path.join(fixture.workspacePath, ...targetDirectory.split("/"));
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "removable.txt"), "project-owned bytes");
    register(fixture.context);

    // When: the active project requests deletion.
    const result = await invoke(channel, { expectedSessionId: fixture.sessionId, relativePath });

    // Then: the existing result contract succeeds without a leftover delete backup.
    expect(result).toMatchObject({ success: true });
    expect(await readdir(directory)).toEqual([]);
  });

  it.each([
    ["assets:selectImage", registerAssetMutationIpc],
    ["fonts:importFile", registerFontMutationIpc],
  ])("opens and cancels the trusted %s picker without mutating", async (channel, register) => {
    // Given: a request for the active project and a canceled native dialog.
    const fixture = await createContext();
    register(fixture.context);

    // When: the trusted renderer invokes the picker.
    const result = await invoke(channel, { expectedSessionId: fixture.sessionId });

    // Then: the picker opens once and cancellation remains side-effect free.
    expect(result).toMatchObject({ success: false, canceled: true, changed: false });
    expect(electronState.showOpenDialog).toHaveBeenCalledOnce();
    expect(fixture.context.projectFiles.listAssetPaths).not.toHaveBeenCalled();
  });

  it("rejects Google-font rollback through a junction without deleting the outside sentinel", async () => {
    // Given: the first variant appears complete, the second fails, and fonts redirects outside.
    const fixture = await createContext();
    const assets = path.join(fixture.workspacePath, "assets");
    const outside = path.join(fixture.root, "outside-fonts");
    await mkdir(assets);
    await mkdir(outside);
    await writeFile(path.join(outside, "outside-font.woff2"), "outside font sentinel");
    await symlink(outside, path.join(assets, "fonts"), "junction");
    electronState.downloadMedia
      .mockResolvedValueOnce({ success: true, relativePath: "assets/fonts/outside-font.woff2" })
      .mockResolvedValueOnce({ success: false, error: "injected second download failure" });
    registerFontMutationIpc(fixture.context);

    // When: the batch rolls back its completed relative path.
    const result = await invoke("fonts:downloadGoogleFont", {
      expectedSessionId: fixture.sessionId,
      family: "Inter",
      variants: [
        { weight: "400", style: "normal" },
        { weight: "700", style: "normal" },
      ],
    });

    // Then: rollback is rejected before following the junction to the outside file.
    expect(result).toMatchObject({ success: false });
    expect(await readFile(path.join(outside, "outside-font.woff2"), "utf8")).toBe("outside font sentinel");
    expect(await readdir(outside)).toEqual(["outside-font.woff2"]);
  });

  it("keeps regular Google-font rollback cleanup compatible", async () => {
    // Given: a completed first font and a failing second variant in a regular workspace.
    const fixture = await createContext();
    const fonts = path.join(fixture.workspacePath, "assets", "fonts");
    await mkdir(fonts, { recursive: true });
    await writeFile(path.join(fonts, "completed.woff2"), "completed font");
    electronState.downloadMedia
      .mockResolvedValueOnce({ success: true, relativePath: "assets/fonts/completed.woff2" })
      .mockResolvedValueOnce({ success: false, error: "injected second download failure" });
    registerFontMutationIpc(fixture.context);

    // When: the batch rolls back after its second variant fails.
    const result = await invoke("fonts:downloadGoogleFont", {
      expectedSessionId: fixture.sessionId,
      family: "Inter",
      variants: [
        { weight: "400", style: "normal" },
        { weight: "700", style: "normal" },
      ],
    });

    // Then: the project-owned completed font is removed with no cleanup residue.
    expect(result).toMatchObject({ success: false });
    expect(await readdir(fonts)).toEqual([]);
  });
});
