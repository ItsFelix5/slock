// biome-ignore-all lint/style/noExcessiveLinesPerFile: One cohesive raw-Slack-payload-to-app-type translation layer; splitting it would scatter the mapping logic across files that all need to stay in sync with the same wire format.
import type { Attachment, Message, MessageKind, SlackFile, User } from "../types";
import { fileProxyUrl } from "./relay";

const SLACK_USER_ID = "USLACK";
const SLACK_AVATAR_URL = "/slack-logo.svg";

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

// The self object in client.userBoot (unlike regular users.list members) carries no
// profile.image_* URLs at all — just an avatar_hash — so the current user's own avatar
// has to be built from Slack's CDN URL convention instead of read off the profile directly.
function avatarUrlFromHash(raw: any): string | undefined {
  const hash = raw.profile?.avatar_hash;
  const team = raw.profile?.team ?? raw.team_id;
  if (!(hash && team)) return;
  return `https://ca.slack-edge.com/${team}-${raw.id}-${hash}-192`;
}

export function mapUser(raw: any): User {
  const isSlack = raw.id === SLACK_USER_ID;
  const name = raw.profile?.display_name || raw.profile?.real_name || raw.real_name || raw.name;
  const rawFields = raw.profile?.fields ?? {};
  const customFields = Object.keys(rawFields)
    .map((id) => ({ alt: rawFields[id]?.alt || undefined, id, value: rawFields[id]?.value ?? "" }))
    .filter((f) => f.value);
  const avatarUrl: string | undefined = isSlack
    ? SLACK_AVATAR_URL
    : raw.profile?.image_192 ||
      raw.profile?.image_72 ||
      raw.profile?.image_48 ||
      avatarUrlFromHash(raw);
  return {
    avatarColor: isSlack ? "transparent" : colorFromHex(raw.color),
    avatarUrl,
    customFields: customFields.length ? customFields : undefined,
    email: raw.profile?.email || undefined,
    id: raw.id,
    // Slackbot is a built-in pseudo-user, not a real bot-token integration, so
    // Slack's API never sets is_bot for it — flag it by id instead.
    isBot: !!raw.is_bot || raw.id === "USLACKBOT" || isSlack,
    name,
    phone: raw.profile?.phone || undefined,
    presence: raw.presence === "away" ? "away" : "active",
    pronouns: raw.profile?.pronouns || undefined,
    statusEmoji: raw.profile?.status_emoji || undefined,
    statusText: raw.profile?.status_text || undefined,
    title: raw.profile?.title || undefined,
    tz: raw.tz,
    tzLabel: raw.tz_label || tzLabelFromOffset(raw.tz_offset),
  };
}

export function mapBot(raw: any): User {
  const rawIcon = raw.icons?.image_72 ?? raw.icons?.image_48 ?? raw.icons?.image_36;
  return {
    avatarColor: "#616061",
    avatarUrl: rawIcon ? fileProxyUrl(rawIcon) : undefined,
    id: raw.id,
    isBot: true,
    name: raw.name,
    presence: "active",
  };
}

// Shared by client.counts (REST, boot) and badge_counts_updated (gateway, live) —
// both hand back the same per-conversation shape, just wrapped in a different
// envelope. Field names are our best understanding of that (undocumented) shape;
// anything that doesn't match just falls through to "not unread" for that entry
// rather than throwing, since this is read-only enhancement, not something that
// should ever fail bootstrap or drop a socket message over.
function parseCountGroup(g: any): { id: string; unread: boolean; mentions: number } | null {
  if (!g?.id) return null;
  // Slack's raw counters/has_unreads flag can include activity it deliberately
  // omits from the sidebar (join/leave messages, for example). Prefer the
  // display counters whenever they are present so our unread styling mirrors
  // Slack's UI instead of lighting up every conversation with raw activity.
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

function mapCountGroups(groups: any[]): Record<string, { unread: boolean; mentions: number }> {
  const map: Record<string, { unread: boolean; mentions: number }> = {};
  for (const g of groups) {
    const parsed = parseCountGroup(g);
    if (parsed) map[parsed.id] = { mentions: parsed.mentions, unread: parsed.unread };
  }
  return map;
}

export function buildUnreadMap(counts: any): Record<string, { unread: boolean; mentions: number }> {
  if (!counts?.ok) return {};
  return mapCountGroups([
    ...(counts.channels ?? []),
    ...(counts.mpims ?? []),
    ...(counts.ims ?? []),
  ]);
}

// The gateway's live push counterpart to client.counts — same per-item fields,
// but we've seen it both nested under a top-level "badges" object and flattened
// at the top level, so check both rather than betting on one.
export function parseBadgeCounts(
  payload: any,
): Record<string, { unread: boolean; mentions: number }> {
  const source = payload?.badges ?? payload ?? {};
  return mapCountGroups([
    ...(source.channels ?? []),
    ...(source.mpims ?? []),
    ...(source.ims ?? []),
  ]);
}

function formatTime(ts: string) {
  const date = new Date(parseFloat(ts) * 1000);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDay(ts: string) {
  const date = new Date(parseFloat(ts) * 1000);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", weekday: "long" });
}

// Only a small, known set of subtypes are pure announcements — Slack embeds
// the acting user as a <@U..> mention right inside the ready-to-render text
// ("<@U123> has joined the channel"), so a plain gray notice with no avatar
// row is correct for these. Everything else defaults to "normal" rather than
// being lumped in as a system notice: unrecognized/new subtypes (e.g. canvas
// shares, which attribute the actor only via `user`, not the text) need the
// full avatar/name treatment or they render as unattributed text.
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

function mapFile(f: any): SlackFile {
  const mimetype: string | undefined = f.mimetype;
  return {
    // Voice messages report length as duration_ms; other files (if ever) as duration.
    duration: f.duration ?? (typeof f.duration_ms === "number" ? f.duration_ms / 1000 : undefined),
    filetype: f.filetype,
    height: f.thumb_360_h ?? f.original_h,
    id: f.id,
    isAudio: !!mimetype?.startsWith("audio/"),
    isImage: !!mimetype?.startsWith("image/"),
    isVideo: !!mimetype?.startsWith("video/"),
    mimetype,
    name: f.name ?? "file",
    permalink: f.permalink,
    size: f.size,
    thumbUrl: (() => {
      const raw = f.thumb_720 ?? f.thumb_360 ?? f.thumb_160;
      return raw ? fileProxyUrl(raw) : undefined;
    })(),
    title: f.title,
    transcriptionHasMore: f.transcription?.preview?.has_more,
    transcriptionPreview: f.transcription?.preview?.content,
    // Kept unproxied: used both as a top-level download-link href (a plain
    // navigation, which does send Slack's SameSite cookie) and as an <img>/
    // <video> subresource src (which doesn't) — callers that need the latter
    // wrap it with fileProxyUrl themselves.
    urlPrivate: f.url_private,
    waveform: Array.isArray(f.audio_wave_samples) ? f.audio_wave_samples : undefined,
    width: f.thumb_360_w ?? f.original_w,
  };
}

function mapAttachment(a: any): Attachment {
  return {
    authorIcon: a.author_icon ? fileProxyUrl(a.author_icon) : undefined,
    authorName: a.author_name,
    blocks: a.blocks,
    channelId: a.channel_id,
    color: a.color,
    fallback: a.fallback,
    fields: a.fields,
    files: Array.isArray(a.files) ? a.files.map(mapFile) : undefined,
    footer: a.footer,
    footerIcon: a.footer_icon ? fileProxyUrl(a.footer_icon) : undefined,
    fromUrl: a.from_url,
    id: a.id,
    imageUrl: a.image_url ? fileProxyUrl(a.image_url) : undefined,
    isMessageUnfurl: !!(a.is_reply_unfurl || a.is_msg_unfurl),
    postedAt: a.ts ? `${formatDay(a.ts)} at ${formatTime(a.ts)}` : undefined,
    pretext: a.pretext,
    text: a.text,
    title: a.title,
    titleLink: a.title_link,
    ts: a.ts,
    videoHeight: a.video_height,
    videoUrl: a.video_url ? fileProxyUrl(a.video_url) : undefined,
    videoWidth: a.video_width,
  };
}

export function mapMessage(m: any): Message {
  const subtype: string | undefined = m.subtype;
  const kind: MessageKind = subtype && SYSTEM_SUBTYPES.has(subtype) ? "system" : "normal";
  return {
    attachments: Array.isArray(m.attachments) ? m.attachments.map(mapAttachment) : undefined,
    blocks: m.blocks,
    // Slack nests modern bot avatars inside bot_profile.icons; old message
    // payloads instead put them at the top-level icons field.
    botIcon: (() => {
      const icon =
        m.bot_profile?.icons?.image_72 ??
        m.bot_profile?.icons?.image_48 ??
        m.bot_profile?.icons?.image_36 ??
        m.icons?.image_72 ??
        m.icons?.image_48 ??
        m.icons?.image_36;
      return icon ? fileProxyUrl(icon) : undefined;
    })(),
    botId: m.bot_id,
    botName:
      m.bot_profile?.name ?? (subtype === "bot_message" || m.bot_id ? m.username : undefined),
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
    text: m.text,
    threadRoot: m.root ? mapMessage(m.root) : undefined,
    threadTs: m.thread_ts && m.thread_ts !== m.ts ? m.thread_ts : undefined,
    time: formatTime(m.ts),
    ts: m.ts,
    userId: m.user ?? m.bot_id ?? "",
  };
}

export function extractChannelSections(data: any):
  | {
      id: string;
      name: string;
      channelIds: string[];
      sidebar: "hid" | "active" | "all";
      type: string;
    }[]
  | null {
  const raw = data?.channel_sections;
  if (!Array.isArray(raw)) return null;
  // Slack always includes built-in pseudo-sections alongside real ones —
  // "stars", "slack_connect", "salesforce_records", "channels",
  // "direct_messages", "recent_apps", "agents" — each with its own fixed,
  // non-renameable channel_section_id, even when the user has never created a
  // custom category. Real user-created sections come back as type "standard"
  // (confirmed by creating one). Every entry (not just "standard") is kept
  // here, in Slack's own order, so the sidebar can drag-reorder the built-in
  // "Starred"/"Channels" groups alongside custom ones — callers that mutate
  // section *membership* (move a channel in/out) must filter to "standard"
  // themselves, since that operation is meaningless for the pseudo-sections.
  return raw
    .map((s: any) => ({
      channelIds: s.channel_ids ?? s.channel_ids_page?.channel_ids ?? s.channels ?? [],
      id: s.channel_section_id ?? s.id ?? s.name,
      name: s.name ?? "Section",
      sidebar: s.sidebar === "all" || s.sidebar === "active" ? s.sidebar : "hid",
      type: s.type ?? "standard",
    }))
    .filter((s: any) => s.id);
}
