import { isChannelId, isFileId, isUserId } from "@slock/slack";
import type { ChannelId, FileId, UserId } from "@slock/types";
import { asMessage, asString, field, type RawMessage } from "./protobufRaw.ts";

export type CanvasEmbed =
  | { channelId: ChannelId; type: "channel" }
  | { fileId: FileId; type: "file" }
  | { ms: number; type: "date" }
  | { shortcode: string; type: "emoji" }
  | { userId: UserId; type: "user" }
  | { type: "unknown" };

const REF_PREFIX_RE = /^s[a-z]:/;
const EMOJI_REF_RE = /^se:([^/]+)\//;

function emojiShortcode(emoji: RawMessage): string {
  const name = asString(field(emoji, 2));
  if (name) return name;
  return (asString(field(emoji, 3)) ?? "").match(EMOJI_REF_RE)?.[1] ?? "";
}

function refId(message: RawMessage, fieldNumber: number): string {
  return (asString(field(message, fieldNumber)) ?? "").replace(REF_PREFIX_RE, "");
}

export function parseEmbedRecord(msg: RawMessage): CanvasEmbed {
  const content = asMessage(field(msg, 12));
  const emoji = content && asMessage(field(content, 48));
  if (emoji) return { shortcode: emojiShortcode(emoji), type: "emoji" };
  const channel = content && asMessage(field(content, 42));
  if (channel) {
    const channelId = refId(channel, 1);
    return isChannelId(channelId) ? { channelId, type: "channel" } : { type: "unknown" };
  }
  const user = content && asMessage(field(content, 44));
  if (user) {
    const userId = refId(user, 1);
    return isUserId(userId) ? { type: "user", userId } : { type: "unknown" };
  }
  const date = content && asMessage(field(content, 62));
  if (date) {
    const ms = field(date, 1)?.varint;
    return { ms: ms === undefined ? 0 : Number(ms), type: "date" };
  }
  const file = content && asMessage(field(content, 54));
  if (file) {
    const fileId = refId(file, 2);
    return isFileId(fileId) ? { fileId, type: "file" } : { type: "unknown" };
  }
  return { type: "unknown" };
}
