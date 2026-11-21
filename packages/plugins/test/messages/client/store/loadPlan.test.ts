import { describe, expect, test } from "bun:test";
import { ch } from "@slock/slack/testing";
import {
  channelsNeedingRecentHistory,
  planThreadLoad,
} from "../../../../src/messages/client/store/history/loadPlan";
import { slackTs } from "../messageFixture";

const A = ch("C1");
const B = ch("C2");
const C = ch("C3");

describe("channelsNeedingRecentHistory", () => {
  test("skips channels at the present and channels with a pending message target", () => {
    const loaded = channelsNeedingRecentHistory({
      atPresent: (id) => id === A,
      targetChannelIds: [B],
      viewIds: [A, B, C],
    });
    expect(loaded).toEqual([C]);
  });

  test("loads everything unloaded when there are no targets", () => {
    expect(
      channelsNeedingRecentHistory({
        atPresent: () => false,
        targetChannelIds: [],
        viewIds: [A, B],
      }),
    ).toEqual([A, B]);
  });
});

describe("planThreadLoad", () => {
  const ts = slackTs(1_700_000_000);
  const anchor = slackTs(1_700_000_500);
  const base = {
    anchor: undefined,
    anchorAttempted: undefined,
    anchorCovered: false,
    hasError: false,
    hasPaging: false,
    ts,
  };

  test("an unseen thread loads from the start", () => {
    expect(planThreadLoad(base)).toEqual({ kind: "initial" });
  });

  test("a loaded or failed thread is left alone", () => {
    expect(planThreadLoad({ ...base, hasPaging: true })).toEqual({ kind: "none" });
    expect(planThreadLoad({ ...base, hasError: true })).toEqual({ kind: "none" });
  });

  test("an uncovered anchor reloads around it even when the thread is loaded", () => {
    expect(planThreadLoad({ ...base, anchor, hasPaging: true })).toEqual({
      anchor,
      kind: "anchored",
    });
  });

  test("an anchor that is covered, already attempted, or the root does not reload", () => {
    expect(planThreadLoad({ ...base, anchor, anchorCovered: true, hasPaging: true })).toEqual({
      kind: "none",
    });
    expect(planThreadLoad({ ...base, anchor, anchorAttempted: anchor, hasPaging: true })).toEqual({
      kind: "none",
    });
    expect(planThreadLoad({ ...base, anchor: ts, hasPaging: true })).toEqual({ kind: "none" });
  });
});
