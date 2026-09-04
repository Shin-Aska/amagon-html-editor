import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";

export const EVIDENCE_ROOT = path.resolve(
  ".omo/evidence/amg-bundled-project-format/task-13-amg-bundled-project-format",
);

export type DialogPlan = {
  readonly opens?: readonly (readonly string[])[];
  readonly saves?: readonly (string | null)[];
};

export type AmagonHarness = {
  readonly app: ElectronApplication;
  readonly page: Page;
  readonly profilePath: string;
  readonly pageErrors: readonly string[];
};

type CaptureIntent = {
  readonly actions: readonly string[];
  readonly state: string;
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

export const launchAmagon = async (tempRoot: string): Promise<AmagonHarness> => {
  const profilePath = path.join(tempRoot, "profile");
  await mkdir(profilePath, { recursive: true });
  const environment = { ...process.env, NODE_ENV: "test" };
  delete environment.ELECTRON_RENDERER_URL;
  const app = await electron.launch({
    args: [
      path.resolve("out/main/index.js"),
      `--user-data-dir=${profilePath}`,
      "--disable-gpu",
    ],
    env: environment,
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  return { app, page, profilePath, pageErrors };
};

export const queueNativeDialogs = async (
  app: ElectronApplication,
  plan: DialogPlan,
): Promise<void> => {
  await app.evaluate(({ dialog }, queued) => {
    const opens = queued.opens.map((filePaths) => ({ canceled: false, filePaths: [...filePaths] }));
    const saves = queued.saves.map((filePath) => filePath === null
      ? { canceled: true, filePath: undefined }
      : { canceled: false, filePath });
    Reflect.set(dialog, "showOpenDialog", async () => (
      opens.shift() ?? { canceled: true, filePaths: [] }
    ));
    Reflect.set(dialog, "showSaveDialog", async () => (
      saves.shift() ?? { canceled: true, filePath: undefined }
    ));
  }, { opens: plan.opens ?? [], saves: plan.saves ?? [] });
};

export const stopAmagon = async (harness: AmagonHarness, removeProfile = true): Promise<void> => {
  if (harness.app.windows().length > 0) {
    await harness.app.evaluate(({ app }) => app.exit(0));
  }
  await harness.app.close().catch((error: unknown) => {
    if (error instanceof Error && error.message.includes("Target page, context or browser has been closed")) return;
    throw error;
  });
  if (removeProfile) await rm(harness.profilePath, { recursive: true, force: true });
};

export const capture = async (
  harness: AmagonHarness,
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
