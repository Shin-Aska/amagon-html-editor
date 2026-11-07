import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppSettingsStore } from "../appSettingsStore";
import { BUILTIN_APP_THEMES } from "../../themes/appThemes";
const api = vi.hoisted(() => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(async () => ({ success: true })),
}));
vi.mock("../../utils/api", () => ({ getApi: () => ({ app: api }) }));
beforeEach(() => {
  api.saveSettings.mockClear();
});
describe("appearance preferences", () => {
  it("loads a custom family and applies the resolved mode without CSS injection", async () => {
    const custom = {
      ...BUILTIN_APP_THEMES[2],
      id: "my-theme",
      name: "My theme",
    };
    api.getSettings.mockResolvedValue({
      success: true,
      settings: {
        theme: "light",
        appColorTheme: custom.id,
        customAppThemes: [custom],
      },
    });
    await useAppSettingsStore.getState().loadSettings();
    expect(document.body.classList.contains("dark")).toBe(false);
    expect(document.body.style.getPropertyValue("--color-accent")).toBe(
      custom.light.accent,
    );
    await useAppSettingsStore.getState().saveSettings({
      theme: "dark",
      codePreferences: {
        fontSize: 16,
        tabSize: 4,
        wordWrap: false,
        minimap: false,
      },
    });
    expect(document.body.style.getPropertyValue("--color-accent")).toBe(
      custom.dark.accent,
    );
    expect(api.saveSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        appColorTheme: "my-theme",
        customAppThemes: [custom],
        codePreferences: {
          fontSize: 16,
          tabSize: 4,
          wordWrap: false,
          minimap: false,
        },
      }),
    );
  });
  it("falls back safely for deleted themes and malformed editor preferences", async () => {
    api.getSettings.mockResolvedValue({
      success: true,
      settings: {
        theme: "bad",
        appColorTheme: "missing",
        customAppThemes: [null],
        codePreferences: {
          fontSize: 1000,
          tabSize: 8,
          wordWrap: "yes",
          minimap: 1,
        },
      },
    });
    await useAppSettingsStore.getState().loadSettings();
    expect(useAppSettingsStore.getState()).toMatchObject({
      theme: "dark",
      appColorTheme: "classic",
      customAppThemes: [],
      codePreferences: {
        fontSize: 13,
        tabSize: 2,
        wordWrap: true,
        minimap: false,
      },
    });
  });
});

it("reports persistence failure while keeping the theme available for a retry", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  api.saveSettings.mockResolvedValueOnce({ success: false });
  try {
    expect(
      await useAppSettingsStore
        .getState()
        .saveSettings({ appColorTheme: "ocean" }),
    ).toBe(false);
    expect(useAppSettingsStore.getState().appColorTheme).toBe("ocean");
  } finally {
    error.mockRestore();
  }
});
