import {
  blocksToDoc,
  type ComposeAtomData,
  composeAtomRenderers,
  docToBlocks,
} from "@slock/blockkit";
import type { Block as SlackBlock } from "@slock/slack-api";
import type { DocModel } from "@slock/ui";
import {
  createEditorStore,
  createParagraph,
  createTextRun,
  EditorView,
  emptyDoc,
  InlineFeedback,
  useEscapeClose,
} from "@slock/ui";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { actionFeedback, composerFeedbackKey } from "../../lib/store";
import ComposerAttachMenu from "./ComposerAttachMenu";
import ComposerSuggestPopover from "./ComposerSuggestPopover";
import { createComposerSubmitHandler } from "./composerSubmit";
import { applyTextSuggestion, insertDateAtom } from "./composerSuggestionApply";
import type { ComposerProps } from "./composerTypes";
import FileChip from "./FileChip";
import { createComposerDraftState } from "./lib/drafts";
import { createPendingFileState, draftCacheKey } from "./lib/submission";
import { createSuggestionController } from "./lib/suggestionController";
import type { SuggestState } from "./lib/suggestTypes";
import { suggestOpen } from "./lib/suggestTypes";
import { useSuggestUi } from "./lib/useSuggestUi";
import ComposeDatePicker from "./popovers/ComposeDatePicker";
import "./Composer.css";

/** A doc built from a plain string — used when there's no real blocks payload to load from
 * (an old text-only draft, or the `initialText`-only edit fallback). */
function docFromPlainText(text: string) {
  return text
    ? { blocks: [createParagraph<ComposeAtomData>([createTextRun(text)])] }
    : emptyDoc<ComposeAtomData>();
}

function docFromDraft(text: string, blocks?: unknown) {
  if (Array.isArray(blocks) && blocks.length > 0) {
    return blocksToDoc(blocks as SlackBlock[]) as DocModel<ComposeAtomData>;
  }
  return docFromPlainText(text);
}

export default function Composer(props: ComposerProps) {
  const editor = createEditorStore<ComposeAtomData>();
  const [plainText, setPlainText] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [dragOver, setDragOver] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [dateOpen, setDateOpen] = createSignal(false);
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  const [suggestPopoverRef, setSuggestPopoverRef] = createSignal<HTMLDivElement>();

  useSuggestUi(suggestPopoverRef, suggest, setSuggest);

  const suggestionCtl = createSuggestionController({
    applyTextSuggestion: (item, state) => applyTextSuggestion(editor, item, state),
    channelId: () => props.channelId,
    includeCommands: !props.editing,
    setSuggest,
    suggest,
  });

  const handleCaretActivity = () => {
    const caret = editor.getCaretContext();
    suggestionCtl.updateSuggestions(caret?.text ?? "", caret?.caretOffset ?? 0, caret?.isDocStart);
  };

  // escape cancels an in-progress edit, same as the Cancel button - suppressed while a suggestion
  // popover is open since that Escape (handled locally below) closes the popover first
  useEscapeClose(
    () => props.editing?.onCancel(),
    () => !!props.editing,
  );

  const handleKeyDownCapture = (event: KeyboardEvent): boolean => {
    if (!suggestOpen(suggest())) return false;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      suggestionCtl.moveActiveSuggestion(1);
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      suggestionCtl.moveActiveSuggestion(-1);
      return true;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      suggestionCtl.applySuggestion();
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setSuggest(null);
      return true;
    }
    return false;
  };

  const feedbackKey = () => composerFeedbackKey(props.threadTs ?? props.channelId ?? "");
  // an editing composer shares its channelId/threadTs with the "real" composer for that spot
  // (main composer or thread reply box) - keying pending files off editing would leak the other
  // composer's staged attachments into the edit box, so it never gets a draft key of its own
  const pendingFiles = createPendingFileState({
    disabled: sending,
    draftKey: () =>
      props.editing || !props.channelId
        ? undefined
        : draftCacheKey(props.channelId, props.threadTs),
  });

  if (props.editing) {
    editor.loadDoc(docFromDraft(props.editing.initialText, props.editing.initialBlocks));
    setPlainText(editor.getPlainText());
  }

  const unsubscribe = editor.onChange(() => setPlainText(editor.getPlainText()));
  onCleanup(unsubscribe);

  const draftState = props.editing
    ? undefined
    : createComposerDraftState({
        blocks: () => (editor.isEmpty() ? undefined : docToBlocks(editor.getDoc())),
        channelId: () => props.channelId,
        editing: () => false,
        key: () => (props.channelId ? draftCacheKey(props.channelId, props.threadTs) : undefined),
        loadIntoEditor: (text, blocks) => editor.loadDoc(docFromDraft(text, blocks)),
        resetPreviews: () => {},
        setText: setPlainText,
        text: plainText,
        threadTs: () => props.threadTs,
      });

  onCleanup(() => draftState?.cacheLocal());

  const handleSubmit = createComposerSubmitHandler({
    channelId: () => props.channelId,
    editing: () => props.editing,
    editor,
    feedbackKey,
    onSent: () => props.replyTo?.onSent(),
    pendingFiles,
    sending,
    setSending,
    threadTs: () => props.threadTs,
  });

  const handleDateSelect = (timestamp: number, format: string) => {
    setDateOpen(false);
    insertDateAtom(editor, timestamp, format);
  };

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
          Draft failed to save.
          <button class="btn-reset" onClick={() => draftState?.retrySync()} type="button">
            Retry
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
          <EditorView
            ariaLabel={props.editing ? "Edit message" : "Message"}
            atomRenderers={composeAtomRenderers}
            class="composer-input"
            editor={editor}
            onCaretActivity={handleCaretActivity}
            onKeyDownCapture={handleKeyDownCapture}
            onSubmit={handleSubmit}
            placeholder={props.placeholder ?? "Message"}
          />
          <Show when={dateOpen()}>
            <div class="composer-date-popover">
              <ComposeDatePicker onClose={() => setDateOpen(false)} onSelect={handleDateSelect} />
            </div>
          </Show>
          <Show when={suggestOpen(suggest()) ? suggest() : undefined}>
            {(state) => (
              <ComposerSuggestPopover
                onHover={suggestionCtl.setActiveSuggestion}
                onPick={suggestionCtl.applySuggestion}
                ref={setSuggestPopoverRef}
                state={state()}
              />
            )}
          </Show>
        </div>
        <Show when={sending()}>
          <span class="composer-send-status">
            {props.editing
              ? "Saving…"
              : pendingFiles.files().length > 0
                ? `Uploading ${pendingFiles.files().length === 1 ? "file" : `${pendingFiles.files().length} files`}…`
                : "Sending…"}
          </span>
        </Show>
      </div>
      <Show when={props.editing}>
        <div class="composer-row composer-edit-actions">
          <button
            class="btn-reset composer-edit-cancel"
            onClick={() => props.editing?.onCancel()}
            type="button"
          >
            Cancel
          </button>
          <button class="btn-reset composer-edit-save" onClick={handleSubmit} type="button">
            Save
          </button>
        </div>
      </Show>
    </div>
  );
}
