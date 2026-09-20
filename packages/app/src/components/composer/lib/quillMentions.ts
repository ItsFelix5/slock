import { decodeTextEntities, encodeTextEntities } from "@slock/blockkit";
import { getCachedWorkspaceDomain, userProfileUrl } from "@slock/types";
import { getEmbedBlot, INLINE_MARKS } from "@slock/ui";
import Quill from "quill";
import { channelDisplayName } from "../../../lib/displayName";
import { store } from "../../../lib/store";
import { type DateValue, dateMrkdwn, dateValue } from "./dateEmbed";
import { emojiValue, resolvedEmojiName } from "./emojiEmbed";
import { suggestionText } from "./suggestionController";
import type { SuggestItem, SuggestState } from "./suggestTypes";

const TRIM_RE = /^(\s*)([\s\S]*?)(\s*)$/;
const TRAILING_NEWLINE_RE = /\n$/;
const LEADING_AT_RE = /^@/;

export interface MentionValue {
  kind: "user" | "channel" | "special" | "usergroup";
  id: string;
  name: string;
}

const MENTION_KINDS: MentionValue["kind"][] = ["user", "channel", "special", "usergroup"];

function mentionValue(value: unknown): MentionValue | undefined {
  if (!(value && typeof value === "object" && "kind" in value && "id" in value && "name" in value))
    return;
  const { kind, id, name } = value;
  return MENTION_KINDS.includes(kind as MentionValue["kind"]) &&
    typeof id === "string" &&
    typeof name === "string"
    ? { id, kind: kind as MentionValue["kind"], name }
    : undefined;
}

export const MENTION_PREFIX: Record<MentionValue["kind"], string> = {
  channel: "#",
  special: "@",
  user: "@",
  usergroup: "@",
};

class MentionBlot extends getEmbedBlot() {
  static blotName = "mention";
  static tagName = "span";

  static create(value: MentionValue) {
    const node = super.create(value);
    if (!(node instanceof HTMLElement)) throw new Error("mention blot produced a non-element node");
    node.className = value.kind === "special" ? "bk-mention bk-mention-broadcast" : "bk-mention";
    node.dataset.kind = value.kind;
    node.dataset.id = value.id;
    node.dataset.name = value.name;
    node.textContent = `${MENTION_PREFIX[value.kind]}${value.name}`;
    return node;
  }

  static value(node: HTMLElement): MentionValue | undefined {
    const { kind, id, name } = node.dataset;
    return kind && MENTION_KINDS.includes(kind as MentionValue["kind"])
      ? { id: id ?? "", kind: kind as MentionValue["kind"], name: name ?? "" }
      : undefined;
  }
}

Quill.register(MentionBlot);

export interface EmbedInsert {
  mention?: MentionValue;
  emoji?: string;
  date?: DateValue;
  divider?: boolean;
}

function describeEmbed(insert: Record<string, unknown>): EmbedInsert | undefined {
  const mention = mentionValue(insert.mention);
  if (mention) return { mention };
  const emoji = emojiValue(insert.emoji);
  if (emoji) return { emoji };
  const date = dateValue(insert.date);
  if (date) return { date };
  if (insert.divider) return { divider: true };
}

function embedText(embed: EmbedInsert): string {
  if (embed.mention) {
    if (embed.mention.kind === "user") return `<@${embed.mention.id}>`;
    if (embed.mention.kind === "special") return `<!${embed.mention.id}>`;
    if (embed.mention.kind === "usergroup") return `<!subteam^${embed.mention.id}>`;
    return `<#${embed.mention.id}|${embed.mention.name}>`;
  }
  if (embed.emoji) return `:${embed.emoji}:`;
  if (embed.date) return dateMrkdwn(embed.date);
  if (embed.divider) return "---";
  return "";
}

export interface DeltaSegment {
  text: string;
  attributes: Record<string, unknown> | undefined;
  embed?: EmbedInsert;
}

export interface DeltaLine {
  segments: DeltaSegment[];
  blockAttributes: Record<string, unknown> | undefined;
}

function sameInlineAttrs(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
) {
  for (const [, key] of INLINE_MARKS) if (!!a?.[key] !== !!b?.[key]) return false;
  return a?.link === b?.link;
}

function pushSegment(
  segments: DeltaSegment[],
  text: string,
  attributes: Record<string, unknown> | undefined,
  embed?: EmbedInsert,
) {
  if (!text) return;
  const prev = segments[segments.length - 1];
  if (!embed && prev && !prev.embed && sameInlineAttrs(prev.attributes, attributes)) {
    prev.text += text;
  } else {
    segments.push({ attributes, embed, text });
  }
}

export function deltaLines(quill: Quill): DeltaLine[] {
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
      const embed = describeEmbed(op.insert);
      if (embed) pushSegment(segments, embedText(embed), undefined, embed);
    }
  }
  if (segments.length) lines.push({ blockAttributes: undefined, segments });
  return lines;
}

export function rawLineText(line: DeltaLine): string {
  return line.segments.map((s) => (s.embed ? s.text : encodeTextEntities(s.text))).join("");
}

function wrapDelimited(text: string, delimiter: string): string {
  const match = text.match(TRIM_RE);
  if (!match) return text;
  const [, lead, core, trail] = match;
  return core ? `${lead}${delimiter}${core}${delimiter}${trail}` : text;
}

function inlineFormattedLineText(line: DeltaLine): string {
  return line.segments
    .map((segment) => {
      let text = segment.embed ? segment.text : encodeTextEntities(segment.text);
      for (const [delimiter, key] of INLINE_MARKS) {
        if (segment.attributes?.[key]) text = wrapDelimited(text, delimiter);
      }
      const link = segment.attributes?.link;
      if (typeof link === "string" && text) text = `<${encodeTextEntities(link)}|${text}>`;
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
  return out.join("\n").replace(TRAILING_NEWLINE_RE, "");
}

const MENTION_TOKEN_RE =
  /<@([A-Z0-9]+)>|<#([A-Z0-9]+)(?:\|([^>]*))?>|<!(channel|here)>|<!subteam\^([A-Z0-9]+)(?:\|([^>]*))?>|:([a-zA-Z0-9_+'-]+):|<!date\^(\d+)\^([^|^>]+)\|([^>]*)>|<([^<>@#!][^<>]*)>/g;

export function loadMrkdwnIntoQuill(quill: Quill, text: string): void {
  quill.setText("\n");
  if (!text) return;
  let cursor = 0;
  let lastIndex = 0;
  const insertPlain = (segment: string) => {
    if (!segment) return;
    const decoded = decodeTextEntities(segment);
    quill.insertText(cursor, decoded);
    cursor += decoded.length;
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
      const name = store.users.userById(userId)?.name ?? userId;
      quill.insertEmbed(cursor, "mention", { id: userId, kind: "user", name });
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
      const name = (
        usergroupLabel ||
        store.usergroups.usergroupById(usergroupId)?.name ||
        ""
      ).replace(LEADING_AT_RE, "");
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
      quill.insertText(cursor, label, { link: url });
      cursor += label.length;
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
  if (item.kind === "user" && kind === "userlink") {
    const url = userProfileUrl(getCachedWorkspaceDomain() ?? "", item.id);
    quill.insertText(start, item.name, { link: url });
    quill.insertText(start + item.name.length, " ");
    return start + item.name.length + 2;
  }
  if (
    (item.kind === "user" && kind !== "userlink") ||
    item.kind === "channel" ||
    item.kind === "special" ||
    item.kind === "usergroup"
  ) {
    quill.insertEmbed(start, "mention", { id: item.id, kind: item.kind, name: item.name });
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
