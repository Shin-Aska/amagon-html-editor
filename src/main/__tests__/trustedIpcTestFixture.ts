import type { assertTrustedMainFrame } from "../projects/projectIpcSecurity";

type Send = (channel: string, payload: unknown) => void;
export type TestIpcEvent = Parameters<typeof assertTrustedMainFrame>[0];

export const createTrustedIpcTestFixture = (send: Send = () => undefined) => {
  const mainFrame = {};
  const webContents = { id: 1, mainFrame, send };
  const foreignMainFrame = {};
  return {
    mainWindow: { webContents },
    trustedEvent: { sender: webContents, senderFrame: mainFrame },
    foreignEvent: {
      sender: { id: 2, mainFrame: foreignMainFrame, send },
      senderFrame: foreignMainFrame,
    },
    childFrameEvent: { sender: webContents, senderFrame: {} },
    missingFrameEvent: { sender: webContents, senderFrame: null },
  };
};
