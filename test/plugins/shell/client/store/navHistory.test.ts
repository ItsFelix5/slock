import { describe, expect, test } from "bun:test";
import { historyAction } from "../../../../../packages/plugins/src/shell/client/store/navHistory";

const mark = (key: string, serialized: string) => ({ key, serialized });

describe("historyAction", () => {
  test("skips when the snapshot is unchanged", () => {
    expect(historyAction(mark("a", "{a}"), mark("a", "{a}"))).toBe("skip");
  });

  test("replaces when only non-structural content changed", () => {
    expect(historyAction(mark("a", "{a1}"), mark("a", "{a2}"))).toBe("replace");
  });

  test("pushes when the pane structure changed", () => {
    expect(historyAction(mark("a", "{a}"), mark("a/b", "{a,b}"))).toBe("push");
  });

  test("an identical serialization wins over a differing key", () => {
    expect(historyAction(mark("a", "{a}"), mark("b", "{a}"))).toBe("skip");
  });
});
