import * as path from "path";
import type { ProjectSessionRegistry } from "./projects/projectSession";
import { APP_MEDIA_SCHEME, createProjectMediaHandler } from "./projects/projectMediaProtocol";

type ProtocolHandler = (request: Request) => Promise<Response> | Response;

export interface AppProtocolContext {
  readonly isPackaged: boolean;
  readonly appPath: string;
  readonly moduleDirectory: string;
  readonly handle: (scheme: string, handler: ProtocolHandler) => void;
  readonly exists: (filePath: string) => boolean;
  readonly readFile: (filePath: string) => Promise<Buffer>;
  readonly sessions: ProjectSessionRegistry;
  readonly getMimeType: (filePath: string) => string;
}

const frameworksDirectory = (context: AppProtocolContext): string => (
  context.isPackaged
    ? path.join(context.appPath, "out", "renderer", "frameworks")
    : path.join(context.moduleDirectory, "..", "..", "public", "frameworks")
);

export const registerAppProtocols = (context: AppProtocolContext): void => {
  const baseDir = frameworksDirectory(context);
  context.handle("app-framework", async (request) => {
    const url = new URL(request.url);
    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!relativePath) return new Response("Missing asset path", { status: 400 });
    const filePath = path.join(baseDir, relativePath);
    const resolved = path.resolve(filePath);
    const resolvedBase = path.resolve(baseDir);
    if (resolved !== resolvedBase && !resolved.startsWith(`${resolvedBase}${path.sep}`)) {
      return new Response("Forbidden: path traversal detected", { status: 403 });
    }
    if (!context.exists(filePath)) return new Response("File not found", { status: 404 });
    try {
      const data = await context.readFile(filePath);
      return new Response(new Uint8Array(data), { headers: { "Content-Type": context.getMimeType(filePath) } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return new Response(`Error reading file: ${message}`, { status: 500 });
    }
  });
  context.handle(APP_MEDIA_SCHEME, createProjectMediaHandler({
    sessions: context.sessions,
    mimeType: context.getMimeType,
  }));
};
