import { afterEach, describe, expect, test } from "bun:test";
import type { ImageElement as ImageElementType } from "@slock/types";
import { imageSrc } from "@slock/ui";
import ImageElement from "../../../packages/blockkit/src/elements/ImageElement";
import { attrs, count, mount, unmountAll } from "../../support/dom";

afterEach(unmountAll);

const element = (image_url: string): ImageElementType => ({
  alt_text: "pic",
  image_url,
  type: "image",
});

describe("ImageElement", () => {
  test("keeps an https image", () => {
    const host = mount(() => <ImageElement el={element("https://img.example.com/a.png")} />);
    expect(attrs(host, "img", "src")).toEqual([imageSrc("https://img.example.com/a.png")]);
  });

  test.each([
    "javascript:alert(1)",
    "data:image/svg+xml,<svg onload=alert(1)>",
    "//evil.com/a.png",
  ])("renders nothing for %p", (url) => {
    const host = mount(() => <ImageElement el={element(url)} />);
    expect(count(host, "img")).toBe(0);
  });
});
