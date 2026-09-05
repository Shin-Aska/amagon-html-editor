import * as path from "path";

export type JsonValue = string | number | boolean | null | JsonObject | readonly JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };
type Handler = (event?: unknown, argument?: JsonObject) => unknown;

export interface SettingsIpcContext {
  readonly handle: (channel: string, handler: Handler) => void;
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
  context.handle("app:getVersion", () => ({ success: true, version: context.getVersion() }));

  context.handle("app:getSettings", async () => {
    try {
      const settings = parseObject(await context.readFile(settingsPath(context), "utf-8"));
      return { success: true, settings };
    } catch {
      return { success: true, settings: null };
    }
  });

  context.handle("app:saveSettings", async (_event, patch = {}) => {
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

  context.handle("app:isEncryptionSecure", () => ({ secure: context.isEncryptionSecure() }));
};
