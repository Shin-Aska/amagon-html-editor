import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const productionModules = [
  "src/main/index.ts",
  "src/main/mainFileHelpers.ts",
  "src/main/googleFontsTransport.ts",
  "src/main/registerAppProtocols.ts",
  "src/main/autosaveController.ts",
  "src/main/registerAutosaveIpc.ts",
  "src/main/mainWindowController.ts",
  "src/main/registerMenuIpc.ts",
  "src/main/registerFontQueryIpc.ts",
  "src/main/registerExportIpc.ts",
  "src/main/registerAssetReadIpc.ts",
  "src/main/registerSettingsIpc.ts",
  "src/main/registerCredentialIpc.ts",
  "src/main/registerPublishIpc.ts",
  "src/main/registerAiIpc.ts",
  "src/main/registerProjectRuntime.ts",
];

describe("main process module size", () => {
  it("keeps the composition root and every extracted module within 250 pure LOC", () => {
    const output = execFileSync(process.execPath, [
      "scripts/check-main-module-loc.mjs",
      ...productionModules,
      "--max",
      "250",
      "--json",
    ], { cwd: process.cwd(), encoding: "utf8" });
    const report: unknown = JSON.parse(output);
    expect(Array.isArray(report)).toBe(true);
    if (!Array.isArray(report)) throw new Error("LOC report was not an array");
    expect(report).toHaveLength(productionModules.length);
    for (const item of report) {
      expect(Reflect.get(item, "pure")).toBeLessThanOrEqual(250);
    }
  });

  it("keeps the main process runtime import graph acyclic", () => {
    expect(() => execFileSync(process.execPath, [
      "scripts/check-main-module-loc.mjs",
      "--assert-no-cycles",
      "src/main/index.ts",
    ], { cwd: process.cwd(), encoding: "utf8" })).not.toThrow();
  });
});
