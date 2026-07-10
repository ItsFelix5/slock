import type { Attachment, Message, MessageKind, SlackFile, User } from "../types";

function colorFromHex(hex: string | undefined) {
  return hex ? `#${hex}` : "#616061";
}

function initialsOf(name: string) {
  return name.slice(0, 1).toUpperCase() || "?";
}

function tzLabelFromOffset(seconds: number | undefined): string | undefined {
  if (seconds === undefined) return undefined;
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
  if (!hash || !team) return undefined;
  return `https://ca.slack-edge.com/${team}-${raw.id}-${hash}-192`;
}

export function mapUser(raw: any): User {
  const name = raw.profile?.display_name || raw.profile?.real_name || raw.real_name || raw.name;
  const rawFields = raw.profile?.fields ?? {};
  const customFields = Object.keys(rawFields)
    .map((id) => ({ id, value: rawFields[id]?.value ?? "", alt: rawFields[id]?.alt || undefined }))
    .filter((f) => f.value);
  return {
    id: raw.id,
    name,
    avatarColor: colorFromHex(raw.color),
    avatarUrl:
      raw.profile?.image_192 ||
      raw.profile?.image_72 ||
      raw.profile?.image_48 ||
      avatarUrlFromHash(raw),
    initials: initialsOf(name),
    presence: raw.presence === "away" ? "away" : "active",
    title: raw.profile?.title || undefined,
    pronouns: raw.profile?.pronouns || undefined,
    statusText: raw.profile?.status_text || undefined,
    statusEmoji: raw.profile?.status_emoji || undefined,
    // Slackbot is a built-in pseudo-user, not a real bot-token integration, so
    // Slack's API never sets is_bot for it — flag it by id instead.
    isBot: !!raw.is_bot || raw.id === "USLACKBOT",
    tz: raw.tz,
    tzLabel: raw.tz_label || tzLabelFromOffset(raw.tz_offset),
    email: raw.profile?.email || undefined,
    phone: raw.profile?.phone || undefined,
    customFields: customFields.length ? customFields : undefined,
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
  const mentions = Number(g.mention_count ?? g.mention_count_display ?? 0) || 0;
  const unreadCount = Number(g.unread_count_display ?? g.unread_count ?? 0) || 0;
  const unread = !!(g.has_unreads ?? g.is_unread ?? (unreadCount > 0 || mentions > 0));
  return { id: g.id, unread, mentions };
}

function mapCountGroups(groups: any[]): Record<string, { unread: boolean; mentions: number }> {
  const map: Record<string, { unread: boolean; mentions: number }> = {};
  for (const g of groups) {
    const parsed = parseCountGroup(g);
    if (parsed) map[parsed.id] = { unread: parsed.unread, mentions: parsed.mentions };
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
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

// A handful of subtypes are just alternate shapes of an ordinary, visible
// message (bot integrations, file uploads, replies also broadcast to the
// channel) — everything else that isn't a pure duplicate/internal event
// (message_changed etc., which conversations.history/replies never really
// hands us as a distinct row anyway) is a system notice like "X joined the
// channel", which Slack already hands us as ready-to-render text.
const CONTENT_SUBTYPES = new Set([
  "bot_message",
  "file_share",
  "thread_broadcast",
  "me_message",
  "file_comment",
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
    id: f.id,
    name: f.name ?? "file",
    title: f.title,
    mimetype,
    filetype: f.filetype,
    size: f.size,
    isImage: !!mimetype?.startsWith("image/"),
    urlPrivate: f.url_private,
    thumbUrl: f.thumb_720 ?? f.thumb_360 ?? f.thumb_160,
    width: f.thumb_360_w ?? f.original_w,
    height: f.thumb_360_h ?? f.original_h,
    permalink: f.permalink,
  };
}

function mapAttachment(a: any): Attachment {
  return {
    id: a.id,
    color: a.color,
    authorName: a.author_name,
    authorIcon: a.author_icon,
    title: a.title,
    titleLink: a.title_link,
    text: a.text,
    imageUrl: a.image_url,
    footer: a.footer,
    footerIcon: a.footer_icon,
    fields: a.fields,
    isMessageUnfurl: !!(a.is_reply_unfurl || a.is_msg_unfurl),
    ts: a.ts,
  };
}

export function mapMessage(m: any): Message {
  const subtype: string | undefined = m.subtype;
  const kind: MessageKind = !subtype || CONTENT_SUBTYPES.has(subtype) ? "normal" : "system";
  return {
    id: m.ts,
    ts: m.ts,
    userId: m.user ?? m.bot_id ?? "",
    text: m.text,
    blocks: m.blocks,
    files: Array.isArray(m.files) ? m.files.map(mapFile) : undefined,
    attachments: Array.isArray(m.attachments) ? m.attachments.map(mapAttachment) : undefined,
    time: formatTime(m.ts),
    day: formatDay(m.ts),
    replyCount: m.reply_count,
    replyUsers: m.reply_users,
    reactions: m.reactions,
    edited: !!m.edited,
    kind,
    botName: subtype === "bot_message" ? m.username : undefined,
    botIcon:
      subtype === "bot_message"
        ? (m.icons?.image_48 ?? m.icons?.image_72 ?? m.icons?.image_36)
        : undefined,
    isBroadcast: subtype === "thread_broadcast",
    threadTs: m.thread_ts && m.thread_ts !== m.ts ? m.thread_ts : undefined,
    isEphemeral: !!m.is_ephemeral,
  };
}

export function extractChannelSections(
  data: any,
): { id: string; name: string; channelIds: string[] }[] | null {
  const raw = data?.channel_sections ?? data?.channelSections;
  if (!Array.isArray(raw)) return null;
  return (
    raw
      // Slack always includes built-in pseudo-sections alongside real ones —
      // "stars", "slack_connect", "salesforce_records", "channels",
      // "direct_messages", "recent_apps", "agents" — each with its own fixed,
      // non-renameable channel_section_id, even when the user has never created
      // a custom category. Real user-created sections come back as type
      // "standard" (confirmed by creating one) — filtering on that (rather than
      // on whether it currently has channels) is what actually distinguishes
      // those from the built-ins — a freshly created section starts out with
      // zero channels too, and needs to stay visible so there's somewhere to
      // move a channel into.
      .filter((s: any) => s.type === "standard")
      .map((s: any) => ({
        id: s.channel_section_id ?? s.id ?? s.name,
        name: s.name ?? "Section",
        channelIds: s.channel_ids ?? s.channel_ids_page?.channel_ids ?? s.channels ?? [],
      }))
      .filter((s: any) => s.id)
  );
}
