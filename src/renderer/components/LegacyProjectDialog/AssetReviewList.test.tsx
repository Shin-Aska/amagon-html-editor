import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import AssetReviewList from "./AssetReviewList";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const container = document.createElement("div");
let root: ReturnType<typeof createRoot> | undefined;
afterEach(() => {
  act(() => root?.unmount());
  container.replaceChildren();
});
it("renders at most 25 of 10,000 missing assets and supports pagination and search", async () => {
  const paths = Array.from(
    { length: 10000 },
    (_, index) => `assets/image-${index}.png`,
  );
  root = createRoot(container);
  await act(async () =>
    root?.render(
      <AssetReviewList
        paths={paths}
        label="Missing assets"
        render={(path) => path}
      />,
    ),
  );
  expect(container.querySelectorAll("li")).toHaveLength(25);
  const next = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Next",
  );
  act(() => next?.click());
  expect(container.querySelector("li")?.textContent).toBe(
    "assets/image-25.png",
  );
  const input = container.querySelector("input");
  if (!input) throw new Error("Search is missing");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(input, "image-9999.png");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.querySelectorAll("li")).toHaveLength(1);
  expect(container.querySelector("li")?.textContent).toBe(
    "assets/image-9999.png",
  );
});
