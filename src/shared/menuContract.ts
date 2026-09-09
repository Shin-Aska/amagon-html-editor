export const MENU_ACTION_CHANNEL = "menu:action" as const;

export const MENU_ACTIONS = [
  "new-project",
  "open-project",
  "close-project",
  "save",
  "save-as",
  "export",
  "publish",
  "undo",
  "redo",
  "cut",
  "copy",
  "paste",
  "duplicate",
  "delete",
  "toggle-sidebar",
  "toggle-inspector",
  "toggle-code-editor",
  "command-palette",
  "keyboard-shortcuts",
  "about",
] as const;

export type MenuAction = (typeof MENU_ACTIONS)[number];
