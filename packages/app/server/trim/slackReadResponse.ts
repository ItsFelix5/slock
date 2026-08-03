// biome-ignore-all lint/style/useNamingConvention lint/style/noExcessiveLinesPerFile: Read payload trimmers share the same recursive entity helpers.
import { trimChannel, trimUser } from "./slackEntities.ts";

function trimUserBoot(data: any): any {
  const trimIm = (im: any) => ({
    created: im?.created,
    id: im?.id,
    is_open: im?.is_open,
    updated: im?.updated,
    user: im?.user,
  });
  const trimMpim = (group: any) => ({
    created: group?.created,
    id: group?.id,
    is_open: group?.is_open,
    members: group?.members,
    updated: group?.updated,
  });
  return {
    channels: Array.isArray(data.channels) ? data.channels.map(trimChannel) : data.channels,
    ims: Array.isArray(data.ims) ? data.ims.map(trimIm) : data.ims,
    mpims: Array.isArray(data.mpims) ? data.mpims.map(trimMpim) : data.mpims,
    ok: true,
    self: trimUser(data.self),
    starred: Array.isArray(data.starred)
      ? data.starred.map((star: any) =>
          typeof star === "string" ? star : { channel: star?.channel, id: star?.id },
        )
      : data.starred,
    subteams: Array.isArray(data.subteams?.self) ? { self: data.subteams.self } : undefined,
  };
}

function trimCounts(data: any): any {
  const trimGroup = (group: any) => ({
    has_unreads: group?.has_unreads,
    id: group?.id,
    is_unread: group?.is_unread,
    last_read: group?.last_read,
    latest: group?.latest,
    mention_count: group?.mention_count,
    mention_count_display: group?.mention_count_display,
    unread_count: group?.unread_count,
    unread_count_display: group?.unread_count_display,
  });
  return {
    channels: Array.isArray(data.channels) ? data.channels.map(trimGroup) : data.channels,
    ims: Array.isArray(data.ims) ? data.ims.map(trimGroup) : data.ims,
    mpims: Array.isArray(data.mpims) ? data.mpims.map(trimGroup) : data.mpims,
    ok: true,
  };
}

const USER_PREF_KEYS = [
  "all_notifications_prefs",
  "channel_sections",
  "emoji_use",
  "frecency",
  "frecency_ent_jumper",
  "frecency_jumper",
  "highlight_words",
  "muted_channels",
  "slock_channel_tabs",
  "slock_desktop_notifications",
  "slock_search_history",
] as const;

function trimUserPrefs(data: any): any {
  const prefs = data.prefs ?? {};
  return {
    ok: true,
    prefs: Object.fromEntries(USER_PREF_KEYS.map((key) => [key, prefs[key]])),
  };
}

function trimActivityMessage(message: any): any {
  if (!message || typeof message !== "object") return message;
  return {
    author_user_id: message.author_user_id,
    bot_id: message.bot_id,
    channel: message.channel,
    text: message.text,
    thread_ts: message.thread_ts,
    ts: message.ts,
    user: message.user,
  };
}

function findActivityMessageReference(value: any, depth = 0): any {
  if (!(value && typeof value === "object") || depth > 5) return;
  const channel = value.channel ?? value.channel_id;
  const ts = value.ts ?? value.message_ts ?? value.latest_ts;
  if (channel && ts) {
    return {
      ...value,
      channel,
      ts,
      user: value.user ?? value.user_id ?? value.latest_user_id,
    };
  }
  for (const nested of Object.values(value)) {
    const message = findActivityMessageReference(nested, depth + 1);
    if (message) return message;
  }
}

function trimActivityItem(raw: any): any {
  const item = raw?.item ?? {};
  const payload = item.bundle_info?.payload;
  const thread = payload?.thread_entry;
  const dmEntry = payload?.dm_entry;
  const channelEntry = payload?.channel_entry;
  const hasBundlePayload =
    thread || dmEntry || channelEntry || payload?.message || payload?.latest_message;
  const message = item.message ?? findActivityMessageReference(item);
  return {
    feed_ts: raw?.feed_ts,
    item: {
      bundle_info: hasBundlePayload
        ? {
            payload: {
              channel_entry: channelEntry
                ? {
                    ...trimActivityMessage(channelEntry),
                    channel_id: channelEntry.channel_id,
                    latest_message: trimActivityMessage(channelEntry.latest_message),
                    latest_ts: channelEntry.latest_ts,
                    latest_user_id: channelEntry.latest_user_id,
                    message: trimActivityMessage(channelEntry.message),
                    user_id: channelEntry.user_id,
                  }
                : undefined,
              dm_entry: dmEntry
                ? {
                    latest_message: trimActivityMessage(dmEntry.latest_message),
                  }
                : undefined,
              latest_message: trimActivityMessage(payload.latest_message),
              message: trimActivityMessage(payload.message),
              thread_entry: thread
                ? {
                    channel_id: thread.channel_id,
                    latest_message: trimActivityMessage(thread.latest_message),
                    latest_msg: trimActivityMessage(thread.latest_msg),
                    latest_reply_actor_user_id: thread.latest_reply_actor_user_id,
                    latest_reply_user_id: thread.latest_reply_user_id,
                    latest_ts: thread.latest_ts,
                    latest_user_id: thread.latest_user_id,
                    message: trimActivityMessage(thread.message),
                    thread_ts: thread.thread_ts,
                    unread_msg_count: thread.unread_msg_count,
                    user_id: thread.user_id,
                  }
                : undefined,
            },
          }
        : undefined,
      channel: item.channel,
      channel_id: item.channel_id,
      latest_user_id: item.latest_user_id,
      message: trimActivityMessage(message),
      message_ts: item.message_ts,
      reaction: item.reaction ? { name: item.reaction.name, user: item.reaction.user } : undefined,
      ts: item.ts,
      type: item.type,
      user_id: item.user_id,
    },
    key: raw?.key,
  };
}

function trimSearchMessages(data: any): any {
  const matches = data.messages?.matches;
  return {
    messages: {
      matches: Array.isArray(matches)
        ? matches.map((match: any) => ({
            channel: { id: match?.channel?.id, name: match?.channel?.name },
            text: match?.text,
            thread_ts: match?.thread_ts,
            ts: match?.ts,
            user: match?.user,
          }))
        : matches,
    },
    ok: true,
  };
}

export function trimReadResponse(method: string, data: any): any | null {
  if (method === "client.userBoot") return trimUserBoot(data);
  if (method === "client.counts") return trimCounts(data);
  if (method === "users.prefs.get") return trimUserPrefs(data);
  if (method === "activity.feed") {
    return {
      items: Array.isArray(data.items) ? data.items.map(trimActivityItem) : data.items,
      ok: true,
      response_metadata: data.response_metadata
        ? { next_cursor: data.response_metadata.next_cursor }
        : undefined,
    };
  }
  if (method === "search.messages") return trimSearchMessages(data);
  return null;
}
