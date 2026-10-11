import { Slot, service } from "@slock/core/solid";
import type { Block, SlackFile } from "@slock/types";
import { InlineFeedback, scrollActiveListOption, useEscapeClose } from "@slock/ui";
import QuillEditor from "@slock/ui/editor/QuillEditor";
import { indexAlignedText } from "@slock/ui/editor/quillText";
import type Quill from "quill";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { uploadFilesForEdit } from "../../../slack/client/api";
import "./Composer.css";
import { createComposerDraftState, draftCacheKey } from "../../../drafts/client/api";
import { composerFeedbackKey } from "../../../slash-commands/client/api";
import ComposerSuggestPopover from "../api/editor/ComposerSuggestPopover";
import MentionHoverCard from "../api/editor/MentionHoverCard";
import { createMentionHoverController } from "../api/editor/mentionHover";
import { useMentionResolution } from "../api/editor/mentionResolution";
import {
  insertSuggestionAt,
  loadMrkdwnIntoQuill,
  pasteMrkdwnClipboard,
} from "../api/editor/mrkdwnInsert";
import { wireEmojiAutoconvert } from "../api/editor/quillEmoji";
import {
  createSuggestionController,
  syncSuggestionsAfterChange,
} from "../api/editor/suggestionController";
import { type SuggestState, suggestOpen } from "../api/editor/suggestTypes";
import { useSuggestShortcuts } from "../api/editor/useSuggestShortcuts";
import { useSuggestUi } from "../api/editor/useSuggestUi";
import ComposeDatePicker from "../api/pickers/ComposeDatePicker";
import { createComposerSubmitHandler } from "../composerSubmit";
import type { ComposerProps } from "../composerTypes";
import { wireHeaderLimit } from "../lib/headerLimit";
import { createPendingFileState } from "../lib/pendingFiles";
import { mrkdwnText } from "../lib/quillMentions";
import { buildRichTextBlocks } from "../lib/richTextBuild";
import { loadRichTextIntoQuill } from "../lib/richTextLoad";
import { useComposerShortcuts } from "../lib/useComposerShortcuts";
import { useDateEdit } from "../lib/useDateEdit";
import ComposerAttachMenu from "./ComposerAttachMenu";
import ComposerFileChips from "./ComposerFileChips";
import ComposerReplyRow from "./ComposerReplyRow";
import DraftsMenu from "./popovers/DraftsMenu";

const feedback = service("feedback");

const templates = service("templates");

export default function Composer(props: ComposerProps) {
  let quill: Quill | undefined;
  let pendingInitialText: string | undefined;
  let pendingInitialBlocks: Block[] | undefined;
  let suggestPopoverRef: HTMLDivElement | undefined;
  let caretIndex = 0;
  const [text, setText] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [dragOver, setDragOver] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  const [draftsMenuOpen, setDraftsMenuOpen] = createSignal(false);
  const resolveMention = useMentionResolution(() => quill);
  const mentionHover = createMentionHoverController();
  const dateEdit = useDateEdit(() => quill);

  useEscapeClose(
    () => props.editing?.onCancel(),
    () => !!props.editing,
  );
  useSuggestUi(() => suggestPopoverRef, suggest, setSuggest);
  createEffect(() => {
    suggest();
    scrollActiveListOption(() => suggestPopoverRef);
  });

  useComposerShortcuts({
    editing: () => !!props.editing,
    focusEditor: () => quill?.focus(),
    paneId: () => props.paneId,
    quill: () => quill,
    toggleDrafts: () => setDraftsMenuOpen((open) => !open),
  });

  const feedbackKey = () => composerFeedbackKey(props.threadTs ?? props.channelId ?? "");

  const [existingFiles, setExistingFiles] = createSignal<SlackFile[]>(
    props.editing?.initialFiles ?? [],
  );

  const pendingFiles = createPendingFileState({
    disabled: sending,
    draftKey: () =>
      props.editing || !props.channelId
        ? undefined
        : draftCacheKey(props.channelId, props.threadTs),
  });

  const loadIntoEditor = (value: string, blocks?: unknown) => {
    const richBlocks: Block[] | undefined = Array.isArray(blocks) ? blocks : undefined;
    if (quill) {
      if (richBlocks?.length) loadRichTextIntoQuill(quill, richBlocks, resolveMention);
      else loadMrkdwnIntoQuill(quill, value, resolveMention);
    } else {
      pendingInitialText = value;
      pendingInitialBlocks = richBlocks;
    }
    setText(value);
  };

  const draftState = props.editing
    ? undefined
    : createComposerDraftState({
        blocks: () => (quill ? buildRichTextBlocks(quill) : undefined),
        channelId: () => props.channelId,
        editing: () => false,
        key: () => (props.channelId ? draftCacheKey(props.channelId, props.threadTs) : undefined),
        loadIntoEditor,
        resetPreviews: () => {},
        setText,
        text,
        threadTs: () => props.threadTs,
      });

  const handleSubmit = createComposerSubmitHandler({
    channelId: () => props.channelId,
    clearDraftAfterSend: () => draftState?.clearAfterSend(pendingFiles) ?? Promise.resolve(),
    editing: () => props.editing,
    existingFiles,
    feedbackKey,
    getQuill: () => quill,
    onSent: () => props.replyTo?.onSent(),
    pendingFiles,
    replyTo: () => props.replyTo,
    sending,
    setExistingFiles,
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
      if (item.kind === "template" && item.files?.length) {
        setExistingFiles((files) => [...files, ...(item.files ?? [])]);
      }
    },
    channelId: () => props.channelId,
    includeCommands: !props.editing,
    setSuggest,
    suggest,
  });

  useSuggestShortcuts({ setSuggest, suggest, suggestions });

  const activeFeedback = () => feedback.get(feedbackKey());

  return (
    <div
      class="composer composer-frame surface-popover"
      classList={{ "composer-editing": !!props.editing, "drag-over": dragOver() }}
      onDragLeave={() => setDragOver(false)}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer?.files.length) pendingFiles.add(e.dataTransfer.files);
      }}
    >
      <Show when={props.replyTo}>{(replyTo) => <ComposerReplyRow replyTo={replyTo()} />}</Show>
      <InlineFeedback class="composer-feedback truncate" feedback={activeFeedback()} />
      <Show when={!props.editing}>
        <Slot {...props} point="composer.notice" />
      </Show>
      <Show when={draftState?.syncError()}>
        <div class="composer-draft-warning flex-align-center">
          draft failed to save
          <button class="btn-reset" onClick={() => draftState?.retrySync()} type="button">
            retry
          </button>
        </div>
      </Show>
      <ComposerFileChips
        disabled={sending()}
        existingFiles={existingFiles()}
        onRemoveExisting={(id) => setExistingFiles((files) => files.filter((f) => f.id !== id))}
        pendingFiles={pendingFiles}
      />
      <div class="composer-row">
        <ComposerAttachMenu
          onFilesSelected={(files) => pendingFiles.add(files)}
          onInsertDate={dateEdit.open}
          onOpenChange={setMenuOpen}
          open={menuOpen()}
        />
        <div class="composer-input-wrap flex-align-center">
          <QuillEditor
            onPasteFiles={(files) => pendingFiles.add(files)}
            onPasteText={(q, event) => pasteMrkdwnClipboard(q, event, resolveMention)}
            onReady={(q) => {
              quill = q;
              const initialBlocks = props.editing?.initialBlocks ?? pendingInitialBlocks;
              const initial = props.editing?.initialText ?? pendingInitialText;
              if (initialBlocks?.length) loadRichTextIntoQuill(q, initialBlocks, resolveMention);
              else if (initial) loadMrkdwnIntoQuill(q, initial, resolveMention);
              wireEmojiAutoconvert(q);
              wireHeaderLimit(q);
              onCleanup(mentionHover.bind(q));
              onCleanup(dateEdit.bind(q));
              q.on("text-change", () => {
                setText(mrkdwnText(q));
                const rawAligned = indexAlignedText(q);
                const aligned = rawAligned.endsWith("\n") ? rawAligned.slice(0, -1) : rawAligned;
                syncSuggestionsAfterChange(
                  q,
                  aligned,
                  suggestions,
                  (index) => {
                    caretIndex = index;
                  },
                  true,
                );
              });
            }}
            onSubmit={handleSubmit}
            placeholder={props.placeholder ?? "message…"}
          />
          <MentionHoverCard hoverIntent={mentionHover.hoverIntent} state={mentionHover.state} />
          <Show when={dateEdit.picker()}>
            {(state) => (
              <div class="composer-date-popover">
                <ComposeDatePicker
                  initial={state().target?.value}
                  onClose={dateEdit.close}
                  onSelect={dateEdit.select}
                />
              </div>
            )}
          </Show>
          <Show when={draftsMenuOpen()}>
            <div class="composer-drafts-popover">
              <DraftsMenu
                hasContent={!!text().trim() || pendingFiles.files().length > 0}
                onClose={() => setDraftsMenuOpen(false)}
                onDelete={(entry) => draftState?.remove(entry) ?? Promise.resolve()}
                onSaveAndStartNew={() => void draftState?.saveAndStartNew()}
                onSaveAsTemplate={async (name) => {
                  if (!quill) return;
                  const blocks = buildRichTextBlocks(quill);
                  const newFiles = pendingFiles.files();
                  const uploaded = newFiles.length
                    ? await uploadFilesForEdit(newFiles.map((file) => ({ file })))
                    : [];
                  const files = [...existingFiles(), ...uploaded];
                  templates.saveTemplate(name, blocks, files);
                }}
                onSwitchTo={(entry) => draftState?.switchTo(entry)}
                stack={draftState?.stack() ?? []}
              />
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
        <Show when={props.editing && sending()}>
          <span class="composer-send-status">saving…</span>
        </Show>
      </div>
    </div>
  );
}
