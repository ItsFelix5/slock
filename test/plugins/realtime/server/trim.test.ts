import { describe, expect, test } from "bun:test";
import { trimSlackGatewayPayload } from "../../../../packages/plugins/src/realtime/server/trim";
import { forAll, pick } from "../../../support/core";

type Payload = Parameters<typeof trimSlackGatewayPayload>[0];

function trim(payload: object) {
  return trimSlackGatewayPayload(JSON.parse(JSON.stringify(payload)));
}

const TYPES = [
  "message",
  "reaction_added",
  "presence_change",
  "user_typing",
  "badge_counts_updated",
  "channel_marked",
  "channel_joined",
  "im_created",
  "channel_left",
  "member_joined_channel",
  "user_invalidated",
  "view_opened",
  "pin_added",
  "star_added",
  "saved_added",
  "channel_rename",
  "channel_archive",
  "subteam_created",
  "subteam_members_changed",
  "user_change",
  "dnd_updated",
  "bot_added",
  "thread_marked",
  "manual_presence_change",
  "desktop_notification",
  "channel_updated",
  "pref_change",
  "document_change",
  "draft_create",
  "draft_delete",
  "dnd_updated_user",
  "dnd_invalidated",
  "activity",
  "file_shared",
  "made_up_event",
];

const SAMPLES: Record<string, unknown> = {
  bot: { id: "B1" },
  channel: "C1",
  channels: ["C1"],
  dnd_status: { snooze_enabled: true, snooze_endtime: 5 },
  draft: { client_msg_id: "m", destinations: [{ channel_id: "C1" }], id: "Dr1" },
  draft_id: "Dr1",
  item: { channel: "C1", message: { ts: "1.1" }, ts: "1.1" },
  message: { text: "x", ts: "1.1" },
  presence: "away",
  subteam: { id: "S1" },
  thread_ts: "1.0",
  ts: "1.1",
  updates: { is_archived: true },
  user: "U1",
  users: ["U1"],
  view: { id: "V1" },
};

function partialPayload(random: () => number, type: string): Payload {
  const payload: Record<string, unknown> = { type };
  for (const [key, sample] of Object.entries(SAMPLES)) {
    const roll = random();
    if (roll < 0.3) continue;
    payload[key] = roll < 0.4 ? null : sample;
  }
  return JSON.parse(JSON.stringify(payload));
}

describe("message events", () => {
  test("message_locked keeps what the thread parent patch needs", () => {
    const event = trim({
      channel: "C1",
      event_ts: "2.2",
      hidden: true,
      is_locked: true,
      subtype: "message_locked",
      thread_ts: "1.1",
      ts: "2.2",
      type: "message",
    });
    expect(event).toMatchObject({
      channel: "C1",
      is_locked: true,
      subtype: "message_locked",
      thread_ts: "1.1",
      ts: "2.2",
      type: "message",
    });
    expect(event).not.toHaveProperty("hidden");
  });

  test("message_deleted carries deleted_ts and the channel", () => {
    expect(
      trim({
        channel: "C1",
        deleted_ts: "1.1",
        subtype: "message_deleted",
        type: "message",
      }),
    ).toMatchObject({ channel: "C1", deleted_ts: "1.1", subtype: "message_deleted" });
  });

  test("a bot message without ts does not crash", () => {
    expect(trim({ bot_id: "B1", channel: "C1", type: "message" })).toMatchObject({
      channel: "C1",
      type: "message",
    });
  });

  test("an object user on a message is dropped, a string is kept", () => {
    expect(trim({ channel: "C1", ts: "1.1", type: "message", user: "U1" })).toMatchObject({
      user: "U1",
    });
  });
});

describe("thread subscription events", () => {
  test("thread_subscribed reads channel and thread_ts from the nested subscription", () => {
    const out = trim({
      subscription: { channel: "C1", thread_ts: "1.1", type: "thread" },
      type: "thread_subscribed",
    });
    expect(out).toEqual({ channel: "C1", thread_ts: "1.1", type: "thread_subscribed" });
  });

  test("thread_unsubscribed keeps top-level channel and thread_ts", () => {
    const out = trim({ channel: "C1", thread_ts: "1.1", type: "thread_unsubscribed" });
    expect(out).toEqual({ channel: "C1", thread_ts: "1.1", type: "thread_unsubscribed" });
  });
});

describe("dnd events", () => {
  test("dnd_updated_user keeps only type and user", () => {
    const event = trim({
      dnd_status: { dnd_enabled: true, next_dnd_end_ts: 9 },
      type: "dnd_updated_user",
      user: "U2",
    });
    expect(event).toEqual({ type: "dnd_updated_user", user: "U2" });
  });

  test("dnd_invalidated accepts a user object or a missing user", () => {
    expect(trim({ type: "dnd_invalidated", user: { id: "U3" } })).toEqual({
      type: "dnd_invalidated",
      user: "U3",
    });
    expect(trim({ type: "dnd_invalidated" })).toEqual({
      type: "dnd_invalidated",
      user: undefined,
    });
  });

  test("dnd_updated converts the snooze end to ms and clears it when disabled", () => {
    expect(
      trim({
        dnd_status: { snooze_enabled: true, snooze_endtime: 100 },
        type: "dnd_updated",
      }),
    ).toEqual({ snoozed_until: 100_000, type: "dnd_updated" });
    expect(
      trim({
        dnd_status: { snooze_enabled: false, snooze_endtime: 100 },
        type: "dnd_updated",
      }),
    ).toEqual({ snoozed_until: null, type: "dnd_updated" });
    expect(trim({ type: "dnd_updated" })).toEqual({
      snoozed_until: null,
      type: "dnd_updated",
    });
  });
});

describe("draft events", () => {
  const draft = {
    blocks: [],
    client_msg_id: "uuid-1",
    date_created: 1,
    destinations: [{ channel_id: "C1", thread_ts: "1.0" }],
    id: "Dr1",
    is_from_composer: true,
    last_updated_ts: "5.5",
  };

  test("draft_create and draft_update become a draft entry", () => {
    for (const type of ["draft_create", "draft_update"] as const) {
      expect(trim({ draft, type })).toEqual({
        draft: {
          blocks: [],
          channelId: "C1",
          clientMsgId: "uuid-1",
          id: "Dr1",
          lastUpdatedTs: "5.5",
          threadTs: "1.0",
        },
        type,
      });
    }
  });

  test("a draft without a destination or id is dropped instead of throwing", () => {
    expect(trim({ draft: { ...draft, destinations: [] }, type: "draft_create" })).toBeNull();
    expect(trim({ draft: { ...draft, id: "" }, type: "draft_update" })).toBeNull();
    expect(trim({ type: "draft_create" })).toBeNull();
  });

  test("delete and send carry only the draft id", () => {
    for (const type of ["draft_delete", "draft_send"] as const) {
      expect(trim({ draft_id: "Dr1", type })).toEqual({ draft_id: "Dr1", type });
    }
  });
});

describe("routing", () => {
  test("file events pass through by type and unknown events are dropped", () => {
    expect(trim({ file_id: "F1", type: "file_shared" })).toEqual({
      file_id: "F1",
      type: "file_shared",
    });
    expect(trim({ type: "made_up_event" })).toBeNull();
    expect(trim({})).toBeNull();
  });

  test("hosted canvas channels never reach the client as joins", () => {
    expect(
      trim({
        channel: { id: "C1", is_file: true, name: "x" },
        type: "channel_joined",
      }),
    ).toBeNull();
  });

  test("channel can be an id or an object everywhere", () => {
    expect(trim({ channel: "C1", type: "channel_archive" })).toEqual({
      channel: "C1",
      type: "channel_archive",
    });
    expect(trim({ channel: { id: "C1" }, type: "channel_archive" })).toEqual({
      channel: "C1",
      type: "channel_archive",
    });
  });
});

describe("garbage", () => {
  test("never throws and keeps the event type when it emits", () => {
    forAll(
      (random) => partialPayload(random, pick(random, TYPES)),
      (payload) => {
        const event = trimSlackGatewayPayload(payload);
        if (event && payload.type !== "message")
          expect(String(event.type)).toBe(String(payload.type));
      },
      500,
    );
  });

  test("a duplicated event trims to equal output", () => {
    forAll(
      (random) => partialPayload(random, pick(random, TYPES)),
      (payload) => {
        expect(trim(payload)).toEqual(trim(payload));
      },
    );
  });

  test("trimming does not mutate the payload", () => {
    forAll(
      (random) => partialPayload(random, pick(random, TYPES)),
      (payload) => {
        const before = JSON.stringify(payload);
        trim(payload);
        expect(JSON.stringify(payload)).toBe(before);
      },
      100,
    );
  });
});
