import { Slot, service } from "@slock/core/solid";
import type { Block, SlackFile } from "@slock/types";
import { InlineFeedback, useEscapeClose } from "@slock/ui";
import QuillEditor from "@slock/ui/editor/QuillEditor";
import type Quill from "@slock/ui/editor/quill";
import { indexAlignedText } from "@slock/ui/editor/quillText";
import { createMemo, createSignal, onCleanup, Show, untrack } from "solid-js";
import "./Composer.css";
import { draftCacheKey } from "../../../drafts/client/api";
import { composerFeedbackKey } from "../../../slash-commands/client/api";
import ComposerSuggestPopover from "../api/editor/ComposerSuggestPopover";
import MentionHoverCard from "../api/editor/MentionHoverCard";
import { createMentionHoverController } from "../api/editor/mentionHover";
import { useMentionResolution } from "../api/editor/mentionResolution";
import {
  insertSuggestionAt,
  loadMrkdwnIntoQuill,
  pasteBlocksClipboard,
} from "../api/editor/mrkdwnInsert";
import {
  createSuggestionController,
  syncSuggestionsAfterChange,
} from "../api/editor/suggestionController";
import { type SuggestState, suggestOpen } from "../api/editor/suggestTypes";
import { useSuggestShortcuts } from "../api/editor/useSuggestShortcuts";
import { useSuggestUi } from "../api/editor/useSuggestUi";
import { createComposerSubmitHandler } from "../composerSubmit";
import type { ComposerProps } from "../composerTypes";
import { uploadAll } from "../lib/attachUpload";
import { mrkdwnText } from "../lib/deltaLines";
import { createEditAttachments } from "../lib/editAttachments";
import { createEditorPlugins } from "../lib/editorPlugins";
import { wireHeaderLimit } from "../lib/headerLimit";
import { createLinkPreviews } from "../lib/linkPreviews";
import { createPendingFileState } from "../lib/pendingFiles";
import { buildRichTextBlocks } from "../lib/richTextBuild";
import { loadRichTextIntoQuill } from "../lib/richTextLoad";
import { useComposerShortcuts } from "../lib/useComposerShortcuts";
import ComposerAttachMenu from "./ComposerAttachMenu";
import ComposerFileChips from "./ComposerFileChips";
import ComposerLinkPreviews from "./ComposerLinkPreviews";
import ComposerReplyRow from "./ComposerReplyRow";
import DraftsMenu from "./popovers/DraftsMenu";

const feedback = service("feedback");
const composer = service("composer");
const drafts = service("drafts");

export default function Composer(props: ComposerProps) {
  let quill: Quill | undefined;
  let suggestPopoverRef: HTMLDivElement | undefined;
  let caretIndex = 0;
  const disposers: Array<() => void> = [];
  onCleanup(() => {
    for (const dispose of disposers.splice(0)) dispose();
  });
  const [sending, setSending] = createSignal(false);
  const [dragOver, setDragOver] = createSignal(false);
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  const [draftsMenuOpen, setDraftsMenuOpen] = createSignal(false);
  const resolveMention = useMentionResolution(() => quill);
  const mentionHover = createMentionHoverController();
  const editorPlugins = createEditorPlugins(() => quill, props);

  useEscapeClose(
    () => props.editing?.onCancel(),
    () => !!props.editing,
  );
  useSuggestUi(() => suggestPopoverRef, suggest, setSuggest);

  useComposerShortcuts({
    dismissPreviews: () => linkPreviews.dismissAll(),
    editing: () => !!props.editing,
    focusEditor: () => quill?.focus(),
    hasPreviews: () => linkPreviews.previews().length > 0,
    paneId: () => props.paneId,
    quill: () => quill,
    toggleDrafts: () => setDraftsMenuOpen((open) => !open),
  });

  const feedbackKey = () => composerFeedbackKey(props.threadTs ?? props.channelId);

  const [existingFiles, setExistingFiles] = createSignal<SlackFile[]>(
    () => props.editing?.initialFiles ?? [],
  );

  const editAttachments = createEditAttachments(() => props.editing?.initialAttachments);

  const pendingFiles = createPendingFileState({
    disabled: sending,
    draftKey: () => (props.editing ? undefined : draftCacheKey(props.channelId, props.threadTs)),
    store: composer.pendingFiles,
    uploadOnAttach: composer.uploadOnAttach,
  });

  const [edits, setEdits] = createSignal(0);
  const [editorReady, setEditorReady] = createSignal(false);
  const editorOps = createMemo(() => {
    edits();
    return quill?.getContents().ops ?? [];
  });
  const text = createMemo(() => mrkdwnText(editorOps()));
  const editorBlocks = createMemo(() => buildRichTextBlocks(editorOps()));
  const linkPreviews = createLinkPreviews({
    blocks: editorBlocks,
    channelId: () => props.channelId,
    enabled: () => !props.editing && pendingFiles.files().length === 0,
  });

  const loadIntoEditor = (blocks: Block[]) => {
    if (!quill) return;
    loadRichTextIntoQuill(quill, blocks, resolveMention);
  };

  const draftState = untrack(() => props.editing)
    ? undefined
    : drafts.createComposerState({
        blocks: editorBlocks,
        channelId: () => props.channelId,
        loadIntoEditor,
        ready: editorReady,
        threadTs: () => props.threadTs,
      });

  const handleSubmit = createComposerSubmitHandler<ReturnType<Quill["getContents"]>>({
    channelId: () => props.channelId,
    clearDraftAfterSend: () => draftState?.clearAfterSend(pendingFiles) ?? Promise.resolve(),
    editing: () => props.editing,
    existingFiles,
    feedbackKey,
    getQuill: () => quill,
    linkPreviews,
    onSent: () => props.replyTo?.onSent(),
    pendingFiles,
    removedAttachmentIds: editAttachments.removed,
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
      class={[
        "composer composer-frame surface-popover",
        { "composer-editing": !!props.editing, "drag-over": dragOver() },
      ]}
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
      <ComposerLinkPreviews
        onRemove={(preview) =>
          props.editing ? editAttachments.remove(preview) : linkPreviews.dismiss(preview.url)
        }
        previews={props.editing ? editAttachments.previews() : linkPreviews.previews()}
      />
      <div class="composer-row">
        <ComposerAttachMenu
          onFilesSelected={(files) => pendingFiles.add(files)}
          editor={editorPlugins.editor}
          onOpenChange={setMenuOpen}
          open={menuOpen()}
        />
        <div class="composer-input-wrap flex-align-center">
          <QuillEditor
            onPasteFiles={(files) => pendingFiles.add(files)}
            onPasteText={(q, event) => pasteBlocksClipboard(q, event, resolveMention)}
            onReady={(q) => {
              quill = q;
              const initialBlocks = props.editing?.initialBlocks;
              const initial = props.editing?.initialText;
              if (initialBlocks?.length) loadRichTextIntoQuill(q, initialBlocks, resolveMention);
              else if (initial) loadMrkdwnIntoQuill(q, initial, resolveMention);
              if (props.editing) {
                q.focus();
                q.setSelection(q.getLength(), 0);
              }
              setEdits((count) => count + 1);
              wireHeaderLimit(q);
              disposers.push(mentionHover.bind(q), ...editorPlugins.bind(q));
              q.on("text-change", () => {
                setEdits((count) => count + 1);
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
              setEditorReady(true);
            }}
            onSubmit={handleSubmit}
            placeholder={props.placeholder ?? "message…"}
          />
          <MentionHoverCard hoverIntent={mentionHover.hoverIntent} state={mentionHover.state} />
          {editorPlugins.popover()}
          <Show when={draftsMenuOpen()}>
            <DraftsMenu
              hasContent={!!text().trim() || pendingFiles.files().length > 0}
              onClose={() => setDraftsMenuOpen(false)}
              onDelete={(entry) => draftState?.remove(entry) ?? Promise.resolve()}
              onSaveAndStartNew={() => void draftState?.saveAndStartNew()}
              onSaveAs={async (action, name) => {
                if (!quill) return;
                const blocks = editorBlocks();
                const uploaded = await uploadAll(pendingFiles.files());
                action.save(name, { blocks, files: [...existingFiles(), ...uploaded] });
              }}
              onSwitchTo={(entry) => draftState?.switchTo(entry)}
              stack={draftState?.stack() ?? []}
            />
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
        <Show when={!props.editing}>
          <Slot {...props} point="composer.trailing" text={text()} />
        </Show>
        <Show when={props.editing && sending()}>
          <span class="composer-send-status">saving…</span>
        </Show>
      </div>
    </div>
  );
}
