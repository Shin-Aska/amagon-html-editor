import { APP_MEDIA_PRIVILEGES, APP_MEDIA_SCHEME } from "./projectMediaProtocol";

export type ProjectStartupPort = {
  readonly registerScheme: (scheme: string, privileges: typeof APP_MEDIA_PRIVILEGES) => void;
  readonly requestSingleInstanceLock: () => boolean;
  readonly quit: () => void;
};

export const initializeProjectStartup = (port: ProjectStartupPort): boolean => {
  port.registerScheme(APP_MEDIA_SCHEME, APP_MEDIA_PRIVILEGES);
  const hasSingleInstanceLock = port.requestSingleInstanceLock();
  if (!hasSingleInstanceLock) port.quit();
  return hasSingleInstanceLock;
};
