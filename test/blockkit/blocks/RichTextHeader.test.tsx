import { afterEach, expect, test } from "bun:test";
import type { RichTextBlock } from "@slock/types";
import RichText from "../../../packages/blockkit/src/blocks/RichText";
import { mount, unmountAll } from "../../support/dom";

afterEach(unmountAll);

test("renders a rich text header at its level", () => {
  const block: RichTextBlock = {
    elements: [{ elements: [{ text: "dunno", type: "text" }], level: 2, type: "rich_text_header" }],
    type: "rich_text",
  };
  const host = mount(() => <RichText block={block} />);
  expect(host.querySelector("h2.bk-header")?.textContent).toBe("dunno");
});
