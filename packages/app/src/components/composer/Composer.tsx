import type { Block, User } from "@slock/slack-api";
import { fetchBrowsableChannels, uploadFile } from "@slock/slack-api";
import { Avatar, Icon, type IconName, Menu, showToast } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
  activeView,
  bootstrap,
  channelById,
  channels,
  currentUser,
  dmById,
  handleSlashCommand,
  recordEmojiUse,
  searchUsers,
  sendMessage,
  userById,
} from "../../lib/store";
import ComposeUserPicker from "./ComposeUserPicker";
import EmojiPicker from "./EmojiPicker";
import "./Composer.css";

type FormatTool =
  | { kind: "wrap"; icon: IconName; title: string; before: string; after?: string }
  | { kind: "line"; icon: IconName; title: string; linePrefix: string }
  | { kind: "block"; icon: IconName; title: string; block: "header" | "divider" }
  | { kind: "attach"; icon: IconName; title: string }
  | { kind: "mention"; icon: IconName; title: string };

const FORMAT_TOOLS: FormatTool[] = [
  { kind: "block", icon: "text", title: "Header", block: "header" },
  { kind: "block", icon: "divider", title: "Divider", block: "divider" },
  { kind: "wrap", icon: "bold", title: "Bold", before: "*" },
  { kind: "wrap", icon: "italic", title: "Italic", before: "_" },
  { kind: "wrap", icon: "strikethrough", title: "Strikethrough", before: "~" },
  { kind: "wrap", icon: "code", title: "Inline code", before: "`" },
  { kind: "wrap", icon: "code-block", title: "Code block", before: "```\n", after: "\n```" },
  { kind: "line", icon: "bulleted-list", title: "Bulleted list", linePrefix: "• " },
  { kind: "line", icon: "numbered-list", title: "Ordered list", linePrefix: "1. " },
  { kind: "line", icon: "quote", title: "Blockquote", linePrefix: "&gt; " },
  { kind: "attach", icon: "attachment", title: "Attach file" },
  { kind: "mention", icon: "mentions", title: "Mention someone" },
];

type UserSuggestItem = { kind: "user"; id: string; name: string; user: User };
type ChannelSuggestItem = { kind: "channel"; id: string; name: string; private: boolean };
type CommandSuggestItem = { kind: "command"; name: string; desc: string };
type SuggestItem = UserSuggestItem | ChannelSuggestItem | CommandSuggestItem;

type SuggestState =
  | { kind: "user"; start: number; items: UserSuggestItem[]; active: number }
  | { kind: "channel"; start: number; items: ChannelSuggestItem[]; active: number }
  | { kind: "command"; start: number; items: CommandSuggestItem[]; active: number };

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

// Detects an in-progress @mention, #channel-mention, or /slash-command token
// immediately before the cursor, the way Slack's real composer does. Mentions
// must start at a word boundary (so "user@example.com" doesn't trigger) and
// slash commands are only recognized as the very first token of the message.
function detectMentionTrigger(
  value: string,
  cursor: number,
): { kind: "user" | "channel" | "command"; start: number; query: string } | null {
  const before = value.slice(0, cursor);
  if (before.startsWith("/") && !/[\s]/.test(before.slice(1))) {
    return { kind: "command", start: 0, query: before.slice(1) };
  }
  const atIdx = before.lastIndexOf("@");
  const hashIdx = before.lastIndexOf("#");
  const idx = Math.max(atIdx, hashIdx);
  if (idx === -1) return null;
  const prevChar = before[idx - 1];
  if (prevChar !== undefined && !/\s/.test(prevChar)) return null;
  const token = before.slice(idx + 1);
  if (/\s/.test(token)) return null;
  return { kind: idx === atIdx ? "user" : "channel", start: idx, query: token };
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
  }
}

type SpecialBlock = { id: number; kind: "header"; text: string } | { id: number; kind: "divider" };

let nextBlockId = 1;

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
  const [specialBlocks, setSpecialBlocks] = createSignal<SpecialBlock[]>([]);
  const [toolsOpen, setToolsOpen] = createSignal(false);
  const [emojiOpen, setEmojiOpen] = createSignal(false);
  const [mentionOpen, setMentionOpen] = createSignal(false);
  const [pendingFiles, setPendingFiles] = createSignal<File[]>([]);
  const [dragOver, setDragOver] = createSignal(false);
  const [sending, setSending] = createSignal(false);
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  let textareaRef: HTMLTextAreaElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;
  let suggestRequestId = 0;

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
      const items = SLASH_COMMANDS.filter((c) => c.name.startsWith(q)).map(
        (c): CommandSuggestItem => ({ kind: "command", name: c.name, desc: c.desc }),
      );
      setSuggest(
        items.length > 0 ? { kind: "command", start: trigger.start, items, active: 0 } : null,
      );
      return;
    }

    if (trigger.kind === "user") {
      const me = currentUser()?.id;
      const local = (bootstrap()?.users ?? [])
        .filter((u) => u.id !== me && u.name.toLowerCase().includes(q))
        .slice(0, 8)
        .map((u): UserSuggestItem => ({ kind: "user", id: u.id, name: u.name, user: u }));
      setSuggest({ kind: "user", start: trigger.start, items: local, active: 0 });
      if (!q) return;
      searchUsers(q, me).then((found) => {
        if (reqId !== suggestRequestId) return;
        setSuggest((prev) => {
          if (prev?.kind !== "user") return prev;
          const merged = new Map<string, UserSuggestItem>();
          for (const it of prev.items) merged.set(it.id, it);
          for (const u of found)
            merged.set(u.id, { kind: "user", id: u.id, name: u.name, user: u });
          return { ...prev, items: [...merged.values()].slice(0, 8) };
        });
      });
      return;
    }

    const local = channels()
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map(
        (c): ChannelSuggestItem => ({
          kind: "channel",
          id: c.id,
          name: c.name,
          private: c.private,
        }),
      );
    setSuggest({ kind: "channel", start: trigger.start, items: local, active: 0 });
    if (!q) return;
    fetchBrowsableChannels(q).then((found) => {
      if (reqId !== suggestRequestId) return;
      setSuggest((prev) => {
        if (prev?.kind !== "channel") return prev;
        const merged = new Map<string, ChannelSuggestItem>();
        for (const it of prev.items) merged.set(it.id, it);
        for (const c of found)
          merged.set(c.id, { kind: "channel", id: c.id, name: c.name, private: c.private });
        return { ...prev, items: [...merged.values()].slice(0, 8) };
      });
    });
  }

  function applySuggestion(index?: number) {
    const s = suggest();
    const el = textareaRef;
    if (!s || !el) return;
    const item = s.items[index ?? s.active];
    if (!item) return;
    const insertion =
      item.kind === "user"
        ? `<@${item.id}> `
        : item.kind === "channel"
          ? `<#${item.id}|${item.name}> `
          : `/${item.name} `;
    const value = el.value;
    const cursor = el.selectionStart;
    const next = value.slice(0, s.start) + insertion + value.slice(cursor);
    const newCursor = s.start + insertion.length;
    el.value = next;
    setText(next);
    setSuggest(null);
    el.focus();
    el.setSelectionRange(newCursor, newCursor);
    resizeTextarea();
  }

  const targetChannelId = () => props.channelId ?? activeView()?.id;
  const draftKey = () => (props.threadTs ? `thread:${props.threadTs}` : targetChannelId());

  const resizeTextarea = () => {
    const el = textareaRef;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  // The composer is a single long-lived component reused across every channel/DM
  // (and once per open thread) rather than remounted on switch, so without this
  // the exact same in-progress text would carry over when you change channels.
  createEffect((prevKey: string | undefined) => {
    const key = draftKey();
    if (key !== prevKey) {
      setText((key && drafts[key]) || "");
      setSpecialBlocks([]);
      queueMicrotask(resizeTextarea);
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
    if (v.kind === "channel") return `Message #${channelById(v.id)?.name ?? ""}`;
    const dm = dmById(v.id);
    return `Message ${dm ? (userById(dm.userId)?.name ?? "") : ""}`;
  };

  function applyAtCursor(
    mutate: (value: string, start: number, end: number) => { next: string; cursor: number },
  ) {
    const el = textareaRef;
    if (!el) return;
    setSuggest(null);
    const { next, cursor } = mutate(el.value, el.selectionStart, el.selectionEnd);
    el.value = next;
    setText(next);
    el.focus();
    el.setSelectionRange(cursor, cursor);
    resizeTextarea();
  }

  const wrapSelection = (before: string, after: string = before) => {
    applyAtCursor((value, start, end) => {
      const selected = value.slice(start, end);
      const next = value.slice(0, start) + before + selected + after + value.slice(end);
      return { next, cursor: start + before.length + selected.length + after.length };
    });
  };

  const prefixLines = (prefix: string) => {
    applyAtCursor((value, start, end) => {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const before = value.slice(0, lineStart);
      const affected = value.slice(lineStart, end);
      const prefixed = affected
        .split("\n")
        .map((line) => prefix + line)
        .join("\n");
      const next = before + prefixed + value.slice(end);
      return { next, cursor: next.length - (value.length - end) };
    });
  };

  const insertText = (fragment: string) => {
    applyAtCursor((value, start, end) => {
      const next = value.slice(0, start) + fragment + value.slice(end);
      return { next, cursor: start + fragment.length };
    });
  };

  const addBlock = (kind: "header" | "divider") => {
    setSpecialBlocks([...specialBlocks(), { id: nextBlockId++, kind, text: "" } as SpecialBlock]);
    setToolsOpen(false);
  };

  const removeBlock = (id: number) => {
    setSpecialBlocks(specialBlocks().filter((b) => b.id !== id));
  };

  const updateHeaderText = (id: number, value: string) => {
    setSpecialBlocks(
      specialBlocks().map((b) => (b.id === id && b.kind === "header" ? { ...b, text: value } : b)),
    );
  };

  const runTool = (tool: FormatTool) => {
    switch (tool.kind) {
      case "wrap":
        wrapSelection(tool.before, tool.after);
        setToolsOpen(false);
        return;
      case "line":
        prefixLines(tool.linePrefix);
        setToolsOpen(false);
        return;
      case "block":
        addBlock(tool.block);
        return;
      case "attach":
        setToolsOpen(false);
        fileInputRef?.click();
        return;
      case "mention":
        setToolsOpen(false);
        setMentionOpen(true);
        return;
    }
  };

  const buildBlocks = (trimmed: string): Block[] => {
    const blocks: Block[] = [];
    for (const sb of specialBlocks()) {
      if (sb.kind === "header") {
        if (sb.text.trim())
          blocks.push({
            type: "header",
            text: { type: "plain_text", text: sb.text.trim(), emoji: true },
          });
      } else {
        blocks.push({ type: "divider" });
      }
    }
    if (trimmed) blocks.push({ type: "section", text: { type: "mrkdwn", text: trimmed } });
    return blocks;
  };

  const canSend = createMemo(() => {
    if (sending()) return false;
    if (pendingFiles().length > 0) return true;
    if (text().trim()) return true;
    return specialBlocks().some((b) => b.kind === "divider" || b.text.trim());
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
    const blocks = specialBlocks().length > 0 ? buildBlocks(trimmed) : undefined;

    setSending(true);
    try {
      if (files.length === 0) {
        if (blocks && blocks.length > 0) {
          setSpecialBlocks([]);
          setText("");
          queueMicrotask(resizeTextarea);
          await sendMessage(id, trimmed, props.threadTs, blocks);
          return;
        }
        if (trimmed.startsWith("/")) {
          setText("");
          queueMicrotask(resizeTextarea);
          const handled = await handleSlashCommand(id, props.threadTs, trimmed);
          if (handled) return;
        }
        await sendMessage(id, trimmed, props.threadTs);
        setText("");
        queueMicrotask(resizeTextarea);
        return;
      }

      setPendingFiles([]);
      setText("");
      queueMicrotask(resizeTextarea);
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
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
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
      <Show when={specialBlocks().length > 0}>
        <div class="composer-blocks">
          <For each={specialBlocks()}>
            {(b) => (
              <div class="composer-block-chip" classList={{ divider: b.kind === "divider" }}>
                <Show
                  when={b.kind === "header"}
                  fallback={<span class="composer-block-divider-line" />}
                >
                  <input
                    class="composer-block-header-input"
                    placeholder="Header text"
                    value={b.kind === "header" ? b.text : ""}
                    onInput={(e) => updateHeaderText(b.id, e.currentTarget.value)}
                  />
                </Show>
                <button
                  type="button"
                  class="composer-block-remove"
                  title="Remove"
                  onClick={() => removeBlock(b.id)}
                >
                  ✕
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

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
                onClick={() => setToolsOpen(!toolsOpen())}
              >
                <Icon name="plus" size={16} />
              </button>
            }
          >
            <For each={FORMAT_TOOLS}>
              {(tool) => (
                <button type="button" class="composer-tools-item" onClick={() => runTool(tool)}>
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
                  insertText(`<@${id}> `);
                  setMentionOpen(false);
                }}
                onClose={() => setMentionOpen(false)}
              />
            </div>
          </Show>
        </div>

        <div class="composer-input-wrap">
          <textarea
            ref={(el) => {
              textareaRef = el;
              queueMicrotask(resizeTextarea);
            }}
            class="composer-input"
            placeholder={dragOver() ? "Drop to attach" : placeholder()}
            value={text()}
            onInput={(e) => {
              setText(e.currentTarget.value);
              resizeTextarea();
              updateSuggestions(e.currentTarget.value, e.currentTarget.selectionStart);
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={() => setSuggest(null)}
            rows={1}
            disabled={!targetChannelId() || sending()}
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

        <div class="composer-picker-wrap">
          <button
            type="button"
            class="composer-tool"
            title="Emoji"
            onClick={() => setEmojiOpen(!emojiOpen())}
          >
            <Icon name="emoji" size={16} />
          </button>
          {emojiOpen() && (
            <div class="composer-emoji-popover">
              <EmojiPicker
                onSelect={(name) => {
                  recordEmojiUse(name);
                  insertText(`:${name}:`);
                  setEmojiOpen(false);
                }}
                onClose={() => setEmojiOpen(false)}
              />
            </div>
          )}
        </div>

        <button type="submit" class="composer-send" disabled={!canSend()} title="Send">
          <Icon name="send" size={15} />
        </button>
      </div>
    </form>
  );
}
