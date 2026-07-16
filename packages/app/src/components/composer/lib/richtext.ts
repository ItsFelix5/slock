// biome-ignore-all lint/performance/useTopLevelRegex: These expressions are local to rich-text transformations.
import {
  DEFAULT_DATE_FORMAT,
  emojiUrl,
  formatSlackDateTokens,
  parseUserProfileLink,
} from "@slock/blockkit";
import { standardEmojiUnicode } from "../../../lib/emojiSearch";
import { channelDisplayName, store } from "../../../lib/store";
import { createLinkChip, createLinkSpan } from "./linkChip";
import { HEADING_TAG_RE } from "./richtextSerialization";

const INLINE_RE = /`([^`]+)`|<([^<>]*)>|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~|:([a-zA-Z0-9_+-]+):/g;
const QUOTE_LINE_RE = /^&gt;\s?/;
const HEADER_LINE_RE = /^(#{1,6}) (.*)$/;
const CODE_FENCE_RE = /```([\s\S]*?)```/g;
export function createHeaderElement(level = 3): HTMLHeadingElement {
  const h = document.createElement(`h${Math.min(6, Math.max(1, level))}`) as HTMLHeadingElement;
  h.className = "composer-header";
  return h;
}
export function createDividerElement(): HTMLHRElement {
  const hr = document.createElement("hr");
  hr.className = "composer-divider";
  return hr;
}
function unescapeEntities(text: string): string {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
function appendText(parent: Node, text: string) {
  if (!text) return;
  parent.appendChild(document.createTextNode(text));
}
export function createMentionChip(id: string, label: string): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className = "composer-chip";
  chip.contentEditable = "false";
  chip.dataset.mentionId = id;
  chip.textContent = `@${label}`;
  return chip;
}
export function createUserLinkChip(id: string, label: string): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className = "composer-chip composer-chip-link";
  chip.contentEditable = "false";
  chip.dataset.userLinkId = id;
  chip.textContent = `@${label}`;
  return chip;
}
export function createChannelChip(id: string, name: string): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className = "composer-chip";
  chip.contentEditable = "false";
  chip.dataset.channelId = id;
  chip.dataset.channelName = name;
  chip.textContent = `#${name}`;
  return chip;
}
export function createDateChip(
  timestamp: number,
  format = DEFAULT_DATE_FORMAT,
  fallback?: string,
): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className = "composer-chip composer-date-chip";
  chip.contentEditable = "false";
  chip.dataset.dateTs = String(timestamp);
  chip.dataset.dateFormat = format;
  const rendered = formatSlackDateTokens(format, timestamp, fallback);
  chip.dataset.dateFallback = fallback ?? rendered;
  chip.textContent = rendered;
  return chip;
}
export function createEmojiChip(name: string): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className = "composer-chip composer-emoji-chip";
  chip.contentEditable = "false";
  chip.dataset.emojiName = name;
  const img = document.createElement("img");
  img.src = emojiUrl(name) ?? "";
  img.alt = `:${name}:`;
  img.title = `:${name}:`;
  chip.appendChild(img);
  return chip;
}
function appendEmojiToken(parent: Node, name: string) {
  if (emojiUrl(name)) {
    parent.appendChild(createEmojiChip(name));
    return;
  }
  appendText(parent, standardEmojiUnicode(name) ?? `:${name}:`);
}
function appendToken(parent: Node, token: string) {
  if (token.startsWith("@")) {
    const [id] = token.slice(1).split("|");
    parent.appendChild(createMentionChip(id, store.users.userById(id)?.name ?? id));
    return;
  }
  if (token.startsWith("#")) {
    const [id, label] = token.slice(1).split("|");
    parent.appendChild(
      createChannelChip(id, label ?? channelDisplayName(store.channels.channelById(id), id)),
    );
    return;
  }
  if (token.startsWith("!date^")) {
    const [main, fallback] = token.slice("!date^".length).split("|");
    const [ts, format] = main.split("^");
    const timestamp = Number(ts);
    if (Number.isFinite(timestamp)) {
      parent.appendChild(createDateChip(timestamp, format, fallback));
      return;
    }
  }
  if (!token.startsWith("!")) {
    const [url, label] = token.split("|");
    const userId = parseUserProfileLink(url);
    if (userId) {
      const name = store.users.userById(userId)?.name ?? label?.replace(/^@/, "") ?? userId;
      parent.appendChild(createUserLinkChip(userId, name));
      return;
    }
    if (/^https?:\/\//.test(url)) {
      parent.appendChild(label && label !== url ? createLinkChip(url, label) : createLinkSpan(url));
      return;
    }
  }
  appendText(parent, `<${token}>`);
}
function appendInline(parent: Node, text: string) {
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) appendText(parent, unescapeEntities(text.slice(lastIndex, index)));
    const [, code, token, bold, italic, strike, emojiName] = match;
    if (code !== undefined) {
      const el = document.createElement("code");
      appendText(el, unescapeEntities(code));
      parent.appendChild(el);
    } else if (token !== undefined) {
      appendToken(parent, token);
    } else if (emojiName !== undefined) {
      appendEmojiToken(parent, emojiName);
    } else if (bold !== undefined) {
      const el = document.createElement("strong");
      appendText(el, unescapeEntities(bold));
      parent.appendChild(el);
    } else if (italic !== undefined) {
      const el = document.createElement("em");
      appendText(el, unescapeEntities(italic));
      parent.appendChild(el);
    } else if (strike !== undefined) {
      const el = document.createElement("s");
      appendText(el, unescapeEntities(strike));
      parent.appendChild(el);
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) appendText(parent, unescapeEntities(text.slice(lastIndex)));
}
function appendLinesWithBreaks(parent: Node, text: string) {
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (i > 0) parent.appendChild(document.createElement("br"));
    appendInline(parent, line);
  });
}
function appendPlainSegment(frag: DocumentFragment, text: string) {
  const lines = text.split("\n");
  let current: string[] = [];
  let currentIsQuote = false;
  const needsSeparator = () =>
    !!frag.lastChild &&
    !HEADING_TAG_RE.test(frag.lastChild.nodeName) &&
    frag.lastChild.nodeName !== "HR";
  const flush = () => {
    if (current.length === 0) return;
    if (needsSeparator()) frag.appendChild(document.createElement("br"));
    const joined = current.join("\n");
    if (currentIsQuote) {
      const bq = document.createElement("blockquote");
      bq.className = "composer-quote";
      appendLinesWithBreaks(bq, joined);
      frag.appendChild(bq);
    } else {
      appendLinesWithBreaks(frag, joined);
    }
    current = [];
  };
  const appendBlock = (el: HTMLElement) => {
    flush();
    if (needsSeparator()) frag.appendChild(document.createElement("br"));
    frag.appendChild(el);
  };
  for (const line of lines) {
    if (line === "---") {
      appendBlock(createDividerElement());
      continue;
    }
    const header = HEADER_LINE_RE.exec(line);
    if (header) {
      const h = createHeaderElement(header[1].length);
      appendInline(h, header[2]);
      appendBlock(h);
      continue;
    }
    const isQuote = QUOTE_LINE_RE.test(line);
    if (isQuote !== currentIsQuote && current.length > 0) flush();
    currentIsQuote = isQuote;
    current.push(isQuote ? line.replace(QUOTE_LINE_RE, "") : line);
  }
  flush();
}
export function mrkdwnToFragment(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  if (!text) return frag;
  let lastIndex = 0;
  for (const match of text.matchAll(CODE_FENCE_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) appendPlainSegment(frag, text.slice(lastIndex, index));
    if (frag.lastChild) frag.appendChild(document.createElement("br"));
    const pre = document.createElement("pre");
    pre.className = "composer-pre";
    appendText(pre, unescapeEntities(match[1].replace(/^\n/, "").replace(/\n$/, "")));
    frag.appendChild(pre);
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) appendPlainSegment(frag, text.slice(lastIndex));
  return frag;
}
function closestElement(node: Node, tagName: string, stopAt: HTMLElement): HTMLElement | null {
  let n: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  while (n && n !== stopAt) {
    if (n.nodeName === tagName) return n as HTMLElement;
    n = n.parentNode;
  }
  return null;
}
export function closestListItem(node: Node, stopAt: HTMLElement): HTMLLIElement | null {
  return closestElement(node, "LI", stopAt) as HTMLLIElement | null;
}
export function placeCaretAtStart(el: Node) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}
export function placeCaretAtEnd(el: Node) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}
export function placeCaretInText(node: Text, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.setStart(node, offset);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}
function topLevelChild(node: Node, root: HTMLElement): Node | null {
  if (node === root) return null;
  let n = node;
  while (n.parentNode && n.parentNode !== root) n = n.parentNode;
  return n.parentNode === root ? n : null;
}
export function expandRangeToLines(root: HTMLElement, range: Range): Range | null {
  let startTop = topLevelChild(range.startContainer, root);
  let endTop = topLevelChild(range.endContainer, root);
  if (!startTop) {
    startTop = root.childNodes[range.startOffset] ?? root.childNodes[range.startOffset - 1] ?? null;
  }
  if (!endTop) {
    endTop = root.childNodes[range.endOffset] ?? root.childNodes[range.endOffset - 1] ?? null;
  }
  if (!(startTop && endTop)) return null;
  let lineStart = startTop;
  while (lineStart.previousSibling && lineStart.previousSibling.nodeName !== "BR") {
    lineStart = lineStart.previousSibling;
  }
  let lineEnd = endTop;
  while (lineEnd.nextSibling && lineEnd.nextSibling.nodeName !== "BR") {
    lineEnd = lineEnd.nextSibling;
  }
  const r = document.createRange();
  r.setStartBefore(lineStart);
  r.setEndAfter(lineEnd);
  return r;
}
