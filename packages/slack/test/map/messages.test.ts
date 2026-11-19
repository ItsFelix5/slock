import { describe, expect, test } from "bun:test";
import { forAll, int, pick, text } from "@slock/core/testing";
import type { RawMessage } from "@slock/types";
import {
  isHiddenSubtype,
  isMyRelayedMessage,
  isRawMessage,
  mapMessage,
  mapVisibleMessage,
  mapVisibleMessages,
  RELAY_BOT_ID,
} from "../../src/map/messages";
import { stamp, uid } from "../../src/testing";
import { garbageRecord, MESSAGE_SPEC, viaJson } from "../garbage";

const TS = stamp("1700000000.000100");

describe("mapMessage", () => {
  test("uses the ts as id and the user as author", () => {
    expect(mapMessage({ text: "hi", ts: TS, user: "U1" })).toMatchObject({
      id: TS,
      kind: "normal",
      text: "hi",
      ts: TS,
      userId: uid("U1"),
    });
  });

  test("bot messages fall back to the bot id as author", () => {
    expect(mapMessage({ bot_id: "B1", ts: TS }).userId).toBe(uid("B1"));
    expect(mapMessage({ ts: TS }).userId).toBeUndefined();
  });

  test("bot icon prefers the message icons over the bot profile", () => {
    const message = mapMessage({
      bot_profile: { icons: { image_72: "profile.png" } },
      icons: { image_48: "message.png" },
      ts: TS,
    });
    expect(message.botIcon).toBe("message.png");
  });

  test("an empty text falls back to the rich text preview", () => {
    const message = mapMessage({
      blocks: [
        {
          block_id: "b",
          elements: [
            { elements: [{ text: "from blocks", type: "text" }], type: "rich_text_section" },
          ],
          type: "rich_text",
        },
      ],
      text: "",
      ts: TS,
    });
    expect(message.text).toBe("from blocks");
  });

  test("system subtypes prefix the actor mention once", () => {
    expect(
      mapMessage({ subtype: "channel_join", text: "joined", ts: TS, user: "U1" }),
    ).toMatchObject({
      kind: "system",
      text: "<@U1> joined",
    });
    expect(
      mapMessage({ subtype: "channel_join", text: "<@U1> joined", ts: TS, user: "U1" }).text,
    ).toBe("<@U1> joined");
  });

  test("threadTs is dropped for the root of a thread", () => {
    expect(mapMessage({ thread_ts: TS, ts: TS }).threadTs).toBeUndefined();
    expect(mapMessage({ thread_ts: "1699999999.000100", ts: TS }).threadTs).toBe(
      stamp("1699999999.000100"),
    );
  });

  test("tombstones and thread_hidden are deleted", () => {
    expect(mapMessage({ subtype: "tombstone", ts: TS }).deleted).toBe(true);
    expect(mapMessage({ subtype: "thread_hidden", ts: TS }).deleted).toBe(true);
    expect(mapMessage({ ts: TS }).deleted).toBeUndefined();
  });

  test("thread_broadcast marks a broadcast", () => {
    expect(mapMessage({ subtype: "thread_broadcast", ts: TS }).isBroadcast).toBe(true);
  });

  test("maps the thread root recursively", () => {
    expect(
      mapMessage({ root: { text: "root", ts: "1.1", user: "U2" }, ts: TS }).threadRoot,
    ).toMatchObject({
      id: "1.1",
      userId: "U2",
    });
  });

  test("never throws on garbage and keeps the ts", () => {
    forAll(
      (random) => ({
        ...garbageRecord(random, MESSAGE_SPEC),
        ts: `${int(random, 1, 2e9)}.${text(random, "0123456789", 6)}0`,
      }),
      (garbage) => {
        const raw = viaJson<RawMessage>(garbage);
        const mapped = mapMessage(raw);
        expect(mapped.id).toBe(stamp(raw.ts));
        expect(mapped.ts).toBe(stamp(raw.ts));
      },
      500,
    );
  });
});

describe("visible messages", () => {
  test("hides edit and delete envelopes", () => {
    for (const subtype of [
      "message_changed",
      "message_deleted",
      "message_replied",
      "reply_broadcast",
    ]) {
      expect(mapVisibleMessage({ subtype, ts: TS })).toBeUndefined();
    }
    expect(mapVisibleMessage({ subtype: "bot_message", ts: TS })).toBeDefined();
  });

  test("keeps only type message and preserves order", () => {
    const raws: RawMessage[] = [
      { ts: "3", type: "message" },
      { ts: "1", type: "message" },
      { subtype: "message_changed", ts: "9", type: "message" },
      { ts: "5", type: "channel_join" },
      { ts: "2", type: "message" },
    ];
    expect(mapVisibleMessages(raws).map((message) => message.id)).toEqual([
      stamp("3"),
      stamp("1"),
      stamp("2"),
    ]);
  });

  test("never drops or reorders visible messages", () => {
    forAll(
      (random) =>
        Array.from({ length: int(random, 0, 12) }, (_, index) => ({
          subtype: pick(random, ["me_message", "bot_message", "message_changed", "tombstone"]),
          ts: `${index}.0`,
          type: "message",
        })),
      (raws) => {
        const expected = raws
          .filter((raw) => raw.subtype !== "message_changed")
          .map((raw) => stamp(raw.ts));
        expect(mapVisibleMessages(raws).map((message) => message.id)).toEqual(expected);
      },
    );
  });
});

describe("helpers", () => {
  test("isHiddenSubtype", () => {
    expect(isHiddenSubtype("tombstone")).toBe(true);
    expect(isHiddenSubtype("bot_message")).toBe(false);
    expect(isHiddenSubtype(undefined)).toBe(false);
  });

  test("isRawMessage needs a string ts", () => {
    expect(isRawMessage({ ts: "1.1" })).toBe(true);
    expect(isRawMessage({ ts: 1 })).toBe(false);
    expect(isRawMessage({})).toBe(false);
  });

  test("isMyRelayedMessage matches the relay bot by original name", () => {
    const relayed = { botId: RELAY_BOT_ID, botName: "felix" };
    expect(isMyRelayedMessage(relayed, { name: "nick", originalName: "felix" })).toBe(true);
    expect(isMyRelayedMessage(relayed, { name: "felix" })).toBe(true);
    expect(isMyRelayedMessage(relayed, { name: "other" })).toBe(false);
    expect(isMyRelayedMessage({ botId: "B2", botName: "felix" }, { name: "felix" })).toBe(false);
    expect(isMyRelayedMessage(relayed, undefined)).toBe(false);
  });
});
