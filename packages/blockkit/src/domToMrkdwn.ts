import { getCachedWorkspaceDomain, userProfileUrl } from "@slock/types";
import { DEFAULT_DATE_FORMAT, formatSlackDate } from "./dateFormat";
import { type InlineDialect, MRKDWN_DIALECT } from "./inlineDialect";

export const HEADING_TAG_RE = /^H[1-6]$/;
const PIPE_RE = /\|/g;
const ZERO_WIDTH_SPACE_RE = /​/g;
const NBSP_RE = / /g;
const TRAILING_NEWLINE_RE = /\n$/;

function wrapNonEmpty(inner: string, marker: string): string {
  return inner ? `${marker}${inner}${marker}` : "";
}

function serializeLinkElement(el: HTMLElement): string {
  const url = el.dataset.linkUrl ?? "";
  const label = (el.textContent ?? "").replace(PIPE_RE, "");
  return label && label !== url ? `<${url}|${label}>` : `<${url}>`;
}

function serializeChildren(node: Node, dialect: InlineDialect): string {
  let out = "";
  const children = Array.from(node.childNodes);
  for (const [index, child] of children.entries()) {
    out += serializeNode(child, dialect);
    const next = children[index + 1];
    if (
      next?.nodeName !== "BR" &&
      child.nodeType === Node.ELEMENT_NODE &&
      ["BLOCKQUOTE", "OL", "PRE", "UL"].includes(child.nodeName)
    ) {
      out += "\n";
    }
  }
  return out;
}

export function serializeNode(node: Node, dialect: InlineDialect): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(ZERO_WIDTH_SPACE_RE, "").replace(NBSP_RE, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  if (el.dataset.mentionId) return `<@${el.dataset.mentionId}>`;
  if (el.dataset.userLinkId) {
    const domain = getCachedWorkspaceDomain();
    const label = (el.textContent ?? `@${el.dataset.userLinkId}`).replace(PIPE_RE, "");
    if (!domain) return label;
    return `<${userProfileUrl(domain, el.dataset.userLinkId)}|${label}>`;
  }
  if (el.dataset.channelId) return `<#${el.dataset.channelId}|${el.dataset.channelName}>`;

  if (el.dataset.dateTs) {
    const timestamp = Number(el.dataset.dateTs);
    const format = el.dataset.dateFormat || DEFAULT_DATE_FORMAT;
    const fallback = el.dataset.dateFallback || formatSlackDate(timestamp);
    return `<!date^${el.dataset.dateTs}^${format}|${fallback}>`;
  }
  if (el.dataset.linkUrl) return serializeLinkElement(el);
  if (el.dataset.emojiName) return `:${el.dataset.emojiName}:`;
  if (HEADING_TAG_RE.test(el.tagName)) {
    const level = Number(el.tagName[1]);
    const inner = serializeChildren(el, dialect).replace(TRAILING_NEWLINE_RE, "");
    return inner.trim() ? `${"#".repeat(level)} ${inner}\n` : "";
  }
  switch (el.tagName) {
    case "BR":
      return "\n";
    case "DIV":
    case "P": {
      const inner = serializeChildren(el, dialect);
      if (!inner) return "";
      return inner.endsWith("\n") ? inner : `${inner}\n`;
    }
    case "B":
    case "STRONG":
      return wrapNonEmpty(serializeChildren(el, dialect), dialect.bold);
    case "I":
    case "EM":
      return wrapNonEmpty(serializeChildren(el, dialect), dialect.italic);
    case "S":
    case "STRIKE":
    case "DEL":
      return wrapNonEmpty(serializeChildren(el, dialect), dialect.strike);
    case "CODE":
      return wrapNonEmpty(serializeChildren(el, dialect), "`");
    case "HR":
      return "---\n";
    case "PRE":
      return `\`\`\`\n${serializeChildren(el, dialect).replace(TRAILING_NEWLINE_RE, "")}\n\`\`\``;
    case "BLOCKQUOTE":
      return serializeChildren(el, dialect)
        .replace(TRAILING_NEWLINE_RE, "")
        .split("\n")
        .map((l) => `${dialect.quotePrefix} ${l}`)
        .join("\n");
    case "UL":
      return Array.from(el.children)
        .map((li) => `• ${serializeChildren(li, dialect).replace(TRAILING_NEWLINE_RE, "")}`)
        .join("\n");
    case "OL":
      return Array.from(el.children)
        .map(
          (li, i) => `${i + 1}. ${serializeChildren(li, dialect).replace(TRAILING_NEWLINE_RE, "")}`,
        )
        .join("\n");
    default:
      return serializeChildren(el, dialect);
  }
}
const TRAILING_NEWLINES_RE = /\n+$/;

export function fragmentToMrkdwn(
  root: HTMLElement,
  dialect: InlineDialect = MRKDWN_DIALECT,
): string {
  return serializeChildren(root, dialect).replace(TRAILING_NEWLINES_RE, "");
}
