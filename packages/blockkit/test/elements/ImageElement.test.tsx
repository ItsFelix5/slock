import { afterEach, describe, expect, test } from "bun:test";
import type { ImageElement as ImageElementType } from "@slock/types";
import { attrs, count, mount, unmountAll } from "../../src/domTesting";
import ImageElement from "../../src/elements/ImageElement";

afterEach(unmountAll);

const element = (image_url: string): ImageElementType => ({
  alt_text: "pic",
  image_url,
  type: "image",
});

describe("ImageElement", () => {
  test("keeps an https image", () => {
    const host = mount(() => <ImageElement el={element("https://img.example.com/a.png")} />);
    expect(attrs(host, "img", "src")).toEqual(["https://img.example.com/a.png"]);
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
