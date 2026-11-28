import { describe, expect, test } from "bun:test";
import { dropZone } from "../../../../../packages/plugins/src/conversations/client/views/dropZone";

const pane = { height: 600, left: 200, top: 0, width: 400 };

describe("dropZone", () => {
  test("the middle covers the whole pane", () => {
    expect(dropZone(pane, 400)).toEqual({ ...pane, side: "over" });
  });

  test("each edge covers its own half", () => {
    expect(dropZone(pane, 210)).toEqual({ ...pane, side: "before", width: 200 });
    expect(dropZone(pane, 590)).toEqual({ ...pane, left: 400, side: "after", width: 200 });
  });
});
