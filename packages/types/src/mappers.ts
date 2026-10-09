import { blockPreviewText } from "./blocks";
import { mapAttachment, mapFile } from "./mapFiles";
import { formatDay, formatTime } from "./mapTime";
import type { RawChannel, RawChannelSection, RawMessage } from "./rawTypes";
import { resolveMediaUrl } from "./server";
import type { Channel, ChannelDetails, Message, MessageKind } from "./types";
import type { User } from "./userTypes";

export { buildUnreadMap, parseBadgeCounts } from "./mapCounts";

export { CLOCK_24H, formatDay, formatDayFromMs, formatTime, formatTimeFromMs } from "./mapTime";

export {
  mapBot,
  mapCustomFields,
  mapProfileIdentity,
  mapStartDate,
  mapUser,
  SLACK_SYSTEM_USER,
  SLACK_USER_ID,
} from "./mapUsers";

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

const FILE_CHANNEL_PREFIX = "FC:";
const CANVAS_COMMENTS_LABEL = "Canvas comments";

export function canvasFileIdOf(raw: Pick<RawChannel, "id" | "is_file" | "name_normalized">) {
  const hosted = raw.is_file || raw.name_normalized?.startsWith(FILE_CHANNEL_PREFIX);
  return hosted ? `F${raw.id.slice(1)}` : undefined;
}

export function mapChannel(raw: RawChannel): Channel {
  const canvasFileId = canvasFileIdOf(raw);
  return {
    archived: !!raw.is_archived,
    canvasFileId,
    id: raw.id,
    lastActivity: raw.latest ? Number.parseFloat(raw.latest) * 1000 : undefined,
    memberCount: raw.num_members ?? raw.member_count,
    name: canvasFileId ? CANVAS_COMMENTS_LABEL : (raw.name ?? raw.id),
    private: !!raw.is_private,
    topic: typeof raw.topic === "string" ? raw.topic : (raw.topic?.value ?? ""),
    unread: (raw.unread_count_display ?? raw.unread_count ?? 0) > 0,
  };
}

export function mapChannelDetails(raw: RawChannel): ChannelDetails {
  return {
    archived: !!raw.is_archived,
    created: raw.created ?? 0,
    creatorId: raw.creator || undefined,
    email: raw.properties?.channel_email_addresses?.[0]?.address || undefined,
    id: raw.id,
    memberCount: raw.num_members,
    name: canvasFileIdOf(raw) ? CANVAS_COMMENTS_LABEL : (raw.name ?? raw.id),
    private: !!raw.is_private,
    purpose: typeof raw.purpose === "string" ? raw.purpose : (raw.purpose?.value ?? ""),
    topic: typeof raw.topic === "string" ? raw.topic : (raw.topic?.value ?? ""),
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

const HIDE_SUBTYPES = new Set([
  "message_changed",
  "message_deleted",
  "message_replied",
  "reply_broadcast",
]);

function isVisibleSubtype(raw: RawMessage): boolean {
  return !(raw.subtype && HIDE_SUBTYPES.has(raw.subtype));
}

export function mapVisibleMessage(raw: RawMessage): Message | undefined {
  return isVisibleSubtype(raw) ? mapMessage(raw) : undefined;
}

export function mapVisibleMessages(raws: RawMessage[]): Message[] {
  return raws
    .filter((raw) => raw.type === "message")
    .flatMap((raw) => mapVisibleMessage(raw) ?? []);
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
    canvasThreadId: m.document_comment?.thread_id,
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
    metadata: m.metadata,
    reactions: m.reactions,
    replyCount: m.reply_count,
    replyUsers: m.reply_users,
    text: m.text || blockPreviewText(m.blocks),
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

export const RELAY_BOT_ID = "B0BU242DJHM";

export function isMyRelayedMessage(
  msg: Pick<Message, "botId" | "botName">,
  user: Pick<User, "name" | "originalName"> | undefined,
): boolean {
  return msg.botId === RELAY_BOT_ID && !!user && msg.botName === (user.originalName ?? user.name);
}
