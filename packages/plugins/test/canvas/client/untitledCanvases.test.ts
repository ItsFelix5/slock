import { describe, expect, test } from "bun:test";
import { parseFileId } from "@slock/slack";
import { newlyUntitled, untitledCanvases } from "../../../src/canvas/client/lib/untitledCanvases";

const fileId = parseFileId("F0123456789");
const otherFileId = parseFileId("F0987654321");

describe("untitledCanvases", () => {
  test("lists canvas panes with no title", () => {
    expect(
      untitledCanvases([
        { content: { fileId, kind: "canvas", title: "" }, id: "a" },
        { content: { fileId: otherFileId, kind: "canvas", title: "Plan" }, id: "b" },
        { content: null, id: "c" },
      ]),
    ).toEqual([{ fileId, id: "a" }]);
  });
});

describe("newlyUntitled", () => {
  const a = { fileId, id: "a" };
  const b = { fileId: otherFileId, id: "b" };

  test("everything is new on the first run", () => {
    expect(newlyUntitled(undefined, [a, b])).toEqual([a, b]);
  });

  test("panes already waiting for a title are not requested again", () => {
    expect(newlyUntitled([a], [a, b])).toEqual([b]);
    expect(newlyUntitled([a, b], [a, b])).toEqual([]);
  });

  test("a pane that switches canvas is requested again", () => {
    expect(newlyUntitled([a], [{ fileId: otherFileId, id: "a" }])).toEqual([
      { fileId: otherFileId, id: "a" },
    ]);
  });

  test("a titled pane drops out and nothing new is requested", () => {
    expect(newlyUntitled([a, b], [b])).toEqual([]);
  });
});
