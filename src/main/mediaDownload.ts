import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { resolveMutationPath } from "./projects/mutationPath";
import { safeMediaFetch, type SafeMediaFetcher } from "./projects/safeMediaNetwork";

export type MediaDownloadRequest = {
  readonly url: string;
  readonly projectDir: string;
  readonly filename?: string;
  readonly signal?: AbortSignal;
  readonly maxBytes?: number;
  readonly relativeDirectory?: "assets" | "assets/fonts";
  readonly fetcher?: SafeMediaFetcher;
};

export type MediaDownloadResult = {
  readonly success: boolean;
  readonly relativePath?: string;
  readonly error?: string;
};

const extensionForContentType = (contentType: string): string => {
  if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) return ".jpg";
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/gif")) return ".gif";
  if (contentType.includes("image/webp")) return ".webp";
  if (contentType.includes("video/mp4")) return ".mp4";
  if (contentType.includes("video/webm")) return ".webm";
  if (contentType.includes("video/ogg")) return ".ogv";
  if (contentType.includes("font/woff2") || contentType.includes("application/font-woff2")) return ".woff2";
  return ".bin";
};

const availableDestination = async (
  request: {
    readonly workspacePath: string;
    readonly relativeDirectory: string;
    readonly baseName: string;
    readonly extension: string;
  },
): Promise<{ readonly path: string; readonly relativePath: string }> => {
  let suffix = 0;
  while (true) {
    const name = suffix === 0
      ? `${request.baseName}${request.extension}`
      : `${request.baseName}-${suffix}${request.extension}`;
    const relativePath = `${request.relativeDirectory}/${name}`;
    const candidate = await resolveMutationPath(request.workspacePath, relativePath);
    const exists = await fs.access(candidate).then(() => true).catch(() => false);
    if (!exists) return { path: candidate, relativePath };
    suffix += 1;
  }
};

export const downloadAndImportMedia = async (
  request: MediaDownloadRequest,
): Promise<MediaDownloadResult> => {
  const maxBytes = request.maxBytes ?? 250 * 1024 * 1024;
  let partialPath: string | null = null;
  let partialRelativePath: string | null = null;
  let partialHandle: Awaited<ReturnType<typeof fs.open>> | null = null;
  try {
    const response = await (request.fetcher ?? safeMediaFetch)(request.url, request.signal);
    if (!response.ok) return { success: false, error: `Download failed: ${response.status}` };
    if (response.body === null) return { success: false, error: "Download returned no body" };
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      await response.body.cancel();
      return { success: false, error: `Download exceeds the ${maxBytes}-byte project media limit` };
    }

    const extension = extensionForContentType(response.headers.get("content-type") ?? "application/octet-stream");
    const requestedName = request.filename ?? `web-${Date.now()}`;
    const baseName = path.basename(requestedName).replace(/[^a-zA-Z0-9._-]/gu, "-") || "web-media";
    const relativeDirectory = request.relativeDirectory ?? "assets";
    const directory = await resolveMutationPath(request.projectDir, relativeDirectory);
    await fs.mkdir(directory, { recursive: true });
    await resolveMutationPath(request.projectDir, relativeDirectory);
    const destination = await availableDestination({
      workspacePath: request.projectDir,
      relativeDirectory,
      baseName,
      extension,
    });

    partialRelativePath = `${destination.relativePath}.amagon-partial-${randomUUID()}`;
    partialPath = await resolveMutationPath(request.projectDir, partialRelativePath);
    partialHandle = await fs.open(partialPath, "wx");
    const reader = response.body.getReader();
    const cancelReader = (): void => { void reader.cancel("download canceled"); };
    request.signal?.addEventListener("abort", cancelReader, { once: true });
    let total = 0;
    try {
      while (true) {
        if (request.signal?.aborted) throw new DOMException("Download canceled", "AbortError");
        const chunk = await reader.read();
        if (chunk.done) break;
        total += chunk.value.byteLength;
        if (total > maxBytes) {
          await reader.cancel("quota exceeded");
          throw new RangeError(`Download exceeds the ${maxBytes}-byte project media limit`);
        }
        await partialHandle.write(chunk.value);
      }
      if (request.signal?.aborted) throw new DOMException("Download canceled", "AbortError");
    } finally {
      request.signal?.removeEventListener("abort", cancelReader);
      reader.releaseLock();
    }
    await partialHandle.sync();
    await partialHandle.close();
    partialHandle = null;
    await resolveMutationPath(request.projectDir, partialRelativePath);
    await resolveMutationPath(request.projectDir, destination.relativePath);
    await fs.rename(partialPath, destination.path);
    partialPath = null;
    partialRelativePath = null;
    return { success: true, relativePath: destination.relativePath };
  } catch (error) {
    if (partialHandle !== null) await partialHandle.close().catch(() => undefined);
    if (partialRelativePath !== null) {
      await resolveMutationPath(request.projectDir, partialRelativePath).then(
        (safePath) => fs.rm(safePath, { force: true }),
      ).catch(() => undefined);
    }
    return { success: false, error: error instanceof Error ? error.message : "Media download failed" };
  }
};
