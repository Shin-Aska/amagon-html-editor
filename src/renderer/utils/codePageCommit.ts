import { useEditorStore } from "../store/editorStore";
import { useProjectStore } from "../store/projectStore";
import type { Block } from "../store/types";

/** Commit the visible code context while preserving the containing page during widget tab editing. */
export function commitPageCodeBlocks(pageId: string, blocks: Block[]): void {
  const project = useProjectStore.getState();
  if (!project.pages.some((page) => page.id === pageId)) return;
  if (project.currentPageId === pageId) {
    useEditorStore.getState().setPageBlocks(blocks);
    project.updatePage(pageId, {
      blocks: useEditorStore.getState().getFullBlocks(),
    });
  } else project.updatePage(pageId, { blocks });
}
