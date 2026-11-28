import { defined } from "@slock/core";
import { encodeTextEntities } from "@slock/slack";
import { wrapDelimited } from "@slock/ui";
import { INLINE_STYLE_FORMATS } from "@slock/ui/editor/inlineFormats";
import { INLINE_MARKS } from "@slock/ui/editor/markdownAutoformat";
import { describeEmbed, type EmbedInsert, embedText } from "./embedValues";

export interface DeltaOp {
  insert?: string | Record<string, unknown>;
  attributes?: Record<string, unknown>;
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
  for (const key of INLINE_STYLE_FORMATS) if (!!a?.[key] !== !!b?.[key]) return false;
  return a?.link === b?.link && a?.tag === b?.tag;
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

function isTrailingBlankLine(line: DeltaLine): boolean {
  return line.segments.length === 0 && !line.blockAttributes;
}

export function deltaLines(ops: readonly DeltaOp[]): DeltaLine[] {
  const lines: DeltaLine[] = [];
  let segments: DeltaSegment[] = [];
  for (const op of ops) {
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
  while (lines.length && isTrailingBlankLine(defined(lines[lines.length - 1]))) lines.pop();
  return lines;
}

function rawLineText(line: DeltaLine): string {
  return line.segments.map((s) => (s.embed ? s.text : encodeTextEntities(s.text))).join("");
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

export function mrkdwnText(ops: readonly DeltaOp[]): string {
  const out: string[] = [];
  let listType: unknown;
  let listCounter = 0;
  let codeBlock: string[] | null = null;
  const flushCodeBlock = () => {
    const code = codeBlock?.join("\n");
    if (code?.trim()) out.push(`\`\`\`${code}\`\`\``);
    codeBlock = null;
  };

  for (const line of deltaLines(ops)) {
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
      listCounter = attrs.list === listType ? listCounter + 1 : Number(attrs.listOffset ?? 0) + 1;
      listType = attrs.list;
      out.push(`${attrs.list === "ordered" ? `${listCounter}.` : "•"} ${text}`);
      continue;
    }
    listType = undefined;

    if (attrs?.blockquote) out.push(`> ${text}`);
    else out.push(text);
  }
  flushCodeBlock();
  const joined = out.join("\n");
  return joined.endsWith("\n") ? joined.slice(0, -1) : joined;
}
