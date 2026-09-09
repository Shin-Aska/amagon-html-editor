type FrameIdentity = object;

type IpcSender = {
  readonly id: number;
  readonly mainFrame: FrameIdentity;
};

type IpcEvent = {
  readonly sender: IpcSender;
  readonly senderFrame: FrameIdentity | null;
};

type ApplicationWindow = {
  readonly webContents: IpcSender;
};

export class ProjectIpcSecurityError extends Error {
  readonly name = "ProjectIpcSecurityError";
}

export const assertTrustedMainFrame = (
  event: IpcEvent,
  mainWindow: ApplicationWindow | null,
): number => {
  if (mainWindow === null || event.sender !== mainWindow.webContents) {
    throw new ProjectIpcSecurityError("IPC request did not originate from the trusted application window");
  }
  if (event.senderFrame === null || event.senderFrame !== event.sender.mainFrame) {
    throw new ProjectIpcSecurityError("IPC request did not originate from the trusted main frame");
  }
  return event.sender.id;
};
