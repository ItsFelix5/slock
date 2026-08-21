import Quill from "quill";
import { channelDisplayName } from "../../../lib/displayName";
import { store } from "../../../lib/store";
import { dateMrkdwn, dateValue } from "./dateEmbed";
import { emojiValue, resolvedEmojiName } from "./emojiEmbed";
import { suggestionText } from "./suggestionController";
import type { SuggestItem, SuggestState } from "./suggestTypes";

interface MentionValue {
  kind: "user" | "channel";
  id: string;
  name: string;
}

function mentionValue(value: unknown): MentionValue | undefined {
  if (!value || typeof value !== "object") return;
  const { kind, id, name } = value as Record<string, unknown>;
  return (kind === "user" || kind === "channel") &&
    typeof id === "string" &&
    typeof name === "string"
    ? { id, kind, name }
    : undefined;
}

const Embed = Quill.import("blots/embed") as typeof import("quill/blots/embed").default;

class MentionBlot extends Embed {
  static blotName = "mention";
  static tagName = "span";

  static create(value: MentionValue) {
    const node = super.create(value) as HTMLElement;
    node.className = "bk-mention";
    node.dataset.kind = value.kind;
    node.dataset.id = value.id;
    node.dataset.name = value.name;
    node.textContent = `${value.kind === "user" ? "@" : "#"}${value.name}`;
    return node;
  }

  static value(node: HTMLElement): MentionValue | undefined {
    const { kind, id, name } = node.dataset;
    return kind === "user" || kind === "channel"
      ? { id: id ?? "", kind, name: name ?? "" }
      : undefined;
  }
}

Quill.register(MentionBlot);

export function indexAlignedText(quill: Quill): string {
  return quill
    .getContents()
    .ops.map((op) => (typeof op.insert === "string" ? op.insert : "\uFFFC"))
    .join("");
}

function embedText(insert: Record<string, unknown>): string {
  const mention = mentionValue(insert.mention);
  if (mention)
    return mention.kind === "user" ? `<@${mention.id}>` : `<#${mention.id}|${mention.name}>`;
  const emojiName = emojiValue(insert.emoji);
  if (emojiName) return `:${emojiName}:`;
  const date = dateValue(insert.date);
  if (date) return dateMrkdwn(date);
  if (insert.divider) return "---";
  return "";
}

interface DeltaSegment {
  text: string;
  attributes: Record<string, unknown> | undefined;
}

interface DeltaLine {
  segments: DeltaSegment[];
  blockAttributes: Record<string, unknown> | undefined;
}

const INLINE_WRAPS: [key: string, delimiter: string][] = [
  ["bold", "*"],
  ["italic", "_"],
  ["strike", "~"],
  ["code", "`"],
];

function sameInlineAttrs(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
) {
  for (const [key] of INLINE_WRAPS) if (!!a?.[key] !== !!b?.[key]) return false;
  return true;
}

function pushSegment(
  segments: DeltaSegment[],
  text: string,
  attributes: Record<string, unknown> | undefined,
) {
  if (!text) return;
  const prev = segments[segments.length - 1];
  if (prev && sameInlineAttrs(prev.attributes, attributes)) prev.text += text;
  else segments.push({ attributes, text });
}

function deltaLines(quill: Quill): DeltaLine[] {
  const lines: DeltaLine[] = [];
  let segments: DeltaSegment[] = [];
  for (const op of quill.getContents().ops) {
    if (typeof op.insert === "string") {
      const parts = op.insert.split("\n");
      parts.forEach((part, i) => {
        pushSegment(segments, part, op.attributes);
        if (i < parts.length - 1) {
          lines.push({ blockAttributes: op.attributes, segments });
          segments = [];
        }
      });
    } else if (op.insert) {
      pushSegment(segments, embedText(op.insert), undefined);
    }
  }
  if (segments.length) lines.push({ blockAttributes: undefined, segments });
  return lines;
}

function rawLineText(line: DeltaLine): string {
  return line.segments.map((s) => s.text).join("");
}

function inlineFormattedLineText(line: DeltaLine): string {
  return line.segments
    .map((segment) => {
      let text = segment.text;
      for (const [key, delimiter] of INLINE_WRAPS) {
        if (segment.attributes?.[key]) text = `${delimiter}${text}${delimiter}`;
      }
      return text;
    })
    .join("");
}

export function mrkdwnText(quill: Quill): string {
  const out: string[] = [];
  let listType: unknown;
  let listCounter = 0;
  let codeBlock: string[] | null = null;
  const flushCodeBlock = () => {
    if (codeBlock) out.push(`\`\`\`${codeBlock.join("\n")}\`\`\``);
    codeBlock = null;
  };

  for (const line of deltaLines(quill)) {
    const attrs = line.blockAttributes;
    if (attrs?.["code-block"]) {
      codeBlock ??= [];
      codeBlock.push(rawLineText(line));
      listType = undefined;
      continue;
    }
    flushCodeBlock();

    const text = inlineFormattedLineText(line);
    if (attrs?.list === "bullet" || attrs?.list === "ordered") {
      listCounter = attrs.list === listType ? listCounter + 1 : 1;
      listType = attrs.list;
      out.push(`${attrs.list === "ordered" ? `${listCounter}.` : "\u2022"} ${text}`);
      continue;
    }
    listType = undefined;

    if (attrs?.header) out.push(text ? `*${text}*` : text);
    else if (attrs?.blockquote) out.push(`> ${text}`);
    else out.push(text);
  }
  flushCodeBlock();
  return out.join("\n");
}

const MENTION_TOKEN_RE =
  /<@([A-Z0-9]+)>|<#([A-Z0-9]+)(?:\|([^>]*))?>|:([a-zA-Z0-9_+'-]+):|<!date\^(\d+)\^([^|^>]+)\|([^>]*)>/g;

export function loadMrkdwnIntoQuill(quill: Quill, text: string): void {
  quill.setText("\n");
  if (!text) return;
  let cursor = 0;
  let lastIndex = 0;
  const insertPlain = (segment: string) => {
    if (!segment) return;
    quill.insertText(cursor, segment);
    cursor += segment.length;
  };
  for (const match of text.matchAll(MENTION_TOKEN_RE)) {
    const [whole, userId, channelId, channelLabel, emojiName, dateTs, dateFormat, dateFallback] =
      match;
    const index = match.index ?? 0;
    insertPlain(text.slice(lastIndex, index));
    if (userId) {
      const name = store.users.userById(userId)?.name ?? userId;
      quill.insertEmbed(cursor, "mention", { id: userId, kind: "user", name });
      cursor += 1;
    } else if (channelId) {
      const name =
        channelLabel || channelDisplayName(store.channels.channelById(channelId), channelId);
      quill.insertEmbed(cursor, "mention", { id: channelId, kind: "channel", name });
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
    } else {
      insertPlain(whole);
    }
    lastIndex = index + whole.length;
  }
  insertPlain(text.slice(lastIndex));
}

export function insertSuggestionAt(
  quill: Quill,
  start: number,
  deleteCount: number,
  item: SuggestItem,
  kind: SuggestState["kind"],
): number {
  quill.deleteText(start, deleteCount);
  if ((item.kind === "user" && kind !== "userlink") || item.kind === "channel") {
    quill.insertEmbed(start, "mention", { id: item.id, kind: item.kind, name: item.name });
    quill.insertText(start + 1, " ");
    return start + 2;
  }
  if (item.kind === "emoji") {
    quill.insertEmbed(start, "emoji", { name: item.name });
    quill.insertText(start + 1, " ");
    return start + 2;
  }
  const text = suggestionText(item, kind);
  quill.insertText(start, text);
  return start + text.length;
}
