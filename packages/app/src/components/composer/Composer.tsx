import {
  focusedPaneId,
  focusPaneById,
  InlineFeedback,
  plainKey,
  QuillEditor,
  scrollActiveListOption,
  useEscapeClose,
  useShortcut,
} from "@slock/ui";
import type Quill from "quill";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { consumeComposerAutofocusSuppression } from "../../lib/composerFocus";
import { actionFeedback, composerFeedbackKey } from "../../lib/feedback";
import "./Composer.css";
import ComposerAttachMenu from "./ComposerAttachMenu";
import ComposerSuggestPopover from "./ComposerSuggestPopover";
import { createComposerSubmitHandler } from "./composerSubmit";
import type { ComposerProps } from "./composerTypes";
import FileChip from "./FileChip";
import { createComposerDraftState, createPendingFileState, draftCacheKey } from "./lib/drafts";
import { wireEmojiAutoconvert } from "./lib/quillEmoji";
import {
  indexAlignedText,
  insertSuggestionAt,
  loadMrkdwnIntoQuill,
  mrkdwnText,
} from "./lib/quillMentions";
import { createSuggestionController } from "./lib/suggestionController";
import { type SuggestState, suggestOpen } from "./lib/suggestTypes";
import { useSuggestUi } from "./lib/useSuggestUi";
import ComposeDatePicker from "./popovers/ComposeDatePicker";

const TRAILING_NEWLINE_RE = /\n$/;

export default function Composer(props: ComposerProps) {
  let quill: Quill | undefined;
  let pendingInitialText: string | undefined;
  let suggestPopoverRef: HTMLDivElement | undefined;
  let caretIndex = 0;
  const [text, setText] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [dragOver, setDragOver] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [dateOpen, setDateOpen] = createSignal(false);
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);

  const autofocus = !(props.editing || consumeComposerAutofocusSuppression());

  useEscapeClose(
    () => props.editing?.onCancel(),
    () => !!props.editing,
  );
  useSuggestUi(() => suggestPopoverRef, suggest, setSuggest);
  createEffect(() => {
    suggest();
    scrollActiveListOption(() => suggestPopoverRef);
  });

  useShortcut({
    enabled: () => !props.editing && !!props.paneId && focusedPaneId() === props.paneId,
    handler: () => quill?.focus(),
    keys: "i",
    label: "Focus the message box",
    match: plainKey("i"),
    scope: "composer",
  });
  useEscapeClose(
    () => {
      if (props.paneId) focusPaneById(props.paneId);
    },
    () => !props.editing && !!quill && document.activeElement === quill.root,
  );

  const feedbackKey = () => composerFeedbackKey(props.threadTs ?? props.channelId ?? "");

  const pendingFiles = createPendingFileState({
    disabled: sending,
    draftKey: () =>
      props.editing || !props.channelId
        ? undefined
        : draftCacheKey(props.channelId, props.threadTs),
  });

  const loadIntoEditor = (value: string) => {
    if (quill) loadMrkdwnIntoQuill(quill, value);
    else pendingInitialText = value;
    setText(value);
  };

  const draftState = props.editing
    ? undefined
    : createComposerDraftState({
        channelId: () => props.channelId,
        editing: () => false,
        key: () => (props.channelId ? draftCacheKey(props.channelId, props.threadTs) : undefined),
        loadIntoEditor,
        resetPreviews: () => {},
        setText,
        text,
        threadTs: () => props.threadTs,
      });

  onCleanup(() => draftState?.cacheLocal());

  const handleSubmit = createComposerSubmitHandler({
    channelId: () => props.channelId,
    editing: () => props.editing,
    feedbackKey,
    getQuill: () => quill,
    onSent: () => props.replyTo?.onSent(),
    pendingFiles,
    sending,
    setSending,
    threadTs: () => props.threadTs,
  });

  const suggestions = createSuggestionController({
    applyTextSuggestion: (item, state) => {
      if (!quill) return;
      caretIndex = insertSuggestionAt(
        quill,
        state.start,
        caretIndex - state.start,
        item,
        state.kind,
      );
      quill.setSelection(caretIndex, 0);
    },
    channelId: () => props.channelId,
    includeCommands: !props.editing,
    setSuggest,
    suggest,
  });

  const handleKeyDownCapture = (event: KeyboardEvent): boolean => {
    if (!suggestOpen(suggest())) return false;
    if (event.key === "ArrowDown") {
      suggestions.moveActiveSuggestion(1);
      return true;
    }
    if (event.key === "ArrowUp") {
      suggestions.moveActiveSuggestion(-1);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      suggestions.applySuggestion();
      return true;
    }
    if (event.key === "Escape") {
      setSuggest(null);
      return true;
    }
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) setSuggest(null);
    return false;
  };

  const handleDateSelect = (_timestamp: number, _format: string) => setDateOpen(false);

  const feedback = () => actionFeedback.get(feedbackKey());

  return (
    <div
      class="composer"
      classList={{ "composer-editing": !!props.editing, "drag-over": dragOver() }}
      onDragLeave={() => setDragOver(false)}
      onDragOver={(e) => {
        if (props.editing) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!props.editing && e.dataTransfer?.files.length) pendingFiles.add(e.dataTransfer.files);
      }}
    >
      <InlineFeedback class="composer-feedback" feedback={feedback()} />
      <Show when={draftState?.syncError()}>
        <div class="composer-draft-warning flex-align-center">
          draft failed to save
          <button class="btn-reset" onClick={() => draftState?.retrySync()} type="button">
            retry
          </button>
        </div>
      </Show>
      <Show when={pendingFiles.files().length > 0}>
        <div class="composer-file-chips">
          <For each={pendingFiles.files()}>
            {(file, index) => (
              <FileChip
                disabled={sending()}
                file={file}
                onRemove={() => pendingFiles.remove(index())}
                onRename={(name) => pendingFiles.rename(index(), name)}
              />
            )}
          </For>
        </div>
      </Show>
      <div class="composer-row">
        <Show when={!props.editing}>
          <ComposerAttachMenu
            onFilesSelected={(files) => pendingFiles.add(files)}
            onInsertDate={() => setDateOpen(true)}
            onOpenChange={setMenuOpen}
            open={menuOpen()}
          />
        </Show>
        <div class="composer-input-wrap">
          <QuillEditor
            autofocus={autofocus}
            onKeyDownCapture={handleKeyDownCapture}
            onReady={(q) => {
              quill = q;
              const initial = props.editing?.initialText ?? pendingInitialText;
              if (initial) loadMrkdwnIntoQuill(q, initial);
              wireEmojiAutoconvert(q);
              q.on("text-change", () => {
                setText(mrkdwnText(q).replace(TRAILING_NEWLINE_RE, ""));
                const aligned = indexAlignedText(q).replace(TRAILING_NEWLINE_RE, "");
                caretIndex = q.getSelection()?.index ?? aligned.length;
                suggestions.updateSuggestions(aligned, caretIndex);
              });
            }}
            onSubmit={handleSubmit}
            placeholder={props.placeholder ?? "message…"}
          />
          <Show when={dateOpen()}>
            <div class="composer-date-popover">
              <ComposeDatePicker onClose={() => setDateOpen(false)} onSelect={handleDateSelect} />
            </div>
          </Show>
          <Show when={suggestOpen(suggest()) ? suggest() : undefined}>
            {(state) => (
              <ComposerSuggestPopover
                onHover={suggestions.setActiveSuggestion}
                onPick={suggestions.applySuggestion}
                ref={(el) => {
                  suggestPopoverRef = el;
                }}
                state={state()}
              />
            )}
          </Show>
        </div>
        <Show when={sending()}>
          <span class="composer-send-status">
            {props.editing
              ? "saving…"
              : pendingFiles.files().length > 0
                ? `uploading ${pendingFiles.files().length === 1 ? "file" : `${pendingFiles.files().length} files`}…`
                : "sending…"}
          </span>
        </Show>
        <Show when={props.editing}>
          <button onClick={() => props.editing?.onCancel()} type="button">
            cancel
          </button>
        </Show>
      </div>
    </div>
  );
}
