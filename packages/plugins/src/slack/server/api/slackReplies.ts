import type {
  Block,
  RawChannel,
  RawFile,
  RawIcons,
  RawMessage,
  RawUser,
  RichTextBlock,
} from "@slock/types";

export type Paged = { response_metadata?: { next_cursor?: string } };

export type HistoryReply = Paged & {
  has_more?: boolean;
  messages?: RawMessage[];
  pin_count?: number;
};

export type ChannelReply = { channel: RawChannel };

export type ChannelInfoReply = {
  channel: RawChannel & {
    pref?: {
      can_thread?: unknown;
      enable_at_channel?: unknown;
      enable_at_here?: unknown;
      who_can_post?: unknown;
    };
  };
};

export type AppProfileReply = {
  app_profile?: { app_user_id?: string; desc?: string; team_id?: string };
};

export type FileInfoReply = {
  content?: string;
  file: RawFile & {
    access?: string;
    dm_mpdm_users_with_file_access?: { access?: string; user_id?: string }[];
    editable?: boolean;
    is_locked?: boolean;
    is_restricted_sharing_enabled?: boolean;
    is_starred?: boolean;
    org_or_workspace_access?: string;
    user_team?: string;
    quip_thread_id?: string;
  };
  is_truncated?: boolean;
};

type SavedItem = {
  channel?: string;
  channel_id?: string;
  date_created?: number;
  date_due?: number;
  description?: RichTextBlock[];
  item_id?: string;
  item_type?: string;
  message_ts?: string;
  state?: string;
  ts?: string;
};

export type SavedListReply = { items?: SavedItem[]; saved_items?: SavedItem[] };

export type RawDraft = {
  blocks?: Block[];
  client_msg_id: string;
  date_scheduled?: number | string;
  destinations: { channel_id: string; thread_ts?: string }[];
  id: string;
  last_updated_ts?: string;
};

export type AppCommandsReply = {
  app_actions?: {
    actions?: {
      action_id?: string;
      desc?: string;
      description?: string;
      name?: string;
      type?: string;
    }[];
    app_id?: string;
    app_name?: string;
    icons?: RawIcons;
  }[];
  commands?: { desc?: string; icons?: RawIcons; name?: string }[];
};

export type RoleAssignmentsReply = { role_assignments?: { users?: string[] }[] };

export type PrefsReply = { prefs?: Record<string, string | undefined> };

export type EntityIndex<Entity> = Record<string, Entity> | Entity[];

export type EdgeUsersReply = { next_marker?: string; results?: RawUser[]; truncated?: boolean };

export type EdgeChannelsReply = { results?: RawChannel[] };
