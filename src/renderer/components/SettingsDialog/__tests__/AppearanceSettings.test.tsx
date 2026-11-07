import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import AppearanceSettings from "../AppearanceSettings";
import { useAppSettingsStore } from "../../../store/appSettingsStore";
import { BUILTIN_APP_THEMES, applyAppPalette } from "../../../themes/appThemes";
vi.mock("../../../utils/api", () => ({
  getApi: () => ({ app: { saveSettings: async () => ({ success: true }) } }),
}));
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
let container: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => {
  useAppSettingsStore.setState({
    theme: "dark",
    appColorTheme: "classic",
    customAppThemes: [],
  });
  applyAppPalette("dark", BUILTIN_APP_THEMES[0].dark);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<AppearanceSettings />));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const button = (name: string) => {
  const el = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === name || b.getAttribute("aria-label") === name,
  );
  if (!el) throw new Error(`Missing ${name}`);
  return el;
};
it("keeps previews temporary, cancels on close, and saves both variants as a custom copy", async () => {
  act(() => button("Customize Ocean").click());
  expect(document.body.style.getPropertyValue("--color-accent")).toBe(
    BUILTIN_APP_THEMES[2].dark.accent,
  );
  expect(useAppSettingsStore.getState().appColorTheme).toBe("classic");
  act(() => button("Cancel").click());
  expect(document.body.style.getPropertyValue("--color-accent")).toBe(
    BUILTIN_APP_THEMES[0].dark.accent,
  );
  act(() => button("Customize Forest").click());
  const user = userEvent.setup(),
    name = container.querySelector<HTMLInputElement>(".app-theme-name input")!;
  await act(async () => {
    await user.clear(name);
    await user.type(name, "My Grove");
  });
  await act(async () => button("Save theme").click());
  const state = useAppSettingsStore.getState();
  expect(state.customAppThemes[0].name).toBe("My Grove");
  expect(state.appColorTheme).toBe(state.customAppThemes[0].id);
  expect(state.customAppThemes[0].light).toEqual(BUILTIN_APP_THEMES[3].light);
  act(() => button("Customize Rose").click());
  act(() => root.unmount());
  expect(document.body.style.getPropertyValue("--color-accent")).toBe(
    BUILTIN_APP_THEMES[3].dark.accent,
  );
  root = createRoot(container);
});
it("supports rename, duplicate and delete without changing built-ins", async () => {
  act(() => button("Customize Graphite").click());
  await act(async () => button("Save theme").click());
  const original = useAppSettingsStore.getState().customAppThemes[0];
  act(() => button(`Duplicate ${original.name}`).click());
  await act(async () => button("Save theme").click());
  expect(useAppSettingsStore.getState().customAppThemes).toHaveLength(2);
  act(() => button(`Edit ${original.name}`).click());
  const user = userEvent.setup(),
    name = container.querySelector<HTMLInputElement>(".app-theme-name input")!;
  await act(async () => {
    await user.clear(name);
    await user.type(name, "Renamed");
  });
  await act(async () => button("Save theme").click());
  expect(
    useAppSettingsStore
      .getState()
      .customAppThemes.find((t) => t.id === original.id)?.name,
  ).toBe("Renamed");
  act(() => button("Delete Renamed").click());
  await act(async () => button("Delete theme").click());
  expect(useAppSettingsStore.getState().appColorTheme).toBe("classic");
  expect(BUILTIN_APP_THEMES[1].name).toBe("Graphite");
});
