import { trimActivityCounts, trimChannel, trimCountGroups, trimMessage } from "./slackEntities.ts";

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
      return { channel: payload.channel, ts: payload.ts, type: payload.type };
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
    case "view_opened": {
      const { view } = payload;
      return {
        type: payload.type,
        view: view
          ? {
              blocks: view.blocks,
              close: view.close,
              id: view.id,
              previous_view_id: view.previous_view_id,
              submit: view.submit,
              title: view.title,
              type: view.type,
            }
          : undefined,
        view_type: payload.view_type,
      };
    }
    default:
      console.debug("[gateway] unhandled message type:", payload?.type, payload);
      return null;
  }
}
