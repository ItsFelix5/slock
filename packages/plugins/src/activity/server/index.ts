import type { Setup } from "@slock/core";
import { isRecord } from "@slock/core";
import { isTs, richTextBlocksToPlainText } from "@slock/slack";
import type { RawActivityEntry, RawActivityFeedEntry, RawActivityMessage } from "@slock/types";
import type { Credentials } from "../../slack/server/api/auth";
import {
  errorResponse,
  jsonResponse,
  slackErrorResponse,
} from "../../slack/server/api/jsonResponse";
import type { Route } from "../../slack/server/api/router";
import { mutate, route, routes } from "../../slack/server/api/router";
import { callSlack } from "../../slack/server/api/slackClient";
import type { ActivityFeedReply, SavedListReply } from "../../slack/server/api/slackReplies";
import { ACTIVITY_FEED_TYPES_PARAM } from "../protocol/feedTypes";

const NO_TS = "0000000000.000000";

function reminderKey(payload: { item_id?: string; item_id_2?: string }) {
  return `${payload.item_id}:${payload.item_id_2}`;
}

async function fetchReminders(
  rawItems: RawActivityFeedEntry[],
  creds: Credentials | null,
): Promise<Map<string, string>> {
  const payloads = [
    ...new Map(
      rawItems.flatMap((raw) =>
        raw.item?.saved_reminder_payload?.item_id
          ? [
              [
                reminderKey(raw.item.saved_reminder_payload),
                raw.item.saved_reminder_payload,
              ] as const,
            ]
          : [],
      ),
    ).values(),
  ];
  const reminders = new Map<string, string>();
  if (payloads.length === 0) return reminders;
  const data = await callSlack<SavedListReply>(
    "saved.get",
    {
      items: JSON.stringify(
        payloads.map((payload) => ({
          item_id: payload.item_id,
          item_detail: "",
          item_type: payload.item_type,
          ts: payload.item_id_2,
        })),
      ),
    },
    creds,
  );
  if (!data.ok) return reminders;
  for (const savedItem of data.saved_items ?? []) {
    if (!(savedItem.item_id && savedItem.description)) continue;
    const text = richTextBlocksToPlainText(savedItem.description);
    if (text)
      reminders.set(
        reminderKey({
          item_id: savedItem.item_id,
          item_id_2: savedItem.ts ?? savedItem.message_ts ?? NO_TS,
        }),
        text,
      );
  }
  return reminders;
}

function trimActivityItem(
  raw: RawActivityFeedEntry,
  reminders: Map<string, string>,
): RawActivityFeedEntry {
  const item = raw.item ?? {};
  const saved = item.saved_reminder_payload;
  const reminderText = saved ? reminders.get(reminderKey(saved)) : undefined;
  const reminderMessage = saved?.item_type === "message" ? saved : undefined;
  const payload = item.bundle_info?.payload;
  const quietlyAdded = item.quietly_added_to_channel_payload;
  const hasBundlePayload =
    payload?.thread_entry ||
    payload?.dm_entry ||
    payload?.channel_entry ||
    payload?.message ||
    payload?.latest_message;
  const message = item.message ?? findActivityMessageReference(item);
  return {
    feed_ts: raw.feed_ts,
    is_unread: raw.is_unread,
    item: {
      activity_text: reminderText ?? findActivityText(item),
      actor_user_id: item.actor_user_id,
      author_user_id: item.author_user_id,
      bundle_info:
        payload && hasBundlePayload
          ? {
              payload: {
                channel_entry: payload.channel_entry
                  ? trimActivityEntry(payload.channel_entry)
                  : undefined,
                dm_entry: payload.dm_entry
                  ? { latest_message: trimActivityMessage(payload.dm_entry.latest_message) }
                  : undefined,
                latest_message: trimActivityMessage(payload.latest_message),
                message: trimActivityMessage(payload.message),
                thread_entry: payload.thread_entry
                  ? trimActivityEntry(payload.thread_entry)
                  : undefined,
              },
            }
          : undefined,
      channel: item.channel,
      channel_id: item.channel_id ?? reminderMessage?.item_id,
      invite: item.invite,
      latest_user_id: item.latest_user_id,
      latest_reply_actor_user_id: item.latest_reply_actor_user_id,
      linked_item_id:
        item.linked_item_id ?? (saved?.item_type === "reminder" ? saved.item_id : undefined),
      message: trimActivityMessage(message),
      message_ts: item.message_ts ?? reminderMessage?.item_id_2,
      quietly_added_to_channel_payload: quietlyAdded
        ? {
            channel_id: quietlyAdded.channel_id,
            inviter_team_id: quietlyAdded.inviter_team_id,
            inviter_user_id: quietlyAdded.inviter_user_id,
          }
        : undefined,
      reaction: item.reaction ? { name: item.reaction.name, user: item.reaction.user } : undefined,
      reminder_note: reminderMessage ? reminderText : undefined,
      ts: item.ts,
      type: item.type,
      user: item.user,
      user_id: item.user_id,
    },
    key: raw.key,
  };
}

function trimActivityMessage(
  message: RawActivityMessage | undefined,
): RawActivityMessage | undefined {
  if (!message) return message;
  return {
    author_user_id: message.author_user_id,
    bot_id: message.bot_id,
    bot_profile: message.bot_profile ? { name: message.bot_profile.name } : undefined,
    channel: message.channel,
    metadata: message.metadata,
    text: message.text,
    thread_ts: message.thread_ts,
    ts: message.ts,
    user: message.user,
    username: message.username,
  };
}

function firstNested<T>(
  value: Record<string, unknown>,
  find: (nested: unknown) => T | undefined,
): T | undefined {
  return Object.values(value).reduce<T | undefined>(
    (found, nested) => found ?? find(nested),
    undefined,
  );
}

function findActivityMessageReference(value: unknown, depth = 0): RawActivityMessage | undefined {
  return isRecord(value) && depth <= MAX_NESTING_DEPTH ? referenceIn(value, depth) : undefined;
}

function referenceIn(
  value: Record<string, unknown>,
  depth: number,
): RawActivityMessage | undefined {
  const reference = {
    ...value,
    channel: value.channel ?? value.channel_id,
    ts: value.ts ?? value.message_ts ?? value.latest_ts,
    user: value.user ?? value.user_id ?? value.latest_user_id,
  };
  if (isMessageReference(reference)) return reference;
  return firstNested(value, (nested) => findActivityMessageReference(nested, depth + 1));
}

function findActivityText(value: unknown, depth = 0): string | undefined {
  return isRecord(value) && depth <= MAX_NESTING_DEPTH ? textIn(value, depth) : undefined;
}

function textIn(value: Record<string, unknown>, depth: number): string | undefined {
  const direct = [value.text, value.title, value.description].find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.trim() !== "",
  );
  return direct ?? firstNested(value, (nested) => findActivityText(nested, depth + 1));
}

function trimActivityEntry(entry: RawActivityEntry): RawActivityEntry {
  return {
    ...trimActivityMessage(entry),
    channel_id: entry.channel_id,
    latest_message: trimActivityMessage(entry.latest_message),
    latest_msg: trimActivityMessage(entry.latest_msg),
    latest_reply_actor_user_id: entry.latest_reply_actor_user_id,
    latest_reply_user_id: entry.latest_reply_user_id,
    latest_ts: entry.latest_ts,
    latest_user_id: entry.latest_user_id,
    message: trimActivityMessage(entry.message),
    unread_msg_count: entry.unread_msg_count,
    user_id: entry.user_id,
  };
}

const MAX_NESTING_DEPTH = 5;

function isMessageReference(value: Record<string, unknown>): value is RawActivityMessage {
  return typeof value.channel === "string" && typeof value.ts === "string";
}

const list: Route[] = [
  route("POST", "activity/archive", async (ctx) => {
    const { key, linkedItemId, ts, type } = await ctx.body.json<{
      key?: string;
      linkedItemId?: string;
      ts?: string;
      type?: string;
    }>();
    if (!(key && type && ts && isTs(ts))) return errorResponse("invalid_activity_entry", 400);
    if (type === "saved_reminder" && linkedItemId) {
      const done = await callSlack(
        "saved.update",
        {
          date_due: "0",
          item_id: linkedItemId,
          item_type: "reminder",
          mark: "completed",
          todo_state: "completed",
        },
        ctx.creds,
      );
      if (!done.ok) return slackErrorResponse(done, "saved.update");
    }
    return mutate("activity.archive", { key, ts, type }, ctx);
  }),

  route("POST", "activity/read", async (ctx) => {
    const { feedTs, key, type } = await ctx.body.json<{
      feedTs?: string;
      key?: string;
      type?: string;
    }>();
    if (!(key && type && feedTs && isTs(feedTs)))
      return errorResponse("invalid_activity_entry", 400);
    return mutate("activity.markRead", { feed_ts: feedTs, key, type }, ctx);
  }),

  route("GET", "activity", async (ctx) => {
    const limit = ctx.searchParams.get("limit") ?? "50";
    const cursor = ctx.searchParams.get("cursor") ?? undefined;
    const types = ctx.searchParams.get("types") ?? ACTIVITY_FEED_TYPES_PARAM;
    const unreadOnly = ctx.searchParams.get("unreadOnly") === "true";
    const data = await callSlack<ActivityFeedReply>(
      "activity.feed",
      {
        archive_only: "false",
        automations_only: "false",
        exclude_automations: "false",
        is_activity_inbox: "true",
        limit,
        mode: "chrono_v1",
        only_salesforce_channels: "false",
        priority_only: "false",
        types,
        unread_only: unreadOnly ? "true" : "false",
        ...(cursor ? { cursor } : {}),
      },
      ctx.creds,
    );
    if (!data.ok) return slackErrorResponse(data, "activity.feed");
    const rawItems = data.items ?? [];
    const reminders = await fetchReminders(rawItems, ctx.creds);
    return jsonResponse({
      items: rawItems.map((raw) => trimActivityItem(raw, reminders)),
      ok: true,
      response_metadata: data.response_metadata
        ? { next_cursor: data.response_metadata.next_cursor }
        : undefined,
    });
  }),
];

const setup: Setup = (ctx) => {
  ctx.add("http", routes(list));
};

export default setup;
