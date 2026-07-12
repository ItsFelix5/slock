import { uploadFile } from "@slock/slack-api";
import { Icon, InlineFeedback, Menu, useClickOutside, useEscapeClose } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js";
import { encodeReplyLink } from "../../lib/replyLink";
import {
  actionFeedback,
  activeView,
  channelById,
  channelDisplayName,
  dmById,
  handleSlashCommand,
  sendMessage,
  userById,
} from "../../lib/store";
import AttachmentCard from "../messages/parts/media/AttachmentCard";
import ComposeDatePicker from "./ComposeDatePicker";
import ComposeLinkEditor from "./ComposeLinkEditor";
import ComposeUserPicker from "./ComposeUserPicker";
import { drafts, draftsReady, persistDraft } from "./lib/drafts";
import { createEditorCommands } from "./lib/editor/editorCommands";
import { createRunTool, FORMAT_TOOLS } from "./lib/formatTools";
import { createLinkPreviewController } from "./lib/linkPreviews";
import { fragmentToBlocks, placeCaretAtEnd } from "./lib/richtext";
import { createSuggestionController } from "./lib/suggestionController";
import type { SuggestState } from "./lib/suggestTypes";
import { suggestItemContent } from "./lib/suggestTypes";
import { linkPreviewToAttachment } from "./lib/textDetection";
import "./Composer.css";

export default function Composer(props: {
  channelId?: string;
  threadTs?: string;
  placeholder?: string;
  replyTo?: { permalink: string; onSent: () => void };
  editing?: {
    initialText: string;
    onSave: (text: string, blocks?: unknown) => void;
    onCancel: () => void;
  };
}) {
  const [text, setText] = createSignal("");
  const [toolsOpen, setToolsOpen] = createSignal(false);
  const [mentionOpen, setMentionOpen] = createSignal(false);
  const [dateOpen, setDateOpen] = createSignal(false);
  const [linkEditor, setLinkEditor] = createSignal<{
    el: HTMLElement;
    url: string;
    label?: string;
  } | null>(null);
  const [pendingFiles, setPendingFiles] = createSignal<File[]>([]);
  const [dragOver, setDragOver] = createSignal(false);
  const [sending, setSending] = createSignal(false);
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  let fileInputRef: HTMLInputElement | undefined;
  let suggestPopoverRef: HTMLDivElement | undefined;

  const linkPreviews = createLinkPreviewController(text);
  const editor = createEditorCommands({
    setText,
    resetLinkPreviews: linkPreviews.reset,
    closeSuggestions: () => setSuggest(null),
  });
  const suggestions = createSuggestionController({
    suggest,
    setSuggest,
    currentTextContext: editor.currentTextContext,
    syncFromDom: editor.syncFromDom,
  });

  useClickOutside(
    () => suggestPopoverRef,
    () => setSuggest(null),
  );
  useEscapeClose(() => setSuggest(null));

  createEffect(() => {
    const s = suggest();
    if (!s || !suggestPopoverRef) return;
    const activeButton = suggestPopoverRef.querySelector(
      `.composer-suggest-row:nth-child(${s.active + 1})`,
    ) as HTMLElement | null;
    if (activeButton) {
      activeButton.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  const targetChannelId = () => props.channelId ?? activeView()?.id;
  const draftKey = () => (props.threadTs ? `thread:${props.threadTs}` : targetChannelId());
  const feedbackKey = () => props.threadTs ?? targetChannelId() ?? "";
  const disabled = () => !targetChannelId() || sending();

  // The composer is a single long-lived component reused across every channel/DM
  // (and once per open thread) rather than remounted on switch, so without this
  // the exact same in-progress text would carry over when you change channels.
  // An editing composer is mounted fresh per edit session instead, so it skips
  // drafts entirely and loads the message's own text once on mount below.
  // Also waits on draftsReady so a channel opened before the initial
  // drafts.list fetch resolves still picks up its real draft once it lands.
  let loadedDraftKey: string | undefined;
  createEffect(() => {
    if (props.editing || !draftsReady()) return;
    const key = draftKey();
    if (key === loadedDraftKey) return;
    loadedDraftKey = key;
    const value = (key && drafts[key]) || "";
    setText(value);
    editor.loadDraftIntoEditor(value);
    linkPreviews.reset();
  });

  createEffect(() => {
    if (props.editing || !draftsReady()) return;
    const key = draftKey();
    const channelId = targetChannelId();
    if (!key || !channelId) return;
    const value = text();
    if (value.trim()) drafts[key] = value;
    else delete drafts[key];
    persistDraft(channelId, props.threadTs, value);
  });

  onMount(() => {
    if (!props.editing) return;
    setText(props.editing.initialText);
    editor.loadDraftIntoEditor(props.editing.initialText);
    editor.focusEditor();
    const el = editor.getRef();
    if (el) placeCaretAtEnd(el);
  });

  const placeholder = () => {
    if (props.placeholder) return props.placeholder;
    const v = activeView();
    if (!v) return "Message";
    if (v.kind === "channel") return `Message #${channelDisplayName(channelById(v.id), v.id)}`;
    const dm = dmById(v.id);
    return `Message ${dm ? (userById(dm.userId)?.name ?? "") : ""}`;
  };

  const runTool = createRunTool({
    applyMark: editor.applyMark,
    saveSelection: editor.saveSelection,
    getFileInput: () => fileInputRef,
    setToolsOpen,
    setDateOpen,
    setMentionOpen,
  });

  const canSend = createMemo(() => {
    if (sending()) return false;
    if (pendingFiles().length > 0) return true;
    return Boolean(text().trim());
  });

  // Can't attach a new file to an already-sent message, so that tool is
  // pointless (and its target, an <input type=file>, isn't even rendered) in
  // edit mode.
  const availableTools = createMemo(() =>
    props.editing ? FORMAT_TOOLS.filter((t) => t.kind !== "attach") : FORMAT_TOOLS,
  );

  const addFiles = (fileList: FileList | File[]) => {
    setPendingFiles([...pendingFiles(), ...Array.from(fileList)]);
  };

  const removeFile = (index: number) => {
    setPendingFiles(pendingFiles().filter((_, i) => i !== index));
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    editor.linkifyAll();
    const trimmed = text().trim();
    // Headers/dividers can't be expressed in plain mrkdwn — such messages go
    // out as an ordered block list, with `trimmed` as the notification text.
    const editorEl = editor.getRef();
    const blocks = editorEl ? (fragmentToBlocks(editorEl) ?? undefined) : undefined;
    // A reply link never decorates an actual slash command — only real
    // message text.
    const isSlashAttempt = trimmed.startsWith("/");
    const outgoing =
      props.replyTo && !isSlashAttempt
        ? encodeReplyLink(props.replyTo.permalink) + trimmed
        : trimmed;
    const suppressUnfurl = linkPreviews.shouldSuppressUnfurl();

    if (props.editing) {
      if (!trimmed) return;
      props.editing.onSave(trimmed, blocks);
      return;
    }

    const id = targetChannelId();
    if (!id || !canSend()) return;
    const files = pendingFiles();

    setSending(true);
    try {
      if (files.length === 0) {
        if (blocks && blocks.length > 0) {
          editor.clearEditor();
          await sendMessage(id, outgoing, props.threadTs, blocks, suppressUnfurl);
          props.replyTo?.onSent();
          return;
        }
        if (isSlashAttempt) {
          editor.clearEditor();
          const handled = await handleSlashCommand(id, props.threadTs, trimmed);
          if (handled) return;
        }
        await sendMessage(id, outgoing, props.threadTs, undefined, suppressUnfurl);
        editor.clearEditor();
        props.replyTo?.onSent();
        return;
      }

      setPendingFiles([]);
      editor.clearEditor();
      await uploadFile(id, files[0], props.threadTs, outgoing || undefined);
      for (const file of files.slice(1)) {
        await uploadFile(id, file, props.threadTs);
      }
      props.replyTo?.onSent();
    } catch (err) {
      console.error("Failed to send", err);
      actionFeedback.flash(feedbackKey(), "Failed to send.", "error");
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const s = suggest();
    if (s && s.items.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        suggestions.moveActiveSuggestion(1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        suggestions.moveActiveSuggestion(-1);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        suggestions.applySuggestion();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggest(null);
        return;
      }
    }
    if (e.key === "Escape" && props.editing) {
      e.preventDefault();
      props.editing.onCancel();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      submit(e);
      return;
    }
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      if (!editor.handleShiftEnterInHeader() && !editor.handleShiftEnterInList())
        editor.insertLineBreak();
      return;
    }
    if (e.key === "Backspace" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (editor.handleBackspaceOnHeading() || editor.handleBackspaceOnDivider()) {
        e.preventDefault();
        return;
      }
    }
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey && !e.shiftKey) {
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        editor.applyMark("bold");
        return;
      }
      if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        editor.applyMark("italic");
        return;
      }
    }
    if (mod && e.shiftKey && !e.altKey) {
      if (e.key.toLowerCase() === "x") {
        e.preventDefault();
        editor.applyMark("strike");
        return;
      }
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        editor.applyMark("code");
        return;
      }
    }
  };

  const onInput = () => {
    editor.normalizeStrayEmptyBlock();
    if (editor.maybeApplyLineTrigger()) return;
    editor.maybeLinkifyTypedUrl();
    editor.syncFromDom();
    // Selecting-all-and-deleting (or backspacing to nothing) can leave the
    // browser's own empty-line placeholder <br> behind, which defeats the
    // :empty CSS placeholder — clear it so "Message #channel" reappears.
    const editorEl = editor.getRef();
    if (!text().trim() && editorEl?.childNodes.length) editorEl.innerHTML = "";
    const ctx = editor.currentTextContext();
    if (ctx) suggestions.updateSuggestions(ctx.node.textContent ?? "", ctx.offset);
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
    if (pasted) {
      editor.insertPlainTextAtCaret(pasted);
      editor.linkifyAll();
    }
  };

  const onEditorClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest(".composer-link, .composer-link-chip");
    if (!target) return;
    const url = target.dataset.linkUrl ?? "";
    if (!url) return;
    setLinkEditor({
      el: target as HTMLElement,
      url,
      label:
        target.classList.contains("composer-link-chip") &&
        target.textContent !== url
          ? target.textContent ?? undefined
          : undefined,
    });
  };

  return (
    <form
      class="composer"
      classList={{ "drag-over": dragOver(), "composer-editing": !!props.editing }}
      onSubmit={submit}
      onDragOver={(e) => {
        e.preventDefault();
        if (!props.editing && targetChannelId()) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!props.editing && e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      <Show when={!props.editing && pendingFiles().length > 0}>
        <div class="composer-file-chips">
          <For each={pendingFiles()}>
            {(file, i) => (
              <span class="composer-file-chip">
                {file.name}
                <button type="button" onClick={() => removeFile(i())} title="Remove">
                  <Icon name="close" size={12} />
                </button>
              </span>
            )}
          </For>
        </div>
      </Show>

      <Show when={!props.editing && linkPreviews.visiblePreviews().length > 0}>
        <div class="composer-link-previews">
          <For each={linkPreviews.visiblePreviews()}>
            {(preview) => (
              <div class="composer-link-preview">
                <AttachmentCard attachment={linkPreviewToAttachment(preview)} />
                <button
                  type="button"
                  class="composer-link-preview-remove"
                  onClick={() => linkPreviews.dismissLinkPreview(preview.url)}
                  title="Remove preview"
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={!props.editing}>
        <InlineFeedback feedback={actionFeedback.get(feedbackKey())} class="composer-feedback" />
      </Show>

      <div class="composer-row">
        <div class="composer-tools-wrap">
          <Menu
            panelClass="menu-panel composer-tools-menu"
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
            <For each={availableTools()}>
              {(tool) => (
                <button
                  type="button"
                  class="menu-item"
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
                  editor.restoreSelection();
                  editor.insertMentionChipAtCaret(id);
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
                  editor.restoreSelection();
                  editor.insertDateChipAtCaret(ts);
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
            ref={editor.setRef}
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
            onClick={onEditorClick}
            onBlur={() => setSuggest(null)}
          />
          <Show when={suggest()}>
            {(s) => (
              <div
                ref={(el) => {
                  suggestPopoverRef = el;
                }}
                class="menu-panel composer-suggest-popover"
              >
                <For each={s().items}>
                  {(item, i) => (
                    <button
                      type="button"
                      class="composer-suggest-row"
                      classList={{ active: i() === s().active }}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => suggestions.setActiveSuggestion(i())}
                      onClick={() => suggestions.applySuggestion(i())}
                    >
                      {suggestItemContent(item)}
                    </button>
                  )}
                </For>
              </div>
            )}
          </Show>
          <Show when={linkEditor()}>
            {(le) => (
              <ComposeLinkEditor
                linkEl={le().el}
                url={le().url}
                currentLabel={le().label}
                onClose={() => setLinkEditor(null)}
              />
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
