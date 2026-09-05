import * as path from "path";
import { assertTrustedMainFrame } from "./projects/projectIpcSecurity";

export type JsonValue = string | number | boolean | null | JsonObject | readonly JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };
type IpcEvent = Parameters<typeof assertTrustedMainFrame>[0];
type MainWindow = Parameters<typeof assertTrustedMainFrame>[1];
type Handler = (event: IpcEvent, argument?: JsonObject) => unknown;

export interface SettingsIpcContext {
  readonly handle: (channel: string, handler: Handler) => void;
  readonly getMainWindow: () => MainWindow;
  readonly getVersion: () => string;
  readonly getUserDataPath: () => string;
  readonly readFile: (filePath: string, encoding: "utf-8") => Promise<string>;
  readonly writeFile: (filePath: string, data: string, encoding: "utf-8") => Promise<unknown>;
  readonly isEncryptionSecure: () => boolean;
}

const settingsPath = (context: SettingsIpcContext): string => (
  path.join(context.getUserDataPath(), "app-settings.json")
);
const parseObject = (raw: string): JsonObject => JSON.parse(raw);
const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export const registerSettingsIpc = (context: SettingsIpcContext): void => {
  context.handle("app:getVersion", (event) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    return { success: true, version: context.getVersion() };
  });

  context.handle("app:getSettings", async (event) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      const settings = parseObject(await context.readFile(settingsPath(context), "utf-8"));
      return { success: true, settings };
    } catch {
      return { success: true, settings: null };
    }
  });

  context.handle("app:saveSettings", async (event, patch = {}) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      const filePath = settingsPath(context);
      let existing: JsonObject;
      try {
        existing = parseObject(await context.readFile(filePath, "utf-8"));
      } catch {
        existing = {};
      }
      const updated = { ...existing, ...patch };
      await context.writeFile(filePath, JSON.stringify(updated, null, 2), "utf-8");
      return { success: true };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });

  context.handle("app:isEncryptionSecure", (event) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    return { secure: context.isEncryptionSecure() };
  });
};
