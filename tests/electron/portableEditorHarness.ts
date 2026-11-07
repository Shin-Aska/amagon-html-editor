import { randomUUID } from "node:crypto";
import path from "node:path";
import { _electron } from "@playwright/test";
import {
  launchAmagon,
  stopAmagon,
  type AmagonHarness,
} from "./electronHarness";

// The existing process-identity harness uses Windows CIM. Keep this smoke test
// portable by owning the Electron handle directly on Linux/macOS.
export async function launchPortableEditor(
  root: string,
): Promise<AmagonHarness> {
  if (process.platform === "win32") return launchAmagon(root);
  const profilePath = path.join(root, "profile");
  const launchToken = randomUUID();
  const env = { ...process.env, NODE_ENV: "test" };
  delete env.ELECTRON_RENDERER_URL;
  const app = await _electron.launch({
    args: [
      path.resolve("out/main/index.js"),
      `--user-data-dir=${profilePath}`,
      "--disable-gpu",
    ],
    env,
  });
  const child = app.process();
  if (!child.pid) throw new Error("Electron process did not start");
  const page = await app.firstWindow();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
  return {
    app,
    page,
    profilePath,
    launchToken,
    mainProcessId: child.pid,
    process: child,
    processTree: [],
    pageErrors,
  };
}

export async function stopPortableEditor(
  harness: AmagonHarness,
): Promise<void> {
  if (process.platform === "win32") return stopAmagon(harness);
  const child = harness.process;
  const exited = new Promise<void>((resolve) => {
    if (child.exitCode !== null) resolve();
    else child.once("exit", () => resolve());
  });
  try {
    await harness.app.evaluate(({ app }) => app.exit(0));
  } catch (error) {
    if (!(error instanceof Error) || !/closed|exited/i.test(error.message))
      throw error;
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      exited,
      new Promise<void>((_, reject) => {
        timeout = setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error("Widget test Electron process did not exit"));
        }, 10_000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
