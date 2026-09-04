import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

const execFileText = (file: string, args: readonly string[]): Promise<string> => new Promise((resolve, reject) => {
  execFile(file, [...args], { maxBuffer: 10 * 1024 * 1024, timeout: 15_000 }, (error, stdout) => {
    if (error !== null) reject(error);
    else resolve(stdout);
  });
});

const optionalCommand = async (file: string, args: readonly string[]): Promise<string | null> => {
  try {
    return await execFileText(file, args);
  } catch (error) {
    if (error instanceof Error) return null;
    throw error;
  }
};

const normalizedFamily = (value: string): string => value.toLowerCase().replace(/\s+/gu, "");
const fontExtensions = new Set([".ttf", ".otf", ".ttc", ".woff", ".woff2"]);

const matchingFileInDirectory = async (directory: string, familyName: string): Promise<string | null> => {
  if (!existsSync(directory)) return null;
  let entries: readonly import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error) return null;
    throw error;
  }
  const target = normalizedFamily(familyName);
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!fontExtensions.has(extension)) continue;
    if (normalizedFamily(path.basename(entry.name, extension)).includes(target)) return path.join(directory, entry.name);
  }
  return null;
};

const resolveLinuxFont = async (familyName: string): Promise<string | null> => {
  const output = await optionalCommand("fc-list", ["-f", "%{family[0]}|%{file}\\n"]);
  if (output === null) return null;
  for (const line of output.split("\n")) {
    const separator = line.indexOf("|");
    if (separator < 0) continue;
    const family = line.slice(0, separator).trim();
    const filePath = line.slice(separator + 1).trim();
    if (family.toLowerCase() === familyName.toLowerCase() && existsSync(filePath)) return filePath;
  }
  return null;
};

const resolveMacFont = async (familyName: string): Promise<string | null> => {
  const roots = ["/System/Library/Fonts", "/Library/Fonts", path.join(os.homedir(), "Library/Fonts")];
  for (const root of roots) {
    const direct = await matchingFileInDirectory(root, familyName);
    if (direct !== null) return direct;
    let children: readonly import("node:fs").Dirent[];
    try {
      children = await fs.readdir(root, { withFileTypes: true });
    } catch (error) {
      if (error instanceof Error) continue;
      throw error;
    }
    for (const child of children) {
      if (!child.isDirectory()) continue;
      const nested = await matchingFileInDirectory(path.join(root, child.name), familyName);
      if (nested !== null) return nested;
    }
  }
  return null;
};

const resolveWindowsFont = async (familyName: string): Promise<string | null> => {
  const windowsDirectory = process.env.WINDIR ?? "C:\\Windows";
  const systemFonts = path.join(windowsDirectory, "Fonts");
  const registry = await optionalCommand("reg", ["query", "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts", "/s"]);
  if (registry !== null) {
    const target = normalizedFamily(familyName);
    for (const line of registry.split("\r\n")) {
      const match = line.match(/^\s+(.+?)\s+REG_SZ\s+(.+)$/iu);
      if (match === null) continue;
      const registryName = match[1];
      const registryFile = match[2];
      if (registryName === undefined || registryFile === undefined) continue;
      const cleanName = normalizedFamily(registryName.replace(/\s*\([^)]+\)\s*$/u, "").trim());
      if (cleanName === target || cleanName.includes(target)) {
        const candidate = path.join(systemFonts, registryFile.trim());
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  const userFonts = path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "Microsoft", "Windows", "Fonts");
  return await matchingFileInDirectory(systemFonts, familyName) ?? matchingFileInDirectory(userFonts, familyName);
};

export const resolveSystemFontPath = async (familyName: string): Promise<string | null> => {
  if (process.platform === "linux") return resolveLinuxFont(familyName);
  if (process.platform === "darwin") return resolveMacFont(familyName);
  if (process.platform === "win32") return resolveWindowsFont(familyName);
  return null;
};
