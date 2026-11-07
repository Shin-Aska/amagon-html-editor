import { describe, expect, it } from "vitest";
import {
  APP_TOKEN_LABELS,
  BUILTIN_APP_THEMES,
  contrastRatio,
  normalizeCustomAppThemes,
  parseAppTheme,
  resolveAppTheme,
  serializeAppTheme,
} from "../appThemes";

describe("app themes", () => {
  it("ships six complete light/dark palettes with readable body text", () => {
    expect(BUILTIN_APP_THEMES).toHaveLength(6);
    for (const theme of BUILTIN_APP_THEMES)
      for (const mode of ["light", "dark"] as const) {
        expect(Object.keys(theme[mode]).sort()).toEqual(
          Object.keys(APP_TOKEN_LABELS).sort(),
        );
        expect(
          contrastRatio(theme[mode].textPrimary, theme[mode].bgPrimary),
        ).toBeGreaterThanOrEqual(4.5);
        for (const color of Object.values(theme[mode]))
          expect(color).toMatch(/^#[a-f0-9]{6}$/i);
      }
  });
  it("round trips a shareable theme with a fresh identity, independent palettes and no extra properties", () => {
    const base = BUILTIN_APP_THEMES[2],
      parsed = parseAppTheme(
        JSON.parse(serializeAppTheme({ ...base, name: "My Ocean" })),
      );
    expect(parsed.name).toBe("My Ocean");
    expect(parsed.id).not.toBe(base.id);
    expect(parsed.light).toEqual(base.light);
    parsed.light.accent = "#123456";
    expect(base.light.accent).not.toBe(parsed.light.accent);
  });
  it.each([
    { format: "project-theme", version: 1 },
    { format: "amagon-ui-theme", version: 2 },
    {
      format: "amagon-ui-theme",
      version: 1,
      theme: { ...BUILTIN_APP_THEMES[0], name: " " },
    },
    {
      format: "amagon-ui-theme",
      version: 1,
      theme: {
        ...BUILTIN_APP_THEMES[0],
        dark: {
          ...BUILTIN_APP_THEMES[0].dark,
          accent: "url(https://example.org)",
        },
      },
    },
  ])("rejects invalid import %j", (value) =>
    expect(() => parseAppTheme(value)).toThrow(),
  );
  it("drops malformed/duplicate saved themes and prevents shadowing built-ins", () => {
    const valid = { ...BUILTIN_APP_THEMES[1], id: "mine" };
    const normalized = normalizeCustomAppThemes([
      valid,
      valid,
      BUILTIN_APP_THEMES[0],
      { id: "bad" },
      null,
    ]);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].id).toBe("mine");
    expect(resolveAppTheme("missing", normalized).id).toBe("classic");
  });
});
