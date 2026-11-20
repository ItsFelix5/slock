import { describe, expect, test } from "bun:test";
import { forAll, int, pick } from "@slock/core/testing";
import { fid, stamp, uid } from "@slock/slack/testing";
import type { Message } from "@slock/types";
import {
  confirmsPending,
  dedupeMessages,
  isPendingMessage,
  mergeMessages,
} from "../../../../src/messages/client/api/messageMerge";
import { message, slackTs } from "../messageFixture";

const SENT_AT_MS = 1_700_000_000_000;

function pending(overrides: Partial<Message> = {}): Message {
  return message(slackTs(1_700_000_000, 100), {
    id: `pending-${SENT_AT_MS}`,
    pending: true,
    text: "hello",
    ...overrides,
  });
}

function confirmed(overrides: Partial<Message> = {}): Message {
  return message(slackTs(1_700_000_001, 500_000), { text: "hello", ...overrides });
}

function randomMessages(random: () => number): Message[] {
  const count = int(random, 0, 12);
  return Array.from({ length: count }, () => {
    const ts = slackTs(1_700_000_000 + int(random, 0, 8), int(random, 0, 3));
    return message(ts, { id: pick(random, [ts, `alt-${ts}`]), text: `v${int(random, 0, 3)}` });
  });
}

function expectOrderedUnique(messages: Message[]) {
  const stamps = messages.map((m) => m.ts);
  expect(new Set(stamps).size).toBe(stamps.length);
  expect(stamps).toEqual([...stamps].sort());
}

describe("confirmsPending", () => {
  test("matches the same author and text inside the window", () => {
    expect(confirmsPending(pending(), confirmed())).toBe(true);
  });

  test.each([
    ["other author", confirmed({ userId: uid("U2") })],
    ["other text", confirmed({ text: "bye" })],
    ["too late", confirmed({ ts: slackTs(1_700_000_061) })],
    ["too early", confirmed({ ts: slackTs(1_699_999_939) })],
  ])("rejects %s", (_name, candidate) => {
    expect(confirmsPending(pending(), candidate)).toBe(false);
  });

  test("a file upload confirms a pending file message whatever the text", () => {
    const upload = pending({ pendingFiles: [], text: "" });
    const file = {
      id: fid("F1"),
      isImage: false,
      name: "a.txt",
      urlPrivate: "https://files.slack.com/a",
    };
    const shared = confirmed({ files: [file], text: "caption" });
    expect(confirmsPending(upload, shared)).toBe(true);
  });

  test("never confirms with a pending message or from a confirmed one", () => {
    expect(confirmsPending(pending(), pending())).toBe(false);
    expect(confirmsPending(confirmed(), confirmed())).toBe(false);
  });
});

describe("dedupeMessages", () => {
  test("sorts by timestamp as a number", () => {
    const result = dedupeMessages([
      message(stamp("10.000001")),
      message(stamp("9.999999")),
      message(stamp("100.5")),
    ]);
    expect(result.map((m) => m.ts)).toEqual([
      stamp("9.999999"),
      stamp("10.000001"),
      stamp("100.5"),
    ]);
  });

  test("the last duplicate wins", () => {
    const result = dedupeMessages([
      message(stamp("5.1"), { text: "old" }),
      message(stamp("5.1"), { text: "new" }),
    ]);
    expect(result.map((m) => m.text)).toEqual(["new"]);
  });

  test("orders microsecond neighbours", () => {
    const result = dedupeMessages([
      message(slackTs(1_700_000_000, 2)),
      message(slackTs(1_700_000_000, 1)),
    ]);
    expect(result.map((m) => m.ts)).toEqual([slackTs(1_700_000_000, 1), slackTs(1_700_000_000, 2)]);
  });

  test("is idempotent, ordered and unique", () => {
    forAll(randomMessages, (messages) => {
      const once = dedupeMessages(messages);
      expectOrderedUnique(once);
      expect(dedupeMessages(once)).toEqual(once);
    });
  });
});

describe("mergeMessages", () => {
  test("replaces a pending message with its confirmation", () => {
    const result = mergeMessages([pending()], [confirmed()]);
    expect(result).toEqual([confirmed()]);
    expect(result.some(isPendingMessage)).toBe(false);
  });

  test("keeps an unrelated pending message", () => {
    const result = mergeMessages([pending({ text: "still sending" })], [confirmed()]);
    expect(result).toHaveLength(2);
    expect(result.some(isPendingMessage)).toBe(true);
  });

  test("fresh data replaces existing messages with the same id", () => {
    const old = message(stamp("5.000001"), { text: "old" });
    const result = mergeMessages([old], [message(stamp("5.000001"), { text: "edited" })]);
    expect(result.map((m) => m.text)).toEqual(["edited"]);
  });

  test("keeps object identity when nothing changed", () => {
    const existing = message(stamp("5.000001"));
    const result = mergeMessages([existing], [{ ...existing }]);
    expect(result[0]).toBe(existing);
  });

  test("a deleted flag from history sticks to the known message", () => {
    const known = message(stamp("5.000001"), { text: "keep" });
    const [merged] = mergeMessages(
      [known],
      [message(stamp("5.000001"), { deleted: true, text: "" })],
    );
    expect(merged).toEqual({ ...known, deleted: true });
  });

  test("history without the flag clears a local deleted mark", () => {
    const known = message(stamp("5.000001"), { deleted: true });
    const [merged] = mergeMessages([known], [message(stamp("5.000001"))]);
    expect(merged?.deleted).toBeUndefined();
  });

  test("subscription state survives a refresh that lacks it", () => {
    const known = message(stamp("5.000001"), { isSubscribed: true });
    const [merged] = mergeMessages([known], [message(stamp("5.000001"))]);
    expect(merged?.isSubscribed).toBe(true);
  });

  test("merging a page into an empty list returns it ordered", () => {
    const page = [message(stamp("3.1")), message(stamp("1.1")), message(stamp("2.1"))];
    expect(mergeMessages([], page).map((m) => m.ts)).toEqual([
      stamp("1.1"),
      stamp("2.1"),
      stamp("3.1"),
    ]);
  });

  test("output is ordered, unique and contains every fresh message", () => {
    forAll(
      (random) => ({ existing: randomMessages(random), fresh: randomMessages(random) }),
      ({ existing, fresh }) => {
        const result = mergeMessages(existing, fresh);
        expectOrderedUnique(result);
        const stamps = new Set(result.map((m) => m.ts));
        for (const m of fresh) expect(stamps.has(m.ts)).toBe(true);
      },
    );
  });

  test("merging the same page twice changes nothing", () => {
    forAll(
      (random) => ({ existing: randomMessages(random), fresh: randomMessages(random) }),
      ({ existing, fresh }) => {
        const once = mergeMessages(existing, fresh);
        expect(mergeMessages(once, fresh)).toEqual(once);
      },
    );
  });
});
