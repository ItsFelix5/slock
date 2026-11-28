import { defined, logUnknown } from "@slock/core";
import { isChannelId, isFileId, isUserId } from "@slock/slack";
import type { ChannelId, FileId, UserId } from "@slock/types";

const TRAILING_URL_PUNCTUATION_RE = /[),.!?;:'"]+$/;

const USER_PROFILE_LINK_RE =
  /^https:\/\/[a-z0-9-]+(?:\.enterprise)?\.slack\.com\/team\/([A-Z0-9]+)(?:[/?#].*)?$/i;

const ARCHIVE_LINK_RE =
  /^https:\/\/[a-z0-9-]+(?:\.enterprise)?\.slack\.com\/archives\/([A-Z0-9]+)(\/p\d+)?\/?(?:[?#].*)?$/i;

export function parseUserProfileLink(url: string): UserId | null {
  const id = USER_PROFILE_LINK_RE.exec(url)?.[1];
  return id && isUserId(id) ? id : null;
}

export function parseArchiveLink(url: string): { channelId: ChannelId; isMessage: boolean } | null {
  const match = ARCHIVE_LINK_RE.exec(url);
  const channelId = match?.[1];
  return match && channelId && isChannelId(channelId) ? { channelId, isMessage: !!match[2] } : null;
}

export function messageLinkLabel(channelName: string, authorName?: string): string {
  return authorName ? `@${authorName} in ${channelName}` : `Message in ${channelName}`;
}

export type InlineNode =
  | { t: "text"; text: string }
  | { t: "bold"; nodes: InlineNode[] }
  | { t: "italic"; nodes: InlineNode[] }
  | { t: "strike"; nodes: InlineNode[] }
  | { t: "code"; nodes: InlineNode[] }
  | { t: "emoji"; name: string }
  | { t: "link"; url: string; label?: string }
  | { t: "user"; id: UserId }
  | { t: "channel"; id: ChannelId; label?: string }
  | { t: "usergroup"; id: string; label?: string }
  | { t: "broadcast"; range: string }
  | { t: "canvas"; fileId: FileId; label?: string }
  | {
      t: "date";
      timestamp: number;
      format: string;
      url?: string;
      fallback?: string;
    };

const INLINE_RE =
  /`([^`]+)`|<([^<>]*)>|:([a-z0-9_+'-]+(?:::skin-tone-[2-6])?):|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|(?<![\p{L}\p{N}])_([^\n]+?)_(?![\p{L}\p{N}])|~([^~\n]+)~|(https?:\/\/[^\s<>]+)/giu;

function splitOnce(text: string, sep: string): [string, string | undefined] {
  const index = text.indexOf(sep);
  return index === -1 ? [text, undefined] : [text.slice(0, index), text.slice(index + sep.length)];
}

function parseToken(token: string): InlineNode {
  const literal: InlineNode = { t: "text", text: `<${token}>` };
  if (token.startsWith("@")) {
    const [id] = splitOnce(token.slice(1), "|");
    return id && isUserId(id) ? { id, t: "user" } : literal;
  }
  if (token.startsWith("#")) {
    const [id, label] = splitOnce(token.slice(1), "|");
    return id && isChannelId(id) ? { id, label, t: "channel" } : literal;
  }
  if (token.startsWith("!subteam^")) {
    const [id, label] = splitOnce(token.slice("!subteam^".length), "|");
    return id ? { id, label, t: "usergroup" } : literal;
  }
  if (token.startsWith("!date^")) {
    const [main, fallback] = splitOnce(token.slice("!date^".length), "|");
    const [ts, format, url] = main.split("^");
    const timestamp = Number(ts);
    return ts && format && Number.isFinite(timestamp)
      ? { fallback, format, t: "date", timestamp, url }
      : literal;
  }
  if (token.startsWith("!canvas^")) {
    const [fileId, label] = splitOnce(token.slice("!canvas^".length), "|");
    return fileId && isFileId(fileId) ? { fileId, label, t: "canvas" } : literal;
  }
  if (token.startsWith("!")) {
    const [range] = splitOnce(token.slice(1), "|");
    if (range === "here" || range === "channel" || range === "everyone")
      return { range, t: "broadcast" };
    logUnknown("mrkdwn command", splitOnce(token.slice(1), "^")[0]);
    return literal;
  }
  const [url, label] = splitOnce(token, "|");
  return url ? { label, t: "link", url } : literal;
}

const CODE_TOKEN_RE = /<([^<>]*)>/g;

function parseCodeInner(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CODE_TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push({ t: "text", text: text.slice(lastIndex, index) });
    nodes.push(parseToken(defined(match[1])));
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push({ t: "text", text: text.slice(lastIndex) });
  return nodes;
}

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push({ t: "text", text: text.slice(lastIndex, index) });
    const [, code, token, emoji, doubleBold, bold, italic, strike, bareUrl] = match;
    if (code !== undefined) nodes.push({ nodes: parseCodeInner(code), t: "code" });
    else if (token !== undefined) nodes.push(parseToken(token));
    else if (emoji !== undefined) nodes.push({ name: emoji, t: "emoji" });
    else if (doubleBold !== undefined || bold !== undefined)
      nodes.push({
        nodes: parseInline(defined(doubleBold ?? bold)),
        t: "bold",
      });
    else if (italic !== undefined) nodes.push({ nodes: parseInline(italic), t: "italic" });
    else if (strike !== undefined) nodes.push({ nodes: parseInline(strike), t: "strike" });
    else if (bareUrl !== undefined) {
      const trail = bareUrl.match(TRAILING_URL_PUNCTUATION_RE)?.[0] ?? "";
      nodes.push({
        t: "link",
        url: trail ? bareUrl.slice(0, -trail.length) : bareUrl,
      });
      if (trail) nodes.push({ t: "text", text: trail });
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push({ t: "text", text: text.slice(lastIndex) });
  return nodes;
}
