import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "../../store/editorStore";
import { useProjectStore } from "../../store/projectStore";
import type { Block, Page } from "../../store/types";
import { commitPageCodeBlocks } from "../codePageCommit";
const heading = (id: string, text: string): Block => ({
  id,
  type: "heading",
  props: { text },
  styles: {},
  classes: [],
  children: [],
});
const page = (id: string, blocks: Block[]): Page => ({
  id,
  title: id,
  slug: id,
  blocks,
  meta: {},
});
beforeEach(() => {
  useEditorStore.setState(useEditorStore.getInitialState());
  useProjectStore.setState({
    ...useProjectStore.getInitialState(),
    pages: [
      page("home", [heading("title", "Home")]),
      page("about", [heading("about-title", "About")]),
    ],
    currentPageId: "home",
  });
  useEditorStore
    .getState()
    .loadPageBlocks(useProjectStore.getState().pages[0].blocks);
});
describe("page code commits", () => {
  it("keeps the full page and other widget tabs when editing a tab’s code", () => {
    const tabs: Block = {
      id: "tabs",
      type: "tabs",
      props: {
        tabs: [
          { label: "One", blocks: [heading("one", "One")] },
          { label: "Two", blocks: [heading("two", "Two")] },
        ],
      },
      styles: {},
      classes: [],
      children: [],
    };
    const full = [tabs, heading("footer", "Keep the footer")];
    useProjectStore.getState().updatePage("home", { blocks: full });
    useEditorStore.getState().loadPageBlocks(full);
    useEditorStore.getState().enterTabEditMode("tabs", 0);
    commitPageCodeBlocks("home", [heading("one", "Edited inside tab")]);
    expect(useEditorStore.getState().blocks).toEqual([
      heading("one", "Edited inside tab"),
    ]);
    expect(useProjectStore.getState().pages[0].blocks).toMatchObject([
      {
        id: "tabs",
        props: {
          tabs: [
            { blocks: [{ props: { text: "Edited inside tab" } }] },
            { blocks: [{ props: { text: "Two" } }] },
          ],
        },
      },
      { id: "footer", props: { text: "Keep the footer" } },
    ]);
  });
  it("targets an inactive page without replacing the active editor", () => {
    commitPageCodeBlocks("about", [heading("about-title", "Updated About")]);
    expect(useProjectStore.getState().pages[1].blocks[0].props.text).toBe(
      "Updated About",
    );
    expect(useEditorStore.getState().blocks[0].props.text).toBe("Home");
  });
});
