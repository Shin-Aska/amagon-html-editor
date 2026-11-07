/** App chrome themes are independent of website/project themes. Hex-only tokens keep imports small and predictable. */
export type AppMode = "light" | "dark";
export const APP_TOKEN_LABELS = {
  bgPrimary: "Background",
  bgSecondary: "Sidebar background",
  bgSurface: "Surface",
  bgHover: "Hover",
  textPrimary: "Text",
  textSecondary: "Secondary text",
  textMuted: "Muted text",
  border: "Border",
  accent: "Accent",
  accentHover: "Accent hover",
  selection: "Selection",
  danger: "Error",
  success: "Success",
  warning: "Warning",
  syntaxTag: "Syntax: tags",
  syntaxString: "Syntax: strings",
  syntaxComment: "Syntax: comments",
  syntaxKeyword: "Syntax: keywords",
} as const;
export type AppToken = keyof typeof APP_TOKEN_LABELS;
export type AppPalette = Record<AppToken, string>;
export interface AppColorTheme {
  id: string;
  name: string;
  light: AppPalette;
  dark: AppPalette;
}
const palette = (dark: boolean, colors: string[]): AppPalette => {
  const [
    bgPrimary,
    bgSecondary,
    bgSurface,
    bgHover,
    textPrimary,
    textSecondary,
    textMuted,
    border,
    accent,
    accentHover,
  ] = colors;
  return {
    bgPrimary,
    bgSecondary,
    bgSurface,
    bgHover,
    textPrimary,
    textSecondary,
    textMuted,
    border,
    accent,
    accentHover,
    selection: dark ? "#3e5274" : "#c4d8f5",
    danger: dark ? "#f38ba8" : "#b91c3e",
    success: dark ? "#a6e3a1" : "#287532",
    warning: dark ? "#fab387" : "#946000",
    syntaxTag: accent,
    syntaxString: dark ? "#a6e3a1" : "#287532",
    syntaxComment: dark ? "#9babc2" : "#637088",
    syntaxKeyword: dark ? "#cba6f7" : "#7c3f9a",
  };
};
export const BUILTIN_APP_THEMES: readonly AppColorTheme[] = [
  {
    id: "classic",
    name: "Amagon Classic",
    light: palette(false, [
      "#eff1f5",
      "#e6e9ef",
      "#dce0e8",
      "#bcc0cc",
      "#4c4f69",
      "#6c6f85",
      "#73778a",
      "#ccd0da",
      "#1e66f5",
      "#405bc9",
    ]),
    dark: palette(true, [
      "#1e1e2e",
      "#181825",
      "#313244",
      "#45475a",
      "#cdd6f4",
      "#a6adc8",
      "#9399b0",
      "#45475a",
      "#89b4fa",
      "#74c7ec",
    ]),
  },
  {
    id: "graphite",
    name: "Graphite",
    light: palette(false, [
      "#f5f6f8",
      "#e9ecf0",
      "#ffffff",
      "#dce1e8",
      "#242b36",
      "#505d70",
      "#647084",
      "#cbd2dc",
      "#285cb5",
      "#184b9a",
    ]),
    dark: palette(true, [
      "#202329",
      "#181b20",
      "#2c3139",
      "#3c4450",
      "#e0e5ed",
      "#b0bdce",
      "#92a0b3",
      "#454d59",
      "#90b9ff",
      "#bbd2ff",
    ]),
  },
  {
    id: "ocean",
    name: "Ocean",
    light: palette(false, [
      "#edf7fa",
      "#dfedf2",
      "#ffffff",
      "#cce3e9",
      "#18394a",
      "#426273",
      "#587581",
      "#bdd3dd",
      "#087687",
      "#065b6a",
    ]),
    dark: palette(true, [
      "#142832",
      "#10212b",
      "#203a46",
      "#2c505e",
      "#d8edf3",
      "#accbd5",
      "#8eafb9",
      "#365967",
      "#65d6d1",
      "#a1e8e2",
    ]),
  },
  {
    id: "forest",
    name: "Forest",
    light: palette(false, [
      "#f0f5ef",
      "#e3ece1",
      "#fafdf8",
      "#d2e1cf",
      "#253c2c",
      "#49634e",
      "#627768",
      "#c1d2bd",
      "#326b46",
      "#235334",
    ]),
    dark: palette(true, [
      "#1c2b23",
      "#16221c",
      "#2b3e31",
      "#3b5441",
      "#e0eddf",
      "#b2cbb5",
      "#94af98",
      "#46614a",
      "#99d3a6",
      "#c0e8c1",
    ]),
  },
  {
    id: "rose",
    name: "Rose",
    light: palette(false, [
      "#faf1f5",
      "#f0e2ea",
      "#fffafd",
      "#e9d0df",
      "#4b3044",
      "#72586c",
      "#826c7c",
      "#dac4d2",
      "#a13f74",
      "#7e2c5a",
    ]),
    dark: palette(true, [
      "#30212e",
      "#261b25",
      "#453041",
      "#5b4055",
      "#f3dfeb",
      "#d1b1c5",
      "#b998ac",
      "#6c4a60",
      "#f1a6ce",
      "#f8c6e0",
    ]),
  },
  {
    id: "sandstone",
    name: "Sandstone",
    light: palette(false, [
      "#faf5eb",
      "#efe6d7",
      "#fffcf6",
      "#e7d9c3",
      "#483c30",
      "#70604b",
      "#81725f",
      "#d8c8af",
      "#966019",
      "#72450e",
    ]),
    dark: palette(true, [
      "#2c2720",
      "#231f19",
      "#40382d",
      "#554a3a",
      "#eee4d3",
      "#cbbda6",
      "#ad9e86",
      "#655742",
      "#e8bd7c",
      "#f4d4a4",
    ]),
  },
];
export const APP_CSS_TOKENS: Record<AppToken, string> = {
  bgPrimary: "bg-primary",
  bgSecondary: "bg-secondary",
  bgSurface: "bg-surface",
  bgHover: "bg-hover",
  textPrimary: "text-primary",
  textSecondary: "text-secondary",
  textMuted: "text-muted",
  border: "border",
  accent: "accent",
  accentHover: "accent-hover",
  selection: "selection",
  danger: "danger",
  success: "success",
  warning: "warning",
  syntaxTag: "syntax-tag",
  syntaxString: "syntax-string",
  syntaxComment: "syntax-comment",
  syntaxKeyword: "syntax-keyword",
};
export function resolveAppTheme(
  id: string,
  custom: readonly AppColorTheme[],
): AppColorTheme {
  return (
    BUILTIN_APP_THEMES.find((t) => t.id === id) ??
    custom.find((t) => t.id === id) ??
    BUILTIN_APP_THEMES[0]
  );
}
export function applyAppPalette(mode: AppMode, colors: AppPalette): void {
  document.body.classList.toggle("dark", mode === "dark");
  document.body.style.colorScheme = mode;
  for (const key of Object.keys(APP_CSS_TOKENS) as AppToken[])
    document.body.style.setProperty(
      `--color-${APP_CSS_TOKENS[key]}`,
      colors[key],
    );
}
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function parseAppTheme(input: unknown): AppColorTheme {
  if (
    !isRecord(input) ||
    input.format !== "amagon-ui-theme" ||
    input.version !== 1 ||
    !isRecord(input.theme)
  )
    throw new Error("Choose an Amagon UI theme JSON file (version 1).");
  const value = input.theme;
  if (
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.trim().length > 60
  )
    throw new Error("Theme names must contain 1–60 characters.");
  const readPalette = (p: unknown): AppPalette => {
    if (!isRecord(p))
      throw new Error("Both light and dark palettes are required.");
    const result = {} as AppPalette;
    for (const key of Object.keys(APP_TOKEN_LABELS) as AppToken[]) {
      if (typeof p[key] !== "string" || !/^#[0-9a-f]{6}$/i.test(p[key]))
        throw new Error(
          `Invalid color for ${APP_TOKEN_LABELS[key]}. Use six-digit hex colors.`,
        );
      result[key] = p[key];
    }
    return result;
  };
  return {
    id: crypto.randomUUID(),
    name: value.name.trim(),
    light: readPalette(value.light),
    dark: readPalette(value.dark),
  };
}
export function serializeAppTheme(theme: AppColorTheme): string {
  return JSON.stringify(
    { format: "amagon-ui-theme", version: 1, theme },
    null,
    2,
  );
}
export function normalizeCustomAppThemes(value: unknown): AppColorTheme[] {
  if (!Array.isArray(value)) return [];
  const themes: AppColorTheme[] = [];
  for (const item of value.slice(0, 50)) {
    try {
      const parsed = parseAppTheme({
        format: "amagon-ui-theme",
        version: 1,
        theme: item,
      });
      if (
        isRecord(item) &&
        typeof item.id === "string" &&
        /^[\w-]{1,80}$/.test(item.id) &&
        !BUILTIN_APP_THEMES.some((t) => t.id === item.id) &&
        !themes.some((t) => t.id === item.id)
      )
        themes.push({ ...parsed, id: item.id });
    } catch {
      // Malformed saved themes are skipped; the built-ins remain available.
      continue;
    }
  }
  return themes;
}
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5]
      .map((n) => parseInt(hex.slice(n, n + 2), 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
