import { afterEach, describe, expect, test } from "bun:test";
import type { LayoutBlock, SectionBlock } from "@slock/types";
import BlockKit from "../../../packages/blockkit/src/BlockKit";
import { mount, unmountAll } from "../../support/dom";

afterEach(unmountAll);

const section = (text: string): SectionBlock => ({
  text: { text, type: "mrkdwn" },
  type: "section",
});

const layout: LayoutBlock = {
  grid_lines: "rows",
  is_label_visible: true,
  label: "Deal",
  rows: [
    {
      items: [
        { block: section("Stage"), width: "narrow" },
        { block: section("Amount"), horizontal_alignment: "end", width: "wide" },
      ],
    },
    { items: [{ block: section("Next") }] },
  ],
  type: "layout",
};

describe("layout block", () => {
  test("renders the label, grid lines and rows in source order", () => {
    const root = mount(() => <BlockKit blocks={[layout]} />);
    expect(root.querySelector(".bk-layout-label")?.textContent).toBe("Deal");
    expect(root.querySelector(".bk-layout--rows")).not.toBeNull();
    expect(root.querySelectorAll(".bk-layout-row").length).toBe(2);
    expect(root.querySelectorAll(".bk-layout-item")[2]?.textContent).toContain("Next");
  });

  test("weights items by width and applies horizontal alignment", () => {
    const root = mount(() => <BlockKit blocks={[layout]} />);
    const [narrow, wide] = root.querySelectorAll<HTMLElement>(".bk-layout-item");
    expect(narrow?.style.flexGrow).toBe("1");
    expect(wide?.style.flexGrow).toBe("3");
    expect(wide?.dataset.align).toBe("end");
  });
});
