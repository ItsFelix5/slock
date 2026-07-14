import { uploadFile } from "@slock/slack-api";
import { useClickOutside, useEscapeClose } from "@slock/ui";
import { createEffect, createMemo, createSignal, onMount } from "solid-js";
import { encodeReplyLink } from "../../lib/replyLink";
import { actionFeedback, channelDisplayName, store } from "../../lib/store";
import { createComposerKeyHandler } from "./composerKeyboard";
import { drafts, draftsReady, persistDraft } from "./lib/drafts";
import { createEditorCommands } from "./lib/editor/editorCommands";
import { createRunTool, FORMAT_TOOLS } from "./lib/formatTools";
import { createLinkPreviewController } from "./lib/linkPreviews";
import { placeCaretAtEnd } from "./lib/richtext";
import { fragmentToBlocks } from "./lib/richtextSerialization";
import { createSuggestionController } from "./lib/suggestionController";
import type { SuggestState } from "./lib/suggestTypes";

export type ComposerProps = {
  channelId?: string;
  threadTs?: string;
  placeholder?: string;
  replyTo?: { permalink: string; onSent: () => void };
  editing?: {
    initialText: string;
    onSave: (text: string, blocks?: unknown) => void;
    onCancel: () => void;
  };
};

export function createComposerController(props: ComposerProps) {
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
    closeSuggestions: () => setSuggest(null),
    resetLinkPreviews: linkPreviews.reset,
    setText,
  });
  const suggestions = createSuggestionController({
    currentTextContext: editor.currentTextContext,
    setSuggest,
    suggest,
    syncFromDom: editor.syncFromDom,
  });
  useClickOutside(
    () => suggestPopoverRef,
    () => setSuggest(null),
  );
  useEscapeClose(() => setSuggest(null));
  createEffect(() => {
    const s = suggest();
    if (!(s && suggestPopoverRef)) return;
    const activeButton = suggestPopoverRef.querySelector(
      `.composer-suggest-row:nth-child(${s.active + 1})`,
    ) as HTMLElement | null;
    if (activeButton) {
      activeButton.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
  const targetChannelId = () => props.channelId ?? store.viewState.activeView()?.id;
  const draftKey = () => (props.threadTs ? `thread:${props.threadTs}` : targetChannelId());
  const feedbackKey = () => props.threadTs ?? targetChannelId() ?? "";
  const disabled = () => !targetChannelId() || sending();
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
    if (!(key && channelId)) return;
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
    const v = store.viewState.activeView();
    if (!v) return "Message";
    if (v.kind === "channel")
      return `Message #${channelDisplayName(store.channels.channelById(v.id), v.id)}`;
    const dm = store.dms.dmById(v.id);
    return `Message ${dm ? (store.users.userById(dm.userId)?.name ?? "") : ""}`;
  };
  const runTool = createRunTool({
    applyMark: editor.applyMark,
    getFileInput: () => fileInputRef,
    saveSelection: editor.saveSelection,
    setDateOpen,
    setMentionOpen,
    setToolsOpen,
  });
  const canSend = createMemo(() => {
    if (sending()) return false;
    if (pendingFiles().length > 0) return true;
    return Boolean(text().trim());
  });
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
    const editorEl = editor.getRef();
    const blocks = editorEl ? (fragmentToBlocks(editorEl) ?? undefined) : undefined;
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
    if (!(id && canSend())) return;
    const files = pendingFiles();
    setSending(true);
    try {
      if (files.length === 0) {
        if (blocks && blocks.length > 0) {
          editor.clearEditor();
          await store.messages.sendMessage(id, outgoing, props.threadTs, blocks, suppressUnfurl);
          props.replyTo?.onSent();
          return;
        }
        if (isSlashAttempt) {
          editor.clearEditor();
          const handled = await store.commands.handleSlashCommand(id, props.threadTs, trimmed);
          if (handled) return;
        }
        await store.messages.sendMessage(id, outgoing, props.threadTs, undefined, suppressUnfurl);
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

  const onKeyDown = createComposerKeyHandler({
    applySuggestion: suggestions.applySuggestion,
    closeSuggestions: () => setSuggest(null),
    editing: props.editing,
    editor,
    moveSuggestion: suggestions.moveActiveSuggestion,
    submit,
    suggest,
  });
  const onInput = () => {
    editor.normalizeStrayEmptyBlock();
    if (editor.maybeApplyLineTrigger()) return;
    editor.maybeLinkifyTypedUrl();
    editor.syncFromDom();
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
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      ".composer-link, .composer-link-chip",
    );
    if (!target) return;
    const url = target.dataset.linkUrl ?? "";
    if (!url) return;
    setLinkEditor({
      el: target as HTMLElement,
      label:
        target.classList.contains("composer-link-chip") && target.textContent !== url
          ? (target.textContent ?? undefined)
          : undefined,
      url,
    });
  };
  return {
    addFiles,
    availableTools,
    canSend,
    dateOpen,
    disabled,
    dragOver,
    editor,
    feedbackKey,
    getEditorRef: editor.getRef,
    getFileInputRef: () => fileInputRef,
    linkEditor,
    linkPreviews,
    mentionOpen,
    onEditorClick,
    onInput,
    onKeyDown,
    onPaste,
    pendingFiles,
    placeholder,
    removeFile,
    runTool,
    sending,
    setDateOpen,
    setDragOver,
    setLinkEditor,
    setMentionOpen,
    setPendingFiles,
    setSuggest,
    setSuggestPopoverRef: (el: HTMLDivElement) => {
      suggestPopoverRef = el;
    },
    setToolsOpen,
    submit,
    suggest,
    suggestions,
    targetChannelId,
    text,
    toolsOpen,
  };
}
