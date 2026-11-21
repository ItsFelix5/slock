import { describe, expect, test } from "bun:test";
import { ch, stamp } from "@slock/slack/testing";
import {
  type ChannelSnapshot,
  channelReadPlan,
  type DividerTracker,
  dividerStep,
  type ThreadSnapshot,
  threadReadPlan,
} from "../../../../src/unread/client/store/readDecisions";
import { message } from "./unreadTestKit";

const C1 = ch("C1");
const ids = (...list: string[]) => new Set(list.map(ch));
const view = (id: string, lastRead: number, latest?: string, hasNewer = false) => ({
  hasNewer,
  id: ch(id),
  lastRead,
  latest: latest ? { pending: false, ts: stamp(latest) } : undefined,
});

describe("dividerStep", () => {
  test("anchors a view at its last read when newer messages exist", () => {
    const step = dividerStep(undefined, ids("C1"), [view("C1", 1_000_000, "2000.0")]);
    expect(step.anchors).toEqual([[C1, 1_000_000]]);
    expect(step.tracker.anchored.has(C1)).toBe(true);
  });

  test("anchors at Infinity when there is nothing unread", () => {
    expect(dividerStep(undefined, ids("C1"), [view("C1", 0, "2000.0")]).anchors).toEqual([
      [C1, Infinity],
    ]);
    expect(dividerStep(undefined, ids("C1"), [view("C1", 5_000_000, "2000.0")]).anchors).toEqual([
      [C1, Infinity],
    ]);
  });

  test("waits for the newest history and for a latest message", () => {
    const step = dividerStep(undefined, ids("C1", "C2"), [
      view("C1", 0, "2000.0", true),
      view("C2", 0),
    ]);
    expect(step.anchors).toEqual([]);
    expect(step.tracker.anchored.size).toBe(0);
  });

  test("anchors each view once", () => {
    const first = dividerStep(undefined, ids("C1"), [view("C1", 0, "2000.0")]);
    const second = dividerStep(first.tracker, ids("C1"), [view("C1", 0, "3000.0")]);
    expect(second.anchors).toEqual([]);
  });

  test("a view that leaves is dropped and can anchor again when it returns", () => {
    const first = dividerStep(undefined, ids("C1", "C2"), [
      view("C1", 0, "2000.0"),
      view("C2", 0, "2000.0"),
    ]);
    const left = dividerStep(first.tracker, ids("C2"), [view("C2", 0, "2000.0")]);
    expect(left.dropped).toEqual([C1]);
    expect(left.anchors).toEqual([]);
    const back = dividerStep(left.tracker, ids("C1", "C2"), [
      view("C1", 0, "2000.0"),
      view("C2", 0, "2000.0"),
    ]);
    expect(back.dropped).toEqual([]);
    expect(back.anchors).toEqual([[C1, Infinity]]);
  });

  test("drops views that were visible but never anchored", () => {
    const first = dividerStep(undefined, ids("C1"), []);
    const left: DividerTracker = dividerStep(first.tracker, ids("C2"), []).tracker;
    expect(left.visible).toEqual(ids("C2"));
    expect(dividerStep(first.tracker, ids("C2"), []).dropped).toEqual([C1]);
  });
});

const snapshot = (extra: Partial<ChannelSnapshot> = {}): ChannelSnapshot => ({
  hasDivider: true,
  hasList: true,
  hasNewer: false,
  id: C1,
  lastRead: 1_000_000,
  latest: { pending: false, ts: stamp("2000.0") },
  unread: true,
  viewed: true,
  ...extra,
});

describe("channelReadPlan", () => {
  test("marks the latest message, clears unread and syncs when it is newer than the cursor", () => {
    expect(channelReadPlan(snapshot(), undefined)).toEqual({
      clear: true,
      mark: { syncMs: 2_000_000, ts: stamp("2000.0") },
    });
  });

  test("clears without syncing when the cursor already covers the latest message", () => {
    expect(channelReadPlan(snapshot({ lastRead: 2_000_000 }), undefined)).toEqual({
      clear: true,
      mark: { syncMs: undefined, ts: stamp("2000.0") },
    });
  });

  test("does nothing until the divider is anchored and the view is seen at the bottom", () => {
    expect(channelReadPlan(snapshot({ hasDivider: false }), undefined)).toBeUndefined();
    expect(channelReadPlan(snapshot({ viewed: false }), undefined)).toBeUndefined();
    expect(channelReadPlan(snapshot({ hasNewer: true }), undefined)).toBeUndefined();
  });

  test("does nothing without a latest message or while it is pending", () => {
    expect(channelReadPlan(snapshot({ latest: undefined }), undefined)).toBeUndefined();
    expect(
      channelReadPlan(snapshot({ latest: { pending: true, ts: stamp("2000.0") } }), undefined),
    ).toBeUndefined();
  });

  test("an already marked latest message only re-clears a flag that came back", () => {
    const marked = stamp("2000.0");
    expect(channelReadPlan(snapshot({ lastRead: 2_000_000, unread: true }), marked)).toEqual({
      clear: true,
    });
    expect(channelReadPlan(snapshot({ lastRead: 2_000_000, unread: false }), marked)).toEqual({
      clear: false,
    });
  });

  test("a cursor older than our own mark means a stale echo, so wait", () => {
    expect(channelReadPlan(snapshot({ lastRead: 500_000 }), stamp("2000.0"))).toBeUndefined();
    expect(channelReadPlan(snapshot({ lastRead: undefined }), stamp("2000.0"))).toBeUndefined();
  });

  test("a newer message after a mark is marked again", () => {
    expect(
      channelReadPlan(
        snapshot({ latest: { pending: false, ts: stamp("3000.0") }, lastRead: 2_000_000 }),
        stamp("2000.0"),
      ),
    ).toEqual({ clear: true, mark: { syncMs: 3_000_000, ts: stamp("3000.0") } });
  });

  test("an unknown cursor counts as zero", () => {
    expect(channelReadPlan(snapshot({ lastRead: undefined }), undefined)?.mark?.syncMs).toBe(
      2_000_000,
    );
  });
});

const root = message("100.0", { isSubscribed: true });
const thread = (extra: Partial<ThreadSnapshot> = {}): ThreadSnapshot => ({
  channelId: C1,
  latest: { pending: false, ts: stamp("200.0") },
  root,
  ts: stamp("100.0"),
  viewed: true,
  ...extra,
});

describe("threadReadPlan", () => {
  test("marks the latest reply of a viewed, subscribed thread", () => {
    expect(threadReadPlan(thread(), undefined)).toEqual({ markTs: stamp("200.0"), root });
  });

  test("does nothing for unviewed or unsubscribed threads", () => {
    expect(threadReadPlan(thread({ viewed: false }), undefined)).toBeUndefined();
    expect(
      threadReadPlan(thread({ root: message("100.0", { isSubscribed: false }) }), undefined),
    ).toBeUndefined();
    expect(threadReadPlan(thread({ root: undefined }), undefined)).toBeUndefined();
  });

  test("does nothing without replies, with only the root, or while the reply is pending", () => {
    expect(threadReadPlan(thread({ latest: undefined }), undefined)).toBeUndefined();
    expect(
      threadReadPlan(thread({ latest: { pending: false, ts: stamp("100.0") } }), undefined),
    ).toBeUndefined();
    expect(
      threadReadPlan(thread({ latest: { pending: true, ts: stamp("200.0") } }), undefined),
    ).toBeUndefined();
  });

  test("does not mark the same reply twice", () => {
    expect(threadReadPlan(thread(), stamp("200.0"))).toBeUndefined();
    expect(threadReadPlan(thread(), stamp("150.0"))?.markTs).toBe(stamp("200.0"));
  });
});
