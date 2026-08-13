import type { Block } from "../blocks";
import type {
  Attachment,
  Channel,
  Message,
  MessageKind,
  Reaction,
  SlackFile,
  SlackFileShare,
  SlackLink,
  User,
  UserCustomField,
} from "../types";
import { resolveMediaUrl } from "./server";

const SLACK_USER_ID = "USLACK";
const SLACK_AVATAR_URL = "/slack-logo.svg";

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
  title?: string;
  transcription?: { preview?: { content?: string; has_more?: boolean } };
  url_private?: string;
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

function colorFromHex(hex: string | undefined) {
  return hex ? `#${hex}` : "#616061";
}

function tzLabelFromOffset(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return;
  const hours = seconds / 3600;
  const sign = hours >= 0 ? "+" : "-";
  const abs = Math.abs(hours);
  const whole = Math.floor(abs);
  const minutes = Math.round((abs - whole) * 60);
  return `UTC${sign}${whole}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

function avatarUrlFromHash(raw: RawUser): string | undefined {
  const hash = raw.profile?.avatar_hash;
  const team = raw.profile?.team ?? raw.team_id;
  if (!(hash && team)) return;
  return `https://ca.slack-edge.com/${team}-${raw.id}-${hash}-192`;
}

export function mapCustomFields(
  profile: RawUserProfile | undefined,
): UserCustomField[] | undefined {
  const rawFields = profile?.fields ?? {};
  const customFields = Object.keys(rawFields)
    .map((id) => ({
      alt: rawFields[id]?.alt || undefined,
      id,
      value: rawFields[id]?.value ?? "",
    }))
    .filter((f) => f.value);
  return customFields.length ? customFields : undefined;
}

export function mapStartDate(profile: RawUserProfile | undefined): string | undefined {
  return profile?.start_date || undefined;
}

export function mapUser(raw: RawUser): User {
  const isSlack = raw.id === SLACK_USER_ID;
  const name = raw.profile?.display_name || raw.profile?.real_name || raw.real_name || raw.name;
  const customFields = mapCustomFields(raw.profile);
  const avatarUrl: string | undefined = isSlack
    ? SLACK_AVATAR_URL
    : raw.profile?.image_192 ||
      raw.profile?.image_72 ||
      raw.profile?.image_48 ||
      avatarUrlFromHash(raw);
  return {
    appId: raw.profile?.api_app_id || undefined,
    avatarColor: isSlack ? "transparent" : colorFromHex(raw.color),
    avatarUrl,
    botId: raw.profile?.bot_id || undefined,
    customFields,
    email: raw.profile?.email || undefined,
    id: raw.id,

    isBot: !!raw.is_bot || raw.id === "USLACKBOT" || isSlack,
    isWorkspaceAdmin: !!(raw.is_admin || raw.is_owner || raw.is_primary_owner),
    lastSeen: raw.last_seen || undefined,
    name: name ?? "",
    phone: raw.profile?.phone || undefined,

    presence: raw.presence === "active" || raw.presence === "away" ? raw.presence : undefined,
    pronouns: raw.profile?.pronouns || undefined,
    startDate: mapStartDate(raw.profile),
    statusEmoji: raw.profile?.status_emoji || undefined,
    statusText: raw.profile?.status_text || undefined,
    title: raw.profile?.title || undefined,
    tz: raw.tz,
    tzLabel: raw.tz_label || tzLabelFromOffset(raw.tz_offset),
  };
}

export function mapBot(raw: RawBot): User {
  const rawIcon = raw.icons?.image_72 ?? raw.icons?.image_48 ?? raw.icons?.image_36;
  return {
    appId: raw.app_id || undefined,
    avatarColor: "#616061",
    avatarUrl: rawIcon ? resolveMediaUrl(rawIcon) : undefined,
    botId: raw.id,
    id: raw.id,
    isBot: true,
    name: raw.name ?? "",
    presence: "active",
  };
}

export function mapChannel(raw: RawChannel): Channel {
  return {
    archived: !!raw.is_archived,
    id: raw.id,
    lastActivity: raw.latest ? Number.parseFloat(raw.latest) * 1000 : undefined,
    memberCount: raw.num_members ?? raw.member_count,
    name: raw.name ?? raw.id,
    private: !!raw.is_private,
    topic: typeof raw.topic === "string" ? raw.topic : (raw.topic?.value ?? ""),
    unread: (raw.unread_count_display ?? raw.unread_count ?? 0) > 0,
  };
}

function parseCountGroup(
  g: RawCountGroup,
): { id: string; unread: boolean; mentions: number } | null {
  if (!g?.id) return null;

  const mentions = Number(g.mention_count_display ?? g.mention_count ?? 0) || 0;
  const rawUnreadCount = g.unread_count_display ?? g.unread_count;
  const hasUnreadCount = rawUnreadCount !== undefined && rawUnreadCount !== null;
  const unreadCount = Number(rawUnreadCount) || 0;
  const fallbackFlag = g.is_unread ?? g.has_unreads;
  const unreadFromFlag =
    fallbackFlag === true || fallbackFlag === 1 || fallbackFlag === "true" || fallbackFlag === "1";
  const unread = mentions > 0 || (hasUnreadCount ? unreadCount > 0 : unreadFromFlag);
  return { id: g.id, mentions, unread };
}

function mapCountGroups(
  groups: RawCountGroup[],
): Record<string, { unread: boolean; mentions: number }> {
  const map: Record<string, { unread: boolean; mentions: number }> = {};
  for (const g of groups) {
    const parsed = parseCountGroup(g);
    if (parsed) map[parsed.id] = { mentions: parsed.mentions, unread: parsed.unread };
  }
  return map;
}

export function buildUnreadMap(
  counts: RawCounts | undefined,
): Record<string, { unread: boolean; mentions: number }> {
  if (!counts) return {};
  return mapCountGroups([
    ...(counts.channels ?? []),
    ...(counts.mpims ?? []),
    ...(counts.ims ?? []),
  ]);
}

export function parseBadgeCounts(
  payload: (RawCounts & { badges?: RawCounts }) | undefined,
): Record<string, { unread: boolean; mentions: number }> {
  const source = payload?.badges ?? payload ?? {};
  return mapCountGroups([
    ...(source.channels ?? []),
    ...(source.mpims ?? []),
    ...(source.ims ?? []),
  ]);
}

export function formatTime(ts: string) {
  const date = new Date(parseFloat(ts) * 1000);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function formatDayFromMs(ms: number) {
  const date = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    weekday: "long",
  });
}

export function formatDay(ts: string) {
  return formatDayFromMs(parseFloat(ts) * 1000);
}

const SYSTEM_SUBTYPES = new Set([
  "channel_join",
  "channel_leave",
  "channel_topic",
  "channel_purpose",
  "channel_name",
  "channel_archive",
  "channel_unarchive",
  "channel_convert_to_public",
  "channel_convert_to_private",
  "group_join",
  "group_leave",
  "group_topic",
  "group_purpose",
  "group_name",
  "group_archive",
  "group_unarchive",
  "pinned_item",
  "unpinned_item",
]);
export const HIDE_SUBTYPES = new Set([
  "message_changed",
  "message_deleted",
  "message_replied",
  "reply_broadcast",
]);

export function mapFile(f: RawFile): SlackFile {
  const mimetype: string | undefined = f.mimetype;

  const thumb =
    (f.thumb_800 && f.thumb_800_w && f.thumb_800_h
      ? { h: f.thumb_800_h, url: f.thumb_800, w: f.thumb_800_w }
      : undefined) ??
    (f.thumb_720 && f.thumb_720_w && f.thumb_720_h
      ? { h: f.thumb_720_h, url: f.thumb_720, w: f.thumb_720_w }
      : undefined) ??
    (f.thumb_480 && f.thumb_480_w && f.thumb_480_h
      ? { h: f.thumb_480_h, url: f.thumb_480, w: f.thumb_480_w }
      : undefined) ??
    (f.thumb_360 && f.thumb_360_w && f.thumb_360_h
      ? { h: f.thumb_360_h, url: f.thumb_360, w: f.thumb_360_w }
      : undefined) ??
    (f.thumb_160 ? { h: f.original_h, url: f.thumb_160, w: f.original_w } : undefined);
  return {
    created: f.created,

    duration: f.duration ?? (typeof f.duration_ms === "number" ? f.duration_ms / 1000 : undefined),
    filetype: f.filetype,
    height: thumb?.h ?? f.original_h,
    id: f.id,
    isAudio: !!mimetype?.startsWith("audio/"),
    isImage: !!mimetype?.startsWith("image/"),
    isMail: mimetype === "message/rfc822" || f.filetype === "eml",
    isPdf: mimetype === "application/pdf" || f.filetype === "pdf",
    isVideo: !!mimetype?.startsWith("video/"),
    mimetype,
    name: f.name ?? "file",
    permalink: f.permalink,
    size: f.size,
    thumbTiny: f.thumb_tiny,
    thumbUrl: thumb ? resolveMediaUrl(thumb.url) : undefined,
    title: f.title,
    transcriptionHasMore: f.transcription?.preview?.has_more,
    transcriptionPreview: f.transcription?.preview?.content,

    urlPrivate: f.url_private ?? "",
    waveform: Array.isArray(f.audio_wave_samples) ? f.audio_wave_samples : undefined,
    width: thumb?.w ?? f.original_w,
  };
}

export function mapLink(raw: RawLink): SlackLink {
  return {
    iconUrl: raw.icon_url ? resolveMediaUrl(raw.icon_url) : undefined,
    thumbHeight: raw.thumb_height ?? undefined,
    thumbUrl: raw.thumb_url ? resolveMediaUrl(raw.thumb_url) : undefined,
    thumbWidth: raw.thumb_width ?? undefined,
    title: raw.title,
    ts: raw.timestamp,
    url: raw.url,
  };
}

export function mapFileShare(raw: RawFileShare): SlackFileShare {
  return {
    channelId: raw.channel_id,
    channelName: raw.channel_name ?? raw.channel_id,
    replyCount: raw.reply_count,
    sharedByUserId: raw.share_user_id,
    threadTs: raw.thread_ts,
    ts: raw.ts,
  };
}

function mapAttachment(a: RawAttachment): Attachment {
  return {
    actions: a.actions?.flatMap((action) =>
      action.type === "button" && action.name && action.text
        ? [
            {
              name: action.name,
              style: action.style,
              text: action.text,
              url: action.url,
              value: action.value,
            },
          ]
        : [],
    ),
    authorIcon: a.author_icon ? resolveMediaUrl(a.author_icon) : undefined,
    authorName: a.author_name,
    blocks: a.blocks,
    callbackId: a.callback_id,
    channelId: a.channel_id,
    color: a.color,
    fallback: a.fallback,
    fields: a.fields,
    files: Array.isArray(a.files) ? a.files.map(mapFile) : undefined,
    footer: a.footer,
    footerIcon: a.footer_icon ? resolveMediaUrl(a.footer_icon) : undefined,
    fromUrl: a.from_url,
    id: a.id,
    imageHeight: a.image_height,
    imageUrl: a.image_url ? resolveMediaUrl(a.image_url) : undefined,
    imageWidth: a.image_width,
    isMessageUnfurl: !!(a.is_reply_unfurl || a.is_msg_unfurl),
    postedAt: a.ts ? `${formatDay(a.ts)} at ${formatTime(a.ts)}` : undefined,
    pretext: a.pretext,
    text: a.text,
    title: a.title,
    titleLink: a.title_link,
    ts: a.ts,
    videoHeight: a.video_height,
    videoUrl: a.video_url ? resolveMediaUrl(a.video_url) : undefined,
    videoWidth: a.video_width,
  };
}

export function mapMessage(m: RawMessage): Message {
  const subtype: string | undefined = m.subtype;
  const kind: MessageKind = subtype && SYSTEM_SUBTYPES.has(subtype) ? "system" : "normal";
  return {
    attachments: Array.isArray(m.attachments) ? m.attachments.map(mapAttachment) : undefined,
    blocks: m.blocks,

    botIcon: (() => {
      const icon =
        m.icons?.image_72 ??
        m.icons?.image_48 ??
        m.icons?.image_36 ??
        m.bot_profile?.icons?.image_72 ??
        m.bot_profile?.icons?.image_48 ??
        m.bot_profile?.icons?.image_36;
      return icon ? resolveMediaUrl(icon) : undefined;
    })(),
    botId: m.bot_id,

    botName: m.username ?? m.bot_profile?.name,
    day: formatDay(m.ts),
    edited: !!m.edited,
    files: Array.isArray(m.files) ? m.files.map(mapFile) : undefined,
    id: m.ts,
    isBroadcast: subtype === "thread_broadcast",
    isEphemeral: !!m.is_ephemeral,
    isSubscribed: typeof m.subscribed === "boolean" ? m.subscribed : undefined,
    kind,
    lastReplyLabel: m.latest_reply
      ? `${formatDay(m.latest_reply)} at ${formatTime(m.latest_reply)}`
      : undefined,
    reactions: m.reactions,
    replyCount: m.reply_count,
    replyUsers: m.reply_users,
    sourceUserId: m.metadata?.event_payload?.source_user_id,
    text: m.text ?? "",
    threadRoot: m.root ? mapMessage(m.root) : undefined,
    threadTs: m.thread_ts && m.thread_ts !== m.ts ? m.thread_ts : undefined,
    time: formatTime(m.ts),
    ts: m.ts,
    userId: m.user ?? m.bot_id ?? "",
  };
}

interface ChannelSectionSummary {
  channelIds: string[];
  id: string;
  name: string;
  sidebar: "hid" | "active" | "all";
  type: string;
}

export function extractChannelSections(
  data: { channel_sections?: RawChannelSection[] } | undefined,
): ChannelSectionSummary[] | null {
  const raw = data?.channel_sections;
  if (!Array.isArray(raw)) return null;

  return raw
    .map((s) => ({
      channelIds: s.channel_ids ?? s.channel_ids_page?.channel_ids ?? s.channels ?? [],
      id: s.channel_section_id ?? s.id ?? s.name,
      name: s.name ?? "Section",

      sidebar: s.sidebar === "all" || s.sidebar === "active" ? s.sidebar : ("hid" as const),
      type: s.type ?? "standard",
    }))
    .filter((s): s is ChannelSectionSummary => !!s.id);
}
