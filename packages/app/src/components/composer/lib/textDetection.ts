import type { Attachment, LinkPreview } from "@slock/slack-api";

// Matches Slack's own composer trigger for a link preview: any bare
// http(s) URL, trailing sentence punctuation stripped since that's almost
// never actually part of the link.
const URL_RE = /https?:\/\/[^\s<>]+/g;
export function detectUrls(value: string): string[] {
  const found = new Set<string>();
  for (const m of value.matchAll(URL_RE)) {
    const clean = m[0].replace(/[),.!?;:'"]+$/, "");
    if (clean) found.add(clean);
  }
  return [...found];
}

export function linkPreviewToAttachment(preview: LinkPreview): Attachment {
  return {
    title: preview.title || preview.url,
    titleLink: preview.url,
    text: preview.description,
    imageUrl: preview.imageUrl,
    footer: preview.siteName,
  };
}

// Detects an in-progress @mention, @/link-mention, #channel-mention,
// :emoji-shortcode, or /slash-command token immediately before the cursor,
// the way Slack's real composer does. Mentions and emoji must start at a
// word boundary (so "user@example.com" and clock times like "10:30" don't
// trigger), and slash commands are only recognized as the very first token
// of the message. "@/" runs the same user search as "@" but is meant to
// insert a silent link to the person's Slack profile instead of a real
// mention — see suggestionController and createUserLinkChip.
export function detectMentionTrigger(
  value: string,
  cursor: number,
): {
  kind: "user" | "userlink" | "channel" | "command" | "emoji";
  start: number;
  query: string;
} | null {
  const before = value.slice(0, cursor);
  if (before.startsWith("/") && !/[\s]/.test(before.slice(1))) {
    return { kind: "command", start: 0, query: before.slice(1) };
  }
  const atIdx = before.lastIndexOf("@");
  const hashIdx = before.lastIndexOf("#");
  const colonIdx = before.lastIndexOf(":");
  const idx = Math.max(atIdx, hashIdx, colonIdx);
  if (idx === -1) return null;
  const prevChar = before[idx - 1];
  if (prevChar !== undefined && !/\s/.test(prevChar)) return null;
  let token = before.slice(idx + 1);
  if (/\s/.test(token)) return null;
  let kind: "user" | "userlink" | "channel" | "emoji" =
    idx === atIdx ? "user" : idx === hashIdx ? "channel" : "emoji";
  if (kind === "user" && token.startsWith("/")) {
    kind = "userlink";
    token = token.slice(1);
  }
  if (kind === "emoji" && !/^[a-z0-9_+-]*$/i.test(token)) return null;
  return { kind, start: idx, query: token };
}
