import { expect, type Dialog, type Page } from "@playwright/test";
import type { AmagonHarness } from "./electronHarness";
import { queueNativeDialogs } from "./electronHarness";

const projectUiStepTimeoutMs = 15_000;

type ProjectUiRequest = {
  readonly harness: AmagonHarness;
  readonly filePath: string;
};

type NewProjectUiRequest = ProjectUiRequest & {
  readonly name: string;
};

type MediaUiRequest = {
  readonly harness: AmagonHarness;
  readonly filePaths: readonly string[];
  readonly kind: "image" | "video";
};

export const answerConfirmations = (page: Page, answers: readonly boolean[]): void => {
  const queue = [...answers];
  const answerDialog = async (dialog: Dialog): Promise<void> => {
    const answer = queue.shift();
    if (answer === undefined) throw new TypeError(`unexpected confirmation: ${dialog.message()}`);
    if (queue.length === 0) page.off("dialog", answerDialog);
    if (answer) await dialog.accept();
    else await dialog.dismiss();
  };
  page.on("dialog", answerDialog);
};

export const settleEditor = async (harness: AmagonHarness): Promise<void> => {
  await expect(harness.page.locator("#html-editor-layout")).toBeVisible();
  const onboarding = harness.page.getByRole("button", { name: "Skip for now" });
  if (await onboarding.isVisible()) await onboarding.click();
  await expect(harness.page.getByText("Loading...", { exact: true })).toHaveCount(0);
};

export const createProjectThroughUi = async (request: NewProjectUiRequest): Promise<void> => {
  await queueNativeDialogs(request.harness.app, { saves: [request.filePath] });
  const newProject = request.harness.page.getByRole("button", { name: /New Project/u });
  await expect(newProject).toBeVisible({ timeout: projectUiStepTimeoutMs });
  await newProject.click({ timeout: projectUiStepTimeoutMs });
  await request.harness.page.getByLabel("Project Name").fill(request.name);
  await request.harness.page.getByRole("button", { name: "Create Project" }).click();
  await settleEditor(request.harness);
};

export const openProjectThroughUi = async (request: ProjectUiRequest): Promise<void> => {
  await queueNativeDialogs(request.harness.app, { opens: [[request.filePath]] });
  const welcomeOpen = request.harness.page.getByRole("button", { name: /Open Project/u });
  if (await welcomeOpen.isVisible()) await welcomeOpen.click();
  else await request.harness.page.keyboard.press("Control+O");
  await settleEditor(request.harness);
};

export const importMediaThroughUi = async (request: MediaUiRequest): Promise<void> => {
  await queueNativeDialogs(request.harness.app, { opens: [request.filePaths] });
  await request.harness.page.getByTitle("Asset Manager").click();
  await expect(request.harness.page.getByRole("heading", { name: "Asset Manager" })).toBeVisible();
  const addMedia = request.harness.page.getByRole("button", { name: "+ Add Media" });
  await expect(addMedia).toBeEnabled();
  await addMedia.click();
  const mediaKind = request.harness.page.getByRole("button", {
    name: request.kind === "image" ? "Add Images" : "Add Video",
  });
  await expect(mediaKind).toBeVisible();
  await mediaKind.click();
  for (const filePath of request.filePaths) {
    await expect(request.harness.page.getByTitle(filePath.split(/[\\/]/u).at(-1) ?? filePath)).toBeVisible();
  }
  await request.harness.page.locator(".am-close-btn").click();
  await expect(request.harness.page.getByRole("heading", { name: "Asset Manager" })).toHaveCount(0);
};

export const importFontThroughUi = async (request: ProjectUiRequest): Promise<void> => {
  await queueNativeDialogs(request.harness.app, { opens: [[request.filePath]] });
  await request.harness.page.getByTitle("Theme Editor").click();
  await request.harness.page.getByRole("button", { name: "Fonts" }).click();
  await request.harness.page.getByRole("button", { name: /Import Font File/u }).click();
  await expect(request.harness.page.getByText(/Imported 1 font file/u)).toBeVisible();
  await request.harness.page.getByRole("button", { name: "Close" }).click();
};
