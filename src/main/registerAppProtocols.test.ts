import * as path from "path";
import { describe, expect, it, vi } from "vitest";
import { ProjectSessionRegistry } from "./projects/projectSession";
import { registerAppProtocols, type AppProtocolContext } from "./registerAppProtocols";

type Handler = (request: Request) => Promise<Response> | Response;

const setup = (overrides: Partial<AppProtocolContext> = {}) => {
  const handlers = new Map<string, Handler>();
  const base = path.resolve("C:/project/public/frameworks");
  const context: AppProtocolContext = {
    isPackaged: false,
    appPath: "C:/project",
    moduleDirectory: path.resolve("C:/project/out/main"),
    handle: (scheme, handler) => handlers.set(scheme, handler),
    exists: () => true,
    readFile: vi.fn(async () => Buffer.from("body")),
    sessions: new ProjectSessionRegistry(),
    getMimeType: () => "text/css",
    ...overrides,
  };
  registerAppProtocols(context);
  const framework = handlers.get("app-framework");
  if (framework === undefined) throw new Error("framework handler missing");
  return { handlers, framework, base };
};

describe("app protocol registration", () => {
  it("serves framework content with the baseline MIME", async () => {
    const { framework } = setup();
    const response = await framework(new Request("app-framework://asset/bootstrap.css"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/css");
    await expect(response.text()).resolves.toBe("body");
  });

  it("registers media after the framework protocol", () => {
    const { handlers } = setup();
    expect([...handlers.keys()]).toEqual(["app-framework", "app-media"]);
    expect(handlers.get("app-media")).toEqual(expect.any(Function));
  });

  it("returns 400 for a missing framework path", async () => {
    const { framework } = setup();
    const response = await framework(new Request("app-framework://asset/"));
    expect(response.status).toBe(400);
  });

  it("returns 403 for decoded traversal", async () => {
    const { framework } = setup();
    const response = await framework(new Request("app-framework://asset/%2e%2e%2fsecret.txt"));
    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toBe("Forbidden: path traversal detected");
  });

  it("returns 404 when the framework file is not found", async () => {
    const { framework } = setup({ exists: () => false });
    const response = await framework(new Request("app-framework://asset/missing.css"));
    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe("File not found");
  });

  it("returns 500 with the read error text", async () => {
    const { framework } = setup({ readFile: async () => { throw new Error("disk failed"); } });
    const response = await framework(new Request("app-framework://asset/broken.css"));
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe("Error reading file: disk failed");
  });
});
