import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
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
  directory: string,
  baseName: string,
  extension: string,
): Promise<string> => {
  let suffix = 0;
  while (true) {
    const name = suffix === 0 ? `${baseName}${extension}` : `${baseName}-${suffix}${extension}`;
    const candidate = path.join(directory, name);
    const exists = await fs.access(candidate).then(() => true).catch(() => false);
    if (!exists) return candidate;
    suffix += 1;
  }
};

export const downloadAndImportMedia = async (
  request: MediaDownloadRequest,
): Promise<MediaDownloadResult> => {
  const maxBytes = request.maxBytes ?? 250 * 1024 * 1024;
  let partialPath: string | null = null;
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
    const directory = path.join(request.projectDir, ...(request.relativeDirectory ?? "assets").split("/"));
    await fs.mkdir(directory, { recursive: true });
    const destination = await availableDestination(directory, baseName, extension);

    partialPath = `${destination}.amagon-partial-${randomUUID()}`;
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
    await fs.rename(partialPath, destination);
    partialPath = null;
    return { success: true, relativePath: path.relative(request.projectDir, destination).replace(/\\/gu, "/") };
  } catch (error) {
    if (partialHandle !== null) await partialHandle.close().catch(() => undefined);
    if (partialPath !== null) await fs.rm(partialPath, { force: true }).catch(() => undefined);
    return { success: false, error: error instanceof Error ? error.message : "Media download failed" };
  }
};
