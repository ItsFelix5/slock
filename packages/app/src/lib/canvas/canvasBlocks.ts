import type { CanvasBlock, RawFile } from "@slock/types";
import type { CanvasEmbed, RawBlock } from "./canvasParse";

function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function embedToMrkdwn(embed: CanvasEmbed, filesById: Map<string, RawFile>): string {
  switch (embed.type) {
    case "emoji":
      return `:${embed.shortcode}:`;
    case "channel":
      return `<#${embed.channelId}>`;
    case "user":
      return `<@${embed.userId}>`;
    case "date": {
      const fallback = escapeMrkdwn(dateFormatter.format(new Date(embed.ms)));
      return `<!date^${Math.floor(embed.ms / 1000)}^{date_short_pretty}|${fallback}>`;
    }
    case "file": {
      const file = filesById.get(embed.fileId);
      if (!file?.permalink) return escapeMrkdwn(`[file ${embed.fileId}]`);
      const title = escapeMrkdwn(file.title?.trim() || file.name?.trim() || embed.fileId);
      return file.filetype === "quip"
        ? `<!canvas^${embed.fileId}|${title}>`
        : `<${escapeMrkdwn(file.permalink)}|${title}>`;
    }
    case "video":
      return "[video]";
    case "unknown":
      return "";
  }
}

const INLINE_MRKDWN: Record<string, string> = { b: "*", i: "_", s: "~", strong: "*" };
const HREF_ATTR_RE = /href=(?:"([^"]*)"|'([^']*)')/;
const ID_ATTR_RE = /\bid=(?:"([^"]*)"|'([^']*)')/;

export function toMrkdwn(
  raw: string,
  embedsById: Map<string, CanvasEmbed>,
  filesById: Map<string, RawFile>,
): string {
  const pseudoHtmlTagRe = /<(\/?)([a-zA-Z]+)([^>]*)>/g;
  let out = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let skipDepth = 0;
  let linkHref: string | null = null;
  let linkLabel = "";
  // biome-ignore lint/suspicious/noAssignInExpressions: regex exec loop
  while ((match = pseudoHtmlTagRe.exec(raw))) {
    const [full, closing, tag] = match;
    const textBefore = raw.slice(lastIndex, match.index);
    lastIndex = match.index + full.length;
    if (linkHref !== null) linkLabel += textBefore;
    else if (skipDepth === 0 && textBefore) out += escapeMrkdwn(textBefore);

    const lower = tag.toLowerCase();
    if (lower === "control") {
      if (closing) skipDepth = Math.max(0, skipDepth - 1);
      else {
        skipDepth++;
        const idMatch = match[3].match(ID_ATTR_RE);
        const id = idMatch?.[1] ?? idMatch?.[2] ?? "";
        const embed = embedsById.get(id);
        if (embed) out += embedToMrkdwn(embed, filesById);
      }
      continue;
    }
    if (skipDepth > 0) continue;
    if (lower === "annotation") continue;
    if (lower === "a") {
      if (closing) {
        out += linkHref ? `<${escapeMrkdwn(linkHref)}|${escapeMrkdwn(linkLabel)}>` : linkLabel;
        linkHref = null;
        linkLabel = "";
      } else {
        const hrefMatch = match[3].match(HREF_ATTR_RE);
        linkHref = hrefMatch?.[1] ?? hrefMatch?.[2] ?? "";
      }
      continue;
    }
    const wrap = INLINE_MRKDWN[lower];
    if (wrap) out += wrap;
  }
  const tail = raw.slice(lastIndex);
  if (linkHref !== null) linkLabel += tail;
  else if (skipDepth === 0) out += escapeMrkdwn(tail);
  return out;
}

export function toCanvasBlocks(
  blocks: RawBlock[],
  embedsById: Map<string, CanvasEmbed>,
  filesById: Map<string, RawFile>,
): CanvasBlock[] {
  const mrkdwn = (raw: string) => toMrkdwn(raw, embedsById, filesById);
  const result: CanvasBlock[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case "unsupported":
        break;
      case "callout":
      case "blockquote":
        result.push({ text: block.childTexts.map(mrkdwn).join("\n"), type: block.type });
        break;
      case "section":
        result.push({ columns: block.columns.map(mrkdwn), text: "", type: "section" });
        break;
      case "image":
        result.push({
          files: block.fileIds
            .map((fileId) => filesById.get(fileId))
            .filter((file): file is RawFile => file !== undefined),
          text: "",
          type: "image",
        });
        break;
      case "bulletList":
      case "orderedList":
      case "checklist":
        result.push({
          items: block.items.map((item) => ({
            checked: item.checked,
            indent: item.indent,
            text: mrkdwn(item.text),
          })),
          text: "",
          type: block.type,
        });
        break;
      case "table":
        result.push({
          colWidths: block.colWidths,
          rows: block.rows.map((row) => row.map(mrkdwn)),
          text: "",
          type: "table",
        });
        break;
      case "title":
        result.push({ text: mrkdwn(block.text), type: "title" });
        break;
      case "paragraph": {
        const text = mrkdwn(block.text);
        if (block.style === 4) result.push({ text, type: "code" });
        else if (block.style >= 1 && block.style <= 3)
          result.push({ level: block.style, text, type: "heading" });
        else result.push({ text, type: "paragraph" });
        break;
      }
    }
  }
  return result;
}
