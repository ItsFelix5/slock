import type { RawMessage } from "./rawTypes";

export type RawActivityMessage = Partial<
  Pick<
    RawMessage,
    "bot_id" | "bot_profile" | "metadata" | "text" | "thread_ts" | "ts" | "user" | "username"
  >
> & {
  author_user_id?: string;
  channel?: string;
};

export type RawActivityEntry = RawActivityMessage & {
  channel_id?: string;
  latest_message?: RawActivityMessage;
  latest_msg?: RawActivityMessage;
  latest_reply_actor_user_id?: string;
  latest_reply_user_id?: string;
  latest_ts?: string;
  latest_user_id?: string;
  message?: RawActivityMessage;
  thread_ts?: string;
  unread_msg_count?: number;
  user_id?: string;
};

export type RawActivityItem = {
  activity_text?: string;
  actor_user_id?: string;
  author_user_id?: string;
  bundle_info?: {
    payload?: {
      channel_entry?: RawActivityEntry;
      dm_entry?: { latest_message?: RawActivityMessage };
      latest_message?: RawActivityMessage;
      message?: RawActivityMessage;
      thread_entry?: RawActivityEntry;
    };
  };
  channel?: string;
  channel_id?: string;
  invite?: string;
  latest_reply_actor_user_id?: string;
  latest_user_id?: string;
  linked_item_id?: string;
  message?: RawActivityMessage;
  message_ts?: string;
  quietly_added_to_channel_payload?: {
    channel_id?: string;
    inviter_team_id?: string;
    inviter_user_id?: string;
  };
  reaction?: { name?: string; user?: string };
  ts?: string;
  type?: string;
  user?: string;
  user_id?: string;
};

export type RawActivityFeedEntry = {
  feed_ts?: string;
  is_unread?: boolean;
  item?: RawActivityItem;
  key?: string;
};
