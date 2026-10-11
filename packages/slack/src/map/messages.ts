import { formatDay, formatTime } from "@slock/core";
import type { Message, MessageKind, RawMessage, User } from "@slock/types";
import { blockPreviewText } from "../richText/plainText";
import { mapAttachment, mapFile } from "./files";

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

const HIDDEN_SUBTYPES = new Set(["tombstone", "thread_hidden"]);

export function isHiddenSubtype(subtype: string | undefined): boolean {
  return !!subtype && HIDDEN_SUBTYPES.has(subtype);
}

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

    botIcon:
      (m.icons?.image_72 ??
        m.icons?.image_48 ??
        m.icons?.image_36 ??
        m.bot_profile?.icons?.image_72 ??
        m.bot_profile?.icons?.image_48 ??
        m.bot_profile?.icons?.image_36) ||
      undefined,
    botId: m.bot_id,

    botName: m.username ?? m.bot_profile?.name,
    canvasThreadId: m.document_comment?.thread_id,
    day: formatDay(m.ts),
    deleted: isHiddenSubtype(subtype) || undefined,
    edited: !!m.edited,
    files: Array.isArray(m.files) ? m.files.map(mapFile) : undefined,
    hasUnreadReplies: !!(
      m.subscribed &&
      m.latest_reply &&
      m.last_read &&
      m.latest_reply > m.last_read
    ),
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

export const RELAY_BOT_ID = "B0BU242DJHM";

export function isMyRelayedMessage(
  msg: Pick<Message, "botId" | "botName">,
  user: Pick<User, "name" | "originalName"> | undefined,
): boolean {
  return msg.botId === RELAY_BOT_ID && !!user && msg.botName === (user.originalName ?? user.name);
}

export function isRawMessage(value: object): value is RawMessage {
  return "ts" in value && typeof value.ts === "string";
}
