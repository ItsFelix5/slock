import { formatSlackDate } from "@slock/blockkit";
import type { Block, SlackFile } from "@slock/types";
import {
  focusedPaneId,
  focusPaneById,
  InlineFeedback,
  indexAlignedText,
  QuillEditor,
  scrollActiveListOption,
  useEscapeClose,
  useShortcut,
} from "@slock/ui";
import type Quill from "quill";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { uploadFilesForEdit } from "../../lib/api";
import { actionFeedback, composerFeedbackKey } from "../../lib/feedback";
import { store } from "../../lib/store";
import "./Composer.css";
import ComposerAttachMenu from "./ComposerAttachMenu";
import ComposerReplyRow from "./ComposerReplyRow";
import ComposerSuggestPopover from "./ComposerSuggestPopover";
import { createComposerSubmitHandler } from "./composerSubmit";
import type { ComposerProps } from "./composerTypes";
import FileChip from "./FileChip";
import { createComposerDraftState, createPendingFileState, draftCacheKey } from "./lib/drafts";
import { createMentionHoverController } from "./lib/mentionHover";
import { useMentionResolution } from "./lib/mentionResolution";
import { insertSuggestionAt, loadMrkdwnIntoQuill, pasteMrkdwnClipboard } from "./lib/mrkdwnInsert";
import { wireEmojiAutoconvert } from "./lib/quillEmoji";
import { mrkdwnText } from "./lib/quillMentions";
import { buildRichTextBlocks } from "./lib/richTextBuild";
import { loadRichTextIntoQuill } from "./lib/richTextLoad";
import { createSuggestionController, syncSuggestionsAfterChange } from "./lib/suggestionController";
import { type SuggestState, suggestOpen } from "./lib/suggestTypes";
import { useSuggestShortcuts } from "./lib/useSuggestShortcuts";
import { useSuggestUi } from "./lib/useSuggestUi";
import MentionHoverCard from "./MentionHoverCard";
import ComposeDatePicker from "./popovers/ComposeDatePicker";
import DraftsMenu from "./popovers/DraftsMenu";

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
  const [dateOpen, setDateOpen] = createSignal(false);
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  const [draftsMenuOpen, setDraftsMenuOpen] = createSignal(false);
  const resolveMention = useMentionResolution(() => quill);
  const mentionHover = createMentionHoverController();

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
    combo: { key: "i" },
    enabled: () => !props.editing && !!props.paneId && focusedPaneId() === props.paneId,
    handler: () => quill?.focus(),
    id: "composer.focus",
    label: "Focus the message box",
    scope: "composer",
    group: "Message box",
  });
  useShortcut({
    allowInInputs: true,
    combo: { alt: true, key: "d", mod: true },
    enabled: () => !props.editing && !!props.paneId && focusedPaneId() === props.paneId,
    handler: () => setDraftsMenuOpen((open) => !open),
    id: "composer.drafts",
    label: "Browse saved drafts",
    scope: "composer",
    group: "Message box",
  });
  useEscapeClose(
    () => {
      if (props.paneId) focusPaneById(props.paneId);
    },
    () => !props.editing && !!quill && document.activeElement === quill.root,
  );

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

  const handleDateSelect = (timestamp: number, format: string) => {
    setDateOpen(false);
    if (!quill) return;
    const index = quill.getSelection(true)?.index ?? quill.getLength();
    quill.insertEmbed(index, "date", {
      fallback: formatSlackDate(timestamp),
      format,
      ts: timestamp,
    });
    quill.insertText(index + 1, " ");
    quill.setSelection(index + 2, 0);
    quill.focus();
  };

  const feedback = () => actionFeedback.get(feedbackKey());

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
      <InlineFeedback class="composer-feedback truncate" feedback={feedback()} />
      <Show when={draftState?.syncError()}>
        <div class="composer-draft-warning flex-align-center">
          draft failed to save
          <button class="btn-reset" onClick={() => draftState?.retrySync()} type="button">
            retry
          </button>
        </div>
      </Show>
      <Show when={existingFiles().length > 0 || pendingFiles.files().length > 0}>
        <div class="composer-file-chips">
          <For each={existingFiles()}>
            {(file) => (
              <FileChip
                disabled={sending()}
                file={
                  new File([], file.title || file.name, { type: file.isImage ? "image/*" : "" })
                }
                onRemove={() => setExistingFiles((files) => files.filter((f) => f.id !== file.id))}
                thumbSrc={file.thumbUrl}
              />
            )}
          </For>
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
        <ComposerAttachMenu
          onFilesSelected={(files) => pendingFiles.add(files)}
          onInsertDate={() => setDateOpen(true)}
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
              onCleanup(mentionHover.bind(q));
              q.on("text-change", () => {
                setText(mrkdwnText(q));
                const rawAligned = indexAlignedText(q);
                const aligned = rawAligned.endsWith("\n") ? rawAligned.slice(0, -1) : rawAligned;
                syncSuggestionsAfterChange(q, aligned, suggestions, (index) => {
                  caretIndex = index;
                });
              });
            }}
            onSubmit={handleSubmit}
            placeholder={props.placeholder ?? "message…"}
          />
          <MentionHoverCard hoverIntent={mentionHover.hoverIntent} state={mentionHover.state} />
          <Show when={dateOpen()}>
            <div class="composer-date-popover">
              <ComposeDatePicker onClose={() => setDateOpen(false)} onSelect={handleDateSelect} />
            </div>
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
                  store.composerTemplates.saveTemplate(name, blocks, files);
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
