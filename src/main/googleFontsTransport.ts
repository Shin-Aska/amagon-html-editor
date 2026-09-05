import { createHash } from "crypto";
import type { ExecFileException } from "child_process";
import * as path from "path";

const ALLOWED_ORIGINS = new Set([
  "https://fonts.googleapis.com",
  "https://fonts.gstatic.com",
]);
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_CONCURRENT_REQUESTS = 4;
const MAX_QUEUED_REQUESTS = 100;

type ExecCallback = (
  error: ExecFileException | null,
  stdout: Buffer,
  stderr: Buffer,
) => void;

export interface GoogleFontsDependencies {
  readonly getTempPath: () => string;
  readonly exists: (filePath: string) => boolean;
  readonly mkdir: (directory: string) => Promise<unknown>;
  readonly writeFile: (filePath: string, data: Buffer) => Promise<unknown>;
  readonly execFile: (
    file: string,
    args: readonly string[],
    options: {
      readonly encoding: "buffer";
      readonly maxBuffer: number;
      readonly windowsHide: true;
      readonly signal?: AbortSignal;
    },
    callback: ExecCallback,
  ) => void;
  readonly fetch: typeof fetch;
}

export interface GoogleFontsService {
  readonly fetchText: (
    url: string,
    options?: { readonly headers?: Readonly<Record<string, string>>; readonly signal?: AbortSignal },
  ) => Promise<string>;
  readonly cacheFile: (url: string) => Promise<{ readonly filePath: string; readonly mimeType: string }>;
  readonly isAllowedUrl: (url: string) => boolean;
  readonly maxResponseBytes: number;
}

export const createGoogleFontsService = (
  dependencies: GoogleFontsDependencies,
  getMimeType: (filePath: string) => string,
): GoogleFontsService => {
  let activeRequests = 0;
  const queuedRequests: Array<{ readonly start: () => void }> = [];

  const isAllowedUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && ALLOWED_ORIGINS.has(`${parsed.protocol}//${parsed.host}`);
    } catch {
      return false;
    }
  };

  const releaseRequest = (): void => {
    activeRequests -= 1;
    queuedRequests.shift()?.start();
  };

  const acquireRequest = async (signal?: AbortSignal): Promise<() => void> => {
    if (signal?.aborted) throw new DOMException("Google Fonts request canceled", "AbortError");
    if (activeRequests < MAX_CONCURRENT_REQUESTS) {
      activeRequests += 1;
      return releaseRequest;
    }
    if (queuedRequests.length >= MAX_QUEUED_REQUESTS) {
      throw new Error("Too many Google Fonts requests in progress");
    }
    return new Promise((resolve, reject) => {
      const queued = {
        start: () => {
          signal?.removeEventListener("abort", cancel);
          if (signal?.aborted) {
            reject(new DOMException("Google Fonts request canceled", "AbortError"));
            return;
          }
          activeRequests += 1;
          resolve(releaseRequest);
        },
      };
      const cancel = (): void => {
        const index = queuedRequests.indexOf(queued);
        if (index >= 0) queuedRequests.splice(index, 1);
        reject(new DOMException("Google Fonts request canceled", "AbortError"));
      };
      signal?.addEventListener("abort", cancel, { once: true });
      queuedRequests.push(queued);
    });
  };

  const fetchWithCurl = (
    url: string,
    options?: { readonly headers?: Readonly<Record<string, string>>; readonly signal?: AbortSignal },
  ): Promise<Buffer> => new Promise((resolve, reject) => {
    const args = [
      "--disable", "--fail", "--silent", "--show-error", "--proto", "=https",
      "--connect-timeout", "10", "--max-time", "30",
    ];
    const userAgent = options?.headers?.["User-Agent"];
    if (userAgent) args.push("--user-agent", userAgent);
    args.push("--url", url);
    dependencies.execFile(
      process.platform === "win32" ? "curl.exe" : "curl",
      args,
      { encoding: "buffer", maxBuffer: MAX_RESPONSE_BYTES, windowsHide: true, signal: options?.signal },
      (error, stdout, stderr) => {
        if (error) {
          const details = stderr.toString().trim();
          reject(new Error(details || error.message));
          return;
        }
        resolve(stdout);
      },
    );
  });

  const fetchWithNode = async (
    url: string,
    options?: { readonly headers?: Readonly<Record<string, string>>; readonly signal?: AbortSignal },
  ): Promise<Buffer> => {
    const controller = new AbortController();
    const abortFromCaller = (): void => controller.abort();
    options?.signal?.addEventListener("abort", abortFromCaller, { once: true });
    if (options?.signal?.aborted) controller.abort();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await dependencies.fetch(url, {
        headers: options?.headers,
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Google Fonts request failed (${response.status})`);
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        throw new Error("Google Fonts response exceeds the 10 MB limit");
      }
      if (!response.body) throw new Error("Google Fonts response has no body");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        totalBytes += result.value.byteLength;
        if (totalBytes > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new Error("Google Fonts response exceeds the 10 MB limit");
        }
        chunks.push(result.value);
      }
      return Buffer.concat(chunks);
    } finally {
      options?.signal?.removeEventListener("abort", abortFromCaller);
      clearTimeout(timeout);
    }
  };

  const fetchBuffer = async (
    url: string,
    options?: { readonly headers?: Readonly<Record<string, string>>; readonly signal?: AbortSignal },
  ): Promise<Buffer> => {
    if (!isAllowedUrl(url)) throw new Error("Unexpected font URL origin (blocked)");
    const release = await acquireRequest(options?.signal);
    try {
      try {
        return await fetchWithCurl(url, options);
      } catch (error) {
        const code = error instanceof Error && "code" in error ? error.code : undefined;
        if (code !== "ENOENT" && code !== "EACCES") throw error;
        return fetchWithNode(url, options);
      }
    } finally {
      release();
    }
  };

  const fetchText: GoogleFontsService["fetchText"] = async (url, options) => (
    await fetchBuffer(url, options)
  ).toString("utf-8");

  const cacheFile: GoogleFontsService["cacheFile"] = async (url) => {
    const cacheDir = path.join(dependencies.getTempPath(), "amagon-google-fonts-cache-v2");
    await dependencies.mkdir(cacheDir);
    const hash = createHash("sha256").update(url).digest("hex");
    const extension = path.extname(new URL(url).pathname).toLowerCase() || ".woff2";
    const filePath = path.join(cacheDir, `${hash}${extension}`);
    if (!dependencies.exists(filePath)) await dependencies.writeFile(filePath, await fetchBuffer(url));
    return { filePath, mimeType: getMimeType(filePath) };
  };

  return { fetchText, cacheFile, isAllowedUrl, maxResponseBytes: MAX_RESPONSE_BYTES };
};
