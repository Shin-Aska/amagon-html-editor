import { registerAssetMutationIpc } from "./registerAssetMutationIpc";
import { registerFontMutationIpc } from "./registerFontMutationIpc";
import { registerMediaSearchIpc } from "./registerMediaSearchIpc";
import type { ProjectResourceContext } from "./projectResourceContext";

export const registerProjectResourceIpc = (context: ProjectResourceContext): void => {
  registerAssetMutationIpc(context);
  registerFontMutationIpc(context);
  registerMediaSearchIpc(context);
};
