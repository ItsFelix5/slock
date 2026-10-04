import {
  CONTEXT_PREFIX,
  decodeTextEntities,
  MRKDWN_CLIPBOARD_TYPE,
  stripTrackingParams,
} from "@slock/blockkit";
import { escapeRegExp, INLINE_MARKS } from "@slock/ui";
import type Quill from "quill";
import { channelDisplayName } from "../../../lib/displayName";
import { store } from "../../../lib/store";
import { resolvedEmojiName } from "./emojiEmbed";
import { linkMentionValue, stripLeadingAt } from "./quillMentions";
import { insertRichTextAt } from "./richTextLoad";
import { suggestionText } from "./suggestionController";
import type { SuggestItem, SuggestState } from "./suggestTypes";

const MENTION_TOKEN_RE =
  /<@([A-Z0-9]+)>|<#([A-Z0-9]+)(?:\|([^>]*))?>|<!(channel|here)>|<!subteam\^([A-Z0-9]+)(?:\|([^>]*))?>|:([a-zA-Z0-9_+'-]+):|<!date\^(\d+)\^([^|^>]+)\|([^>]*)>|<([^<>@#!][^<>]*)>/g;

const HEADER_LINE_RE = /^(#{1,4}) (.*)$/;

const INLINE_TOKEN_RE = new RegExp(
  INLINE_MARKS.map(([char]) => {
    const escaped = escapeRegExp(char);
    return `${escaped}([^${escaped}\\n]+)${escaped}`;
  }).join("|"),
  "g",
);

function insertInlineText(quill: Quill, start: number, text: string): number {
  let cursor = start;
  let lastIndex = 0;
  const insertRun = (segment: string, attributes?: Record<string, unknown>) => {
    if (!segment) return;
    const decoded = decodeTextEntities(segment);
    if (attributes) quill.insertText(cursor, decoded, attributes);
    else quill.insertText(cursor, decoded);
    cursor += decoded.length;
  };
  for (const match of text.matchAll(INLINE_TOKEN_RE)) {
    const index = match.index ?? 0;
    insertRun(text.slice(lastIndex, index));
    const groupIndex = match.slice(1).findIndex((group) => group !== undefined);
    const format = INLINE_MARKS[groupIndex]?.[1];
    insertRun(match[groupIndex + 1] ?? "", format ? { [format]: true } : undefined);
    lastIndex = index + match[0].length;
  }
  insertRun(text.slice(lastIndex));
  return cursor;
}

function insertMrkdwnLineAt(
  quill: Quill,
  start: number,
  text: string,
  onUnresolvedUser?: (id: string) => void,
): number {
  let cursor = start;
  if (!text) return cursor;
  let lastIndex = 0;
  const insertPlain = (segment: string) => {
    if (!segment) return;
    cursor = insertInlineText(quill, cursor, segment);
  };
  for (const match of text.matchAll(MENTION_TOKEN_RE)) {
    const [
      whole,
      userId,
      channelId,
      channelLabel,
      broadcastRange,
      usergroupId,
      usergroupLabel,
      emojiName,
      dateTs,
      dateFormat,
      dateFallback,
      linkToken,
    ] = match;
    const index = match.index ?? 0;
    insertPlain(text.slice(lastIndex, index));
    if (userId) {
      const user = store.users.userById(userId);
      if (!user) onUnresolvedUser?.(userId);
      quill.insertEmbed(cursor, "mention", {
        id: userId,
        kind: "user",
        name: user?.name ?? userId,
      });
      cursor += 1;
    } else if (channelId) {
      const name =
        channelLabel || channelDisplayName(store.channels.channelById(channelId), channelId);
      quill.insertEmbed(cursor, "mention", { id: channelId, kind: "channel", name });
      cursor += 1;
    } else if (broadcastRange) {
      quill.insertEmbed(cursor, "mention", {
        id: broadcastRange,
        kind: "special",
        name: broadcastRange,
      });
      cursor += 1;
    } else if (usergroupId) {
      const name = stripLeadingAt(
        usergroupLabel || store.usergroups.usergroupById(usergroupId)?.name || "",
      );
      quill.insertEmbed(cursor, "mention", {
        id: usergroupId,
        kind: "usergroup",
        name: name || usergroupId,
      });
      cursor += 1;
    } else if (emojiName && resolvedEmojiName(emojiName)) {
      quill.insertEmbed(cursor, "emoji", { name: emojiName });
      cursor += 1;
    } else if (dateTs && dateFormat) {
      quill.insertEmbed(cursor, "date", {
        fallback: dateFallback ?? "",
        format: dateFormat,
        ts: Number(dateTs),
      });
      cursor += 1;
    } else if (linkToken) {
      const pipeIndex = linkToken.indexOf("|");
      const url = decodeTextEntities(pipeIndex === -1 ? linkToken : linkToken.slice(0, pipeIndex));
      const label = decodeTextEntities(
        pipeIndex === -1 ? linkToken : linkToken.slice(pipeIndex + 1),
      );
      const mention = linkMentionValue(url, label);
      if (mention) {
        quill.insertEmbed(cursor, "mention", mention);
        cursor += 1;
      } else {
        quill.insertText(cursor, label, { link: url });
        cursor += label.length;
      }
    } else {
      insertPlain(whole);
    }
    lastIndex = index + whole.length;
  }
  insertPlain(text.slice(lastIndex));
  return cursor;
}

export function insertMrkdwnAt(
  quill: Quill,
  start: number,
  text: string,
  onUnresolvedUser?: (id: string) => void,
): number {
  let cursor = start;
  if (!text) return cursor;
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (line === "---") {
      quill.insertEmbed(cursor, "divider", true);
      cursor += 1;
    } else {
      cursor = insertMrkdwnLineAt(quill, cursor, line, onUnresolvedUser);
    }
    if (i < lines.length - 1) {
      quill.insertText(cursor, "\n");
      cursor += 1;
    }
  });
  return cursor;
}

export function loadMrkdwnIntoQuill(
  quill: Quill,
  text: string,
  onUnresolvedUser?: (id: string) => void,
): void {
  quill.setText("\n");
  insertMrkdwnAt(quill, 0, text, onUnresolvedUser);
}

const BARE_URL_RE = /^https?:\/\/\S+$/;

function pasteCleanedUrl(quill: Quill, event: ClipboardEvent): boolean {
  const pasted = event.clipboardData?.getData("text/plain").trim() ?? "";
  if (!BARE_URL_RE.test(pasted)) return false;
  const cleaned = stripTrackingParams(pasted);
  if (cleaned === pasted) return false;
  const selection = quill.getSelection(true) ?? { index: quill.getLength(), length: 0 };
  if (selection.length) {
    quill.formatText(selection.index, selection.length, "link", cleaned, "user");
    quill.setSelection(selection.index + selection.length, 0, "silent");
    return true;
  }
  quill.insertText(selection.index, cleaned, "user");
  quill.setSelection(selection.index + cleaned.length, 0);
  return true;
}

interface PastedLine {
  content: string;
  format?: { name: "header" | "context"; value: number | true };
}

function pastedLine(line: string): PastedLine {
  const header = HEADER_LINE_RE.exec(line);
  if (header) {
    const [, hashes = "#", content = ""] = header;
    return { content, format: { name: "header", value: hashes.length } };
  }
  if (line.startsWith(CONTEXT_PREFIX)) {
    return { content: line.slice(CONTEXT_PREFIX.length), format: { name: "context", value: true } };
  }
  return { content: line };
}

function insertPastedLines(
  quill: Quill,
  start: number,
  text: string,
  onUnresolvedUser?: (id: string) => void,
): number {
  let cursor = start;
  const lines = text.split("\n");
  lines.forEach((raw, i) => {
    const { content, format } = pastedLine(raw);
    if (format && quill.getLine(cursor)[1] > 0) {
      quill.insertText(cursor, "\n");
      cursor += 1;
    }
    const lineStart = cursor;
    cursor = insertMrkdwnAt(quill, cursor, content, onUnresolvedUser);
    if (format || i < lines.length - 1) {
      quill.insertText(cursor, "\n");
      cursor += 1;
    }
    if (format) quill.formatLine(lineStart, 1, format.name, format.value);
  });
  return cursor;
}

export function pasteMrkdwnClipboard(
  quill: Quill,
  event: ClipboardEvent,
  onUnresolvedUser?: (id: string) => void,
): boolean {
  const text = event.clipboardData?.getData(MRKDWN_CLIPBOARD_TYPE);
  if (!text) return pasteCleanedUrl(quill, event);
  const selection = quill.getSelection(true) ?? { index: quill.getLength(), length: 0 };
  if (selection.length) quill.deleteText(selection.index, selection.length);
  const cursor = insertPastedLines(quill, selection.index, text, onUnresolvedUser);
  quill.setSelection(cursor, 0);
  return true;
}

export function insertSuggestionAt(
  quill: Quill,
  start: number,
  deleteCount: number,
  item: SuggestItem,
  kind: SuggestState["kind"],
): number {
  if (item.kind === "template") {
    return insertRichTextAt(quill, start, deleteCount, item.blocks);
  }
  quill.deleteText(start, deleteCount);
  if (
    item.kind === "channel" ||
    item.kind === "special" ||
    item.kind === "usergroup" ||
    item.kind === "user"
  ) {
    const embedKind = item.kind === "user" && kind === "userlink" ? "userlink" : item.kind;
    quill.insertEmbed(start, "mention", { id: item.id, kind: embedKind, name: item.name });
    quill.insertText(start + 1, " ");
    return start + 2;
  }
  if (item.kind === "emoji") {
    quill.insertEmbed(start, "emoji", { name: item.name });
    quill.insertText(start + 1, " ");
    return start + 2;
  }
  const text = suggestionText(item);
  quill.insertText(start, text);
  return start + text.length;
}
