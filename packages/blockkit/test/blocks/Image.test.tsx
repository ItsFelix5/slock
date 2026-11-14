import { afterEach, describe, expect, test } from "bun:test";
import type { ImageBlock } from "@slock/types";
import Image from "../../src/blocks/Image";
import { attrs, count, mount, unmountAll } from "../../src/domTesting";

afterEach(unmountAll);

const block = (fields: Partial<ImageBlock>): ImageBlock => ({
  alt_text: "chart",
  image_url: "https://img.example.com/a.png",
  type: "image",
  ...fields,
});

describe("Image block", () => {
  test("renders a safe image with its title", () => {
    const host = mount(() => (
      <Image block={block({ title: { text: "Q3", type: "plain_text" } })} />
    ));
    expect(attrs(host, "img", "src")).toEqual(["https://img.example.com/a.png"]);
    expect(host.querySelector("figcaption")?.textContent).toBe("Q3");
  });

  test("uses the slack file url when there is no image_url", () => {
    const host = mount(() => (
      <Image
        block={block({
          image_url: undefined,
          slack_file: { url: "https://files.slack.com/b.png" },
        })}
      />
    ));
    expect(attrs(host, "img", "src")).toEqual(["https://files.slack.com/b.png"]);
  });

  test.each([
    "javascript:alert(1)",
    "data:image/svg+xml,<svg onload=alert(1)>",
    "//evil.com/a.png",
    "/api/secret",
    "",
  ])("renders nothing for %p", (url) => {
    const host = mount(() => <Image block={block({ image_url: url })} />);
    expect(count(host, "img")).toBe(0);
    expect(count(host, "figure")).toBe(0);
  });
});
