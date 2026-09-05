import { describe, expect, it, vi } from "vitest";
import {
  createGoogleFontsService,
  type GoogleFontsDependencies,
} from "./googleFontsTransport";

const successExec: GoogleFontsDependencies["execFile"] = (_file, _args, _options, callback) => {
  callback(null, Buffer.from("curl-body"), Buffer.alloc(0));
};

const dependencies = (
  overrides: Partial<GoogleFontsDependencies> = {},
): GoogleFontsDependencies => ({
  getTempPath: () => "C:/tmp",
  exists: () => false,
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  execFile: successExec,
  fetch: vi.fn(async () => new Response("node-body")),
  ...overrides,
});

const mimeType = (filePath: string): string => filePath.endsWith(".woff") ? "font/woff" : "font/woff2";

describe("Google Fonts transport", () => {
  it("accepts only the two HTTPS Google Fonts origins", () => {
    const service = createGoogleFontsService(dependencies(), mimeType);
    expect(service.isAllowedUrl("https://fonts.googleapis.com/css2?family=Inter")).toBe(true);
    expect(service.isAllowedUrl("https://fonts.gstatic.com/s/inter.woff2")).toBe(true);
    expect(service.isAllowedUrl("http://fonts.gstatic.com/s/inter.woff2")).toBe(false);
    expect(service.isAllowedUrl("https://fonts.gstatic.com.evil.test/inter.woff2")).toBe(false);
    expect(service.isAllowedUrl("not a url")).toBe(false);
  });

  it("uses curl with the preserved arguments and user agent", async () => {
    const execFile = vi.fn<GoogleFontsDependencies["execFile"]>(successExec);
    const service = createGoogleFontsService(dependencies({ execFile }), mimeType);
    await expect(service.fetchText("https://fonts.googleapis.com/css2", {
      headers: { "User-Agent": "agent" },
    })).resolves.toBe("curl-body");
    expect(execFile).toHaveBeenCalledWith(
      expect.stringMatching(/^curl(?:\.exe)?$/),
      expect.arrayContaining(["--disable", "--proto", "=https", "--max-time", "30", "--user-agent", "agent"]),
      expect.objectContaining({ encoding: "buffer", maxBuffer: 10 * 1024 * 1024, windowsHide: true }),
      expect.any(Function),
    );
  });

  it.each(["ENOENT", "EACCES"])("uses the node curl fallback for %s", async (code) => {
    const execFile: GoogleFontsDependencies["execFile"] = (_file, _args, _options, callback) => {
      callback(Object.assign(new Error("missing curl"), { code }), Buffer.alloc(0), Buffer.alloc(0));
    };
    const fetchMock = vi.fn(async () => new Response("fallback"));
    const service = createGoogleFontsService(dependencies({ execFile, fetch: fetchMock }), mimeType);
    await expect(service.fetchText("https://fonts.gstatic.com/font.woff2")).resolves.toBe("fallback");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://fonts.gstatic.com/font.woff2",
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("does not fall back for a curl transport failure", async () => {
    const execFile: GoogleFontsDependencies["execFile"] = (_file, _args, _options, callback) => {
      callback(Object.assign(new Error("network down"), { code: "ECONNRESET" }), Buffer.alloc(0), Buffer.alloc(0));
    };
    const fetchMock = vi.fn(async () => new Response("unused"));
    const service = createGoogleFontsService(dependencies({ execFile, fetch: fetchMock }), mimeType);
    await expect(service.fetchText("https://fonts.gstatic.com/font.woff2")).rejects.toThrow("network down");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a blocked origin before either transport runs", async () => {
    const execFile = vi.fn<GoogleFontsDependencies["execFile"]>(successExec);
    const fetchMock = vi.fn(async () => new Response("unused"));
    const service = createGoogleFontsService(dependencies({ execFile, fetch: fetchMock }), mimeType);
    await expect(service.fetchText("https://example.com/font.woff2")).rejects.toThrow("Unexpected font URL origin (blocked)");
    expect(execFile).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects the node fallback content-length above 10 MB", async () => {
    const execFile: GoogleFontsDependencies["execFile"] = (_file, _args, _options, callback) => {
      callback(Object.assign(new Error("missing curl"), { code: "ENOENT" }), Buffer.alloc(0), Buffer.alloc(0));
    };
    const fetchMock = vi.fn(async () => new Response("x", { headers: { "content-length": String(10 * 1024 * 1024 + 1) } }));
    const service = createGoogleFontsService(dependencies({ execFile, fetch: fetchMock }), mimeType);
    await expect(service.fetchText("https://fonts.gstatic.com/font.woff2")).rejects.toThrow("Google Fonts response exceeds the 10 MB limit");
  });

  it("caches misses and leaves cache hits untouched", async () => {
    let exists = false;
    const writeFile = vi.fn(async () => { exists = true; });
    const deps = dependencies({ exists: () => exists, writeFile });
    const service = createGoogleFontsService(deps, mimeType);
    const first = await service.cacheFile("https://fonts.gstatic.com/font.woff");
    const second = await service.cacheFile("https://fonts.gstatic.com/font.woff");
    expect(first).toEqual(second);
    expect(first.mimeType).toBe("font/woff");
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it("rejects the 101st queued request and recovers after release", async () => {
    const held: Array<Parameters<GoogleFontsDependencies["execFile"]>[3]> = [];
    let hold = true;
    const execFile: GoogleFontsDependencies["execFile"] = (_file, _args, _options, callback) => {
      if (hold) held.push(callback);
      else callback(null, Buffer.from("ok"), Buffer.alloc(0));
    };
    const service = createGoogleFontsService(dependencies({ execFile }), mimeType);
    const active = Array.from({ length: 4 }, () => service.fetchText("https://fonts.gstatic.com/font.woff2"));
    const queued = Array.from({ length: 100 }, () => service.fetchText("https://fonts.gstatic.com/font.woff2"));
    await expect(service.fetchText("https://fonts.gstatic.com/font.woff2")).rejects.toThrow("Too many Google Fonts requests in progress");
    hold = false;
    held.forEach((callback) => callback(null, Buffer.from("ok"), Buffer.alloc(0)));
    await expect(Promise.all([...active, ...queued])).resolves.toHaveLength(104);
    await expect(service.fetchText("https://fonts.gstatic.com/font.woff2")).resolves.toBe("ok");
  });

  it("removes an aborted queued request", async () => {
    const held: Array<Parameters<GoogleFontsDependencies["execFile"]>[3]> = [];
    const execFile: GoogleFontsDependencies["execFile"] = (_file, _args, _options, callback) => held.push(callback);
    const service = createGoogleFontsService(dependencies({ execFile }), mimeType);
    const active = Array.from({ length: 4 }, () => service.fetchText("https://fonts.gstatic.com/font.woff2"));
    const controller = new AbortController();
    const canceled = service.fetchText("https://fonts.gstatic.com/font.woff2", { signal: controller.signal });
    controller.abort();
    await expect(canceled).rejects.toMatchObject({ name: "AbortError" });
    held.forEach((callback) => callback(null, Buffer.from("ok"), Buffer.alloc(0)));
    await Promise.all(active);
  });
});
