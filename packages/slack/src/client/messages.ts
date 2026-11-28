import { formatDay, formatTime } from "@slock/core";
import { service } from "@slock/core/services";
import type { Message, MessageKind, RawMessage, RawReaction, Reaction } from "@slock/types";
import { ifPresent, isTs, parseTs, parseUserId } from "../ids";
import { mapAttachment, mapFile } from "../map/files";
import { botIconOf, botTeamIdOf, isHiddenSubtype } from "../rawMessage";
import { blockPreviewText } from "./blockPreview";

const env = service("env");

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

function systemText(m: RawMessage, text: string): string {
  return m.user && !text.includes(`<@${m.user}>`) ? `<@${m.user}> ${text}` : text;
}

export function mapReaction(raw: RawReaction): Reaction {
  return { count: raw.count, name: raw.name, users: raw.users.map(parseUserId) };
}

function editedTsOf(edited: unknown) {
  if (typeof edited !== "object" || edited === null || !("ts" in edited)) return;
  return typeof edited.ts === "string" && isTs(edited.ts) ? edited.ts : undefined;
}

export function mapMessage(m: RawMessage): Message {
  const ts = parseTs(m.ts);
  const subtype: string | undefined = m.subtype;
  const kind: MessageKind = subtype && SYSTEM_SUBTYPES.has(subtype) ? "system" : "normal";
  const text = m.text || blockPreviewText(m.blocks);
  return {
    attachments: Array.isArray(m.attachments) ? m.attachments.map(mapAttachment) : undefined,
    blocks: m.blocks,

    botIcon: botIconOf(m),
    botId: m.bot_id,

    botName: m.username ?? m.bot_profile?.name,
    botTeamId: botTeamIdOf(m),
    canvasComment: m.document_comment?.thread_id
      ? { resolved: !!m.document_comment.is_archived, threadId: m.document_comment.thread_id }
      : undefined,
    day: formatDay(ts, env.now()),
    deleted: isHiddenSubtype(subtype) || m.deleted || undefined,
    edited: !!m.edited,
    editedTs: editedTsOf(m.edited),
    files: Array.isArray(m.files) ? m.files.map(mapFile) : undefined,
    id: ts,
    isBroadcast: subtype === "thread_broadcast",
    isEphemeral: !!m.is_ephemeral,
    isLocked: m.is_locked || undefined,
    isSubscribed: typeof m.subscribed === "boolean" ? m.subscribed : undefined,
    kind,
    latestReply: ifPresent(parseTs, m.latest_reply),
    lastReplyLabel: m.latest_reply
      ? `${formatDay(m.latest_reply, env.now())} at ${formatTime(m.latest_reply)}`
      : undefined,
    metadata: m.metadata,
    reactions: m.reactions?.map(mapReaction),
    replyCount: m.reply_count,
    replyUsers: m.reply_users?.map(parseUserId),
    replyUsersCount: m.reply_users_count,
    subtype,
    text: kind === "system" ? systemText(m, text) : text,
    threadLastRead: ifPresent(parseTs, m.last_read),
    threadRoot: m.root ? mapMessage(m.root) : undefined,
    threadTs: m.thread_ts && m.thread_ts !== m.ts ? parseTs(m.thread_ts) : undefined,
    time: formatTime(ts),
    ts,
    userId: ifPresent(parseUserId, m.user ?? m.bot_id),
  };
}
