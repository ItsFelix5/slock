import { emojiUrl, formatSlackDate } from "@slock/blockkit";
import type { Block } from "@slock/slack-api";
import { standardEmojiUnicode } from "../../../lib/emojiSearch";
import { channelById, channelDisplayName, userById } from "../../../lib/store";

// The composer edits a live DOM tree (contenteditable) instead of a raw mrkdwn
// string, so bold/italic/etc. render for real as you type instead of showing
// literal `*`/`_`/`~` markers. These helpers convert between that DOM tree and
// the plain mrkdwn text the rest of the app (drafts, the send API) expects.
//
// Line model: we never let the browser insert its own paragraph-splitting
// <div>s — Enter is intercepted (see Composer.tsx) and always inserts an
// explicit <br>. So the editable root's children are a flat run of text
// nodes, inline mark elements (STRONG/EM/S/CODE), mention/channel chips, and
// <br>s, with occasional block elements (PRE/BLOCKQUOTE/UL/OL) wrapping a
// contiguous line range. That flat-ish shape is what makes DOM<->text
// conversion and "current line" lookups below tractable without a full
// editor framework.

const INLINE_RE = /`([^`]+)`|<([^<>]*)>|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~|:([a-zA-Z0-9_+-]+):/g;
const QUOTE_LINE_RE = /^&gt;\s?/;
const HEADER_LINE_RE = /^(#{1,6}) (.*)$/;
export const HEADING_TAG_RE = /^H[1-6]$/;
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

export function createChannelChip(id: string, name: string): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className = "composer-chip";
  chip.contentEditable = "false";
  chip.dataset.channelId = id;
  chip.dataset.channelName = name;
  chip.textContent = `#${name}`;
  return chip;
}

const DEFAULT_DATE_FORMAT = "{date_short_pretty} at {time}";

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
  chip.dataset.dateFallback = fallback ?? formatSlackDate(timestamp);
  chip.textContent = formatSlackDate(timestamp);
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

// Resolves a `:name:` shortcode the same way blockkit's EmojiText does when
// displaying a sent message: a custom-emoji image chip, else the literal
// Unicode glyph, else the shortcode text unchanged if the name isn't known.
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
    parent.appendChild(createMentionChip(id, userById(id)?.name ?? id));
    return;
  }
  if (token.startsWith("#")) {
    const [id, label] = token.slice(1).split("|");
    parent.appendChild(createChannelChip(id, label ?? channelDisplayName(channelById(id), id)));
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
  // Usergroup/broadcast/link tokens aren't editable as chips here — keep
  // them as literal text so an old draft containing one still round-trips.
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

  // Headers/HR serialize with their own trailing "\n" (see serializeNode), so
  // the line after them needs no <br> separator — inserting one would add a
  // blank line on every draft round-trip.
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

// Deserializes stored mrkdwn (a draft, most commonly) into a DOM fragment
// suitable for dropping into the contenteditable root.
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
    // nbsp is a contenteditable artifact (Chrome uses it for spaces that
    // would collapse at the end of a line) \u2014 plain space in mrkdwn.
    return (node.textContent ?? "").replace(/\u200B/g, "").replace(/\u00A0/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  if (el.dataset.mentionId) return `<@${el.dataset.mentionId}>`;
  if (el.dataset.channelId) return `<#${el.dataset.channelId}|${el.dataset.channelName}>`;
  if (el.dataset.emojiName) return `:${el.dataset.emojiName}:`;
  if (el.dataset.dateTs) {
    const format = el.dataset.dateFormat || DEFAULT_DATE_FORMAT;
    const fallback = el.dataset.dateFallback || formatSlackDate(Number(el.dataset.dateTs));
    return `<!date^${el.dataset.dateTs}^${format}|${fallback}>`;
  }
  if (HEADING_TAG_RE.test(el.tagName)) {
    // An empty header (all content deleted) serializes to nothing, so the
    // editor still counts as empty and the stray element gets cleaned up.
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
    // Headers/HR own their trailing newline: as block elements, whatever
    // follows them in the DOM starts a new visual line even without a <br>,
    // so the separator has to come from serialization. The draft parser
    // knows this and skips the <br> it would otherwise insert after them.
    case "HR":
      return "---\n";
    // Blocks created on an empty line carry a placeholder <br> (see
    // wrapCurrentLinesInBlock) — strip the trailing newline it serializes to.
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

// Serializes the current contenteditable DOM back into mrkdwn text — the
// inverse of mrkdwnToFragment, and the source of truth sent to the API.
// Trailing newlines (a heading's/HR's own terminator, placeholder <br>s) are trimmed
// so a draft round-trips without accumulating blank lines.
export function fragmentToMrkdwn(root: HTMLElement): string {
  return serializeChildren(root).replace(/\n+$/, "");
}

// Headers and dividers have no mrkdwn syntax, so a message containing them
// must be sent as an ordered Block Kit block list: runs of inline content
// become section blocks, split wherever a heading/HR sits. Slack's header
// block has no levels, so H1-H6 all become the same block type. Returns null
// when the message is plain text and can be sent without blocks.
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
    if (text) blocks.push({ type: "section", text: { type: "mrkdwn", text } });
    run = "";
  };
  for (const child of Array.from(root.childNodes)) {
    if (HEADING_TAG_RE.test(child.nodeName)) {
      flush();
      const text = (child.textContent ?? "").trim();
      if (text) blocks.push({ type: "header", text: { type: "plain_text", text, emoji: true } });
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

// Expands a selection Range to the full set of top-level lines it touches
// (a "line" being a run of siblings between <br>s), so block tools like
// "bulleted list" or "blockquote" apply to whole lines the way they do in
// Slack's real composer, not just the exact character selection.
export function expandRangeToLines(root: HTMLElement, range: Range): Range | null {
  let startTop = topLevelChild(range.startContainer, root);
  let endTop = topLevelChild(range.endContainer, root);
  if (!startTop) {
    startTop = root.childNodes[range.startOffset] ?? root.childNodes[range.startOffset - 1] ?? null;
  }
  if (!endTop) {
    endTop = root.childNodes[range.endOffset] ?? root.childNodes[range.endOffset - 1] ?? null;
  }
  if (!startTop || !endTop) return null;

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
