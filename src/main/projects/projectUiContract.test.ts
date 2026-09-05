import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const menuChannelPattern = /webContents\.send\(["']([^"']+)["']/u;

const readMenuChannel = (source: string): string => {
  const match = menuChannelPattern.exec(source);
  if (match?.[1] === undefined) throw new TypeError("menu action channel is missing");
  return match[1];
};

describe("Electron project UI harness", () => {
  it("closeProjectThroughUi uses the production menu action channel", async () => {
    const [helperSource, productionSource] = await Promise.all([
      readFile(path.resolve(process.cwd(), "tests", "electron", "projectUi.ts"), "utf8"),
      readFile(path.resolve(process.cwd(), "src", "main", "menu.ts"), "utf8"),
    ]);

    expect(readMenuChannel(helperSource)).toBe(readMenuChannel(productionSource));
    expect(helperSource).not.toContain('"menu-action"');
  });
});
