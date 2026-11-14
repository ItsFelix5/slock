import { describe, expect, test } from "bun:test";
import type { Message } from "@slock/types";
import { unreadSummary } from "../../../../../src/home/client/views/lib/unreadSummary";

const NOW = Date.UTC(2026, 9, 29, 12, 0, 0);
const MINUTE = 60_000;

function message(userId: string, ts: number): Message {
  return { ts: (ts / 1000).toFixed(6), userId } as Message;
}

describe("unreadSummary", () => {
  test("falls back to Unread without any detail", () => {
    expect(unreadSummary({ now: NOW })).toBe("Unread");
  });

  test("pluralizes mentions", () => {
    expect(unreadSummary({ mentions: 1, now: NOW })).toBe("1 mention");
    expect(unreadSummary({ mentions: 3, now: NOW })).toBe("3 mentions");
  });

  test("adds the time since the last read", () => {
    expect(unreadSummary({ lastRead: NOW - 5 * MINUTE, mentions: 2, now: NOW })).toBe(
      "2 mentions · since 5m ago",
    );
    expect(unreadSummary({ lastRead: NOW - 10_000, now: NOW })).toBe("Unread · since just now");
  });

  test("counts loaded messages newer than lastRead from other people", () => {
    const lastRead = NOW - 10 * MINUTE;
    const loadedMessages = [
      message("U2", NOW - 20 * MINUTE),
      message("U2", NOW - 5 * MINUTE),
      message("U1", NOW - 4 * MINUTE),
      message("U3", NOW - 3 * MINUTE),
    ];
    expect(unreadSummary({ currentUserId: "U1", lastRead, loadedMessages, now: NOW })).toBe(
      "2 unread messages · since 10m ago",
    );
    expect(
      unreadSummary({
        currentUserId: "U1",
        lastRead,
        loadedMessages: loadedMessages.slice(1, 2),
        now: NOW,
      }),
    ).toBe("1 unread message · since 10m ago");
  });

  test("does not count when nothing newer is loaded", () => {
    const loadedMessages = [message("U2", NOW - 20 * MINUTE)];
    expect(unreadSummary({ lastRead: NOW - MINUTE, loadedMessages, now: NOW })).toBe(
      "Unread · since 1m ago",
    );
  });

  test("skips the count when lastRead is unknown", () => {
    const loadedMessages = [message("U2", NOW - MINUTE)];
    expect(unreadSummary({ loadedMessages, mentions: 1, now: NOW })).toBe("1 mention");
  });
});
