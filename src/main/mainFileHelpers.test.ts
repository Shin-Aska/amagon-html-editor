import * as path from "path";
import { describe, expect, it } from "vitest";
import { getMimeType, isPathSafe } from "./mainFileHelpers";

describe("main file response helpers", () => {
  it.each([
    ["photo.PNG", "image/png"],
    ["font.woff2", "font/woff2"],
    ["clip.webm", "video/webm"],
    ["page.html", "text/html"],
    ["manual.pdf", "application/pdf"],
    ["unknown.bin", "application/octet-stream"],
  ])("preserves MIME mapping for %s", (file, expected) => {
    expect(getMimeType(file)).toBe(expected);
  });

  it("preserves containment semantics", () => {
    const base = path.resolve("C:/projects/site");
    expect(isPathSafe(base, base)).toBe(true);
    expect(isPathSafe(path.join(base, "assets", "image.png"), base)).toBe(true);
    expect(isPathSafe(path.resolve(base, "..", "outside.txt"), base)).toBe(false);
    expect(isPathSafe(`${base}-backup/file.txt`, base)).toBe(false);
    expect(isPathSafe(path.resolve("C:/elsewhere/file.txt"), base)).toBe(false);
  });
});
