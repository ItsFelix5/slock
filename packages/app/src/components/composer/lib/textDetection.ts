import { WHITESPACE_RE } from "@slock/ui";

const EMOJI_QUERY_RE = /^[a-z0-9_+'-]*$/i;
const EMOJI_SHORTCODE_RE = /:([a-z0-9_+'-]+):$/i;

export function matchTypedEmojiShortcode(
  before: string,
): { start: number; end: number; name: string } | null {
  const match = before.match(EMOJI_SHORTCODE_RE);
  if (!match) return null;
  const [whole, name] = match;
  const start = before.length - whole.length;
  const prevChar = before[start - 1];
  if (prevChar !== undefined && !WHITESPACE_RE.test(prevChar)) return null;
  return { end: before.length, name, start };
}

export function detectMentionTrigger(
  value: string,
  cursor: number,
  commandsPerLine = false,
): {
  kind: "user" | "userlink" | "channel" | "command" | "emoji" | "template";
  start: number;
  query: string;
} | null {
  const before = value.slice(0, cursor);
  const lineStart = commandsPerLine ? before.lastIndexOf("\n") + 1 : 0;
  const line = before.slice(lineStart);
  if (line.startsWith("/") && !WHITESPACE_RE.test(line.slice(1))) {
    return { kind: "command", query: line.slice(1), start: lineStart };
  }
  const atIdx = before.lastIndexOf("@");
  const hashIdx = before.lastIndexOf("#");
  const colonIdx = before.lastIndexOf(":");
  const tildeIdx = before.lastIndexOf("~");
  const idx = Math.max(atIdx, hashIdx, colonIdx, tildeIdx);
  if (idx === -1) return null;
  const prevChar = before[idx - 1];
  if (prevChar !== undefined && !WHITESPACE_RE.test(prevChar)) return null;
  let token = before.slice(idx + 1);
  if (WHITESPACE_RE.test(token)) return null;
  let kind: "user" | "userlink" | "channel" | "emoji" | "template" =
    idx === atIdx ? "user" : idx === hashIdx ? "channel" : idx === tildeIdx ? "template" : "emoji";
  if (kind === "user" && token.startsWith("/")) {
    kind = "userlink";
    token = token.slice(1);
  }
  if (kind === "emoji" && (!EMOJI_QUERY_RE.test(token) || token.length === 1)) return null;
  return { kind, query: token, start: idx };
}
