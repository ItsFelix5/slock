import { WHITESPACE_RE } from "@slock/ui";

const EMOJI_QUERY_RE = /^[a-z0-9_+'-]*$/i;

export function detectMentionTrigger(
  value: string,
  cursor: number,
  commandsPerLine = false,
  customTriggers: readonly string[] = [],
): {
  kind: "user" | "userlink" | "channel" | "command" | "emoji" | "template" | "custom";
  start: number;
  query: string;
  trigger?: string;
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
  const customIdx = customTriggers.map((trigger) => before.lastIndexOf(trigger));
  const idx = Math.max(atIdx, hashIdx, colonIdx, tildeIdx, ...customIdx);
  if (idx === -1) return null;
  const prevChar = before[idx - 1];
  if (prevChar !== undefined && !WHITESPACE_RE.test(prevChar)) return null;
  let token = before.slice(idx + 1);
  if (WHITESPACE_RE.test(token)) return null;
  const custom = customTriggers[customIdx.indexOf(idx)];
  if (
    custom !== undefined &&
    idx !== atIdx &&
    idx !== hashIdx &&
    idx !== colonIdx &&
    idx !== tildeIdx
  )
    return { kind: "custom", query: token, start: idx, trigger: custom };
  let kind: "user" | "userlink" | "channel" | "emoji" | "template" =
    idx === atIdx ? "user" : idx === hashIdx ? "channel" : idx === tildeIdx ? "template" : "emoji";
  if (kind === "user" && token.startsWith("/")) {
    kind = "userlink";
    token = token.slice(1);
  }
  if (kind === "emoji" && (!EMOJI_QUERY_RE.test(token) || token.length === 1)) return null;
  return { kind, query: token, start: idx };
}
