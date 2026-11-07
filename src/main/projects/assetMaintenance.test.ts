// @vitest-environment node
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseProjectSessionId } from "../../shared/projects/projectIpcContract";
import { batchRepairAssets, matchRepairFiles } from "./batchRepairAssets";
import { AssetCleanup } from "./assetCleanup";

const roots: string[] = [];
const sessionId = parseProjectSessionId("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
const otherSession = parseProjectSessionId("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "amagon-maintenance-"));
  roots.push(root);
  await mkdir(path.join(root, "assets"));
  return root;
};
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
describe("batch missing asset repair", () => {
  it("leaves ambiguous basenames unresolved and prefers exact folder suffixes", () => {
    expect([
      ...matchRepairFiles(
        ["assets/logo.png", "assets/nested/logo.png"],
        ["/backup/logo.png"],
      ),
    ]).toEqual([]);
    expect([
      ...matchRepairFiles(
        ["assets/a/logo.png", "assets/b/logo.png"],
        ["/backup/assets/a/logo.png", "/backup/assets/b/logo.png"],
      ),
    ]).toHaveLength(2);
    expect([
      ...matchRepairFiles(
        ["assets/logo.png"],
        ["/one/logo.png", "/two/logo.png"],
      ),
    ]).toEqual([]);
  });
  it("indexes 10,000 replacement names, including repeated basenames", () => {
    const targets = Array.from(
      { length: 10000 },
      (_, index) => `assets/folder-${index}/logo.png`,
    );
    const sources = targets.map((target) => `/backup/${target}`);
    expect(matchRepairFiles(targets, sources).size).toBe(10000);
  });
  it("repairs nested and percent filenames in one batch without overwriting existing files", async () => {
    const root = await fixture();
    const backup = path.join(root, "backup");
    await mkdir(backup);
    const source = path.join(backup, "100%.png");
    const existing = path.join(root, "assets", "existing.png");
    const existingSource = path.join(backup, "existing.png");
    await writeFile(source, "replacement");
    await writeFile(existingSource, "wrong");
    await writeFile(existing, "keep");
    const result = await batchRepairAssets(
      root,
      ["assets/nested/100%.png", "assets/existing.png", "assets/missing.png"],
      [source, existingSource],
    );
    expect(result.repaired).toEqual(["assets/nested/100%.png"]);
    expect(result.unmatched).toEqual(["assets/missing.png"]);
    expect(result.failed).toHaveLength(1);
    expect(
      await readFile(path.join(root, "assets/nested/100%.png"), "utf8"),
    ).toBe("replacement");
    expect(await readFile(existing, "utf8")).toBe("keep");
  });
});
describe("recoverable unused asset cleanup", () => {
  it("moves unused files outside assets and restores both files and missing entries with Undo", async () => {
    const root = await fixture();
    await writeFile(path.join(root, "assets/unused.png"), "original");
    const cleanup = new AssetCleanup();
    const result = await cleanup.move(root, sessionId, [
      {
        key: "file:assets/unused.png",
        kind: "file",
        relativePath: "assets/unused.png",
        fontIds: ["file-font"],
      },
      {
        key: "missing:assets/fonts/missing.woff2",
        kind: "missing-entry",
        relativePath: "assets/fonts/missing.woff2",
        fontIds: ["missing-font"],
      },
    ]);
    await expect(
      readFile(path.join(root, "assets/unused.png")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(
      await readFile(
        path.join(
          root,
          `.amagon-unused-assets/${result.token}/assets/unused.png`,
        ),
        "utf8",
      ),
    ).toBe("original");
    expect(await cleanup.undo(root, sessionId, result.token)).toEqual({
      paths: ["assets/unused.png"],
      fontIds: ["file-font", "missing-font"],
      remaining: 0,
    });
    expect(await readFile(path.join(root, "assets/unused.png"), "utf8")).toBe(
      "original",
    );
  });
  it("never overwrites a reimported file and allows retrying Undo after a conflict", async () => {
    const root = await fixture();
    const target = path.join(root, "assets/unused.png");
    await writeFile(target, "original");
    const cleanup = new AssetCleanup();
    const result = await cleanup.move(root, sessionId, [
      {
        key: "file:assets/unused.png",
        kind: "file",
        relativePath: "assets/unused.png",
        fontIds: ["font"],
      },
    ]);
    await writeFile(target, "new");
    expect(await cleanup.undo(root, sessionId, result.token)).toEqual({
      paths: [],
      fontIds: [],
      remaining: 1,
    });
    expect(await readFile(target, "utf8")).toBe("new");
    await rm(target);
    expect((await cleanup.undo(root, sessionId, result.token)).remaining).toBe(
      0,
    );
    expect(await readFile(target, "utf8")).toBe("original");
  });
  it("rejects a cleanup token belonging to another session", async () => {
    const root = await fixture();
    const cleanup = new AssetCleanup();
    const result = await cleanup.move(root, sessionId, []);
    await expect(
      cleanup.undo(root, otherSession, result.token),
    ).rejects.toThrow("different project");
  });
  it("refuses to move files through a symlink or junction", async () => {
    const root = await fixture();
    const outside = await fixture();
    await writeFile(path.join(outside, "keep.png"), "keep");
    await symlink(
      outside,
      path.join(root, "assets/linked"),
      process.platform === "win32" ? "junction" : "dir",
    );
    const result = await new AssetCleanup().move(root, sessionId, [
      {
        key: "file:assets/linked/keep.png",
        kind: "file",
        relativePath: "assets/linked/keep.png",
        fontIds: [],
      },
    ]);
    expect(result.paths).toEqual([]);
    expect(result.failed).toHaveLength(1);
    expect(await readFile(path.join(outside, "keep.png"), "utf8")).toBe("keep");
  });
});
