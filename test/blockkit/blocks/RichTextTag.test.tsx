import { afterEach, describe, expect, test } from "bun:test";
import type { RichTextBlock, RichTextTagElement } from "@slock/types";
import RichText from "../../../packages/blockkit/src/blocks/RichText";
import { mount, unmountAll } from "../../support/dom";

afterEach(unmountAll);

const render = (tag: Omit<RichTextTagElement, "type">) => {
  const block: RichTextBlock = {
    elements: [{ elements: [{ ...tag, type: "tag" }], type: "rich_text_section" }],
    type: "rich_text",
  };
  return mount(() => <RichText block={block} />).querySelector<HTMLElement>(".bk-tag");
};

describe("RichText tag", () => {
  test("renders its text with the given color", () => {
    const tag = render({ color: "red", text: "Blocked" });
    expect(tag?.textContent).toBe("Blocked");
    expect(tag?.classList.contains("bk-tag-red")).toBe(true);
  });

  test("defaults to gray and applies style", () => {
    const tag = render({ style: { bold: true }, text: "In progress" });
    expect(tag?.className).not.toContain("bk-tag-blue");
    expect(tag?.classList.contains("bk-rt-bold")).toBe(true);
  });
});
