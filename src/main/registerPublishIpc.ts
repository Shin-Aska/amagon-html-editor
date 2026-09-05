import type {
  ExportedFile,
  PublishCredentials,
  PublishProgress,
  PublishResult,
  ValidationResult,
} from "../publish";
import type { PublisherExtension } from "../publish/types/PublisherExtension";

interface PublishRequest {
  readonly providerId: string;
  readonly files: ExportedFile[];
  readonly credentials?: PublishCredentials;
}

interface SaveCredentialsRequest {
  readonly providerId: string;
  readonly credentials: PublishCredentials;
}

interface PublishEvent {
  readonly sender: { readonly send: (channel: string, progress: PublishProgress) => void };
}

export interface PublishIpcContext {
  readonly handle: <TArgument>(channel: string, handler: (event: PublishEvent, argument: TArgument) => unknown) => void;
  readonly getAllPublishers: () => PublisherExtension[];
  readonly getPublisher: (providerId: string) => PublisherExtension | undefined;
  readonly loadCredentials: (providerId: string) => Promise<PublishCredentials>;
  readonly saveCredentials: (providerId: string, credentials: PublishCredentials) => Promise<void>;
  readonly deleteCredentials: (providerId: string) => Promise<void>;
  readonly resolveSensitiveValues: (
    fields: PublisherExtension["credentialFields"],
    stored: PublishCredentials,
    incoming: PublishCredentials,
  ) => PublishCredentials;
  readonly maskApiKey: (apiKey: string) => string;
}

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export const registerPublishIpc = (context: PublishIpcContext): void => {
  const buildBlankCredentials = (providerId: string): PublishCredentials => {
    const publisher = context.getPublisher(providerId);
    if (publisher === undefined) return {};
    return publisher.credentialFields.reduce<PublishCredentials>((credentials, field) => {
      credentials[field.key] = "";
      return credentials;
    }, {});
  };

  const loadMaskedCredentials = async (providerId: string): Promise<PublishCredentials> => {
    const publisher = context.getPublisher(providerId);
    if (publisher === undefined) return {};
    const stored = await context.loadCredentials(providerId);
    const masked: PublishCredentials = {};
    for (const field of publisher.credentialFields) {
      const value = stored[field.key] ?? "";
      masked[field.key] = field.sensitive ? context.maskApiKey(value) : value;
    }
    return masked;
  };

  const getPublisherOrThrow = (providerId: string): PublisherExtension => {
    const publisher = context.getPublisher(providerId);
    if (publisher === undefined) throw new Error(`Unknown publish provider: ${providerId}`);
    return publisher;
  };

  context.handle<never>("publish:getProviders", () => context.getAllPublishers().map((publisher) => ({
    id: publisher.meta.id,
    displayName: publisher.meta.displayName,
    description: publisher.meta.description,
    credentialFields: publisher.credentialFields.map((field) => ({ ...field })),
  })));

  context.handle<string>("publish:getCredentials", async (_event, providerId) => {
    try {
      return await loadMaskedCredentials(providerId);
    } catch {
      return buildBlankCredentials(providerId);
    }
  });

  context.handle<SaveCredentialsRequest>("publish:saveCredentials", async (_event, data) => {
    try {
      getPublisherOrThrow(data.providerId);
      await context.saveCredentials(data.providerId, data.credentials);
      return { success: true };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });

  context.handle<string>("publish:deleteCredentials", async (_event, providerId) => {
    try {
      getPublisherOrThrow(providerId);
      await context.deleteCredentials(providerId);
      return { success: true };
    } catch (error) {
      return { success: false, error: errorMessage(error) };
    }
  });

  context.handle<PublishRequest>("publish:validate", async (_event, data): Promise<ValidationResult> => {
    const publisher = context.getPublisher(data.providerId);
    if (publisher === undefined) {
      return {
        ok: false,
        issues: [{ severity: "error", message: `Unknown publish provider: ${data.providerId}` }],
      };
    }
    const stored = await context.loadCredentials(data.providerId);
    const credentials = context.resolveSensitiveValues(publisher.credentialFields, stored, data.credentials || {});
    return publisher.validate(data.files, credentials);
  });

  context.handle<PublishRequest>("publish:publish", async (event, data): Promise<PublishResult> => {
    const publisher = context.getPublisher(data.providerId);
    if (publisher === undefined) {
      return { success: false, error: `Unknown publish provider: ${data.providerId}`, warnings: [] };
    }
    const stored = await context.loadCredentials(data.providerId);
    const credentials = context.resolveSensitiveValues(publisher.credentialFields, stored, data.credentials || {});
    return publisher.publish(data.files, credentials, (progress) => {
      event.sender.send("publish:progress", progress);
    });
  });
};
