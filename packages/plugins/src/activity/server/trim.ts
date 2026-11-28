import { isRecord } from "@slock/core";
import type { RealtimeTrim } from "@slock/plugins/realtime/server/api";
import { trimBotProfile } from "@slock/plugins/slack/server/api/trim/slackMessages";
import type { RawActivityEntry, RawActivityFeedEntry, RawActivityMessage } from "@slock/types";

export function reminderKey(payload: { item_id?: string; item_id_2?: string }) {
  return `${payload.item_id}:${payload.item_id_2}`;
}

export function trimActivityItem(
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
    bot_profile: trimBotProfile(message.bot_profile),
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

function isFeedEntry(value: unknown): value is RawActivityFeedEntry {
  return isRecord(value);
}

export const activityEventTrim: RealtimeTrim = {
  types: ["activity"],
  trim: ({ entry, subtype }) => {
    if (!isFeedEntry(entry)) return { subtype, type: "activity" };
    if (entry.item?.saved_reminder_payload)
      return { subtype: "activity_invalidated", type: "activity" };
    return { entry: trimActivityItem(entry, new Map()), subtype, type: "activity" };
  },
};
