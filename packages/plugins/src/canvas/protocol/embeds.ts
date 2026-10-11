import { asMessage, asString, field, type RawMessage } from "./protobufRaw.ts";

export type CanvasEmbed =
  | { channelId: string; type: "channel" }
  | { fileId: string; type: "file" }
  | { ms: number; type: "date" }
  | { shortcode: string; type: "emoji" }
  | { userId: string; type: "user" }
  | { durationMs: number; type: "video" }
  | { type: "unknown" };

const REF_PREFIX_RE = /^s[a-z]:/;
const EMOJI_REF_RE = /^se:([^/]+)\//;

function emojiShortcode(emoji: RawMessage): string {
  const name = asString(field(emoji, 2));
  if (name) return name;
  return (asString(field(emoji, 3)) ?? "").match(EMOJI_REF_RE)?.[1] ?? "";
}

export function parseEmbedRecord(msg: RawMessage): CanvasEmbed {
  const content = asMessage(field(msg, 12));
  const emoji = content && asMessage(field(content, 48));
  if (emoji) return { shortcode: emojiShortcode(emoji), type: "emoji" };
  const channel = content && asMessage(field(content, 42));
  if (channel)
    return {
      channelId: (asString(field(channel, 1)) ?? "").replace(REF_PREFIX_RE, ""),
      type: "channel",
    };
  const user = content && asMessage(field(content, 44));
  if (user)
    return { type: "user", userId: (asString(field(user, 1)) ?? "").replace(REF_PREFIX_RE, "") };
  const date = content && asMessage(field(content, 62));
  if (date) {
    const ms = field(date, 1)?.varint;
    return { ms: ms === undefined ? 0 : Number(ms), type: "date" };
  }
  const file = content && asMessage(field(content, 54));
  if (file)
    return { fileId: (asString(field(file, 2)) ?? "").replace(REF_PREFIX_RE, ""), type: "file" };
  const video = content && asMessage(field(content, 7));
  if (video) {
    const durationMs = field(msg, 2)?.varint;
    return { durationMs: durationMs === undefined ? 0 : Number(durationMs), type: "video" };
  }
  return { type: "unknown" };
}
