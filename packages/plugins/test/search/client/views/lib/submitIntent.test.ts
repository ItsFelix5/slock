import { describe, expect, test } from "bun:test";
import { submitIntent } from "../../../../../src/search/client/views/lib/submitIntent";

const idle = { activeIndex: 2, hasQuery: true, rowCount: 3, searching: false };

describe("submitIntent", () => {
  test("opens the active row once results are committed", () => {
    expect(submitIntent(idle)).toEqual({ index: 2, kind: "open" });
    expect(submitIntent({ ...idle, activeIndex: 0 })).toEqual({ index: 0, kind: "open" });
  });

  test("ignores enter with no active row", () => {
    expect(submitIntent({ ...idle, activeIndex: null })).toEqual({ kind: "ignore" });
  });

  test("queues while the first search is pending with nothing shown", () => {
    expect(submitIntent({ ...idle, rowCount: 0, searching: true })).toEqual({ kind: "queue" });
    expect(submitIntent({ ...idle, activeIndex: null, rowCount: 0, searching: true })).toEqual({
      kind: "queue",
    });
  });

  test("does not queue when rows are already shown or the query is empty", () => {
    expect(submitIntent({ ...idle, searching: true })).toEqual({ index: 2, kind: "open" });
    expect(submitIntent({ ...idle, hasQuery: false, rowCount: 0, searching: true })).toEqual({
      index: 2,
      kind: "open",
    });
  });
});
