// biome-ignore-all lint/style/useNamingConvention lint/style/noExcessiveLinesPerFile: Slack payloads preserve Slack's wire field names; activity trimming shares recursive helpers.
import { jsonResponse, slackErrorResponse } from "../http/jsonResponse.ts";
import { callSlack } from "../slackClient.ts";
import { type Route, route } from "./router.ts";

// Feed types worth surfacing — Slack also emits other app/workflow feed types
// (list_record_assigned, saved_reminder, external_channel_invite, ...) with no
// equivalent in the app's model, left out of the request entirely rather than
// fetched and silently dropped. Adding an invalid value to `types` isn't just
// ignored: it appears to fail the whole request, so don't add one here
// without confirming the exact wire string real Slack sends first. This is
// the default; the client can narrow it to one category via `?types=`.
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
  "saved_reminder",
  "internal_channel_invite",
  "external_channel_invite",
  "external_dm_invite",
].join(",");

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

export const activityRoutes: Route[] = [
  // Slack's own client-side Activity tab, undocumented and used here because
  // there's no public endpoint that returns historical dm/thread/reaction/
  // broadcast activity — search.messages only ever finds literal @mentions.
  // Only carries ids (channel/ts/reactor); resolving each entry's message
  // body is a separate batched lookup (see /api/messages/lookup).
  route("GET", "/api/activity", async (ctx) => {
    const limit = ctx.searchParams.get("limit") ?? "50";
    const cursor = ctx.searchParams.get("cursor") ?? undefined;
    const types = ctx.searchParams.get("types") ?? ACTIVITY_FEED_TYPES;
    const unreadOnly = ctx.searchParams.get("unreadOnly") === "true";
    const data = await callSlack(
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
    return jsonResponse(
      {
        items: Array.isArray(data.items) ? data.items.map(trimActivityItem) : data.items,
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
