import { assertTrustedMainFrame } from "./projects/projectIpcSecurity";

type IpcEvent = Parameters<typeof assertTrustedMainFrame>[0];
type MainWindow = Exclude<Parameters<typeof assertTrustedMainFrame>[1], null>;
type Handler = (event: IpcEvent, isLoaded: boolean) => void;

export interface MenuIpcContext<TWindow extends MainWindow, TMenu> {
  readonly handle: (channel: string, handler: Handler) => void;
  readonly getMainWindow: () => TWindow | null;
  readonly buildMenu: (window: TWindow, isLoaded: boolean) => TMenu;
  readonly setApplicationMenu: (menu: TMenu) => void;
}

export const registerMenuIpc = <TWindow extends MainWindow, TMenu>(
  context: MenuIpcContext<TWindow, TMenu>,
): void => {
  context.handle("menu:setProjectLoaded", (event, isLoaded) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    const window = context.getMainWindow();
    if (window === null) return;
    context.setApplicationMenu(context.buildMenu(window, isLoaded));
  });
};
