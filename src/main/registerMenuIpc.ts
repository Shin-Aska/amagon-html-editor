type Handler = (event: unknown, isLoaded: boolean) => void;

export interface MenuIpcContext<TWindow, TMenu> {
  readonly handle: (channel: string, handler: Handler) => void;
  readonly getMainWindow: () => TWindow | null;
  readonly buildMenu: (window: TWindow, isLoaded: boolean) => TMenu;
  readonly setApplicationMenu: (menu: TMenu) => void;
}

export const registerMenuIpc = <TWindow, TMenu>(
  context: MenuIpcContext<TWindow, TMenu>,
): void => {
  context.handle("menu:setProjectLoaded", (_event, isLoaded) => {
    const window = context.getMainWindow();
    if (window === null) return;
    context.setApplicationMenu(context.buildMenu(window, isLoaded));
  });
};
