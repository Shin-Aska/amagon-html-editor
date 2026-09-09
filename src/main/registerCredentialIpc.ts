import type { PublishCredentials } from "../publish";
import type { CredentialDefinition, CredentialRecord } from "./credentialCatalog";
import { assertTrustedMainFrame } from "./projects/projectIpcSecurity";

type IpcEvent = Parameters<typeof assertTrustedMainFrame>[0];
type MainWindow = Parameters<typeof assertTrustedMainFrame>[1];

interface SaveCredentialRequest {
  readonly id: string;
  readonly values: PublishCredentials;
}

export interface CredentialIpcContext {
  readonly handle: <TArgument>(channel: string, handler: (event: IpcEvent, argument: TArgument) => unknown) => void;
  readonly getMainWindow: () => MainWindow;
  readonly listCredentials: () => Promise<CredentialRecord[]>;
  readonly getDefinitions: () => CredentialDefinition[];
  readonly getValues: (id: string) => Promise<PublishCredentials>;
  readonly saveCredential: (id: string, values: PublishCredentials) => Promise<void>;
  readonly deleteCredential: (id: string) => Promise<void>;
  readonly isEncryptionSecure: () => boolean;
}

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export const registerCredentialIpc = (context: CredentialIpcContext): void => {
  context.handle<never>("app:getCredentials", async (event) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      return {
        success: true,
        credentials: await context.listCredentials(),
        definitions: context.getDefinitions(),
        secure: context.isEncryptionSecure(),
      };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });

  context.handle<never>("app:getCredentialDefinitions", async (event) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      return { success: true, definitions: context.getDefinitions() };
    } catch (error) {
      return { success: false, error: errorMessage(error), definitions: [] };
    }
  });

  context.handle<string>("app:getCredentialValues", async (event, id) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      return { success: true, values: await context.getValues(id) };
    } catch (error) {
      return { success: false, error: errorMessage(error), values: {} };
    }
  });

  context.handle<SaveCredentialRequest>("app:saveCredential", async (event, data) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      await context.saveCredential(data.id, data.values);
      return { success: true };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });

  context.handle<string>("app:deleteCredential", async (event, id) => {
    assertTrustedMainFrame(event, context.getMainWindow());
    try {
      await context.deleteCredential(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });
};
