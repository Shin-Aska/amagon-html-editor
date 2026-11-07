import { describe, expect, it } from "vitest";
import { projectFontAssetPath, projectFontUrl } from "../projectFontUrl";

describe("projectFontUrl", () => {
  it("encodes an imported font filename when constructing its session URL", () => {
    const relativePath = "assets/fonts/My Font #100%.ttf";

    const url = projectFontUrl(relativePath, "font_session_123");

    expect(url).toBe("app-media://project-asset/font_session_123/assets/fonts/My%20Font%20%23100%25.ttf");
  });

  it.each([
    "app-media://project-asset/font_session_123/assets/fonts/My%20Font.ttf",
    "https://example.com/font.woff2",
    "",
  ])("preserves an existing reference when it is %s", (reference) => {
    const url = projectFontUrl(reference, "font_session_123");

    expect(url).toBe(reference);
  });
});

describe("projectFontAssetPath", () => {
  it.each([
    ["assets/fonts/literal%20font.ttf", "assets/fonts/literal%20font.ttf"],
    ["app-media://project-asset/font_session_123/assets/fonts/literal%2520font.ttf", "assets/fonts/literal%20font.ttf"],
    ["app-media://project-asset/old_session_123/assets/fonts/font.ttf", undefined],
    ["app-media://project-asset/font_session_123/assets/image.png", undefined],
    ["assets/fonts/../image.png", undefined],
    ["file:///etc/font.ttf", undefined],
  ])("resolves only current project font paths: %s", (reference, expected) => {
    expect(projectFontAssetPath(reference, "font_session_123")).toBe(expected);
  });
});
