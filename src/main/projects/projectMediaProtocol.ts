import { open } from "node:fs/promises";
import path from "node:path";
import type { FileHandle } from "node:fs/promises";
import type { ProjectSessionRegistry } from "./projectSession";

export const APP_MEDIA_SCHEME = "app-media";

export const APP_MEDIA_PRIVILEGES = {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  stream: true,
} as const;

type MediaProtocolOptions = {
  readonly sessions: ProjectSessionRegistry;
  readonly mimeType: (filePath: string) => string;
  readonly chunkBytes?: number;
};

type ByteRange = {
  readonly start: number;
  readonly end: number;
};

const parseRange = (header: string | null, size: number): ByteRange | null | "invalid" => {
  if (header === null) return null;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(header.trim());
  if (match === null || size === 0) return "invalid";
  const startText = match[1] ?? "";
  const endText = match[2] ?? "";
  if (startText.length === 0 && endText.length === 0) return "invalid";
  if (startText.length === 0) {
    const suffix = Number(endText);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return "invalid";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(startText);
  const requestedEnd = endText.length === 0 ? size - 1 : Number(endText);
  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(requestedEnd)
    || start < 0
    || start >= size
    || requestedEnd < start
  ) return "invalid";
  return { start, end: Math.min(requestedEnd, size - 1) };
};

const closeRead = async (handle: FileHandle, release: () => void): Promise<void> => {
  try {
    await handle.close();
  } finally {
    release();
  }
};

export const createProjectMediaHandler = (
  options: MediaProtocolOptions,
): ((request: Request) => Promise<Response>) => async (request) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  let resolved: Awaited<ReturnType<ProjectSessionRegistry["resolveRuntimeAsset"]>>;
  try {
    resolved = await options.sessions.resolveRuntimeAsset(request.url);
  } catch (error) {
    if (error instanceof Error) return new Response(error.message, { status: 403 });
    throw error;
  }

  let handle: FileHandle;
  try {
    handle = await open(resolved.filePath, "r");
  } catch (error) {
    resolved.lease.release();
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return new Response("File not found", { status: 404 });
    }
    throw error;
  }

  try {
    const stats = await handle.stat();
    if (!stats.isFile()) {
      await closeRead(handle, resolved.lease.release);
      return new Response("File not found", { status: 404 });
    }
    const range = parseRange(request.headers.get("range"), stats.size);
    if (range === "invalid") {
      await closeRead(handle, resolved.lease.release);
      return new Response("Range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${stats.size}`, "Accept-Ranges": "bytes" },
      });
    }
    const selected = range ?? { start: 0, end: Math.max(0, stats.size - 1) };
    const contentLength = stats.size === 0 ? 0 : selected.end - selected.start + 1;
    const headers = new Headers({
      "Accept-Ranges": "bytes",
      "Content-Length": String(contentLength),
      "Content-Type": options.mimeType(resolved.filePath),
    });
    if (range !== null) headers.set("Content-Range", `bytes ${selected.start}-${selected.end}/${stats.size}`);
    if (request.method === "HEAD" || contentLength === 0) {
      await closeRead(handle, resolved.lease.release);
      return new Response(null, { status: range === null ? 200 : 206, headers });
    }

    const chunkBytes = options.chunkBytes ?? 64 * 1024;
    let position = selected.start;
    let finished = false;
    const finish = async (): Promise<void> => {
      if (finished) return;
      finished = true;
      await closeRead(handle, resolved.lease.release);
    };
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const remaining = selected.end - position + 1;
          if (remaining <= 0) {
            await finish();
            controller.close();
            return;
          }
          const buffer = Buffer.allocUnsafe(Math.min(chunkBytes, remaining));
          const read = await handle.read(buffer, 0, buffer.byteLength, position);
          if (read.bytesRead === 0) {
            await finish();
            controller.close();
            return;
          }
          position += read.bytesRead;
          controller.enqueue(buffer.subarray(0, read.bytesRead));
        } catch (error) {
          await finish();
          controller.error(error);
        }
      },
      async cancel() {
        await finish();
      },
    });
    return new Response(body, { status: range === null ? 200 : 206, headers });
  } catch (error) {
    await closeRead(handle, resolved.lease.release);
    if (error instanceof Error) return new Response(error.message, { status: 500 });
    throw error;
  }
};
