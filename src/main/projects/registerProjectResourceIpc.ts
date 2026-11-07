import { registerAssetMutationIpc } from "./registerAssetMutationIpc";
import {registerAssetMaintenanceIpc} from './registerAssetMaintenanceIpc';
import { registerFontMutationIpc } from "./registerFontMutationIpc";
import { registerMediaSearchIpc } from "./registerMediaSearchIpc";
import type { ProjectResourceContext } from "./projectResourceContext";

export const registerProjectResourceIpc = (context: ProjectResourceContext): void => {
  registerAssetMutationIpc(context);
  registerAssetMaintenanceIpc(context);
  registerFontMutationIpc(context);
  registerMediaSearchIpc(context);
};
