// biome-ignore-all lint/performance/useTopLevelRegex: These expressions are local to serialization.
import { formatSlackDate } from "@slock/blockkit";
import { type Block, getCachedWorkspaceDomain, userProfileUrl } from "@slock/slack-api";
import { serializeLinkElement } from "./linkChip";
export const HEADING_TAG_RE = /^H[1-6]$/;
const DEFAULT_DATE_FORMAT = "{date_short_pretty} at {time}";
function wrapNonEmpty(inner: string, marker: string): string {
  return inner ? `${marker}${inner}${marker}` : "";
}
function serializeChildren(node: Node): string {
  let out = "";
  for (const child of Array.from(node.childNodes)) out += serializeNode(child);
  return out;
}
function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\u200B/g, "").replace(/\u00A0/g, " ");
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
    const format = el.dataset.dateFormat || DEFAULT_DATE_FORMAT;
    const fallback = el.dataset.dateFallback || formatSlackDate(Number(el.dataset.dateTs));
    return `<!date^${el.dataset.dateTs}^${format}|${fallback}>`;
  }
  if (HEADING_TAG_RE.test(el.tagName)) {
    const level = Number(el.tagName[1]);
    const inner = serializeChildren(el).replace(/\n$/, "");
    return inner.trim() ? `${"#".repeat(level)} ${inner}\n` : "";
  }
  switch (el.tagName) {
    case "BR":
      return "\n";
    case "DIV":
    case "P":
      return `${serializeChildren(el)}\n`;
    case "B":
    case "STRONG":
      return wrapNonEmpty(serializeChildren(el), "*");
    case "I":
    case "EM":
      return wrapNonEmpty(serializeChildren(el), "_");
    case "S":
    case "STRIKE":
    case "DEL":
      return wrapNonEmpty(serializeChildren(el), "~");
    case "CODE":
      return wrapNonEmpty(serializeChildren(el), "`");
    case "HR":
      return "---\n";
    case "PRE":
      return `\`\`\`\n${serializeChildren(el).replace(/\n$/, "")}\n\`\`\``;
    case "BLOCKQUOTE":
      return serializeChildren(el)
        .replace(/\n$/, "")
        .split("\n")
        .map((l) => `&gt; ${l}`)
        .join("\n");
    case "UL":
      return Array.from(el.children)
        .map((li) => `• ${serializeChildren(li).replace(/\n$/, "")}`)
        .join("\n");
    case "OL":
      return Array.from(el.children)
        .map((li, i) => `${i + 1}. ${serializeChildren(li).replace(/\n$/, "")}`)
        .join("\n");
    default:
      return serializeChildren(el);
  }
}
export function fragmentToMrkdwn(root: HTMLElement): string {
  return serializeChildren(root).replace(/\n+$/, "");
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
      run += serializeNode(child);
    }
  }
  flush();
  return blocks;
}
