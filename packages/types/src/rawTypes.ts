import type { Block } from "./blocks";
import type { Reaction } from "./types";

export interface RawUserProfile {
  api_app_id?: string;
  avatar_hash?: string;
  bot_id?: string;
  display_name?: string;
  email?: string;
  fields?: Record<string, { alt?: string; value?: string } | undefined>;
  image_192?: string;
  image_48?: string;
  image_72?: string;
  phone?: string;
  pronouns?: string;
  real_name?: string;
  start_date?: string;
  status_emoji?: string;
  status_text?: string;
  team?: string;
  title?: string;
}

export interface RawIcons {
  image_32?: string;
  image_36?: string;
  image_48?: string;
  image_64?: string;
  image_72?: string;
}

export interface RawUser {
  color?: string;
  deleted?: boolean;
  id: string;
  is_admin?: boolean;
  is_bot?: boolean;
  is_owner?: boolean;
  is_primary_owner?: boolean;
  last_seen?: number;
  name?: string;
  presence?: string;
  profile?: RawUserProfile;
  real_name?: string;
  team_id?: string;
  tz?: string;
  tz_label?: string;
  tz_offset?: number;
}

export interface RawBot {
  app_id?: string;
  icons?: RawIcons;
  id: string;
  name?: string;
  user_id?: string;
}

export interface RawChannelText {
  value?: string;
}

export interface RawChannelProperties {
  canvas?: { file_id?: string; quip_thread_id?: string };
  channel_email_addresses?: { address?: string }[];
  has_custom_mpdm_name?: boolean;
  tabs?: { data?: { file_id?: string }; label?: string; type?: string }[];
}

export interface RawChannel {
  created?: number;
  creator?: string;
  id: string;
  is_archived?: boolean;
  is_channel?: boolean;
  is_file?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_member?: boolean;
  is_mpim?: boolean;
  is_open?: boolean;
  is_private?: boolean;
  is_record_channel?: boolean;
  last_read?: string;
  latest?: string;
  member_count?: number;
  members?: string[];
  name?: string;
  name_normalized?: string;
  num_members?: number;
  properties?: RawChannelProperties;
  purpose?: string | RawChannelText;
  topic?: string | RawChannelText;
  unread_count?: number;
  unread_count_display?: number;
  updated?: number;
  user?: string;
}

export interface RawCountGroup {
  has_unreads?: boolean | number | string;
  id?: string;
  is_unread?: boolean | number | string;
  last_read?: string;
  latest?: string;
  mention_count?: number;
  mention_count_display?: number;
  unread_count?: number | null;
  unread_count_display?: number | null;
}

export interface RawCounts {
  activity_v2?: Record<string, number>;
  channels?: RawCountGroup[];
  ims?: RawCountGroup[];
  mpims?: RawCountGroup[];
}

export interface RawFile {
  audio_wave_samples?: number[];
  created?: number;
  duration?: number;
  duration_ms?: number;
  filetype?: string;
  id: string;
  mimetype?: string;
  mode?: string;
  name?: string;
  original_h?: number;
  original_w?: number;
  permalink?: string;
  size?: number;
  thumb_160?: string;
  thumb_360?: string;
  thumb_360_h?: number;
  thumb_360_w?: number;
  thumb_480?: string;
  thumb_480_h?: number;
  thumb_480_w?: number;
  thumb_720?: string;
  thumb_720_h?: number;
  thumb_720_w?: number;
  thumb_800?: string;
  thumb_800_h?: number;
  thumb_800_w?: number;

  thumb_tiny?: string;
  thumb_video?: string;
  thumb_video_h?: number;
  thumb_video_w?: number;
  title?: string;
  transcription?: {
    lines?: { contents?: string; end_time_ms?: number; start_time_ms?: number }[];
    preview?: { content?: string; has_more?: boolean };
  };
  url_private?: string;
  url_private_download?: string;
  vtt?: string;
}

export interface RawLink {
  icon_url?: string | null;
  thumb_height?: number | null;
  thumb_url?: string | null;
  thumb_width?: number | null;
  timestamp: string;
  title: string | null;
  url: string;
}

export interface RawFileShare {
  access?: string;
  channel_id: string;
  channel_name?: string;
  reply_count?: number;
  share_user_id?: string;
  thread_ts?: string;
  ts: string;
}

export interface RawAttachment {
  actions?: {
    name?: string;
    style?: string;
    text?: string;
    type?: string;
    url?: string;
    value?: string;
  }[];
  author_icon?: string;
  author_id?: string;
  author_name?: string;
  author_subname?: string;
  blocks?: Block[];
  callback_id?: string;
  channel_id?: string;
  color?: string;
  fallback?: string;
  fields?: { short?: boolean; title: string; value: string }[];
  files?: RawFile[];
  footer?: string;
  footer_icon?: string;
  from_url?: string;
  id?: number;
  image_height?: number;
  image_url?: string;
  image_width?: number;
  is_msg_unfurl?: boolean;
  is_reply_unfurl?: boolean;
  pretext?: string;
  text?: string;
  title?: string;
  title_link?: string;
  ts?: string;
  video_height?: number;
  video_url?: string;
  video_width?: number;
}

export interface RawMessage {
  attachments?: RawAttachment[];
  blocks?: Block[];
  bot_id?: string;
  bot_profile?: {
    icons?: RawIcons;
    name?: string;
  };
  document_comment?: { is_archived?: boolean; is_visible?: boolean; thread_id?: string };
  edited?: unknown;
  files?: RawFile[];
  icons?: RawIcons;
  is_ephemeral?: boolean;
  latest_reply?: string;
  metadata?: {
    event_type?: string;
  };
  reactions?: Reaction[];
  reply_count?: number;
  reply_users?: string[];
  root?: RawMessage;
  subscribed?: boolean;
  subtype?: string;
  text?: string;
  thread_ts?: string;
  ts: string;
  type?: string;
  user?: string;
  username?: string;
}

export interface RawChannelSection {
  channel_ids?: string[];
  channel_ids_page?: { channel_ids?: string[] };
  channel_section_id?: string;
  channels?: string[];
  id?: string;
  name?: string;
  sidebar?: string;
  type?: string;
}

export interface RawUsergroup {
  created_by?: string;
  date_create?: number;
  description?: string;
  handle?: string;
  id: string;
  is_section?: boolean;
  name?: string;
  prefs?: { channels?: string[]; groups?: string[] };
  user_count?: number;
}

export function isRawMessage(value: object): value is RawMessage {
  return "ts" in value && typeof value.ts === "string";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
