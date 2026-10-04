import type { ModalView } from "./blocks";
import type { RawChannel, RawCounts, RawMessage, RawUser } from "./rawTypes";

export interface DesktopNotificationEvent {
  avatarImage?: string;
  channel?: string;
  content?: string;
  event_ts?: string;
  is_shared?: boolean;
  launchUri?: string;
  msg?: string;
  subtitle?: string;
  title?: string;
  type: "desktop_notification";
}

export type GatewayMessageEvent = Partial<Omit<RawMessage, "type">> & {
  channel?: string;
  deleted_ts?: string;
  message?: RawMessage;
  type: "message";
};

export type MembershipEventType =
  | "channel_archive"
  | "channel_deleted"
  | "channel_joined"
  | "channel_left"
  | "channel_rename"
  | "channel_unarchive"
  | "group_archive"
  | "group_joined"
  | "group_left"
  | "group_rename"
  | "group_unarchive"
  | "im_close"
  | "im_created"
  | "im_open"
  | "member_left_channel"
  | "mpim_close"
  | "mpim_joined"
  | "mpim_open";

export type GatewayEvent =
  | { connected: boolean; type: "_status" }
  | GatewayMessageEvent
  | {
      item: { channel?: string; ts?: string };
      item_user?: string;
      reaction?: string;
      type: "reaction_added" | "reaction_removed";
      user?: string;
    }
  | { presence?: string; type: "presence_change"; user?: string; users?: string[] }
  | { channel?: string; thread_ts?: string; type: "user_typing"; user?: string }
  | (RawCounts & { badges?: RawCounts; type: "badge_counts_updated" })
  | {
      channel?: string;
      mention_count?: number;
      ts?: string;
      type: "channel_marked";
      unread_count?: number;
    }
  | { channel: RawChannel; type: "channel_joined" | "group_joined" }
  | { channel: RawChannel; type: "im_created"; user?: string }
  | { channel?: string; type: "channel_left" | "group_left" }
  | { channel?: string; type: "member_left_channel"; user?: string }
  | { type: "user_invalidated"; user?: string; users?: string[] }
  | { type: "view_opened" | "view_updated"; view?: ModalView; view_type?: string }
  | { channel_id?: string; ts?: string; type: "pin_added" | "pin_removed" }
  | { item: { channel?: string; type?: string }; type: "star_added" | "star_removed" }
  | { item: { channel?: string; ts?: string }; type: "saved_added" | "saved_deleted" }
  | { type: "saved_clear" }
  | { channel: { id?: string; name?: string }; type: "channel_rename" | "group_rename" }
  | {
      channel?: string;
      type:
        | "channel_archive"
        | "channel_deleted"
        | "channel_unarchive"
        | "group_archive"
        | "group_unarchive"
        | "im_close"
        | "im_open"
        | "mpim_close"
        | "mpim_joined"
        | "mpim_open";
    }
  | { subteam: { id?: string }; type: "subteam_created" | "subteam_deleted" | "subteam_updated" }
  | { subteam_id?: string; type: "subteam_members_changed" }
  | { type: "user_change"; user: RawUser }
  | { snoozed_until: number | null; type: "dnd_updated" }
  | { channel_id?: string; type: "canvas_created" }
  | { bot: { id?: string }; type: "bot_added" | "bot_changed" }
  | { type: "commands_changed" | "emoji_changed" }
  | { channel?: string; thread_ts?: string; type: "thread_marked"; unread_count?: number }
  | { channel?: string; thread_ts?: string; type: "thread_subscribed" | "thread_unsubscribed" }
  | { presence?: string; type: "manual_presence_change" }
  | DesktopNotificationEvent
  | { type: `file_${string}` };

export type MembershipEvent = Extract<GatewayEvent, { type: MembershipEventType }>;
