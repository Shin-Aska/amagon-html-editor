import { beforeAll, describe, expect, it } from "vitest";
import { blockToHtml, pageToHtml } from "../blockToHtml";
import { registerBlocks } from "../../registry/registerBlocks";
import {
  buildDefaultBlockProps,
  componentRegistry,
} from "../../registry/ComponentRegistry";
import {
  decorateWidgetHtml,
  widgetHtmlRanges,
} from "../../components/CodeEditor/editorSupport";
import type { Block } from "../../store/types";

beforeAll(() => registerBlocks());
const heading = (id: string): Block => ({
  id,
  type: "heading",
  props: {
    id: "custom-anchor",
    anchorId: "custom-anchor",
    text: "Find this heading",
    level: 2,
  },
  styles: {},
  classes: [],
  children: [],
});
describe("code source identities", () => {
  it.each(["bootstrap-5", "tailwind", "vanilla"] as const)(
    "%s: identifies every registered widget without changing export markup",
    (framework) => {
      for (const definition of componentRegistry.getAll()) {
        const block: Block = {
          id: `source-${definition.type}`,
          type: definition.type,
          props: {
            ...buildDefaultBlockProps(definition),
            id: `element-${definition.type}`,
          },
          classes: definition.defaultClasses ?? [],
          styles: {},
          children: [],
        };
        const options = { framework, includeEditorMetadata: true };
        const exported = blockToHtml([block], options),
          source = blockToHtml([block], {
            ...options,
            decorateBlock: decorateWidgetHtml,
          });
        expect(widgetHtmlRanges(source).has(block.id), definition.type).toBe(
          true,
        );
        expect(
          source
            .replace(/ data-block-id="[^"]*"/g, "")
            .replace(/<!--amagon-source-(?:start|end):[^>]*-->/g, ""),
          definition.type,
        ).toBe(exported);
        expect(exported).not.toContain("data-block-id=");
      }
    },
  );
  it("keeps nested widget and tab content identities distinct from custom HTML ids", () => {
    const blocks: Block[] = [
      {
        id: "container",
        type: "container",
        props: {},
        styles: {},
        classes: [],
        children: [heading("child")],
      },
      {
        id: "tabs",
        type: "tabs",
        props: { tabs: [{ label: "First", blocks: [heading("tab-child")] }] },
        styles: {},
        classes: [],
        children: [],
      },
    ];
    const source = pageToHtml(blocks, {
      decorateBlock: decorateWidgetHtml,
      includeEditorMetadata: true,
    });
    const ranges = widgetHtmlRanges(source);
    for (const id of ["container", "child", "tabs", "tab-child"])
      expect(ranges.has(id), id).toBe(true);
    expect(ranges.get("container")!.start).toBeLessThan(
      ranges.get("child")!.start,
    );
    expect(ranges.get("container")!.end).toBeGreaterThan(
      ranges.get("child")!.end,
    );
    expect(source).toContain('id="custom-anchor"');
    expect(pageToHtml(blocks)).not.toContain("data-block-id=");
  });
});
