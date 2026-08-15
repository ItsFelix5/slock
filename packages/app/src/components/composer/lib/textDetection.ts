import type { Attachment, LinkPreview } from "@slock/slack-api";

const URL_RE = /https?:\/\/[^\s<>]+/g;
const TRAILING_PUNCTUATION_RE = /[),.!?;:'"]+$/;
export function detectUrls(value: string): string[] {
  const found = new Set<string>();
  for (const m of value.matchAll(URL_RE)) {
    const clean = m[0].replace(TRAILING_PUNCTUATION_RE, "");
    if (clean) found.add(clean);
  }
  return [...found];
}

export function linkPreviewToAttachment(preview: LinkPreview): Attachment {
  return {
    footer: preview.siteName,
    imageUrl: preview.imageUrl,
    text: preview.description,
    title: preview.title || preview.url,
    titleLink: preview.url,
  };
}

const WHITESPACE_RE = /\s/;
const EMOJI_QUERY_RE = /^[a-z0-9_+'-]*$/i;

export function detectMentionTrigger(
  value: string,
  cursor: number,
): {
  kind: "user" | "userlink" | "channel" | "command" | "emoji";
  start: number;
  query: string;
} | null {
  const before = value.slice(0, cursor);
  if (before.startsWith("/") && !WHITESPACE_RE.test(before.slice(1))) {
    return { kind: "command", query: before.slice(1), start: 0 };
  }
  const atIdx = before.lastIndexOf("@");
  const hashIdx = before.lastIndexOf("#");
  const colonIdx = before.lastIndexOf(":");
  const idx = Math.max(atIdx, hashIdx, colonIdx);
  if (idx === -1) return null;
  const prevChar = before[idx - 1];
  if (prevChar !== undefined && !WHITESPACE_RE.test(prevChar)) return null;
  let token = before.slice(idx + 1);
  if (WHITESPACE_RE.test(token)) return null;
  let kind: "user" | "userlink" | "channel" | "emoji" =
    idx === atIdx ? "user" : idx === hashIdx ? "channel" : "emoji";
  if (kind === "user" && token.startsWith("/")) {
    kind = "userlink";
    token = token.slice(1);
  }
  if (kind === "emoji" && !EMOJI_QUERY_RE.test(token)) return null;
  return { kind, query: token, start: idx };
}
