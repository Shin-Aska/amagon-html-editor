import path from "node:path";
import type { ProjectDialogPort } from "./projectServiceTypes";

const AMG_FILTERS = [{ name: "Amagon Project", extensions: ["amg"] }] as const;

export const OPEN_PROJECT_FILTERS = [
  { name: "Amagon Project", extensions: ["amg"] },
  { name: "Legacy Amagon JSON", extensions: ["json"] },
] as const;

export const projectSlug = (name: string): string => {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
  return normalized.length === 0 ? "project" : normalized;
};

const enforcedAmgPath = (selectedPath: string): string | null => {
  const extension = path.extname(selectedPath);
  if (extension.length === 0) return `${selectedPath}.amg`;
  return extension.toLowerCase() === ".amg" ? selectedPath : null;
};

export const chooseAmgTarget = async (
  dialogs: ProjectDialogPort,
  documentsPath: string,
  title: string,
  defaultName: string,
): Promise<string | null> => {
  while (true) {
    const selection = await dialogs.showSave({
      title,
      defaultPath: path.join(documentsPath, defaultName),
      filters: AMG_FILTERS,
    });
    if (selection.canceled || selection.filePath === undefined) return null;
    const targetPath = enforcedAmgPath(selection.filePath);
    if (targetPath !== null) return targetPath;
  }
};
