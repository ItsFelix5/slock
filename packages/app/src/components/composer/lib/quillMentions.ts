import {
  encodeTextEntities,
  messageLinkLabel,
  parseArchiveLink,
  parseUserProfileLink,
} from "@slock/blockkit";
import { getCachedWorkspaceDomain, userProfileUrl } from "@slock/types";
import { INLINE_MARKS } from "@slock/ui/editor/markdownAutoformat";
import { getEmbedBlot } from "@slock/ui/editor/quillText";
import Quill from "quill";
import { channelDisplayName } from "../../../lib/displayName";
import { store } from "../../../lib/store";
import { type DateValue, dateMrkdwn, dateValue } from "./dateEmbed";
import { emojiValue } from "./emojiEmbed";

export function stripLeadingAt(name: string): string {
  return name.startsWith("@") ? name.slice(1) : name;
}

export interface MentionValue {
  kind: "user" | "channel" | "special" | "usergroup" | "userlink" | "messagelink";
  id: string;
  name: string;
}

const MENTION_KINDS: MentionValue["kind"][] = [
  "user",
  "channel",
  "special",
  "usergroup",
  "userlink",
  "messagelink",
];

export function isMentionKind(kind: unknown): kind is MentionValue["kind"] {
  return MENTION_KINDS.some((candidate) => candidate === kind);
}

function mentionValue(value: unknown): MentionValue | undefined {
  if (!(value && typeof value === "object" && "kind" in value && "id" in value && "name" in value))
    return;
  const { kind, id, name } = value;
  return isMentionKind(kind) && typeof id === "string" && typeof name === "string"
    ? { id, kind, name }
    : undefined;
}

export const MENTION_PREFIX: Record<MentionValue["kind"], string> = {
  channel: "#",
  special: "@",
  user: "@",
  usergroup: "@",
  userlink: "@",
  messagelink: "",
};

class MentionBlot extends getEmbedBlot() {
  static blotName = "mention";
  static className = "bk-mention";
  static tagName = "span";

  static create(value: MentionValue) {
    // biome-ignore lint/complexity/noThisInStatic: parent embed class is resolved at runtime
    const node = super.create(value);
    if (!(node instanceof HTMLElement)) throw new Error("mention blot produced a non-element node");
    const isSelf =
      (value.kind === "user" && value.id === store.users.currentUser()?.id) ||
      (value.kind === "usergroup" && store.usergroups.isSelfMember(value.id));
    node.className =
      value.kind === "special"
        ? "bk-mention bk-mention-broadcast"
        : value.kind === "userlink" || value.kind === "messagelink"
          ? "bk-mention bk-mention-link"
          : isSelf
            ? "bk-mention bk-mention-self"
            : "bk-mention";
    node.dataset.kind = value.kind;
    node.dataset.id = value.id;
    node.dataset.name = value.name;
    node.textContent = `${MENTION_PREFIX[value.kind]}${value.name}`;
    return node;
  }

  static value(node: HTMLElement): MentionValue | undefined {
    const { kind, id, name } = node.dataset;
    return isMentionKind(kind) ? { id: id ?? "", kind, name: name ?? "" } : undefined;
  }
}

Quill.register(MentionBlot);

export function linkMentionValue(
  url: string,
  label: string,
  authorId?: string,
): MentionValue | undefined {
  const userId = parseUserProfileLink(url);
  if (userId) return { id: userId, kind: "userlink", name: label };
  const archive = parseArchiveLink(url);
  if (!archive) return;
  const channelName = channelDisplayName(
    store.channels.channelById(archive.channelId),
    archive.channelId,
  );
  if (!archive.isMessage) return { id: archive.channelId, kind: "channel", name: channelName };
  if (label !== url) return;
  const authorName = authorId ? store.users.userById(authorId)?.name : undefined;
  return { id: url, kind: "messagelink", name: messageLinkLabel(channelName, authorName) };
}

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
    if (embed.mention.kind === "userlink") {
      const url = userProfileUrl(getCachedWorkspaceDomain() ?? "", embed.mention.id);
      return `<${url}|${embed.mention.name}>`;
    }
    if (embed.mention.kind === "messagelink") return `<${embed.mention.id}>`;
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
  while (lines.length && isTrailingBlankLine(lines[lines.length - 1])) lines.pop();
  return lines;
}

function isTrailingBlankLine(line: DeltaLine): boolean {
  return line.segments.length === 0 && !line.blockAttributes;
}

export function rawLineText(line: DeltaLine): string {
  return line.segments.map((s) => (s.embed ? s.text : encodeTextEntities(s.text))).join("");
}

function wrapDelimited(text: string, delimiter: string): string {
  const core = text.trim();
  if (!core) return text;
  const lead = text.slice(0, text.length - text.trimStart().length);
  const trail = text.slice(lead.length + core.length);
  return `${lead}${delimiter}${core}${delimiter}${trail}`;
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
    const code = codeBlock?.join("\n");
    if (code?.trim()) out.push(`\`\`\`${code}\`\`\``);
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
  const joined = out.join("\n");
  return joined.endsWith("\n") ? joined.slice(0, -1) : joined;
}
