import type {
  GatewayEvent,
  ModalView,
  RawChannel,
  RawCounts,
  RawMessage,
  RawUser,
} from "@slock/types";
import {
  isHostedChannel,
  trimActivityCounts,
  trimChannel,
  trimCountGroup,
  trimCountGroups,
} from "./slackChannels.ts";
import { trimUser } from "./slackEntities.ts";
import { trimMessage } from "./slackMessages.ts";

type RawGatewayEvent = Omit<RawMessage, "ts" | "type"> &
  RawCounts & {
    avatarImage?: string;
    badges?: RawCounts;
    bot?: { id?: string };
    channel?: string | RawChannel;
    channel_id?: string;
    content?: string;
    deleted_ts?: string;
    dnd_status?: { snooze_enabled?: boolean; snooze_endtime?: number };
    event_ts?: string;
    is_shared?: boolean;
    item?: { channel?: string; message?: { ts?: string }; ts?: string; type?: string };
    item_user?: string;
    message?: RawMessage;
    launchUri?: string;
    mention_count?: number;
    msg?: string;
    presence?: string;
    reaction?: string;
    subscription?: { thread_ts?: string; unread_count?: number };
    subteam?: { id?: string };
    subteam_id?: string;
    subtitle?: string;
    title?: string;
    ts?: string;
    type?: string;
    unread_count?: number;
    user?: string | RawUser;
    users?: string[];
    view?: ModalView;
    view_type?: string;
  };

function trimGatewayCounts(payload: RawCounts): RawCounts {
  return trimCountGroups(payload, trimCountGroup);
}

function trimView(view: ModalView | undefined): ModalView | undefined {
  if (!view) return;
  return {
    blocks: view.blocks,
    close: view.close,
    id: view.id,
    previous_view_id: view.previous_view_id,
    submit: view.submit,
    title: view.title,
    type: view.type,
  };
}

function channelId(channel: RawGatewayEvent["channel"]): string | undefined {
  return typeof channel === "string" ? channel : channel?.id;
}

function isFileEvent(type: string | undefined): type is `file_${string}` {
  return !!type?.startsWith("file_");
}

export function trimSlackGatewayPayload(payload: RawGatewayEvent): GatewayEvent | null {
  const channel = typeof payload.channel === "object" ? payload.channel : undefined;
  const user = typeof payload.user === "string" ? payload.user : undefined;
  switch (payload.type) {
    case "message":
      return {
        ...trimMessage({ ...payload, ts: payload.ts ?? "", user }),
        channel: channelId(payload.channel),
        deleted_ts: payload.deleted_ts,
        message: payload.message ? trimMessage(payload.message) : undefined,
        type: "message",
      };
    case "reaction_added":
    case "reaction_removed":
      return {
        item: { channel: payload.item?.channel, ts: payload.item?.ts },
        item_user: payload.item_user,
        reaction: payload.reaction,
        type: payload.type,
        user,
      };
    case "presence_change":
      return { presence: payload.presence, type: payload.type, user, users: payload.users };
    case "user_typing":
      return {
        channel: channelId(payload.channel),
        thread_ts: payload.thread_ts,
        type: payload.type,
        user,
      };
    case "badge_counts_updated":
      return {
        ...trimGatewayCounts(payload),
        activity_v2: trimActivityCounts(payload.activity_v2),
        badges: payload.badges ? trimGatewayCounts(payload.badges) : undefined,
        type: payload.type,
      };
    case "channel_marked":
      return {
        channel: channelId(payload.channel),
        mention_count: payload.mention_count,
        ts: payload.ts,
        type: payload.type,
        unread_count: payload.unread_count,
      };
    case "channel_joined":
    case "group_joined":
      return channel && !isHostedChannel(channel)
        ? { channel: trimChannel(channel), type: payload.type }
        : null;
    case "im_created":
      return channel
        ? { channel: { ...trimChannel(channel), user: channel.user }, type: payload.type, user }
        : null;
    case "channel_left":
    case "group_left":
      return { channel: channelId(payload.channel), type: payload.type };
    case "member_left_channel":
      return { channel: channelId(payload.channel), type: payload.type, user };
    case "user_invalidated":
      return { type: payload.type, user, users: payload.users };
    case "view_opened":
    case "view_updated":
      return { type: payload.type, view: trimView(payload.view), view_type: payload.view_type };
    case "pin_added":
    case "pin_removed":
      return {
        channel_id: payload.channel_id,
        ts: payload.item?.message?.ts ?? payload.item?.ts,
        type: payload.type,
      };
    case "star_added":
    case "star_removed":
      return {
        item: { channel: payload.item?.channel, type: payload.item?.type },
        type: payload.type,
      };
    case "saved_added":
    case "saved_deleted":
      return {
        item: { channel: payload.item?.channel, ts: payload.item?.message?.ts ?? payload.item?.ts },
        type: payload.type,
      };
    case "saved_clear":
      return { type: payload.type };
    case "channel_rename":
    case "group_rename":
      return channel && !isHostedChannel(channel)
        ? { channel: { id: channel.id, name: channel.name }, type: payload.type }
        : null;
    case "channel_archive":
    case "channel_unarchive":
    case "group_archive":
    case "group_unarchive":
    case "channel_deleted":
    case "im_close":
    case "im_open":
    case "mpim_close":
    case "mpim_open":
    case "mpim_joined":
      return { channel: channelId(payload.channel), type: payload.type };
    case "subteam_created":
    case "subteam_updated":
    case "subteam_deleted":
      return { subteam: { id: payload.subteam?.id }, type: payload.type };
    case "subteam_members_changed":
      return { subteam_id: payload.subteam_id, type: payload.type };
    case "user_change":
      return typeof payload.user === "object"
        ? { type: payload.type, user: trimUser(payload.user) }
        : null;
    case "dnd_updated":
      return {
        snoozed_until:
          payload.dnd_status?.snooze_enabled && payload.dnd_status.snooze_endtime
            ? payload.dnd_status.snooze_endtime * 1000
            : null,
        type: payload.type,
      };
    case "canvas_created":
      return { channel_id: payload.channel_id, type: payload.type };
    case "bot_added":
    case "bot_changed":
      return { bot: { id: payload.bot?.id }, type: payload.type };
    case "commands_changed":
    case "emoji_changed":
      return { type: payload.type };
    case "thread_marked":
      return {
        channel: channelId(payload.channel),
        thread_ts: payload.subscription?.thread_ts,
        type: payload.type,
        unread_count: payload.subscription?.unread_count,
      };
    case "thread_subscribed":
    case "thread_unsubscribed":
      return {
        channel: channelId(payload.channel),
        thread_ts: payload.thread_ts,
        type: payload.type,
      };
    case "manual_presence_change":
      return { presence: payload.presence, type: payload.type };
    case "desktop_notification":
      return {
        avatarImage: payload.avatarImage,
        channel: channelId(payload.channel),
        content: payload.content,
        event_ts: payload.event_ts,
        is_shared: payload.is_shared,
        launchUri: payload.launchUri,
        msg: payload.msg,
        subtitle: payload.subtitle,
        title: payload.title,
        type: payload.type,
      };
    default:
      return isFileEvent(payload.type) ? { type: payload.type } : null;
  }
}
