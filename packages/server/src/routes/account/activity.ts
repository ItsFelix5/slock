import {
  ACTIVITY_FEED_TYPES_PARAM,
  isRecord,
  type RawActivityEntry,
  type RawActivityFeedEntry,
  type RawActivityMessage,
  type RawCounts,
  richTextBlocksToPlainText,
} from "@slock/types";
import type { Credentials } from "../../auth.ts";
import { errorResponse, jsonResponse, slackErrorResponse } from "../../http/jsonResponse.ts";
import { callSlack } from "../../slackClient.ts";
import type { ActivityFeedReply, SavedListReply } from "../../slackReplies.ts";
import { trimActivityCounts } from "../../trim/slackChannels.ts";
import { mutate, type Route, route } from "../router.ts";

const MAX_NESTING_DEPTH = 5;

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

function isMessageReference(value: Record<string, unknown>): value is RawActivityMessage {
  return typeof value.channel === "string" && typeof value.ts === "string";
}

function findActivityMessageReference(value: unknown, depth = 0): RawActivityMessage | undefined {
  if (!isRecord(value) || depth > MAX_NESTING_DEPTH) return;
  const reference = {
    ...value,
    channel: value.channel ?? value.channel_id,
    ts: value.ts ?? value.message_ts ?? value.latest_ts,
    user: value.user ?? value.user_id ?? value.latest_user_id,
  };
  if (isMessageReference(reference)) return reference;
  for (const nested of Object.values(value)) {
    const message = findActivityMessageReference(nested, depth + 1);
    if (message) return message;
  }
}

function findActivityText(value: unknown, depth = 0): string | undefined {
  if (!isRecord(value) || depth > MAX_NESTING_DEPTH) return;
  for (const candidate of [value.text, value.title, value.description]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  for (const nested of Object.values(value)) {
    const text = findActivityText(nested, depth + 1);
    if (text) return text;
  }
}

type Reminder = { channel?: string; text?: string; ts?: string };

async function fetchReminders(
  rawItems: RawActivityFeedEntry[],
  creds: Credentials | null,
): Promise<Map<string, Reminder>> {
  const ids = [
    ...new Set(
      rawItems.flatMap((raw) =>
        raw.item?.type === "saved_reminder" && raw.item.linked_item_id
          ? [raw.item.linked_item_id]
          : [],
      ),
    ),
  ];
  const reminders = new Map<string, Reminder>();
  if (ids.length === 0) return reminders;
  const data = await callSlack<SavedListReply>(
    "saved.get",
    {
      items: JSON.stringify(
        ids.map((id) => ({ item_id: id, item_detail: "", item_type: "reminder", ts: "" })),
      ),
    },
    creds,
  );
  console.log("saved.get reminders", JSON.stringify(data));
  if (!data.ok) return reminders;
  for (const savedItem of data.saved_items ?? []) {
    if (!savedItem.item_id) continue;
    reminders.set(savedItem.item_id, {
      channel:
        savedItem.item_type === "message"
          ? savedItem.item_id
          : (savedItem.channel_id ?? savedItem.channel),
      text: savedItem.description ? richTextBlocksToPlainText(savedItem.description) : undefined,
      ts: savedItem.ts ?? savedItem.message_ts,
    });
  }
  return reminders;
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

function trimActivityItem(
  raw: RawActivityFeedEntry,
  reminders: Map<string, Reminder>,
): RawActivityFeedEntry {
  const item = raw.item ?? {};
  const reminder =
    item.type === "saved_reminder" && item.linked_item_id
      ? reminders.get(item.linked_item_id)
      : undefined;
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
      activity_text: reminder?.text ?? findActivityText(item),
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
      channel_id: item.channel_id ?? reminder?.channel,
      invite: item.invite,
      latest_user_id: item.latest_user_id,
      latest_reply_actor_user_id: item.latest_reply_actor_user_id,
      linked_item_id: item.linked_item_id,
      message: trimActivityMessage(message),
      message_ts: item.message_ts ?? reminder?.ts,
      quietly_added_to_channel_payload: quietlyAdded
        ? {
            channel_id: quietlyAdded.channel_id,
            inviter_team_id: quietlyAdded.inviter_team_id,
            inviter_user_id: quietlyAdded.inviter_user_id,
          }
        : undefined,
      reaction: item.reaction ? { name: item.reaction.name, user: item.reaction.user } : undefined,
      ts: item.ts,
      type: item.type,
      user: item.user,
      user_id: item.user_id,
    },
    key: raw.key,
  };
}

export const activityRoutes: Route[] = [
  route("POST", "activity/archive", async (ctx) => {
    const { key, ts, type } = await ctx.body.json<{
      key?: string;
      ts?: string;
      type?: string;
    }>();
    if (!(key && ts && type)) return errorResponse("invalid_activity_entry", 400);
    return mutate("activity.archive", { key, ts, type }, ctx);
  }),

  route("POST", "activity/read", async (ctx) => {
    const { feedTs, key, type } = await ctx.body.json<{
      feedTs?: string;
      key?: string;
      type?: string;
    }>();
    if (!(feedTs && key && type)) return errorResponse("invalid_activity_entry", 400);
    return mutate("activity.markRead", { feed_ts: feedTs, key, type }, ctx);
  }),

  route("GET", "activity/counts", async (ctx) => {
    const data = await callSlack<RawCounts>("client.counts", {}, ctx.creds);
    if (!data.ok) return slackErrorResponse(data, "client.counts", ctx.creds, ctx.acceptEncoding);
    return jsonResponse(
      { activityCounts: trimActivityCounts(data.activity_v2), ok: true },
      ctx.creds,
      ctx.acceptEncoding,
    );
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
    if (!data.ok) return slackErrorResponse(data, "activity.feed", ctx.creds, ctx.acceptEncoding);
    const rawItems = data.items ?? [];
    const reminders = await fetchReminders(rawItems, ctx.creds);
    return jsonResponse(
      {
        items: rawItems.map((raw) => trimActivityItem(raw, reminders)),
        ok: true,
        response_metadata: data.response_metadata
          ? { next_cursor: data.response_metadata.next_cursor }
          : undefined,
      },
      ctx.creds,
      ctx.acceptEncoding,
    );
  }),
];
