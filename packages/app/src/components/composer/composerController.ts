import { uploadFiles } from "@slock/slack-api";
import { createEffect, createMemo, createSignal, onMount } from "solid-js";
import { encodeReplyLink } from "../../lib/replyLink";
import {
  actionFeedback,
  channelDisplayName,
  composerFeedbackKey,
  dmDisplayName,
  store,
} from "../../lib/store";
import type { ComposerProps } from "./composerTypes";
import { createSlashCommandSuggestionState } from "./lib/commands/slashCommandSuggestions";
import { clearPersistedDraft, createComposerDraftState } from "./lib/drafts";
import { createRunTool, FORMAT_TOOLS } from "./lib/formatTools";
import { createLexicalEditor } from "./lib/lexicalEditor";
import { createLinkPreviewController } from "./lib/linkPreviews";
import { createPendingFileState, draftCacheKey, submitComposerPayload } from "./lib/submission";
import { createSuggestionController, suggestionText } from "./lib/suggestionController";
import type { SuggestState } from "./lib/suggestTypes";
import { useSuggestUi } from "./lib/useSuggestUi";
export function createComposerController(props: ComposerProps) {
  const [text, setText] = createSignal("");
  const [toolsOpen, setToolsOpen] = createSignal(false);
  const [dateOpen, setDateOpen] = createSignal(false);
  const [dragOver, setDragOver] = createSignal(false);
  const [sending, setSending] = createSignal(false);
  const [retryingDraft, setRetryingDraft] = createSignal(false);
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  let fileInputRef: HTMLInputElement | undefined;
  let suggestPopoverRef: HTMLDivElement | undefined;
  let editorRootRef: HTMLDivElement | undefined;
  let mounted = false;
  const linkPreviews = createLinkPreviewController(text);
  const editor = createLexicalEditor({ setText });
  const setEditorRef = (el: HTMLDivElement) => {
    editorRootRef = el;
    if (mounted) editor.setRef(el);
  };
  onMount(() => {
    mounted = true;
    if (editorRootRef) editor.setRef(editorRootRef);
  });
  const targetChannelId = () => props.channelId;
  const suggestions = createSuggestionController({
    channelId: targetChannelId,
    applyTextSuggestion: (item, state) => {
      editor.replaceTrigger(state.start, suggestionText(item, state.kind));
    },
    setSuggest,
    suggest,
  });
  useSuggestUi(() => suggestPopoverRef, suggest, setSuggest);
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
  });
  const placeholder = () => {
    if (props.placeholder) return props.placeholder;
    const { channelId } = props;
    if (!channelId) return "Message";
    const dm = store.dms.dmById(channelId);
    if (dm) return `Message ${dmDisplayName(dm, store.users.userById)}`;
    return `Message #${channelDisplayName(store.channels.channelById(channelId), channelId)}`;
  };
  const runTool = createRunTool({
    applyBlock: editor.applyBlock,
    applyMark: editor.applyMark,
    getFileInput: () => fileInputRef,
    saveSelection: editor.saveSelection,
    setDateOpen,
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
  const renameFile = pendingFileState.rename;
  const submit = async (e: Event) => {
    e.preventDefault();
    if (sending()) return;
    setSuggest(null);
    const trimmed = text().trim();
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
        await props.editing.onSave(trimmed);
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
          ? "Couldn't upload. Your message and files are ready to retry."
          : "Couldn't send. Your message is ready to retry.",
        "error",
      );
    } finally {
      setSending(false);
    }
  };
  const updateSuggestions = () => {
    const context = editor.getTextContext();
    if (context) suggestions.updateSuggestions(context.text, context.offset);
    else setSuggest(null);
  };
  const onInput = () => {
    queueMicrotask(updateSuggestions);
    composerDrafts.cacheLocal();
  };
  const applySuggestion = (index?: number) => {
    suggestions.applySuggestion(index);
    composerDrafts.cacheLocal();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing) return;
    const state = suggest();
    if (state?.items.length && !(event.metaKey || event.ctrlKey || event.altKey)) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        suggestions.moveActiveSuggestion(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applySuggestion();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setSuggest(null);
        return;
      }
    }
    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      const mark =
        event.key.toLowerCase() === "b"
          ? "bold"
          : event.key.toLowerCase() === "i"
            ? "italic"
            : event.key.toLowerCase() === "e"
              ? "code"
              : undefined;
      if (mark) {
        event.preventDefault();
        editor.applyMark(mark);
        composerDrafts.cacheLocal();
        return;
      }
    }
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !(event.metaKey || event.ctrlKey || event.altKey)
    ) {
      submit(event);
      return;
    }
    if (event.key === "Escape" && props.editing) {
      event.preventDefault();
      props.editing.onCancel();
      return;
    }
    if (["ArrowLeft", "ArrowRight", "End", "Home"].includes(event.key)) setSuggest(null);
    queueMicrotask(updateSuggestions);
  };
  return {
    addFiles,
    availableTools,
    cacheDraftLocally: composerDrafts.cacheLocal,
    canSend,
    dateOpen,
    disabled,
    dragOver,
    draftSyncError: composerDrafts.syncError,
    editor,
    setEditorRef,
    applySuggestion,
    feedbackKey,
    getEditorRef: editor.getRef,
    setFileInputRef: (el: HTMLInputElement) => {
      fileInputRef = el;
    },
    linkPreviews,
    onInput,
    onKeyDown,
    pendingFiles,
    placeholder,
    removeFile,
    renameFile,
    retryDraftSync,
    retryingDraft,
    runTool,
    sending,
    ...slashCommandSuggestions,
    setDateOpen,
    setDragOver,
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
