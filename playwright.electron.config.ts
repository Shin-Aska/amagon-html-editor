import { defineConfig } from "@playwright/test";

const evidenceRoot = ".omo/evidence/amg-bundled-project-format/task-13-amg-bundled-project-format";

export default defineConfig({
  testDir: "./tests/electron",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: `${evidenceRoot}/test-results`,
  reporter: [
    ["list"],
    ["html", { outputFolder: `${evidenceRoot}/playwright-report`, open: "never" }],
  ],
  use: {
    trace: "on",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "amg" }],
});
