import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ElectronApplication, Page } from "@playwright/test";

export const EVIDENCE_ROOT = path.resolve(
  ".omo/evidence/amg-bundled-project-format/task-13-amg-bundled-project-format",
);

export type CaptureIntent = {
  readonly actions: readonly string[];
  readonly state: string;
};

type CaptureHarness = {
  readonly app: ElectronApplication;
  readonly page: Page;
};

type CaptureRecord = CaptureIntent & {
  readonly file: string;
  readonly capturedAt: string;
  readonly source: "real Electron out/main/index.js";
  readonly viewport: { readonly width: number; readonly height: number; readonly devicePixelRatio: number };
  readonly windowBounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
  readonly image: { readonly width: number; readonly height: number; readonly sha256: string };
};

const captureRecords: CaptureRecord[] = [];

export const capture = async (
  harness: CaptureHarness,
  name: string,
  intent: CaptureIntent,
): Promise<string> => {
  await mkdir(EVIDENCE_ROOT, { recursive: true });
  const outputPath = path.join(EVIDENCE_ROOT, name);
  const bytes = await harness.page.screenshot({ path: outputPath, fullPage: true });
  const viewport = await harness.page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  }));
  const windowBounds = await harness.app.evaluate(({ BrowserWindow }, url) => (
    BrowserWindow.getAllWindows().find((window) => window.webContents.getURL() === url)?.getBounds() ?? null
  ), harness.page.url());
  captureRecords.push({
    ...intent,
    file: name,
    capturedAt: new Date().toISOString(),
    source: "real Electron out/main/index.js",
    viewport,
    windowBounds,
    image: {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  });
  await writeFile(
    path.join(EVIDENCE_ROOT, "capture-provenance.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), captures: captureRecords }, null, 2),
  );
  return outputPath;
};
