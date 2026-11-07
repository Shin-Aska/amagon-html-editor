import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";
import type {
  AssetCleanupCandidate,
  AssetCleanupResult,
  AssetCleanupUndoResult,
} from "../../shared/projects/assetMaintenanceContract";
import type { ProjectSessionId } from "../../shared/projects/projectIpcContract";
import { resolveMutationPath } from "./mutationPath";

type CleanupRecord = {
  readonly token: string;
  readonly sessionId: ProjectSessionId;
  readonly entries: AssetCleanupCandidate[];
};

/** One bounded undo record. Trash lives outside assets and is excluded from bundles. */
export class AssetCleanup {
  private record: CleanupRecord | null = null;

  async move(
    workspace: string,
    sessionId: ProjectSessionId,
    entries: readonly AssetCleanupCandidate[],
  ): Promise<AssetCleanupResult> {
    const token = randomUUID();
    const completed: AssetCleanupCandidate[] = [];
    const failed: string[] = [];
    for (const entry of entries) {
      try {
        if (entry.kind === "file")
          await this.moveExclusive(
            workspace,
            entry.relativePath,
            `.amagon-unused-assets/${token}/${entry.relativePath}`,
          );
        completed.push(entry);
      } catch (error) {
        failed.push(
          `${entry.relativePath}: ${error instanceof Error ? error.message : "Could not move file"}`,
        );
      }
    }
    if (completed.length)
      this.record = { token, sessionId, entries: completed };
    return {
      token,
      paths: completed
        .filter((entry) => entry.kind === "file")
        .map((entry) => entry.relativePath),
      fontIds: completed.flatMap((entry) => entry.fontIds),
      failed,
    };
  }

  async undo(
    workspace: string,
    sessionId: ProjectSessionId,
    token: string,
  ): Promise<AssetCleanupUndoResult> {
    const record = this.record;
    if (!record || record.sessionId !== sessionId || record.token !== token)
      throw new TypeError(
        "This cleanup belongs to a different project or has expired",
      );
    const restored: AssetCleanupCandidate[] = [];
    const remaining: AssetCleanupCandidate[] = [];
    for (const entry of record.entries) {
      try {
        if (entry.kind === "file")
          await this.moveExclusive(
            workspace,
            `.amagon-unused-assets/${token}/${entry.relativePath}`,
            entry.relativePath,
          );
        restored.push(entry);
      } catch (error) {
        if (error instanceof Error) remaining.push(entry);
        else throw error;
      }
    }
    this.record = remaining.length ? { ...record, entries: remaining } : null;
    return {
      paths: restored
        .filter((entry) => entry.kind === "file")
        .map((entry) => entry.relativePath),
      fontIds: restored.flatMap((entry) => entry.fontIds),
      remaining: remaining.length,
    };
  }

  private async moveExclusive(
    workspace: string,
    sourceRelative: string,
    destinationRelative: string,
  ): Promise<void> {
    const source = await resolveMutationPath(workspace, sourceRelative);
    const destination = await resolveMutationPath(
      workspace,
      destinationRelative,
    );
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await resolveMutationPath(workspace, destinationRelative);
    // Hard-link creation is exclusive: neither cleanup nor Undo replaces another file.
    await fs.link(source, destination);
    try {
      await fs.unlink(await resolveMutationPath(workspace, sourceRelative));
    } catch (error) {
      await fs.unlink(
        await resolveMutationPath(workspace, destinationRelative),
      );
      throw error;
    }
  }
}
