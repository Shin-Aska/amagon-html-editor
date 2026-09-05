import { BrowserWindow, type MenuItemConstructorOptions } from "electron";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAppMenu } from "../menu";

const electronMock = vi.hoisted(() => {
  const templates: MenuItemConstructorOptions[][] = [];
  return { sent: vi.fn(), templates };
});

vi.mock("electron", () => ({
  BrowserWindow: class {
    readonly webContents = { send: electronMock.sent };
    isDestroyed(): boolean { return false; }
  },
  Menu: {
    buildFromTemplate: (template: MenuItemConstructorOptions[]) => {
      electronMock.templates.push(template);
      return {};
    },
  },
}));

describe("Electron project menu", () => {
  beforeEach(() => {
    electronMock.sent.mockReset();
    electronMock.templates.length = 0;
  });

  it("dispatches Close Project through the renderer menu channel", () => {
    buildAppMenu(new BrowserWindow(), true);
    const template = electronMock.templates[0];
    const fileMenu = template?.find((item) => item.label === "File");
    if (!Array.isArray(fileMenu?.submenu)) throw new TypeError("File menu is missing");
    const closeProject = fileMenu.submenu.find((item) => item.label === "Close Project");
    if (closeProject?.click === undefined) throw new TypeError("Close Project action is missing");

    Reflect.apply(closeProject.click, closeProject, []);

    expect(electronMock.sent).toHaveBeenCalledWith("menu:action", "close-project");
  });
});
