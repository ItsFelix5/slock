// biome-ignore-all lint/style/useNamingConvention: Slack API payloads preserve the service's wire field names.
import type { ActivityItem } from "../../types";
import { callSlack } from "../relay";
import { fetchPermalinkMessage } from "./messages";

// Feed types worth surfacing, mapped to our ActivityItem kinds below. Slack
// also emits app/workflow feed types (list_record_assigned, saved_reminder,
// external_channel_invite, ...) with no equivalent in our model — left out of
// the request entirely rather than fetched and silently dropped.
const ACTIVITY_FEED_TYPES = [
  "at_user",
  "at_user_group",
  "at_channel",
  "at_everyone",
  "keyword",
  "thread_v2",
  "message_reaction",
  "dm",
  "channel",
].join(",");

function activityKindFor(type: string): ActivityItem["kind"] | undefined {
  switch (type) {
    case "at_user":
      return "mention";
    case "dm":
      return "dm";
    case "keyword":
      return "keyword";
    case "thread_v2":
      return "thread_reply";
    case "at_channel":
    case "at_everyone":
      return "channel_mention";
    case "at_user_group":
      return "usergroup_mention";
    case "channel":
      return "channel_all";
    case "message_reaction":
      return "reaction";
    default:
      return;
  }
}

type FeedEntry = Omit<ActivityItem, "text">;

// Each feed entry only carries ids (channel/ts/reactor), never the message
// body — fetchActivityFeed below fetches that separately per entry.
function mapFeedEntry(raw: any, time: number): FeedEntry | undefined {
  const kind = activityKindFor(raw.item?.type);
  if (!kind) return;
  if (raw.item.type === "message_reaction") {
    const { message, reaction } = raw.item;
    if (!(message && reaction)) return;
    return {
      channelId: message.channel,
      id: raw.key,
      kind,
      reactionName: reaction.name,
      time,
      ts: message.ts,
      userId: reaction.user,
    };
  }
  if (raw.item.type === "thread_v2") {
    const thread = raw.item.bundle_info?.payload?.thread_entry;
    if (!thread) return;
    return {
      channelId: thread.channel_id,
      id: raw.key,
      kind,
      threadTs: thread.thread_ts,
      time,
      ts: thread.latest_ts,
      userId: "",
    };
  }
  const { message } = raw.item;
  if (!message) return;
  return {
    broadcastRange:
      raw.item.type === "at_everyone"
        ? "everyone"
        : raw.item.type === "at_channel"
          ? "channel"
          : undefined,
    channelId: message.channel,
    id: raw.key,
    kind,
    threadTs: message.thread_ts && message.thread_ts !== message.ts ? message.thread_ts : undefined,
    time,
    ts: message.ts,
    userId: message.author_user_id ?? "",
  };
}

// Slack's own client-side Activity tab, undocumented and used here because
// there's no public endpoint that returns historical dm/thread/reaction/
// broadcast activity — search.messages only ever finds literal @mentions.
export async function fetchActivityFeed(limit = 50): Promise<ActivityItem[]> {
  const data = await callSlack("activity.feed", {
    archive_only: "false",
    automations_only: "false",
    exclude_automations: "false",
    is_activity_inbox: "true",
    limit: String(limit),
    mode: "chrono_v1",
    only_salesforce_channels: "false",
    priority_only: "false",
    types: ACTIVITY_FEED_TYPES,
    unread_only: "false",
  });
  if (!data.ok) return [];
  const entries = ((data.items ?? []) as any[])
    .map((raw) => mapFeedEntry(raw, parseFloat(raw.feed_ts) * 1000))
    .filter((entry): entry is FeedEntry => !!entry);

  const messages = await Promise.all(
    entries.map((entry) =>
      fetchPermalinkMessage(entry.channelId, entry.ts, entry.threadTs ?? entry.ts).catch(
        () => undefined,
      ),
    ),
  );

  return entries.map((entry, i) => {
    const msg = messages[i];
    return {
      ...entry,
      text: msg?.text ?? "",
      // message_reaction entries never carry thread_ts from the feed itself
      // (unlike at_user/dm/keyword, which do) — the fetched message is the
      // only source for it, needed so a reply you post in that thread later
      // is recognized as covering this activity (see engagementCoversItem).
      threadTs:
        entry.kind === "reaction"
          ? (msg?.threadTs ?? ((msg?.replyCount ?? 0) > 0 ? msg?.ts : undefined))
          : entry.threadTs,
      userId: entry.userId || msg?.userId || "",
    };
  });
}
