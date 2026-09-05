// @vitest-environment node

import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadAndImportMedia } from "../mediaDownload";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const temporaryRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
};

describe("media download mutation security", () => {
  it("rejects a linked media destination without changing outside files", async () => {
    // Given: a workspace assets junction and a successful streamed response.
    const workspace = await temporaryRoot("amagon-media-workspace-");
    const outside = await temporaryRoot("amagon-media-outside-");
    await writeFile(path.join(outside, "sentinel.txt"), "outside sentinel");
    await symlink(outside, path.join(workspace, "assets"), "junction");
    const fetcher = vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("downloaded bytes"));
        controller.close();
      },
    }), { status: 200, headers: { "content-type": "image/png" } }));

    // When: a media download targets the linked directory.
    const result = await downloadAndImportMedia({
      url: "https://media.example/linked",
      projectDir: workspace,
      filename: "linked",
      fetcher,
    });

    // Then: the request fails before any outside write or partial is created.
    expect(result.success).toBe(false);
    expect(await readFile(path.join(outside, "sentinel.txt"), "utf8")).toBe("outside sentinel");
    expect(await readdir(outside)).toEqual(["sentinel.txt"]);
  });

  it("keeps a regular workspace download compatible", async () => {
    // Given: a regular workspace and a small streamed response.
    const workspace = await temporaryRoot("amagon-media-control-");
    const fetcher = vi.fn(async () => new Response("regular media", {
      status: 200,
      headers: { "content-type": "image/png" },
    }));

    // When: the download targets the ordinary assets directory.
    const result = await downloadAndImportMedia({
      url: "https://media.example/control",
      projectDir: workspace,
      filename: "control",
      fetcher,
    });

    // Then: the asset is atomically promoted with its existing relative-path contract.
    expect(result).toEqual({ success: true, relativePath: "assets/control.png" });
    expect(await readFile(path.join(workspace, "assets", "control.png"), "utf8")).toBe("regular media");
    expect(await readdir(path.join(workspace, "assets"))).toEqual(["control.png"]);
  });
});
