import { emojiUrl } from "@slock/blockkit";
import type { User } from "@slock/slack-api";
import { fetchBrowsableChannels, uploadFile } from "@slock/slack-api";
import { Avatar, fuzzySearch, Icon, type IconName, Menu, showToast } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
  allEmojiEntries,
  frequentEmoji,
  searchEmoji,
  standardEmojiUnicode,
} from "../../lib/emojiSearch";
import {
  activeView,
  bootstrap,
  channelById,
  channelDisplayName,
  channels,
  currentUser,
  dmById,
  frecencyScore,
  handleSlashCommand,
  recordEmojiUse,
  searchUsers,
  sendMessage,
  userById,
} from "../../lib/store";
import ComposeDatePicker from "./ComposeDatePicker";
import ComposeUserPicker from "./ComposeUserPicker";
import {
  closestListItem,
  createChannelChip,
  createDateChip,
  createDividerElement,
  createEmojiChip,
  createHeaderElement,
  createMentionChip,
  expandRangeToLines,
  fragmentToBlocks,
  fragmentToMrkdwn,
  HEADING_TAG_RE,
  mrkdwnToFragment,
  placeCaretAtEnd,
  placeCaretAtStart,
  placeCaretInText,
} from "./richtext";
import "./Composer.css";

type FormatTool =
  | { kind: "mark"; icon: IconName; title: string; mark: "bold" | "italic" | "strike" | "code" }
  | { kind: "date"; icon: IconName; title: string }
  | { kind: "attach"; icon: IconName; title: string }
  | { kind: "mention"; icon: IconName; title: string };

// Block formats (header, divider, quote, code block, lists) aren't menu items —
// they're typed markdown-style at the start of a line; see maybeApplyLineTrigger.
// Date is the one block that stays in the menu: it needs a real picker popup.
const FORMAT_TOOLS: FormatTool[] = [
  { kind: "mark", icon: "bold", title: "Bold", mark: "bold" },
  { kind: "mark", icon: "italic", title: "Italic", mark: "italic" },
  { kind: "mark", icon: "strikethrough", title: "Strikethrough", mark: "strike" },
  { kind: "mark", icon: "code", title: "Inline code", mark: "code" },
  { kind: "date", icon: "calendar", title: "Date" },
  { kind: "attach", icon: "attachment", title: "Attach file" },
  { kind: "mention", icon: "mentions", title: "Mention someone" },
];

type UserSuggestItem = { kind: "user"; id: string; name: string; user: User };
type ChannelSuggestItem = { kind: "channel"; id: string; name: string; private: boolean };
type CommandSuggestItem = { kind: "command"; name: string; desc: string };
type EmojiSuggestItem = { kind: "emoji"; name: string; unicode?: string };
type SuggestItem = UserSuggestItem | ChannelSuggestItem | CommandSuggestItem | EmojiSuggestItem;

type SuggestState =
  | { kind: "user"; start: number; items: UserSuggestItem[]; active: number }
  | { kind: "channel"; start: number; items: ChannelSuggestItem[]; active: number }
  | { kind: "command"; start: number; items: CommandSuggestItem[]; active: number }
  | { kind: "emoji"; start: number; items: EmojiSuggestItem[]; active: number };

const SLASH_COMMANDS: { name: string; desc: string }[] = [
  { name: "shrug", desc: "Append ¯\\_(ツ)_/¯ to your message" },
  { name: "me", desc: "Share an action you're doing" },
  { name: "topic", desc: "Set the channel topic" },
  { name: "remind", desc: "Set a reminder" },
  { name: "msg", desc: "Send a direct message" },
  { name: "invite", desc: "Invite people to this channel" },
  { name: "leave", desc: "Leave this channel" },
  { name: "archive", desc: "Archive this channel" },
  { name: "rename", desc: "Rename this channel" },
  { name: "status", desc: "Set your status" },
  { name: "dnd", desc: "Snooze notifications" },
  { name: "who", desc: "List members of this channel" },
  { name: "mute", desc: "Mute this channel" },
  { name: "call", desc: "Start a call" },
];

// Detects an in-progress @mention, #channel-mention, :emoji-shortcode, or
// /slash-command token immediately before the cursor, the way Slack's real
// composer does. Mentions and emoji must start at a word boundary (so
// "user@example.com" and clock times like "10:30" don't trigger), and slash
// commands are only recognized as the very first token of the message.
function detectMentionTrigger(
  value: string,
  cursor: number,
): { kind: "user" | "channel" | "command" | "emoji"; start: number; query: string } | null {
  const before = value.slice(0, cursor);
  if (before.startsWith("/") && !/[\s]/.test(before.slice(1))) {
    return { kind: "command", start: 0, query: before.slice(1) };
  }
  const atIdx = before.lastIndexOf("@");
  const hashIdx = before.lastIndexOf("#");
  const colonIdx = before.lastIndexOf(":");
  const idx = Math.max(atIdx, hashIdx, colonIdx);
  if (idx === -1) return null;
  const prevChar = before[idx - 1];
  if (prevChar !== undefined && !/\s/.test(prevChar)) return null;
  const token = before.slice(idx + 1);
  if (/\s/.test(token)) return null;
  const kind = idx === atIdx ? "user" : idx === hashIdx ? "channel" : "emoji";
  if (kind === "emoji" && !/^[a-z0-9_+-]*$/i.test(token)) return null;
  return { kind, start: idx, query: token };
}

function suggestItemContent(item: SuggestItem) {
  switch (item.kind) {
    case "user":
      return (
        <>
          <Avatar user={item.user} size="small" />
          <span class="composer-suggest-label">{item.name}</span>
        </>
      );
    case "channel":
      return (
        <>
          <span class="composer-suggest-icon">
            {item.private ? <Icon name="lock" size={12} /> : "#"}
          </span>
          <span class="composer-suggest-label">{item.name}</span>
        </>
      );
    case "command":
      return (
        <>
          <span class="composer-suggest-icon">/</span>
          <span class="composer-suggest-label">{item.name}</span>
          <span class="composer-suggest-desc">{item.desc}</span>
        </>
      );
    case "emoji": {
      const url = emojiUrl(item.name);
      return (
        <>
          <span class="composer-suggest-icon composer-suggest-emoji">
            {url ? <img src={url} alt="" /> : (item.unicode ?? "❔")}
          </span>
          <span class="composer-suggest-label">:{item.name}:</span>
        </>
      );
    }
  }
}

const DRAFTS_KEY = "slock-drafts";

function loadDrafts(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

const drafts = loadDrafts();

function persistDrafts() {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

export default function Composer(props: {
  channelId?: string;
  threadTs?: string;
  placeholder?: string;
}) {
  const [text, setText] = createSignal("");
  const [toolsOpen, setToolsOpen] = createSignal(false);
  const [emojiOpen, setEmojiOpen] = createSignal(false);
  const [mentionOpen, setMentionOpen] = createSignal(false);
  const [dateOpen, setDateOpen] = createSignal(false);
  const [pendingFiles, setPendingFiles] = createSignal<File[]>([]);
  const [dragOver, setDragOver] = createSignal(false);
  const [sending, setSending] = createSignal(false);
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  let editorRef: HTMLDivElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;
  let suggestRequestId = 0;
  let savedRange: Range | null = null;

  // --- selection / DOM plumbing -----------------------------------------

  function syncFromDom() {
    if (!editorRef) return;
    setText(fragmentToMrkdwn(editorRef));
  }

  function loadDraftIntoEditor(value: string) {
    const el = editorRef;
    if (!el) return;
    el.innerHTML = "";
    el.appendChild(mrkdwnToFragment(value));
  }

  function clearEditor() {
    setText("");
    if (editorRef) editorRef.innerHTML = "";
  }

  function focusEditor() {
    editorRef?.focus();
  }

  // The emoji/mention pickers render their own autofocused search inputs,
  // which steals focus (and with it, window.getSelection()) away from the
  // editor the instant they open. We snapshot the caret before that happens
  // and restore it right before inserting, so "insert emoji" lands where the
  // user was actually typing instead of wherever focus last was.
  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef?.contains(sel.anchorNode)) {
      savedRange = sel.getRangeAt(0).cloneRange();
    } else {
      savedRange = null;
    }
  }

  function restoreSelection() {
    focusEditor();
    const sel = window.getSelection();
    if (!sel || !editorRef) return;
    sel.removeAllRanges();
    if (savedRange) sel.addRange(savedRange);
    else placeCaretAtEnd(editorRef);
  }

  function currentTextContext(): { node: Text; offset: number } | null {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== Node.TEXT_NODE) return null;
    if (!editorRef?.contains(node)) return null;
    return { node: node as Text, offset: sel.anchorOffset };
  }

  // --- mention / channel / emoji / slash-command suggestions --------------

  function setActiveSuggestion(index: number) {
    setSuggest((prev) => (prev ? { ...prev, active: index } : prev));
  }

  function moveActiveSuggestion(delta: number) {
    const s = suggest();
    if (!s) return;
    const n = s.items.length;
    setActiveSuggestion((((s.active + delta) % n) + n) % n);
  }

  function updateSuggestions(value: string, cursor: number) {
    const trigger = detectMentionTrigger(value, cursor);
    if (!trigger) {
      setSuggest(null);
      return;
    }
    const q = trigger.query.toLowerCase();
    const reqId = ++suggestRequestId;

    if (trigger.kind === "command") {
      const items = fuzzySearch(SLASH_COMMANDS, { query: q, text: (c) => c.name }).map(
        (c): CommandSuggestItem => ({ kind: "command", name: c.name, desc: c.desc }),
      );
      setSuggest(
        items.length > 0 ? { kind: "command", start: trigger.start, items, active: 0 } : null,
      );
      return;
    }

    if (trigger.kind === "emoji") {
      const entries = allEmojiEntries();
      const ranked = q ? searchEmoji(entries, q) : frequentEmoji(entries, 8);
      const items: EmojiSuggestItem[] = ranked
        .slice(0, 8)
        .map((e) => ({ kind: "emoji", name: e.name, unicode: e.unicode }));
      setSuggest(
        items.length > 0 ? { kind: "emoji", start: trigger.start, items, active: 0 } : null,
      );
      return;
    }

    // Both branches below rank by fuzzy name match first, frecency (usage
    // frequency/recency) as the tiebreaker — same policy as GlobalSearch and
    // the emoji picker — and re-rank the *whole* candidate pool (local +
    // remote) each time new remote results land, so a remote match doesn't
    // just get appended after whatever was locally visible first.

    if (trigger.kind === "user") {
      const me = currentUser()?.id;
      const toItems = (users: User[]): UserSuggestItem[] =>
        fuzzySearch(users, { query: q, text: (u) => u.name, frequency: (u) => frecencyScore(u.id) })
          .slice(0, 8)
          .map((u) => ({ kind: "user", id: u.id, name: u.name, user: u }));

      const localUsers = (bootstrap()?.users ?? []).filter((u) => u.id !== me);
      setSuggest({ kind: "user", start: trigger.start, items: toItems(localUsers), active: 0 });
      if (!q) return;
      searchUsers(q, me).then((found) => {
        if (reqId !== suggestRequestId) return;
        const merged = new Map<string, User>();
        for (const u of localUsers) merged.set(u.id, u);
        for (const u of found) merged.set(u.id, u);
        setSuggest((prev) =>
          prev?.kind === "user" ? { ...prev, items: toItems([...merged.values()]) } : prev,
        );
      });
      return;
    }

    type ChannelCandidate = { id: string; name: string; private: boolean };
    const toChannelItems = (list: ChannelCandidate[]): ChannelSuggestItem[] =>
      fuzzySearch(list, { query: q, text: (c) => c.name, frequency: (c) => frecencyScore(c.id) })
        .slice(0, 8)
        .map((c) => ({ kind: "channel", id: c.id, name: c.name, private: c.private }));

    const localChannels = channels();
    setSuggest({
      kind: "channel",
      start: trigger.start,
      items: toChannelItems(localChannels),
      active: 0,
    });
    if (!q) return;
    fetchBrowsableChannels(q).then((found) => {
      if (reqId !== suggestRequestId) return;
      const merged = new Map<string, ChannelCandidate>();
      for (const c of localChannels) merged.set(c.id, c);
      for (const c of found) merged.set(c.id, c);
      setSuggest((prev) =>
        prev?.kind === "channel" ? { ...prev, items: toChannelItems([...merged.values()]) } : prev,
      );
    });
  }

  function applySuggestion(index?: number) {
    const s = suggest();
    const ctx = currentTextContext();
    if (!s || !ctx) return;
    const item = s.items[index ?? s.active];
    if (!item) return;
    const { node, offset } = ctx;
    const parent = node.parentNode;
    if (!parent) return;

    const after = node.splitText(offset);
    node.deleteData(s.start, node.length - s.start);

    if (item.kind === "command") {
      const insertion = document.createTextNode(`/${item.name} `);
      parent.insertBefore(insertion, after);
      placeCaretInText(insertion, insertion.length);
    } else if (item.kind === "emoji") {
      recordEmojiUse(item.name);
      if (emojiUrl(item.name)) {
        const chip = createEmojiChip(item.name);
        parent.insertBefore(chip, after);
        const space = document.createTextNode(" ");
        parent.insertBefore(space, after);
        placeCaretInText(space, 1);
      } else {
        const insertion = document.createTextNode(`${item.unicode ?? `:${item.name}:`} `);
        parent.insertBefore(insertion, after);
        placeCaretInText(insertion, insertion.length);
      }
    } else {
      const chip =
        item.kind === "user"
          ? createMentionChip(item.id, item.name)
          : createChannelChip(item.id, item.name);
      parent.insertBefore(chip, after);
      const space = document.createTextNode(" ");
      parent.insertBefore(space, after);
      placeCaretInText(space, 1);
    }
    setSuggest(null);
    syncFromDom();
  }

  const targetChannelId = () => props.channelId ?? activeView()?.id;
  const draftKey = () => (props.threadTs ? `thread:${props.threadTs}` : targetChannelId());
  const disabled = () => !targetChannelId() || sending();

  // The composer is a single long-lived component reused across every channel/DM
  // (and once per open thread) rather than remounted on switch, so without this
  // the exact same in-progress text would carry over when you change channels.
  createEffect((prevKey: string | undefined) => {
    const key = draftKey();
    if (key !== prevKey) {
      const value = (key && drafts[key]) || "";
      setText(value);
      loadDraftIntoEditor(value);
    }
    return key;
  }, undefined);

  createEffect(() => {
    const key = draftKey();
    if (!key) return;
    const value = text();
    if (value.trim()) drafts[key] = value;
    else delete drafts[key];
    persistDrafts();
  });

  const placeholder = () => {
    if (props.placeholder) return props.placeholder;
    const v = activeView();
    if (!v) return "Message";
    if (v.kind === "channel") return `Message #${channelDisplayName(channelById(v.id), v.id)}`;
    const dm = dmById(v.id);
    return `Message ${dm ? (userById(dm.userId)?.name ?? "") : ""}`;
  };

  // --- formatting commands -------------------------------------------------

  function applyMark(mark: "bold" | "italic" | "strike" | "code") {
    focusEditor();
    if (mark === "code") {
      toggleInlineCode();
    } else {
      const command = mark === "bold" ? "bold" : mark === "italic" ? "italic" : "strikeThrough";
      document.execCommand(command);
    }
    syncFromDom();
  }

  function toggleInlineCode() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef) return;
    const range = sel.getRangeAt(0);
    let ancestor: Node | null =
      range.commonAncestorContainer.nodeType === Node.TEXT_NODE
        ? range.commonAncestorContainer.parentNode
        : range.commonAncestorContainer;
    while (ancestor && ancestor !== editorRef && ancestor.nodeName !== "CODE") {
      ancestor = ancestor.parentNode;
    }
    if (ancestor && ancestor.nodeName === "CODE") {
      const parent = ancestor.parentNode;
      if (!parent) return;
      while (ancestor.firstChild) parent.insertBefore(ancestor.firstChild, ancestor);
      parent.removeChild(ancestor);
      return;
    }
    if (range.collapsed) {
      const code = document.createElement("code");
      code.appendChild(document.createTextNode("\u200B"));
      range.insertNode(code);
      placeCaretAtEnd(code);
    } else {
      const code = document.createElement("code");
      code.appendChild(range.extractContents());
      range.insertNode(code);
      const r = document.createRange();
      r.setStartAfter(code);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  }

  function wrapCurrentLinesInBlock(build: (contents: DocumentFragment) => HTMLElement) {
    const el = editorRef;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    focusEditor();
    const original = sel.getRangeAt(0);
    const lineRange = expandRangeToLines(el, original);
    if (!lineRange) {
      const container = build(document.createDocumentFragment());
      container.appendChild(document.createElement("br"));
      original.insertNode(container);
      placeCaretAtStart(container);
    } else {
      const contents = lineRange.extractContents();
      const container = build(contents);
      lineRange.insertNode(container);
      // A trigger typed on an empty line wraps no content — give the block a
      // placeholder <br> so it stays visible and the caret can sit inside it.
      if (!container.textContent && !container.querySelector("br")) {
        container.appendChild(document.createElement("br"));
        placeCaretAtStart(container);
      } else {
        placeCaretAtEnd(container);
      }
    }
    syncFromDom();
  }

  function applyCodeBlock() {
    wrapCurrentLinesInBlock((frag) => {
      const pre = document.createElement("pre");
      pre.className = "composer-pre";
      pre.appendChild(frag);
      return pre;
    });
  }

  function applyHeader(level: number) {
    wrapCurrentLinesInBlock((frag) => {
      const h = createHeaderElement(level);
      h.appendChild(frag);
      return h;
    });
  }

  // Dividers are a caret-position insert, not a line wrap: the "---" marker is
  // already gone by the time this runs, so just drop an <hr> before the caret
  // and keep the (now empty) line after it for continued typing.
  function insertDividerAtCaret() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const hr = createDividerElement();
    range.insertNode(hr);
    if (!hr.nextSibling) hr.after(document.createElement("br"));
    const r = document.createRange();
    r.setStartAfter(hr);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    syncFromDom();
  }

  function applyQuote() {
    wrapCurrentLinesInBlock((frag) => {
      const bq = document.createElement("blockquote");
      bq.className = "composer-quote";
      bq.appendChild(frag);
      return bq;
    });
  }

  function applyList(ordered: boolean) {
    const el = editorRef;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    focusEditor();
    const original = sel.getRangeAt(0);
    const lineRange = expandRangeToLines(el, original);
    const list = document.createElement(ordered ? "ol" : "ul");
    list.className = "composer-list";
    let li = document.createElement("li");
    list.appendChild(li);
    if (!lineRange) {
      li.appendChild(document.createElement("br"));
      original.insertNode(list);
      placeCaretAtStart(li);
    } else {
      const contents = lineRange.extractContents();
      for (const node of Array.from(contents.childNodes)) {
        if (node.nodeName === "BR") {
          li = document.createElement("li");
          list.appendChild(li);
        } else {
          li.appendChild(node);
        }
      }
      lineRange.insertNode(list);
      const lastLi = list.lastElementChild ?? list;
      if (!lastLi.textContent && !lastLi.querySelector("br")) {
        lastLi.appendChild(document.createElement("br"));
        placeCaretAtStart(lastLi);
      } else {
        placeCaretAtEnd(lastLi);
      }
    }
    syncFromDom();
  }

  function insertPlainTextAtCaret(fragmentText: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const parts = fragmentText.split("\n");
    let lastNode: Text = document.createTextNode(parts[0]);
    range.insertNode(lastNode);
    for (let i = 1; i < parts.length; i++) {
      const br = document.createElement("br");
      lastNode.after(br);
      const t = document.createTextNode(parts[i]);
      br.after(t);
      lastNode = t;
    }
    placeCaretInText(lastNode, lastNode.length);
    syncFromDom();
  }

  function insertEmojiAtCaret(name: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    if (emojiUrl(name)) {
      const chip = createEmojiChip(name);
      range.insertNode(chip);
      const space = document.createTextNode(" ");
      chip.after(space);
      placeCaretInText(space, 1);
    } else {
      const text = document.createTextNode(`${standardEmojiUnicode(name) ?? `:${name}:`} `);
      range.insertNode(text);
      placeCaretInText(text, text.length);
    }
    syncFromDom();
  }

  function insertMentionChipAtCaret(id: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const chip = createMentionChip(id, userById(id)?.name ?? id);
    range.insertNode(chip);
    const space = document.createTextNode(" ");
    chip.after(space);
    placeCaretInText(space, 1);
    syncFromDom();
  }

  function insertDateChipAtCaret(timestamp: number) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const chip = createDateChip(timestamp);
    range.insertNode(chip);
    const space = document.createTextNode(" ");
    chip.after(space);
    placeCaretInText(space, 1);
    syncFromDom();
  }

  function insertLineBreak() {
    focusEditor();
    // The native command inserts the <br> AND leaves the caret with the right
    // affinity so the next character lands on the new line — something the
    // Range API can't fully reproduce. (It only emits a real <br> because
    // .composer-input is not white-space: pre-wrap; see Composer.css.)
    if (document.execCommand("insertLineBreak")) {
      syncFromDom();
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const br = document.createElement("br");
    range.insertNode(br);
    // Land the caret in a real text node after the <br>: an element-anchored
    // caret there gets normalized by Chrome back to the end of the previous
    // text node, which would glue the next characters onto the old line.
    let target = br.nextSibling;
    if (!target || target.nodeType !== Node.TEXT_NODE) {
      target = document.createTextNode("");
      br.after(target);
    }
    // Placeholder <br> keeps the new line visible while it's still empty.
    if (!(target as Text).length && !target.nextSibling) target.after(document.createElement("br"));
    placeCaretInText(target as Text, 0);
    syncFromDom();
  }

  // Headers are single-line (a header block holds one line of plain text), so
  // Shift+Enter inside one doesn't break the line — it exits to a fresh plain
  // line right below the header.
  function handleShiftEnterInHeader(): boolean {
    const el = editorRef;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return false;
    let n: Node | null = sel.getRangeAt(0).startContainer;
    while (n && n !== el && !HEADING_TAG_RE.test(n.nodeName)) n = n.parentNode;
    if (!n || n === el) return false;
    const heading = n as HTMLElement;
    if (!heading.nextSibling) heading.after(document.createElement("br"));
    const r = document.createRange();
    r.setStartAfter(heading);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    syncFromDom();
    return true;
  }

  // Enter inside a list item continues the list (like a real editor) rather
  // than just inserting a soft line break; an empty item exits the list.
  function handleShiftEnterInList(): boolean {
    const el = editorRef;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return false;
    const li = closestListItem(sel.getRangeAt(0).startContainer, el);
    if (!li) return false;
    if ((li.textContent ?? "").trim() === "") {
      const list = li.parentElement;
      if (!list) return true;
      li.remove();
      if (list.children.length === 0) {
        const br = document.createElement("br");
        list.replaceWith(br);
        const r = document.createRange();
        r.setStartAfter(br);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    } else {
      const newLi = document.createElement("li");
      newLi.appendChild(document.createElement("br"));
      li.after(newLi);
      placeCaretAtStart(newLi);
    }
    syncFromDom();
    return true;
  }

  // Headers and dividers are "typed into existence" by a markdown trigger
  // (see maybeApplyLineTrigger) and have no visible marker afterwards, so the
  // browser's native Backspace handling on them is unpredictable — it can eat
  // extra characters, get stuck, or turn the element into a resize-selected
  // object instead of just removing it. Treat each as a single character:
  // Backspace right at its start undoes it in one press, same as deleting one
  // char, instead of that native funkiness.
  function handleBackspaceOnHeading(): boolean {
    const el = editorRef;
    const sel = window.getSelection();
    if (!el || !sel || !sel.isCollapsed || sel.rangeCount === 0) return false;
    const { startContainer, startOffset } = sel.getRangeAt(0);

    let n: Node | null = startContainer;
    while (n && n !== el && !HEADING_TAG_RE.test(n.nodeName)) n = n.parentNode;
    if (!n || n === el) return false;
    const heading = n as HTMLElement;

    const beforeCaret = document.createRange();
    beforeCaret.selectNodeContents(heading);
    beforeCaret.setEnd(startContainer, startOffset);
    if (beforeCaret.toString().length > 0 || beforeCaret.cloneContents().querySelector("img"))
      return false;

    const before = heading.previousSibling;
    const after = heading.nextSibling;
    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createElement("br"));
    const marker = document.createTextNode("");
    frag.appendChild(marker);
    while (heading.firstChild) frag.appendChild(heading.firstChild);
    if (after) frag.appendChild(document.createElement("br"));
    heading.replaceWith(frag);
    placeCaretInText(marker, 0);
    syncFromDom();
    return true;
  }

  function handleBackspaceOnDivider(): boolean {
    const el = editorRef;
    const sel = window.getSelection();
    if (!el || !sel || !sel.isCollapsed || sel.rangeCount === 0) return false;
    const { startContainer, startOffset } = sel.getRangeAt(0);

    let hr: Node | null = null;
    if (startContainer.nodeType === Node.TEXT_NODE) {
      if (startOffset !== 0 || startContainer.parentNode !== el) return false;
      let prev: Node | null = startContainer.previousSibling;
      while (prev && prev.nodeType === Node.TEXT_NODE && !(prev as Text).length)
        prev = prev.previousSibling;
      if (prev?.nodeName === "HR") hr = prev;
    } else if (startContainer === el) {
      const candidate = el.childNodes[startOffset - 1];
      if (candidate?.nodeName === "HR") hr = candidate;
    }
    if (!hr) return false;

    const br = document.createElement("br");
    (hr as ChildNode).replaceWith(br);
    const r = document.createRange();
    r.setStartAfter(br);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    syncFromDom();
    return true;
  }

  const runTool = (tool: FormatTool) => {
    switch (tool.kind) {
      case "mark":
        applyMark(tool.mark);
        setToolsOpen(false);
        return;
      case "date":
        saveSelection();
        setToolsOpen(false);
        setDateOpen(true);
        return;
      case "attach":
        setToolsOpen(false);
        fileInputRef?.click();
        return;
      case "mention":
        saveSelection();
        setToolsOpen(false);
        setMentionOpen(true);
        return;
    }
  };

  const canSend = createMemo(() => {
    if (sending()) return false;
    if (pendingFiles().length > 0) return true;
    return Boolean(text().trim());
  });

  const addFiles = (fileList: FileList | File[]) => {
    setPendingFiles([...pendingFiles(), ...Array.from(fileList)]);
  };

  const removeFile = (index: number) => {
    setPendingFiles(pendingFiles().filter((_, i) => i !== index));
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    const id = targetChannelId();
    if (!id || !canSend()) return;
    const files = pendingFiles();
    const trimmed = text().trim();
    // Headers/dividers can't be expressed in plain mrkdwn — such messages go
    // out as an ordered block list, with `trimmed` as the notification text.
    const blocks = editorRef ? (fragmentToBlocks(editorRef) ?? undefined) : undefined;

    setSending(true);
    try {
      if (files.length === 0) {
        if (blocks && blocks.length > 0) {
          clearEditor();
          await sendMessage(id, trimmed, props.threadTs, blocks);
          return;
        }
        if (trimmed.startsWith("/")) {
          clearEditor();
          const handled = await handleSlashCommand(id, props.threadTs, trimmed);
          if (handled) return;
        }
        await sendMessage(id, trimmed, props.threadTs);
        clearEditor();
        return;
      }

      setPendingFiles([]);
      clearEditor();
      await uploadFile(id, files[0], props.threadTs, trimmed || undefined);
      for (const file of files.slice(1)) {
        await uploadFile(id, file, props.threadTs);
      }
    } catch (err) {
      console.error("Failed to send", err);
      showToast("Failed to send.");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const s = suggest();
    if (s && s.items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveActiveSuggestion(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveActiveSuggestion(-1);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applySuggestion();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggest(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      submit(e);
      return;
    }
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      if (!handleShiftEnterInHeader() && !handleShiftEnterInList()) insertLineBreak();
      return;
    }
    if (e.key === "Backspace" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (handleBackspaceOnHeading() || handleBackspaceOnDivider()) {
        e.preventDefault();
        return;
      }
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey && !e.shiftKey) {
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        applyMark("bold");
        return;
      }
      if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        applyMark("italic");
        return;
      }
    }
    if (mod && e.shiftKey && !e.altKey) {
      if (e.key.toLowerCase() === "x") {
        e.preventDefault();
        applyMark("strike");
        return;
      }
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        applyMark("code");
        return;
      }
    }
  };

  // Deleting through (or select-all-deleting) a code block/blockquote can
  // leave the browser's own empty block behind with the caret dropped inside
  // it — so the next character you type silently lands back in a "code
  // block" you thought you'd cleared. Once it's the *only* thing left and
  // it's empty, drop it back to plain flow.
  function normalizeStrayEmptyBlock() {
    const el = editorRef;
    if (el?.childNodes.length !== 1) return;
    const only = el.firstChild as HTMLElement;
    if (only.nodeType !== Node.ELEMENT_NODE || (only.textContent ?? "").trim()) return;
    if (
      only.tagName === "PRE" ||
      only.tagName === "BLOCKQUOTE" ||
      only.tagName === "UL" ||
      only.tagName === "OL" ||
      HEADING_TAG_RE.test(only.tagName) ||
      only.tagName === "HR"
    ) {
      el.innerHTML = "";
    }
  }

  // Block formats are typed, markdown-style, at the start of a line: "# "
  // through "###### " → header (level = number of #s), "> " → quote, "- "/"* "
  // → bulleted list, "1. " → ordered list, and "```"/"---" convert the moment
  // the third character lands. Only fires for
  // bare top-level text, so a line already inside a quote/list/code block
  // can't re-trigger.
  function maybeApplyLineTrigger(): boolean {
    const el = editorRef;
    const ctx = currentTextContext();
    if (!el || !ctx) return false;
    const { node, offset } = ctx;
    if (node.parentNode !== el) return false;
    // "Start of line" = nothing before, a <br>, or a block element (content
    // after a heading/HR/PRE/… starts a fresh line without any <br>). Empty
    // text nodes don't count — Chrome litters them around caret repositioning.
    const LINE_BOUNDARY = ["BR", "HR", "PRE", "BLOCKQUOTE", "UL", "OL"];
    let prev = node.previousSibling;
    while (prev && prev.nodeType === Node.TEXT_NODE && !(prev as Text).length) {
      prev = prev.previousSibling;
    }
    if (prev && !LINE_BOUNDARY.includes(prev.nodeName) && !HEADING_TAG_RE.test(prev.nodeName))
      return false;
    const before = (node.textContent ?? "").slice(0, offset);

    // Accept nbsp as the trigger space: Chrome inserts a space at the end of a line as nbsp (a plain
    // trailing space would collapse visually), and the trigger space is
    // always at the end of the line when typed.
    let action: (() => void) | undefined;
    const headerMatch = /^(#{1,6})[ \u00a0]$/.exec(before);
    if (headerMatch) action = () => applyHeader(headerMatch[1].length);
    else if (before === "---") action = insertDividerAtCaret;
    else if (before === "```") action = applyCodeBlock;
    else if (/^>[ \u00a0]$/.test(before)) action = applyQuote;
    else if (/^[-*][ \u00a0]$/.test(before)) action = () => applyList(false);
    else if (/^\d+\.[ \u00a0]$/.test(before)) action = () => applyList(true);
    if (!action) return false;

    node.deleteData(0, offset);
    placeCaretInText(node, 0);
    action();
    setSuggest(null);
    syncFromDom();
    return true;
  }

  const onInput = () => {
    normalizeStrayEmptyBlock();
    if (maybeApplyLineTrigger()) return;
    syncFromDom();
    // Selecting-all-and-deleting (or backspacing to nothing) can leave the
    // browser's own empty-line placeholder <br> behind, which defeats the
    // :empty CSS placeholder — clear it so "Message #channel" reappears.
    if (!text().trim() && editorRef?.childNodes.length) editorRef.innerHTML = "";
    const ctx = currentTextContext();
    if (ctx) updateSuggestions(ctx.node.textContent ?? "", ctx.offset);
    else setSuggest(null);
  };

  const onPaste = (e: ClipboardEvent) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      addFiles(files);
      return;
    }
    e.preventDefault();
    const pasted = e.clipboardData?.getData("text/plain") ?? "";
    if (pasted) insertPlainTextAtCaret(pasted);
  };

  return (
    <form
      class="composer"
      classList={{ "drag-over": dragOver() }}
      onSubmit={submit}
      onDragOver={(e) => {
        e.preventDefault();
        if (targetChannelId()) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      <Show when={pendingFiles().length > 0}>
        <div class="composer-file-chips">
          <For each={pendingFiles()}>
            {(file, i) => (
              <span class="composer-file-chip">
                {file.name}
                <button type="button" onClick={() => removeFile(i())} title="Remove">
                  ✕
                </button>
              </span>
            )}
          </For>
        </div>
      </Show>

      <div class="composer-row">
        <div class="composer-tools-wrap">
          <Menu
            panelClass="composer-tools-menu"
            open={toolsOpen()}
            onClose={() => setToolsOpen(false)}
            trigger={
              <button
                type="button"
                class="composer-tool"
                classList={{ active: toolsOpen() }}
                title="Add formatting or a block"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setToolsOpen(!toolsOpen())}
              >
                <Icon name="plus" size={16} />
              </button>
            }
          >
            <For each={FORMAT_TOOLS}>
              {(tool) => (
                <button
                  type="button"
                  class="composer-tools-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => runTool(tool)}
                >
                  <Icon name={tool.icon} size={15} />
                  {tool.title}
                </button>
              )}
            </For>
          </Menu>
          <Show when={mentionOpen()}>
            <div class="composer-mention-popover">
              <ComposeUserPicker
                onSelect={(id) => {
                  restoreSelection();
                  insertMentionChipAtCaret(id);
                  setMentionOpen(false);
                }}
                onClose={() => setMentionOpen(false)}
              />
            </div>
          </Show>
          <Show when={dateOpen()}>
            <div class="composer-mention-popover">
              <ComposeDatePicker
                onSelect={(ts) => {
                  restoreSelection();
                  insertDateChipAtCaret(ts);
                  setDateOpen(false);
                }}
                onClose={() => setDateOpen(false)}
              />
            </div>
          </Show>
        </div>

        <div class="composer-input-wrap">
          {/* biome-ignore lint/a11y/useSemanticElements: rich-text formatting needs a real contenteditable, not <textarea> */}
          <div
            ref={(el) => {
              editorRef = el;
            }}
            class="composer-input"
            classList={{ disabled: disabled() }}
            contentEditable={!disabled()}
            tabIndex={0}
            role="textbox"
            aria-multiline="true"
            aria-label={dragOver() ? "Drop to attach" : placeholder()}
            data-placeholder={dragOver() ? "Drop to attach" : placeholder()}
            onInput={onInput}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={() => setSuggest(null)}
          />
          <Show when={suggest()}>
            {(s) => (
              <div class="composer-suggest-popover">
                <For each={s().items}>
                  {(item, i) => (
                    <button
                      type="button"
                      class="composer-suggest-row"
                      classList={{ active: i() === s().active }}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActiveSuggestion(i())}
                      onClick={() => applySuggestion(i())}
                    >
                      {suggestItemContent(item)}
                    </button>
                  )}
                </For>
              </div>
            )}
          </Show>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          class="composer-file-input"
          onChange={(e) => {
            if (e.currentTarget.files?.length) addFiles(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
        />
      </div>
    </form>
  );
}
