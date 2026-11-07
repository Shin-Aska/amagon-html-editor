import {useToastStore} from "../store/toastStore";
import { create } from "zustand";
import type { ProjectSessionId } from "../../shared/projects/projectIpcContract";

type Request = {
  readonly sessionId: ProjectSessionId;
  readonly displayPath: string;
};
type PromptState = {
  request: Request | null;
  answer: (proceed: boolean) => void;
};
export const useLegacyConversionPrompt = create<PromptState>(() => ({
  request: null,
  answer: () => undefined,
}));
export function requestLegacyConversion(request: Request): Promise<boolean> {
  if (useLegacyConversionPrompt.getState().request)
    return Promise.resolve(false);
  useToastStore.getState().clearToast();
  return new Promise((resolve) =>
    useLegacyConversionPrompt.setState({
      request,
      answer: (proceed) => {
        useLegacyConversionPrompt.setState({
          request: null,
          answer: () => undefined,
        });
        resolve(proceed);
      },
    }),
  );
}
export const PROJECT_ASSETS_REPAIRED_EVENT = "amagon:project-assets-repaired";
