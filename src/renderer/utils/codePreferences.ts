export interface CodePreferences {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
}
export const DEFAULT_CODE_PREFERENCES: CodePreferences = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: true,
  minimap: false,
};
export function normalizeCodePreferences(value: unknown): CodePreferences {
  const v =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    fontSize:
      typeof v.fontSize === "number" &&
      Number.isInteger(v.fontSize) &&
      v.fontSize >= 10 &&
      v.fontSize <= 24
        ? v.fontSize
        : 13,
    tabSize: v.tabSize === 4 ? 4 : 2,
    wordWrap: typeof v.wordWrap === "boolean" ? v.wordWrap : true,
    minimap: v.minimap === true,
  };
}
