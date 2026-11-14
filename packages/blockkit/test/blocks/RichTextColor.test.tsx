import { afterEach, describe, expect, test } from "bun:test";
import type { RichTextBlock } from "@slock/types";
import RichText from "../../src/blocks/RichText";
import { mount, unmountAll } from "../../src/domTesting";

afterEach(unmountAll);

const colorBlock = (value: string): RichTextBlock => ({
  elements: [{ elements: [{ type: "color", value }], type: "rich_text_section" }],
  type: "rich_text",
});

const dotBackground = (value: string) => {
  const host = mount(() => <RichText block={colorBlock(value)} />);
  return host.querySelector<HTMLElement>(".bk-color-dot")?.style.background ?? "";
};

describe("RichText color dot", () => {
  test("paints a hex color", () => {
    expect(dotBackground("#ff0000")).not.toBe("");
  });

  test.each([
    "url(https://evil.com/x.png)",
    "#fff;background:url(https://evil.com/x.png)",
    "red",
    "var(--x)",
  ])("ignores %p", (value) => {
    expect(dotBackground(value)).toBe("");
  });
});
