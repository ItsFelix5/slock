import {
  trimActivityCounts,
  trimChannel,
  trimCountGroups,
  trimMessage,
  trimUser,
} from "./slackEntities.ts";

function trimGatewayCounts(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;
  return trimCountGroups(payload, (group: any) => ({
    has_unreads: group?.has_unreads,
    id: group?.id,
    is_unread: group?.is_unread,
    mention_count: group?.mention_count,
    mention_count_display: group?.mention_count_display,
    unread_count: group?.unread_count,
    unread_count_display: group?.unread_count_display,
  }));
}

function trimView(view: any): any {
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

function eventChannelId(payload: any): any {
  return typeof payload.channel === "string" ? payload.channel : payload.channel?.id;
}

function trimMessageEvent(payload: any): any {
  return {
    ...trimMessage(payload),
    channel: payload.channel,
    deleted_ts: payload.deleted_ts,
    message: payload.message ? trimMessage(payload.message) : undefined,
  };
}

export function trimSlackGatewayPayload(payload: any): any | null {
  switch (payload?.type) {
    case "message":
      return trimMessageEvent(payload);
    case "reaction_added":
    case "reaction_removed":
      return {
        item: { channel: payload.item?.channel, ts: payload.item?.ts },
        item_user: payload.item_user,
        reaction: payload.reaction,
        type: payload.type,
        user: payload.user,
      };
    case "presence_change":
      return {
        presence: payload.presence,
        type: payload.type,
        user: payload.user,
        users: payload.users,
      };
    case "user_typing":
      return {
        channel: payload.channel,
        thread_ts: payload.thread_ts,
        type: payload.type,
        user: payload.user,
      };
    case "badge_counts_updated": {
      const counts = trimGatewayCounts(payload);
      return {
        ...counts,
        activity_v2: trimActivityCounts(payload.activity_v2),
        badges: payload.badges ? trimGatewayCounts(payload.badges) : undefined,
        type: payload.type,
      };
    }
    case "channel_marked":
      return {
        channel: payload.channel,
        mention_count: payload.mention_count,
        ts: payload.ts,
        type: payload.type,
        unread_count: payload.unread_count,
      };
    case "channel_joined":
    case "group_joined":
      return { channel: trimChannel(payload.channel), type: payload.type };
    case "im_created":
      return {
        channel: { ...trimChannel(payload.channel), user: payload.channel?.user },
        type: payload.type,
        user: payload.user,
      };
    case "channel_left":
    case "group_left":
      return { channel: payload.channel, type: payload.type };
    case "member_left_channel":
      return { channel: payload.channel, type: payload.type, user: payload.user };
    case "user_invalidated":
      return { type: payload.type, user: payload.user, users: payload.users };
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
      return {
        channel: { id: payload.channel?.id, name: payload.channel?.name },
        type: payload.type,
      };
    case "channel_archive":
    case "channel_unarchive":
    case "group_archive":
    case "group_unarchive":
    case "channel_deleted":
      return { channel: eventChannelId(payload), type: payload.type };
    case "im_close":
    case "im_open":
    case "mpim_close":
    case "mpim_open":
    case "mpim_joined":
      return { channel: eventChannelId(payload), type: payload.type };
    case "subteam_created":
    case "subteam_updated":
    case "subteam_deleted":
      return { subteam: { id: payload.subteam?.id }, type: payload.type };
    case "subteam_members_changed":
      return { subteam_id: payload.subteam_id, type: payload.type };
    case "user_change":
      return { type: payload.type, user: trimUser(payload.user) };
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
      return { type: payload.type };
    case "emoji_changed":
      return { type: payload.type };
    case "thread_marked":
      return {
        channel: payload.channel,
        thread_ts: payload.subscription?.thread_ts,
        type: payload.type,
        unread_count: payload.subscription?.unread_count,
      };
    case "thread_subscribed":
    case "thread_unsubscribed":
      return { channel: payload.channel, thread_ts: payload.thread_ts, type: payload.type };
    case "manual_presence_change":
      return { presence: payload.presence, type: payload.type };
    case "desktop_notification":
      return {
        avatarImage: payload.avatarImage,
        channel: payload.channel,
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
      if (typeof payload?.type === "string" && payload.type.startsWith("file_")) {
        return { type: payload.type };
      }
      return null;
  }
}
