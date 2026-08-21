import { formatDay, formatTime } from "./mapTime";
import type {
  RawAttachment,
  RawChannel,
  RawChannelSection,
  RawFile,
  RawFileShare,
  RawLink,
  RawMessage,
} from "./rawTypes";
import { resolveMediaUrl } from "./server";
import type {
  Attachment,
  Channel,
  Message,
  MessageKind,
  SlackFile,
  SlackFileShare,
  SlackLink,
} from "./types";

export { buildUnreadMap, parseBadgeCounts } from "./mapCounts";
export { formatDay, formatDayFromMs, formatTime } from "./mapTime";
export { mapBot, mapCustomFields, mapStartDate, mapUser } from "./mapUsers";
export type {
  RawAttachment,
  RawBot,
  RawChannel,
  RawChannelSection,
  RawCountGroup,
  RawCounts,
  RawFile,
  RawFileShare,
  RawLink,
  RawMessage,
  RawUser,
  RawUserProfile,
} from "./rawTypes";

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
    (f.thumb_160 ? { h: f.original_h, url: f.thumb_160, w: f.original_w } : undefined) ??
    (f.thumb_video ? { h: f.thumb_video_h, url: f.thumb_video, w: f.thumb_video_w } : undefined);
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
    transcriptionLines: f.transcription?.lines?.map((line) => ({
      endMs: line.end_time_ms ?? 0,
      startMs: line.start_time_ms ?? 0,
      text: line.contents ?? "",
    })),
    transcriptionPreview: f.transcription?.preview?.content,

    urlPrivate: f.url_private ?? "",
    vtt: f.vtt ? resolveMediaUrl(f.vtt) : undefined,
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
