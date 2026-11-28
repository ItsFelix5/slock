import { afterEach, describe, expect, test } from "bun:test";
import type { RichTextBlock, RichTextInlineElement } from "@slock/types";
import RichText from "../../../packages/blockkit/src/blocks/RichText";
import { mount, unmountAll } from "../../support/dom";

afterEach(unmountAll);

const render = (el: RichTextInlineElement) => {
  const block: RichTextBlock = {
    elements: [{ elements: [el], type: "rich_text_section" }],
    type: "rich_text",
  };
  return mount(() => <RichText block={block} />);
};

describe("RichText references", () => {
  test("citation links its display text", () => {
    const link = render({
      index: 1,
      text: "Roadmap",
      type: "citation",
      url: "https://example.com/roadmap",
    }).querySelector("a");
    expect(link?.textContent).toBe("Roadmap");
    expect(link?.getAttribute("href")).toBe("https://example.com/roadmap");
  });

  test("file without a url renders its title as plain text", () => {
    const root = render({ file_id: "F123ABC456", text: "Q3 plan", type: "file" });
    expect(root.querySelector("a")).toBeNull();
    expect(root.textContent).toContain("Q3 plan");
  });

  test("team renders a workspace mention", () => {
    const mention = render({ team_id: "T123ABC456", type: "team" }).querySelector(".bk-mention");
    expect(mention?.textContent).toBe("Workspace");
  });

  test("canvas user mention renders as a user mention", () => {
    const root = render({ type: "canvas_user_mention", user_id: "U123ABC456" });
    expect(root.querySelector(".bk-mention")).not.toBeNull();
  });
});
