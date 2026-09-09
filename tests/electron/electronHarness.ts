import type { ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
export { capture, EVIDENCE_ROOT } from "./electronCapture";
import {
  captureProcessTree,
  isSameCapturedProcess,
  readLiveCapturedProcesses,
  terminateCapturedProcessTree,
  type ProcessIdentity,
} from "./processOwnership";

export type DialogPlan = {
  readonly opens?: readonly (readonly string[])[];
  readonly saves?: readonly (string | null)[];
};

export type AmagonHarness = {
  readonly app: ElectronApplication;
  readonly page: Page;
  readonly profilePath: string;
  readonly process: ChildProcess;
  readonly mainProcessId: number;
  readonly launchToken: string;
  readonly processTree: readonly ProcessIdentity[];
  readonly pageErrors: readonly string[];
};

const electronStepTimeoutMs = 15_000;
const electronCloseTimeoutMessage = "Electron application did not close within the bounded cleanup interval";
const electronProcessExitTimeoutMessage = "Electron process tree did not exit within the bounded cleanup interval";
const processPollIntervalMs = 100;
const profileRemovalRetries = 5;

type ElectronProcessTarget = {
  readonly mainProcessId: number;
  readonly processTree: readonly ProcessIdentity[];
  readonly profilePath: string;
  readonly launchToken: string;
};

const delay = async (milliseconds: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
};

const waitForProcessTreeExit = async (processTree: readonly ProcessIdentity[]): Promise<void> => {
  const deadline = Date.now() + electronStepTimeoutMs;
  let remaining = await readLiveCapturedProcesses(processTree);
  while (remaining.length > 0 && Date.now() < deadline) {
    await delay(processPollIntervalMs);
    remaining = await readLiveCapturedProcesses(processTree);
  }
  if (remaining.length > 0) {
    throw new Error(`${electronProcessExitTimeoutMessage}: ${remaining.map((process) => process.pid).join(", ")}`);
  }
};

const removeProfileDirectory = async (profilePath: string, processTree: readonly ProcessIdentity[]): Promise<void> => {
  try {
    await rm(profilePath, {
      force: true,
      maxRetries: profileRemovalRetries,
      recursive: true,
      retryDelay: processPollIntervalMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown profile removal failure";
    throw new Error(`failed to remove Electron profile ${profilePath} after process tree ${processTree.map((process) => process.pid).join(", ")} exited: ${message}`);
  }
};

const waitForRendererReady = async (page: Page, pageErrors: readonly string[]): Promise<void> => {
  try {
    await page.waitForFunction(() => (
      document.querySelector("#html-editor-layout") !== null
      || [...document.querySelectorAll("button")].some((button) => button.textContent?.includes("New Project") === true)
    ), undefined, { timeout: electronStepTimeoutMs });
  } catch (error) {
    const state = await page.evaluate(() => ({
      bodyText: document.body.innerText.slice(0, 500),
      hasEditor: document.querySelector("#html-editor-layout") !== null,
      hasWelcome: [...document.querySelectorAll("button")].some((button) => button.textContent?.includes("New Project") === true),
      loadingCount: [...document.querySelectorAll("body *")].filter((element) => element.textContent?.trim() === "Loading...").length,
    })).catch((inspectionError: unknown) => {
      if (inspectionError instanceof Error) return { bodyText: inspectionError.message, hasEditor: false, hasWelcome: false, loadingCount: -1 };
      throw inspectionError;
    });
    const message = error instanceof Error ? error.message : "unknown readiness error";
    throw new Error(`renderer did not reach welcome or editor: ${JSON.stringify({ state, pageErrors, message })}`);
  }
};

const waitForElectronClose = async (closing: Promise<void>): Promise<void> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      closing,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(electronCloseTimeoutMessage)), electronStepTimeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
};

const closeElectronApplication = async (
  app: ElectronApplication,
  target: ElectronProcessTarget,
): Promise<void> => {
  const refreshedTree = await captureProcessTree(target.mainProcessId, target.profilePath, target.launchToken);
  const activeProcessTree = [
    ...target.processTree,
    ...refreshedTree.filter((candidate) => !target.processTree.some((captured) => isSameCapturedProcess(captured, candidate))),
  ];
  const closing = app.close();
  let closeError: unknown;
  try {
    await waitForElectronClose(closing);
  } catch (error) {
    if (!(error instanceof Error)
      || (!error.message.includes("Target page, context or browser has been closed")
        && error.message !== electronCloseTimeoutMessage)) {
      closeError = error;
    }
  }
  try {
    await waitForProcessTreeExit(activeProcessTree);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith(electronProcessExitTimeoutMessage)) throw error;
    await terminateCapturedProcessTree(activeProcessTree, target.profilePath);
    await waitForProcessTreeExit(activeProcessTree);
  }
  if (closeError !== undefined) {
    throw closeError;
  }
};

export const launchAmagon = async (tempRoot: string): Promise<AmagonHarness> => {
  const profilePath = path.join(tempRoot, "profile");
  const launchToken = randomUUID();
  await mkdir(profilePath, { recursive: true });
  const environment = { ...process.env, NODE_ENV: "test" };
  delete environment.ELECTRON_RENDERER_URL;
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({
      args: [
        path.resolve("out/main/index.js"),
        `--user-data-dir=${profilePath}`,
        `--amagon-e2e-token=${launchToken}`,
        "--disable-gpu",
      ],
      env: environment,
      timeout: electronStepTimeoutMs,
    });
    const process = app.process();
    if (process.pid === undefined) throw new TypeError("launched Electron application has no process id");
    const mainProcessId = await app.evaluate(() => process.pid);
    if (!Number.isSafeInteger(mainProcessId) || mainProcessId <= 0) throw new TypeError("launched Electron main process has no process id");
    const processTree = await captureProcessTree(mainProcessId, profilePath, launchToken);
    if (processTree.length === 0) throw new TypeError("launched Electron application identity could not be captured");
    const page = await app.firstWindow({ timeout: electronStepTimeoutMs });
    await page.waitForLoadState("domcontentloaded", { timeout: electronStepTimeoutMs });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await waitForRendererReady(page, pageErrors);
    return { app, page, profilePath, process, mainProcessId, launchToken, processTree, pageErrors };
  } catch (error) {
    let cleanupError: unknown;
    if (app !== null) {
      const process = app.process();
      const mainProcessId = await app.evaluate(() => process.pid);
      const processTree = await captureProcessTree(mainProcessId, profilePath, launchToken);
      try {
        await closeElectronApplication(app, { mainProcessId, processTree, profilePath, launchToken });
      } catch (closeError) {
        cleanupError = closeError;
      }
      try {
        await removeProfileDirectory(profilePath, processTree);
      } catch (profileError) {
        cleanupError ??= profileError;
      }
    } else {
      try {
        await removeProfileDirectory(profilePath, []);
      } catch (profileError) {
        cleanupError = profileError;
      }
    }
    if (cleanupError !== undefined && !(error instanceof Error)) throw cleanupError;
    throw error;
  }
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
  let cleanupError: unknown;
  try {
    if (harness.app.windows().length > 0) {
      await harness.app.evaluate(({ app }) => app.exit(0));
    }
  } catch (error) {
    cleanupError = error;
  }
  try {
    await closeElectronApplication(harness.app, harness);
  } catch (error) {
    cleanupError ??= error;
  }
  if (removeProfile) {
    try {
      await removeProfileDirectory(harness.profilePath, harness.processTree);
    } catch (error) {
      cleanupError ??= error;
    }
  }
  if (cleanupError !== undefined) throw cleanupError;
};

export const sendAutosaveTick = async (harness: AmagonHarness): Promise<void> => {
  await harness.app.evaluate(({ BrowserWindow }, pageUrl) => {
    const window = BrowserWindow.getAllWindows().find((candidate) => candidate.webContents.getURL() === pageUrl);
    if (window === undefined) throw new TypeError(`no Electron window found for ${pageUrl}`);
    window.webContents.send("auto-save-tick");
  }, harness.page.url());
};
