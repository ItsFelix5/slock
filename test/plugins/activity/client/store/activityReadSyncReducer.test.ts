import { describe, expect, test } from "bun:test";
import {
  epochOf,
  initialReadSyncState,
  type ReadSyncEvent,
  type ReadSyncState,
  reduceReadSync,
} from "../../../../../packages/plugins/src/activity/client/store/activityReadSyncReducer";
import { forAll, int, pick, type Random } from "../../../../support/core";
import { ch, stamp } from "../../../../support/slack";

const run = (events: readonly ReadSyncEvent[], from: ReadSyncState = initialReadSyncState) =>
  events.reduce(reduceReadSync, from);

const requested = (channel: string): ReadSyncEvent => ({
  channelId: ch(channel),
  type: "requested",
});
const settled = (channel: string, epoch: number, synced: boolean, ts = "1.1"): ReadSyncEvent => ({
  channelId: ch(channel),
  epoch,
  synced,
  ts: stamp(ts),
  type: "settled",
});

describe("reduceReadSync", () => {
  test.each([
    {
      expected: { epoch: 1, failures: 0, pending: 1 },
      events: [requested("C1")],
      name: "a request is pending",
    },
    {
      expected: { epoch: 1, failures: 0, pending: 0 },
      events: [requested("C1"), settled("C1", 1, true)],
      name: "a synced request clears pending",
    },
    {
      expected: { epoch: 1, failures: 1, pending: 0 },
      events: [requested("C1"), settled("C1", 1, false)],
      name: "a failed request is recorded",
    },
    {
      expected: { epoch: 2, failures: 0, pending: 1 },
      events: [requested("C1"), requested("C1"), settled("C1", 2, true)],
      name: "the newest request decides and the older one still pends",
    },
    {
      expected: { epoch: 2, failures: 0, pending: 0 },
      events: [requested("C1"), requested("C1"), settled("C1", 2, true), settled("C1", 1, false)],
      name: "a stale failure is ignored",
    },
    {
      expected: { epoch: 2, failures: 0, pending: 0 },
      events: [requested("C1"), settled("C1", 1, false), requested("C1"), settled("C1", 2, true)],
      name: "a later success clears the failure",
    },
  ])("$name", ({ events, expected }) => {
    const state = run(events);
    expect({
      epoch: epochOf(state, ch("C1")),
      failures: state.failures.size,
      pending: state.pending.size,
    }).toEqual(expected);
  });

  test("does not mutate the previous state", () => {
    const before = run([requested("C1")]);
    run([settled("C1", 1, false)], before);
    expect(before.failures.size).toBe(0);
    expect(before.pending.get(ch("C1"))).toBe(1);
  });
});

type Outstanding = { channel: string; epoch: number };

function scenario(random: Random) {
  const channels = ["C1", "C2", "C3"].slice(0, int(random, 1, 3));
  const events: ReadSyncEvent[] = [];
  const outstanding: Outstanding[] = [];
  const requestCounts = new Map<string, number>();
  for (let step = int(random, 1, 40); step > 0; step--) {
    if (outstanding.length === 0 || random() < 0.5) {
      const channel = pick(random, channels);
      const epoch = (requestCounts.get(channel) ?? 0) + 1;
      requestCounts.set(channel, epoch);
      outstanding.push({ channel, epoch });
      events.push(requested(channel));
    } else {
      const [done] = outstanding.splice(int(random, 0, outstanding.length - 1), 1);
      if (!done) continue;
      events.push(settled(done.channel, done.epoch, random() < 0.5));
    }
  }
  return { events, outstanding, requestCounts };
}

describe("reduceReadSync invariants", () => {
  test("counts stay valid for any event order", () => {
    forAll(scenario, ({ events, outstanding, requestCounts }) => {
      let state = initialReadSyncState;
      for (const event of events) {
        state = reduceReadSync(state, event);
        for (const count of state.pending.values()) expect(count).toBeGreaterThan(0);
        for (const channelId of state.failures.keys())
          expect(state.epochs.has(channelId)).toBe(true);
      }
      const stillPending = new Set(outstanding.map(({ channel }) => ch(channel)));
      expect(new Set(state.pending.keys())).toEqual(stillPending);
      for (const [channel, count] of requestCounts) expect(epochOf(state, ch(channel))).toBe(count);
    });
  });

  test("settle order never changes pending, and only the newest epoch decides failures", () => {
    forAll(scenario, ({ events }) => {
      const requests = events.filter((event) => event.type === "requested");
      const settles = events.filter((event) => event.type === "settled");
      const epochsAtEnd = run(requests);
      const settledInOrder = run(settles, epochsAtEnd);
      const settledReversed = run([...settles].reverse(), epochsAtEnd);
      expect(settledReversed.pending).toEqual(settledInOrder.pending);
      const newest = new Set(
        [...epochsAtEnd.epochs].map(([channelId, epoch]) => `${channelId}:${epoch}`),
      );
      const deciding = settles.filter(
        (event) => event.type === "settled" && newest.has(`${event.channelId}:${event.epoch}`),
      );
      expect(new Set(settledReversed.failures.keys())).toEqual(
        new Set(
          deciding.flatMap((event) =>
            event.type === "settled" && !event.synced ? [event.channelId] : [],
          ),
        ),
      );
    });
  });
});
