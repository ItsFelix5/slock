import { afterEach, describe, expect, test } from "bun:test";
import type { ContextBlock } from "@slock/types";
import { imageSrc } from "@slock/ui";
import Context from "../../src/blocks/Context";
import { attrs, mount, unmountAll } from "../../src/domTesting";

afterEach(unmountAll);

const imageBlock = (image_url: string): ContextBlock => ({
  elements: [{ alt_text: "icon", image_url, type: "image" }],
  type: "context",
});

describe("Context block image", () => {
  test("keeps an https image", () => {
    const host = mount(() => <Context block={imageBlock("https://img.example.com/a.png")} />);
    expect(attrs(host, "img", "src")).toEqual([imageSrc("https://img.example.com/a.png")]);
  });

  test.each([
    "javascript:alert(1)",
    "data:image/svg+xml,<svg onload=alert(1)>",
    "//evil.com/a.png",
  ])("drops %p", (url) => {
    const host = mount(() => <Context block={imageBlock(url)} />);
    expect(attrs(host, "img", "src")).toEqual([null]);
  });
});
