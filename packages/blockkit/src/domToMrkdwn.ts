// biome-ignore-all lint/performance/useTopLevelRegex: These expressions are local to serialization.
import { getCachedWorkspaceDomain, userProfileUrl } from "@slock/slack-api";
import { DEFAULT_DATE_FORMAT, formatSlackDate } from "./dateFormat";
import { type InlineDialect, MRKDWN_DIALECT } from "./inlineDialect";

export const HEADING_TAG_RE = /^H[1-6]$/;

function wrapNonEmpty(inner: string, marker: string): string {
  return inner ? `${marker}${inner}${marker}` : "";
}

// A link is a chip carrying its real destination in `data-link-url` (both
// the composer's editable link chips and blockkit's rendered <a> tags use
// this attribute) — the visible label only differs from the url when it was
// customized, so a plain autolinked/unlabeled url round-trips as `<url>`
// rather than the noisier `<url|url>`.
function serializeLinkElement(el: HTMLElement): string {
  const url = el.dataset.linkUrl ?? "";
  const label = (el.textContent ?? "").replace(/\|/g, "");
  return label && label !== url ? `<${url}|${label}>` : `<${url}>`;
}

function serializeChildren(node: Node, dialect: InlineDialect): string {
  let out = "";
  for (const child of Array.from(node.childNodes)) out += serializeNode(child, dialect);
  return out;
}
// Exported (not just fragmentToMrkdwn) so callers that need to build up
// their own runs node-by-node — see the composer's fragmentToBlocks, which
// interleaves this with header/divider block boundaries — don't have to
// reimplement inline serialization themselves.
export function serializeNode(node: Node, dialect: InlineDialect): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/​/g, "").replace(/ /g, " ");
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
  // Checked ahead of dataset.linkUrl: a date chip with a url (e.g. a linked
  // deadline) carries both attributes, and losing the timestamp/format down
  // to a plain link would mean it no longer reconstructs as a live date chip
  // on paste.
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
    const inner = serializeChildren(el, dialect).replace(/\n$/, "");
    return inner.trim() ? `${"#".repeat(level)} ${inner}\n` : "";
  }
  switch (el.tagName) {
    case "BR":
      return "\n";
    case "DIV":
    case "P": {
      // Layout wrappers (e.g. a copied selection spanning several message
      // rows clones many nested non-content divs) shouldn't each add their
      // own line break on top of one their content already ended with —
      // that's what turns a multi-message copy into a wall of blank lines.
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
