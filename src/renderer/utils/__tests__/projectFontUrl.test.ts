import { describe, expect, it } from "vitest";
import { projectFontUrl } from "../projectFontUrl";

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
