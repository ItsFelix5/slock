import { describe, expect, test } from "bun:test";
import { forAll, int } from "@slock/core/testing";
import { ch, stamp, uid } from "@slock/slack/testing";
import type { ActivityItem, User } from "@slock/types";
import {
  gatewayActivityCountsSnapshot,
  gatewayActivityPingCount,
  isOwnOrUnresolved,
  NO_CHANNEL,
  NO_USER,
  reactionActivityKey,
} from "../../../src/activity/client/kinds";

const me: User = { avatarColor: "", id: uid("U1"), name: "me" };

function item(patch: Partial<ActivityItem>): ActivityItem {
  return {
    channelId: ch("C1"),
    id: "a",
    kind: "mention",
    text: "",
    time: 1,
    ts: stamp("1.1"),
    userId: uid("U2"),
    ...patch,
  };
}

describe("isOwnOrUnresolved", () => {
  test.each([
    ["own channel_all", "channel_all", uid("U1"), true],
    ["own thread reply", "thread_reply", uid("U1"), true],
    ["own dm", "dm", uid("U1"), true],
    ["unresolved author", "thread_reply", NO_USER, true],
    ["someone else", "thread_reply", uid("U2"), false],
    ["own mention is kept", "mention", uid("U1"), false],
    ["own reaction is kept", "reaction", uid("U1"), false],
    ["unresolved mention is kept", "mention", NO_USER, false],
  ] as const)("%s", (_name, kind, userId, expected) => {
    expect(isOwnOrUnresolved({ kind, userId }, me)).toBe(expected);
  });
});

describe("reactionActivityKey", () => {
  test("is distinct per reacting user", () => {
    const key = (id: string) =>
      reactionActivityKey(item({ kind: "reaction", reactionName: "x", userId: uid(id) }));
    expect(key("U1")).toBeDefined();
    expect(key("U1")).not.toBe(key("U2"));
  });

  test.each([
    ["not a reaction", { kind: "mention" as const, reactionName: "x" }],
    ["no emoji", { kind: "reaction" as const }],
    ["no user", { kind: "reaction" as const, reactionName: "x", userId: NO_USER }],
    ["no channel", { channelId: NO_CHANNEL, kind: "reaction" as const, reactionName: "x" }],
  ])("is undefined for %s", (_name, patch) => {
    expect(reactionActivityKey(item(patch))).toBeUndefined();
  });
});

describe("gatewayActivityPingCount", () => {
  test("sums only ping keys", () => {
    expect(gatewayActivityPingCount({ at_user: 2, dm: 1, thread_v2: 3, reactions: 40 })).toBe(6);
  });

  test("is zero without counts", () => {
    expect(gatewayActivityPingCount(undefined)).toBe(0);
    expect(gatewayActivityPingCount({})).toBe(0);
  });

  test("ignores garbage values", () => {
    expect(gatewayActivityPingCount({ at_user: Number.NaN, dm: 2 })).toBe(2);
  });

  test("property: never negative", () => {
    const keys = ["at_user", "dm", "keyword", "thread_v2", "other"];
    forAll(
      (random) => Object.fromEntries(keys.map((key) => [key, int(random, -5, 5)] as const)),
      (counts) => expect(gatewayActivityPingCount(counts)).toBeGreaterThanOrEqual(0),
    );
  });
});

describe("gatewayActivityCountsSnapshot", () => {
  test("is stable across key order", () => {
    expect(gatewayActivityCountsSnapshot({ a: 1, b: 2 })).toBe(
      gatewayActivityCountsSnapshot({ b: 2, a: 1 }),
    );
  });

  test("changes when a count changes", () => {
    expect(gatewayActivityCountsSnapshot({ a: 1 })).not.toBe(
      gatewayActivityCountsSnapshot({ a: 2 }),
    );
  });

  test("is empty without counts", () => {
    expect(gatewayActivityCountsSnapshot(undefined)).toBe("");
  });
});
