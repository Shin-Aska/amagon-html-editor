import { describe, expect, it, vi } from "vitest";
import {
  blockIdAtOffset,
  monacoAppTheme,
  pageFilename,
  projectClasses,
  projectThemeVariableNames,
  widgetHtmlRanges,
  decorateWidgetHtml,
} from "../editorSupport";
import { createDefaultTheme } from "../../../store/types";
import { BUILTIN_APP_THEMES } from "../../../themes/appThemes";
import { normalizeCodePreferences } from "../../../utils/codePreferences";
import {
  flushCodeEdits,
  registerCodeFlush,
  resetCodeSession,
  codeSessionGeneration,
} from "../../../utils/codeEditingSession";
describe("editor support", () => {
  it("maps app palettes to Monaco including syntax and selection colors", () => {
    const p = BUILTIN_APP_THEMES[2].light,
      t = monacoAppTheme("light", p);
    expect(t.base).toBe("vs");
    expect(t.colors["editor.background"]).toBe(p.bgPrimary);
    expect(t.colors["editor.selectionBackground"]).toBe(p.selection);
    expect(t.rules.find((r) => r.token === "tag")?.foreground).toBe(
      p.syntaxTag.slice(1),
    );
  });
  it("resolves nested widgets, opening tags, void elements, and closing tags", () => {
    const html =
      '<main data-block-id="main"><section data-block-id="section"><h2 data-block-id="title">Hello</h2><img data-block-id="image" src="x"></section>Tail</main>';
    expect(blockIdAtOffset(html, html.indexOf("Hello") + 2)).toBe("title");
    expect(
      blockIdAtOffset(html, html.indexOf('data-block-id="title"') + 5),
    ).toBe("title");
    expect(blockIdAtOffset(html, html.indexOf('src="x"') + 2)).toBe("image");
    expect(blockIdAtOffset(html, html.indexOf("Tail") + 1)).toBe("main");
    expect(blockIdAtOffset("<!doctype html>", 1)).toBe(null);
  });
  it("offers unique project classes and actual page filenames", () => {
    expect(
      projectClasses([
        {
          id: "a",
          type: "container",
          props: {},
          styles: {},
          classes: ["hero", "shared"],
          children: [
            {
              id: "b",
              type: "heading",
              props: {},
              styles: {},
              classes: ["shared", "title"],
              children: [],
            },
          ],
        },
      ]),
    ).toEqual(["hero", "shared", "title"]);
    expect(pageFilename({ slug: "about" })).toBe("about.html");
  });
  it("flushes before reset and unregisters panel callbacks", () => {
    const fn = vi.fn(),
      remove = registerCodeFlush(fn),
      generation = codeSessionGeneration();
    flushCodeEdits();
    resetCodeSession();
    expect(fn).toHaveBeenCalledTimes(2);
    expect(codeSessionGeneration()).toBe(generation + 1);
    remove();
    flushCodeEdits();
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it("suggests website CSS variable names that are actually emitted", () => {
    const names = projectThemeVariableNames(createDefaultTheme());
    expect(names).toContain("--theme-bg");
    expect(names).toContain("--theme-text-muted");
    expect(names).toContain("--theme-font-family");
    expect(names).not.toContain("--theme-background");
  });
  it("keeps editor settings bounded with minimap off by default", () => {
    expect(normalizeCodePreferences(null)).toEqual({
      fontSize: 13,
      tabSize: 2,
      wordWrap: true,
      minimap: false,
    });
    expect(
      normalizeCodePreferences({
        fontSize: 18,
        tabSize: 4,
        wordWrap: false,
        minimap: true,
      }),
    ).toEqual({ fontSize: 18, tabSize: 4, wordWrap: false, minimap: true });
  });
});

describe("widget HTML source ranges", () => {
  it("covers complete nested elements and void tags without matching comments or script strings", () => {
    const html = `<!-- <b data-block-id="fake"> -->
<section data-block-id='outer' title="a > b">
<h2 data-block-id="title">Hello</h2>
<img data-block-id="image" src="image.png">
<script>const text='<b data-block-id="fake">';</script>
</section>`;
    const ranges = widgetHtmlRanges(html);
    const slice = (id: string) => {
      const r = ranges.get(id)!;
      return html.slice(r.start, r.end);
    };
    expect(slice("outer")).toBe(html.slice(html.indexOf("<section")));
    expect(slice("title")).toBe('<h2 data-block-id="title">Hello</h2>');
    expect(slice("image")).toBe('<img data-block-id="image" src="image.png">');
    expect(ranges.has("fake")).toBe(false);
  });
  it("handles single-line markup, escaped identities and absent widgets", () => {
    const html =
      '<div data-block-id="a&amp;b">one<span data-block-id="child">two</span></div>';
    expect(widgetHtmlRanges(html).get("a&b")).toEqual({
      start: 0,
      end: html.length,
    });
    expect(widgetHtmlRanges(html).has("missing")).toBe(false);
    expect(widgetHtmlRanges("<p>No identity</p>").size).toBe(0);
  });
});

it("maps complete multipart widgets in both directions", () => {
  const block = {
    id: "multipart",
    type: "modal",
    props: {},
    styles: {},
    classes: [],
    children: [],
  };
  const source = decorateWidgetHtml(
    '<button>Open</button><div role="dialog"><p>Dialog body</p></div>',
    block,
  );
  const range = widgetHtmlRanges(source).get("multipart")!;
  expect(source.slice(range.start, range.end)).toContain("Dialog body");
  expect(source.slice(range.start, range.end)).toMatch(/<\/div>$/);
  expect(blockIdAtOffset(source, source.indexOf("Dialog body") + 2)).toBe(
    "multipart",
  );
});
