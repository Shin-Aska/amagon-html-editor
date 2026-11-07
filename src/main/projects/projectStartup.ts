import { APP_MEDIA_PRIVILEGES, APP_MEDIA_SCHEME } from "./projectMediaProtocol";

export const APP_FRAMEWORK_PRIVILEGES = {
  standard: true,
  secure: true,
  supportFetchAPI: true,
  corsEnabled: true,
} as const;

export type ProjectStartupPort = {
  readonly registerSchemes: (schemes: {
    scheme: string;
    privileges: typeof APP_MEDIA_PRIVILEGES | typeof APP_FRAMEWORK_PRIVILEGES;
  }[]) => void;
  readonly requestSingleInstanceLock: () => boolean;
  readonly quit: () => void;
};

export const initializeProjectStartup = (port: ProjectStartupPort): boolean => {
  // Electron accepts privileged registrations only once, before app readiness.
  // Framework CSS needs relative URLs and CORS for bundled icon/font requests.
  port.registerSchemes([
    { scheme: APP_MEDIA_SCHEME, privileges: APP_MEDIA_PRIVILEGES },
    { scheme: "app-framework", privileges: APP_FRAMEWORK_PRIVILEGES },
  ]);
  const hasSingleInstanceLock = port.requestSingleInstanceLock();
  if (!hasSingleInstanceLock) port.quit();
  return hasSingleInstanceLock;
};
