import { BLOCKS_CLIPBOARD_TYPE, stripTrackingParams } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { decodeTextEntities } from "@slock/slack";
import type { Block } from "@slock/types";
import { escapeRegExp } from "@slock/ui";
import { INLINE_MARKS } from "@slock/ui/editor/markdownAutoformat";
import type Quill from "@slock/ui/editor/quill";
import { resolvedEmojiName } from "../../../../emoji/client/api/resolvedEmojiName";
import { linkMentionValue, stripLeadingAt } from "../../lib/quillMentions";
import { insertRichTextAt } from "../../lib/richTextLoad";
import { suggestionText } from "./suggestionController";
import type { SuggestItem, SuggestState } from "./suggestTypes";

const titles = service("titles");
const usersStore = service("users");

const usergroups = service("usergroups");

const MENTION_TOKEN_RE =
  /<@([A-Z0-9]+)>|<#([A-Z0-9]+)(?:\|([^>]*))?>|<!(channel|here)>|<!subteam\^([A-Z0-9]+)(?:\|([^>]*))?>|:([a-zA-Z0-9_+'-]+):|<!date\^(\d+)\^([^|^>]+)\|([^>]*)>|<([^<>@#!][^<>]*)>/g;

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
      const user = usersStore.userById(userId);
      if (!user) onUnresolvedUser?.(userId);
      quill.insertEmbed(cursor, "mention", {
        id: userId,
        kind: "user",
        name: user?.name ?? userId,
      });
      cursor += 1;
    } else if (channelId) {
      const name = channelLabel || titles.title(channelId);
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
        usergroupLabel || usergroups.usergroupById(usergroupId)?.name || "",
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

function pasteUrl(quill: Quill, event: ClipboardEvent): boolean {
  const pasted = event.clipboardData?.getData("text/plain").trim() ?? "";
  if (!BARE_URL_RE.test(pasted)) return false;
  const cleaned = stripTrackingParams(pasted);
  const selection = quill.getSelection(true) ?? { index: quill.getLength(), length: 0 };
  const mention = selection.length ? undefined : linkMentionValue(cleaned, cleaned);
  if (mention) {
    quill.insertEmbed(selection.index, "mention", mention, "user");
    quill.setSelection(selection.index + 1, 0);
    return true;
  }
  if (cleaned === pasted) return false;
  if (selection.length) {
    quill.formatText(selection.index, selection.length, "link", cleaned, "user");
    quill.setSelection(selection.index + selection.length, 0, "silent");
    return true;
  }
  quill.insertText(selection.index, cleaned, "user");
  quill.setSelection(selection.index + cleaned.length, 0);
  return true;
}

export function pasteBlocksClipboard(
  quill: Quill,
  event: ClipboardEvent,
  onUnresolvedUser?: (id: string) => void,
): boolean {
  const json = event.clipboardData?.getData(BLOCKS_CLIPBOARD_TYPE);
  if (!json) return pasteUrl(quill, event);
  const blocks: Block[] = JSON.parse(json);
  const selection = quill.getSelection(true) ?? { index: quill.getLength(), length: 0 };
  insertRichTextAt(quill, selection.index, selection.length, blocks, onUnresolvedUser, true);
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
