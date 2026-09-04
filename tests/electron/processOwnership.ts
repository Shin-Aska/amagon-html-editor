import { execFile } from "node:child_process";
import path from "node:path";

export type ProcessIdentity = {
  readonly commandLine: string;
  readonly creationTime: string;
  readonly executablePath: string;
  readonly name: string;
  readonly pid: number;
};

const processCommandTimeoutMs = 15_000;

const runWindowsCommand = async (file: string, args: readonly string[]): Promise<string> => await new Promise((resolve, reject) => {
  execFile(file, args, { timeout: processCommandTimeoutMs, windowsHide: true }, (error, stdout) => {
    if (error !== null) {
      reject(error);
      return;
    }
    resolve(stdout);
  });
});

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const isProcessIdentity = (value: unknown): value is ProcessIdentity => isRecord(value)
  && typeof value["pid"] === "number"
  && Number.isSafeInteger(value["pid"])
  && value["pid"] > 0
  && typeof value["creationTime"] === "string"
  && typeof value["executablePath"] === "string"
  && typeof value["name"] === "string"
  && typeof value["commandLine"] === "string";

const parseProcessIdentities = (output: string): readonly ProcessIdentity[] => {
  const parsed: unknown = JSON.parse(output);
  const candidates = Array.isArray(parsed) ? parsed : [parsed];
  return candidates.filter(isProcessIdentity);
};

const readProcessIdentities = async (processIds: readonly number[]): Promise<readonly ProcessIdentity[]> => {
  if (processIds.length === 0 || process.platform !== "win32") return [];
  const script = [
    `$ids = @(${processIds.join(",")})`,
    "$records = @(Get-CimInstance Win32_Process | Where-Object { $ids -contains [int]$_.ProcessId } | Sort-Object ProcessId | ForEach-Object { [PSCustomObject]@{ pid = [int]$_.ProcessId; creationTime = $_.CreationDate.ToFileTimeUtc().ToString(); executablePath = $_.ExecutablePath; name = $_.Name; commandLine = $_.CommandLine } })",
    "if ($records.Count -eq 0) { '[]' } else { $records | ConvertTo-Json -Compress }",
  ].join("; ");
  return parseProcessIdentities(await runWindowsCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]));
};

export const isSameCapturedProcess = (captured: ProcessIdentity, current: ProcessIdentity): boolean => (
  captured.pid === current.pid
  && captured.creationTime === current.creationTime
  && captured.executablePath === current.executablePath
  && captured.name === current.name
  && captured.commandLine === current.commandLine
);

export const normalizeUserDataDir = (profilePath: string): string => path.win32
  .normalize(profilePath.trim())
  .replace(/[\\/]$/, "")
  .toLocaleLowerCase();

const readUserDataDir = (commandLine: string): string | undefined => {
  const match = /(?:^|[\s"]+)--user-data-dir=(?:"([^"]*)"|([^\s"]+))/i.exec(commandLine);
  const value = match?.[1] ?? match?.[2];
  return value === undefined ? undefined : normalizeUserDataDir(value);
};

export const isExactProfileOwner = (process: ProcessIdentity, profilePath: string): boolean => (
  process.name.toLocaleLowerCase() === "electron.exe"
  && readUserDataDir(process.commandLine) === normalizeUserDataDir(profilePath)
);

const hasExactArgument = (commandLine: string, name: string, expected: string): boolean => {
  const expression = new RegExp(`(?:^|[\\s"]+)${name}=(?:"([^"]*)"|([^\\s"]+))`, "i");
  const match = expression.exec(commandLine);
  return (match?.[1] ?? match?.[2]) === expected;
};

export const isTrustedMainProcess = (process: ProcessIdentity, profilePath: string, launchToken: string): boolean => (
  isExactProfileOwner(process, profilePath)
  && hasExactArgument(process.commandLine, "--amagon-e2e-token", launchToken)
);

export const selectLiveCapturedProcesses = (
  captured: readonly ProcessIdentity[],
  current: readonly ProcessIdentity[],
): readonly ProcessIdentity[] => captured.flatMap((expected) => {
  const candidate = current.find((process) => process.pid === expected.pid);
  return candidate !== undefined && isSameCapturedProcess(expected, candidate) ? [candidate] : [];
});

export const canTerminateCapturedProcess = (
  captured: ProcessIdentity,
  current: ProcessIdentity,
  profilePath: string,
): boolean => isSameCapturedProcess(captured, current) && isExactProfileOwner(current, profilePath);

export const canTerminateCapturedDescendant = (
  captured: ProcessIdentity,
  current: ProcessIdentity,
): boolean => isSameCapturedProcess(captured, current);

export const captureProcessTree = async (
  rootProcessId: number,
  profilePath: string,
  launchToken: string,
): Promise<readonly ProcessIdentity[]> => {
  if (process.platform !== "win32") return [];
  const root = (await readProcessIdentities([rootProcessId]))[0];
  if (root === undefined || !isTrustedMainProcess(root, profilePath, launchToken)) return [];
  const script = [
    `$root = ${rootProcessId}`,
    "$all = Get-CimInstance Win32_Process",
    "$pending = [System.Collections.Generic.Queue[int]]::new()",
    "$seen = [System.Collections.Generic.HashSet[int]]::new()",
    "$pending.Enqueue($root)",
    "while ($pending.Count -gt 0) { $current = $pending.Dequeue(); if (-not $seen.Add($current)) { continue }; $all | Where-Object { $_.ParentProcessId -eq $current } | ForEach-Object { $pending.Enqueue([int]$_.ProcessId) } }",
    "$records = @($all | Where-Object { $seen.Contains([int]$_.ProcessId) } | Sort-Object ProcessId | ForEach-Object { [PSCustomObject]@{ pid = [int]$_.ProcessId; creationTime = $_.CreationDate.ToFileTimeUtc().ToString(); executablePath = $_.ExecutablePath; name = $_.Name; commandLine = $_.CommandLine } })",
    "if ($records.Count -eq 0) { '[]' } else { $records | ConvertTo-Json -Compress }",
  ].join("; ");
  const records = parseProcessIdentities(await runWindowsCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]));
  return [root, ...records.filter((record) => record.pid !== rootProcessId)];
};

export const readLiveCapturedProcesses = async (
  captured: readonly ProcessIdentity[],
): Promise<readonly ProcessIdentity[]> => selectLiveCapturedProcesses(
  captured,
  await readProcessIdentities(captured.map((process) => process.pid)),
);

export const terminateCapturedProcessTree = async (
  captured: readonly ProcessIdentity[],
  profilePath: string,
): Promise<void> => {
  const current = await readProcessIdentities(captured.map((process) => process.pid));
  const root = captured[0];
  if (root !== undefined) {
    const currentRoot = current.find((process) => process.pid === root.pid);
    if (currentRoot !== undefined && canTerminateCapturedProcess(root, currentRoot, profilePath)) {
      await terminateProcess(root, true);
      return;
    }
  }
  for (const expected of captured.slice(1)) {
    const candidate = current.find((process) => process.pid === expected.pid);
    if (candidate !== undefined && canTerminateCapturedDescendant(expected, candidate)) {
      await terminateProcess(expected, false);
    }
  }
};

const terminateProcess = async (captured: ProcessIdentity, includeDescendants: boolean): Promise<void> => {
  const current = (await readProcessIdentities([captured.pid]))[0];
  if (current === undefined || !canTerminateCapturedDescendant(captured, current)) return;
  try {
    const treeArgument = includeDescendants ? ["/T"] : [];
    await runWindowsCommand("taskkill.exe", ["/PID", String(captured.pid), ...treeArgument, "/F"]);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    const remaining = await readLiveCapturedProcesses([captured]);
    if (remaining.length > 0) {
      throw new Error(`taskkill failed while captured Electron process ${captured.pid} remains live: ${error.message}`);
    }
  }
};
