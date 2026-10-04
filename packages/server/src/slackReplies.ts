import type {
  Block,
  RawActivityFeedEntry,
  RawBot,
  RawChannel,
  RawChannelSection,
  RawCounts,
  RawFile,
  RawIcons,
  RawLink,
  RawMessage,
  RawUser,
  RawUsergroup,
  RawUserProfile,
  RichTextBlock,
} from "@slock/types";

type Paged = { response_metadata?: { next_cursor?: string } };

export type HistoryReply = Paged & { has_more?: boolean; messages?: RawMessage[] };

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

export type UserReply = { user: RawUser };

export type AuthTestReply = { user_id: string };

export type PostMessageReply = { ts?: string };

export type MessagesListReply = { messages?: unknown };

export type UploadReservationReply = { file_id?: string; upload_url?: string };

export type FilesCompleteReply = { files?: RawFile[] };

export type AppProfileReply = { app_profile?: { desc?: string } };

export type UsergroupMembersReply = { users?: string[] };

export type UserProfileReply = { profile: RawUserProfile };

export type SetPhotoReply = { profile?: RawUserProfile; user?: { profile?: RawUserProfile } };

export type TeamProfileReply = {
  profile?: {
    fields?: {
      field_name?: string;
      id?: string;
      is_hidden?: boolean;
      label?: string;
      ordering?: number;
      type?: string;
    }[];
  };
};

export type FileInfoReply = {
  content?: string;
  file: RawFile & { editable?: boolean; quip_thread_id?: string };
  is_truncated?: boolean;
};

export type FileSharesReply = { conversation_shares?: { shares?: unknown } };

export type FilesSearchReply = {
  items?: RawFile[];
  pagination?: { total_count?: number };
};

export type LinksSearchReply = {
  items?: RawLink[];
  pagination?: { total_count?: number };
};

export type ChannelSectionsReply = { channel_sections?: RawChannelSection[] };

export type CreatedSectionReply = RawChannelSection & { channel_section?: RawChannelSection };

export type ActivityFeedReply = Paged & { items?: RawActivityFeedEntry[] };

export type SavedItem = {
  channel?: string;
  channel_id?: string;
  description?: RichTextBlock[];
  item_id?: string;
  item_type?: string;
  message_ts?: string;
  ts?: string;
};

export type SavedListReply = { items?: SavedItem[]; saved_items?: SavedItem[] };

export type PinsListReply = {
  items?: { channel?: string; created?: number; message?: RawMessage; type?: string }[];
};

export type DraftsListReply = {
  drafts?: {
    blocks?: Block[];
    client_msg_id?: string;
    destinations?: { channel_id?: string; thread_ts?: string }[];
    id?: string;
    last_updated_ts?: string;
  }[];
};

export type DraftCreateReply = {
  draft?: { id?: string; last_updated_ts?: string };
  id?: string;
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

export type ConversationViewReply = {
  channel?: RawChannel;
  history?: { has_more?: boolean; messages?: RawMessage[] };
  users?: RawUser[];
};

export type UserBootReply = {
  channels?: RawChannel[];
  ims?: { created?: number; id: string; is_open?: boolean; updated?: number; user?: string }[];
  is_open?: string[];
  mpims?: RawChannel[];
  self?: RawUser;
  starred?: (string | { channel?: string; id?: string })[];
  subteams?: { self?: string[] };
};

export type CountsReply = RawCounts;

export type PrefsReply = { prefs?: Record<string, string | undefined> };

export type RetentionReply = { retention_duration?: string; retention_type?: string };

export type DndReply = { snooze_enabled?: boolean; snooze_endtime?: number };

export type EntityIndex<Entity> = Record<string, Entity> | Entity[];

export type EdgeUsersInfoReply = {
  results?: EntityIndex<RawUser>;
  user?: RawUser;
  users?: EntityIndex<RawUser>;
};

export type EdgeChannelsInfoReply = {
  channel?: RawChannel;
  channels?: EntityIndex<RawChannel>;
  results?: EntityIndex<RawChannel>;
};

export type EdgeUsergroupsInfoReply = {
  results?: EntityIndex<RawUsergroup>;
  usergroup?: RawUsergroup;
  usergroups?: EntityIndex<RawUsergroup>;
};

export type EdgeUsersReply = { next_marker?: string; results?: RawUser[]; truncated?: boolean };

export type EdgeChannelsReply = { results?: RawChannel[] };

export type SearchMessageMatch = RawMessage & {
  channel?: { id?: string; name?: string };
  permalink?: string;
};

export type MessagesSearchReply = {
  items?: { channel?: { id?: string; name?: string }; messages?: SearchMessageMatch[] }[];
};

export type BotReply = { bot: RawBot };
