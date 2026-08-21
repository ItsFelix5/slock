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

export interface RawUser {
  color?: string;
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
  icons?: { image_36?: string; image_48?: string; image_72?: string };
  id: string;
  name?: string;
}

export interface RawChannel {
  id: string;
  is_archived?: boolean;
  is_private?: boolean;
  latest?: string;
  member_count?: number;
  name?: string;
  num_members?: number;
  topic?: string | { value?: string };
  unread_count?: number;
  unread_count_display?: number;
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
  author_name?: string;
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
    icons?: { image_36?: string; image_48?: string; image_72?: string };
    name?: string;
  };
  edited?: unknown;
  files?: RawFile[];
  icons?: { image_36?: string; image_48?: string; image_72?: string };
  is_ephemeral?: boolean;
  latest_reply?: string;
  metadata?: { event_payload?: { source_user_id?: string } };
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
