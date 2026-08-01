import { uploadFiles } from "@slock/slack-api";
import { useClickOutside, useEscapeClose } from "@slock/ui";
import { createEffect, createMemo, createSignal, onMount } from "solid-js";
import { encodeReplyLink } from "../../lib/replyLink";
import {
  actionFeedback,
  channelDisplayName,
  composerFeedbackKey,
  dmDisplayName,
  store,
} from "../../lib/store";
import { createComposerKeyHandler } from "./composerKeyboard";
import type { ComposerProps } from "./composerTypes";
import { createSlashCommandSuggestionState } from "./lib/commands/slashCommandSuggestions";
import { clearPersistedDraft, createComposerDraftState } from "./lib/drafts";
import { createEditorCommands } from "./lib/editor/editorCommands";
import { createRunTool, FORMAT_TOOLS } from "./lib/formatTools";
import { createLinkPreviewController } from "./lib/linkPreviews";
import { placeCaretAtEnd } from "./lib/richtext";
import { fragmentToBlocks } from "./lib/richtextSerialization";
import { createPendingFileState, draftCacheKey, submitComposerPayload } from "./lib/submission";
import { createSuggestionController } from "./lib/suggestionController";
import type { SuggestState } from "./lib/suggestTypes";

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
  const [dragOver, setDragOver] = createSignal(false);
  const [sending, setSending] = createSignal(false);
  const [retryingDraft, setRetryingDraft] = createSignal(false);
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
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
  useEscapeClose(
    () => setSuggest(null),
    () => suggest() !== null,
  );
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
  const draftKey = () => {
    const channelId = targetChannelId();
    return channelId ? draftCacheKey(channelId, props.threadTs) : undefined;
  };
  const feedbackKey = () => props.threadTs ?? targetChannelId() ?? "";
  const disabled = () => !targetChannelId() || sending();
  const pendingFileState = createPendingFileState({
    disabled: () => sending() || !!props.editing,
    draftKey,
  });
  const pendingFiles = pendingFileState.files;
  const composerDrafts = createComposerDraftState({
    channelId: targetChannelId,
    editing: () => !!props.editing,
    key: draftKey,
    loadIntoEditor: editor.loadDraftIntoEditor,
    resetPreviews: linkPreviews.reset,
    setText,
    text,
    threadTs: () => props.threadTs,
  });
  const retryDraftSync = async () => {
    if (retryingDraft()) return;
    setRetryingDraft(true);
    try {
      await composerDrafts.retrySync();
    } finally {
      setRetryingDraft(false);
    }
  };
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
    return `Message ${dmDisplayName(store.dms.dmById(v.id), store.users.userById)}`;
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
    if (sending() || !targetChannelId()) return false;
    if (pendingFiles().length > 0) return true;
    return Boolean(text().trim());
  });
  const slashCommandSuggestions = createSlashCommandSuggestionState(text);
  const availableTools = createMemo(() =>
    props.editing ? FORMAT_TOOLS.filter((t) => t.kind !== "attach") : FORMAT_TOOLS,
  );
  const addFiles = pendingFileState.add;
  const removeFile = pendingFileState.remove;
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
      setSending(true);
      try {
        await props.editing.onSave(trimmed, blocks);
      } finally {
        setSending(false);
      }
      return;
    }
    const id = targetChannelId();
    const submittedDraftKey = draftKey();
    if (!(id && submittedDraftKey && canSend())) return;
    const files = pendingFiles();
    const completeSubmission = (clearFiles: boolean) => {
      clearPersistedDraft(id, props.threadTs);
      if (draftKey() === submittedDraftKey) {
        editor.clearEditor();
      }
      if (clearFiles) pendingFileState.clear(submittedDraftKey);
      props.replyTo?.onSent();
    };
    setSending(true);
    try {
      await submitComposerPayload({
        blocks: blocks && blocks.length > 0 ? blocks : undefined,
        files,
        isSlashAttempt,
        onSuccess: completeSubmission,
        runCommand: () => store.commands.handleSlashCommand(id, props.threadTs, trimmed),
        sendMessage: (messageBlocks) =>
          store.messages.sendMessage(id, outgoing, props.threadTs, messageBlocks, suppressUnfurl),
        uploadFiles: () => uploadFiles(id, files, props.threadTs, outgoing || undefined),
      });
    } catch (err) {
      console.error("Failed to send", err);
      actionFeedback.flash(
        composerFeedbackKey(feedbackKey()),
        files.length > 0
          ? "Couldn’t upload. Your message and files are ready to retry."
          : "Couldn’t send. Your message is ready to retry.",
        "error",
      );
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
    if (editor.maybeApplyLineTrigger()) {
      composerDrafts.cacheLocal();
      return;
    }
    editor.maybeLinkifyTypedUrl();
    editor.syncFromDom();
    const editorEl = editor.getRef();
    if (!text().trim() && editorEl?.childNodes.length) editorEl.innerHTML = "";
    const ctx = editor.currentTextContext();
    if (ctx) suggestions.updateSuggestions(ctx.node.textContent ?? "", ctx.offset);
    else setSuggest(null);
    composerDrafts.cacheLocal();
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
      editor.insertPastedTextAtCaret(pasted);
      editor.linkifyAll();
      composerDrafts.cacheLocal();
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
    draftSyncError: composerDrafts.syncError,
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
    retryDraftSync,
    retryingDraft,
    runTool,
    sending,
    ...slashCommandSuggestions,
    setDateOpen,
    setDragOver,
    setLinkEditor,
    setMentionOpen,
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
