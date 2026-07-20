// biome-ignore-all lint/performance/useTopLevelRegex: These expressions are local to serialization.
import { DEFAULT_DATE_FORMAT, formatSlackDateTokens } from "@slock/blockkit";
import { type Block, getCachedWorkspaceDomain, userProfileUrl } from "@slock/slack-api";
import { serializeLinkElement } from "./linkChip";
import { type InlineDialect, MRKDWN_DIALECT } from "./richtext";
export const HEADING_TAG_RE = /^H[1-6]$/;
function wrapNonEmpty(inner: string, marker: string): string {
  return inner ? `${marker}${inner}${marker}` : "";
}
function serializeChildren(node: Node, dialect: InlineDialect): string {
  let out = "";
  for (const child of Array.from(node.childNodes)) out += serializeNode(child, dialect);
  return out;
}
function serializeNode(node: Node, dialect: InlineDialect): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/​/g, "").replace(/ /g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  if (el.dataset.mentionId) return `<@${el.dataset.mentionId}>`;
  if (el.dataset.userLinkId) {
    const domain = getCachedWorkspaceDomain();
    const label = (el.textContent ?? `@${el.dataset.userLinkId}`).replace(/\|/g, "");
    if (!domain) return label;
    return `<${userProfileUrl(domain, el.dataset.userLinkId)}|${label}>`;
  }
  if (el.dataset.channelId) return `<#${el.dataset.channelId}|${el.dataset.channelName}>`;
  if (el.dataset.linkUrl) return serializeLinkElement(el);
  if (el.dataset.emojiName) return `:${el.dataset.emojiName}:`;
  if (el.dataset.dateTs) {
    const timestamp = Number(el.dataset.dateTs);
    const format = el.dataset.dateFormat || DEFAULT_DATE_FORMAT;
    const fallback = el.dataset.dateFallback || formatSlackDateTokens(format, timestamp);
    return `<!date^${el.dataset.dateTs}^${format}|${fallback}>`;
  }
  if (HEADING_TAG_RE.test(el.tagName)) {
    const level = Number(el.tagName[1]);
    const inner = serializeChildren(el, dialect).replace(/\n$/, "");
    return inner.trim() ? `${"#".repeat(level)} ${inner}\n` : "";
  }
  switch (el.tagName) {
    case "BR":
      return "\n";
    case "DIV":
    case "P":
      return `${serializeChildren(el, dialect)}\n`;
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
      return `\`\`\`\n${serializeChildren(el, dialect).replace(/\n$/, "")}\n\`\`\``;
    case "BLOCKQUOTE":
      return serializeChildren(el, dialect)
        .replace(/\n$/, "")
        .split("\n")
        .map((l) => `${dialect.quotePrefix} ${l}`)
        .join("\n");
    case "UL":
      return Array.from(el.children)
        .map((li) => `• ${serializeChildren(li, dialect).replace(/\n$/, "")}`)
        .join("\n");
    case "OL":
      return Array.from(el.children)
        .map((li, i) => `${i + 1}. ${serializeChildren(li, dialect).replace(/\n$/, "")}`)
        .join("\n");
    default:
      return serializeChildren(el, dialect);
  }
}
export function fragmentToMrkdwn(
  root: HTMLElement,
  dialect: InlineDialect = MRKDWN_DIALECT,
): string {
  return serializeChildren(root, dialect).replace(/\n+$/, "");
}
export function fragmentToBlocks(root: HTMLElement): Block[] | null {
  if (
    !root.querySelector(
      ":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > hr",
    )
  )
    return null;
  const blocks: Block[] = [];
  let run = "";
  const flush = () => {
    const text = run.trim();
    if (text) blocks.push({ text: { text, type: "mrkdwn" }, type: "section" });
    run = "";
  };
  for (const child of Array.from(root.childNodes)) {
    if (HEADING_TAG_RE.test(child.nodeName)) {
      flush();
      const text = (child.textContent ?? "").trim();
      if (text) blocks.push({ text: { emoji: true, text, type: "plain_text" }, type: "header" });
    } else if (child.nodeName === "HR") {
      flush();
      blocks.push({ type: "divider" });
    } else {
      run += serializeNode(child, MRKDWN_DIALECT);
    }
  }
  flush();
  return blocks;
}
