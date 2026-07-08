import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { useClickOutside } from "../../hooks/useClickOutside";
import Icon, { type IconName } from "../../icons";
import { uploadFile } from "../../lib/slackApi";
import {
  activeView,
  channelById,
  dmById,
  handleSlashCommand,
  recordEmojiUse,
  sendMessage,
  userById,
} from "../../lib/store";
import { showToast } from "../../lib/toast";
import type { Block } from "../blockkit/types";
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
  let textareaRef: HTMLTextAreaElement | undefined;
  let fileInputRef: HTMLInputElement | undefined;

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

  useClickOutside(".composer-tools-wrap", () => setToolsOpen(false));

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
          <button
            type="button"
            class="composer-tool"
            classList={{ active: toolsOpen() }}
            title="Add formatting or a block"
            onClick={() => setToolsOpen(!toolsOpen())}
          >
            <Icon name="plus" size={16} />
          </button>
          <Show when={toolsOpen()}>
            <div class="composer-tools-menu">
              <For each={FORMAT_TOOLS}>
                {(tool) => (
                  <button type="button" class="composer-tools-item" onClick={() => runTool(tool)}>
                    <Icon name={tool.icon} size={15} />
                    {tool.title}
                  </button>
                )}
              </For>
            </div>
          </Show>
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
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          rows={1}
          disabled={!targetChannelId() || sending()}
        />

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
