import * as path from "path";

const MIME_MAP: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".apng": "image/apng",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".html": "text/html",
  ".htm": "text/html",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
};

export const getMimeType = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
};

export const isPathSafe = (requestedPath: string, allowedBase: string): boolean => {
  const resolved = path.resolve(requestedPath);
  const base = path.resolve(allowedBase);
  return resolved.startsWith(base + path.sep) || resolved === base;
};
