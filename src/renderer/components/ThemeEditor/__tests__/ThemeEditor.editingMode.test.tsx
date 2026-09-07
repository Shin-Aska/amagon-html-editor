import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectStore } from "../../../store/projectStore";
import ThemeEditor from "../ThemeEditor";
import { builtInGalleryThemes } from "../../../themes/themeGalleryRegistry";

describe("ThemeEditor editing mode", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
    useProjectStore.setState(useProjectStore.getInitialState());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useProjectStore.setState(useProjectStore.getInitialState());
  });

  const button = (label: string): HTMLButtonElement => {
    const match = [...container.querySelectorAll("button")].find((item) => item.textContent?.trim() === label);
    if (!match) throw new TypeError(`Missing button: ${label}`);
    return match;
  };

  it("keeps Dark Page selected when a parent rerender replaces the close callback", async () => {
    const onClose = vi.fn();
    await act(async () => root.render(<ThemeEditor isOpen onClose={onClose} />));
    await act(async () => button("Dark Page").click());
    await act(async () => root.render(<ThemeEditor isOpen onClose={onClose} />));
    expect(button("Dark Page").classList.contains("theme-btn-primary")).toBe(true);

    await act(async () => root.render(<ThemeEditor isOpen onClose={vi.fn()} />));

    expect(button("Dark Page").classList.contains("theme-btn-primary")).toBe(true);
    expect(button("Light Page").classList.contains("theme-btn-primary")).toBe(false);
  });

  it("uses the latest close callback for Escape without changing the editing target", async () => {
    const originalClose = vi.fn();
    const latestClose = vi.fn();
    await act(async () => root.render(<ThemeEditor isOpen onClose={originalClose} />));
    await act(async () => button("Dark Page").click());
    await act(async () => root.render(<ThemeEditor isOpen onClose={latestClose} />));

    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));

    expect(latestClose).toHaveBeenCalledOnce();
    expect(originalClose).not.toHaveBeenCalled();
    expect(button("Dark Page").classList.contains("theme-btn-primary")).toBe(true);
  });

  it("replaces every preset card when switching from Dark Page to Light Page", async () => {
    await act(async () => root.render(<ThemeEditor isOpen onClose={vi.fn()} />));
    await act(async () => button("Presets").click());
    await act(async () => button("Dark Page").click());

    await act(async () => button("Light Page").click());

    const displayed = [...container.querySelectorAll(".theme-preset-card-built-in .theme-preset-name")].map((item) => item.textContent);
    expect(displayed).toEqual(builtInGalleryThemes.filter((item) => item.mode === "light").map((item) => item.name));
  });
});
