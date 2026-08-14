import {
  ATOM_DATE,
  ATOM_EMOJI,
  ATOM_MENTION,
  blocksToDoc,
  type ComposeAtomData,
  composeAtomRenderers,
  docToBlocks,
  formatSlackDateTokens,
} from "@slock/blockkit";
import type { Block as SlackBlock } from "@slock/slack-api";
import { uploadFiles } from "@slock/slack-api";
import type { DocModel } from "@slock/ui";
import {
  createAtomRun,
  createEditorStore,
  createParagraph,
  createTextRun,
  EditorView,
  emptyDoc,
  IconButton,
  InlineFeedback,
  Menu,
  MenuItem,
} from "@slock/ui";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { actionFeedback, composerFeedbackKey, store } from "../../lib/store";
import type { ComposerProps } from "./composerTypes";
import FileChip from "./FileChip";
import { clearPersistedDraft, createComposerDraftState } from "./lib/drafts";
import { createPendingFileState, draftCacheKey, submitComposerPayload } from "./lib/submission";
import { createSuggestionController } from "./lib/suggestionController";
import type { SuggestItem, SuggestState } from "./lib/suggestTypes";
import { suggestItemContent } from "./lib/suggestTypes";
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
  // biome-ignore lint/suspicious/noUnassignedVariables: standard Solid ref pattern
  let fileInputRef: HTMLInputElement | undefined;
  let plusClickTimer: ReturnType<typeof setTimeout> | undefined;

  useSuggestUi(suggestPopoverRef, suggest, setSuggest);

  const applyTextSuggestion = (item: SuggestItem, state: SuggestState) => {
    if (item.kind === "command") {
      editor.replaceTriggerRange(state.start, createTextRun(`/${item.name} `));
      return;
    }
    if (item.kind === "emoji") {
      editor.replaceTriggerRange(state.start, [
        createAtomRun(ATOM_EMOJI, {
          fallbackText: `:${item.name}:`,
          name: item.name,
          unicode: item.unicode,
        }),
        createTextRun(" "),
      ]);
      return;
    }
    if (item.kind === "user") {
      editor.replaceTriggerRange(state.start, [
        createAtomRun(ATOM_MENTION, {
          fallbackText: `<@${item.id}>`,
          refId: item.id,
          target: "user",
        }),
        createTextRun(" "),
      ]);
      return;
    }
    editor.replaceTriggerRange(state.start, [
      createAtomRun(ATOM_MENTION, {
        fallbackText: `<#${item.id}>`,
        refId: item.id,
        target: "channel",
      }),
      createTextRun(" "),
    ]);
  };

  const suggestionCtl = createSuggestionController({
    applyTextSuggestion,
    channelId: () => props.channelId,
    includeCommands: !props.editing,
    setSuggest,
    suggest,
  });

  const handleCaretActivity = () => {
    const caret = editor.getCaretContext();
    suggestionCtl.updateSuggestions(caret?.text ?? "", caret?.caretOffset ?? 0);
  };

  const handleKeyDownCapture = (event: KeyboardEvent): boolean => {
    if (!suggest()) return false;
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
  const pendingFiles = createPendingFileState({
    disabled: sending,
    draftKey: () => (props.channelId ? draftCacheKey(props.channelId, props.threadTs) : undefined),
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

  const handleSubmit = async () => {
    if (sending() || !props.channelId) return;
    const text = editor.getPlainText().trim();
    if (!text && pendingFiles.files().length === 0 && editor.isEmpty()) return;
    setSending(true);
    try {
      if (props.editing) {
        const blocks = editor.isEmpty() ? undefined : docToBlocks(editor.getDoc());
        const ok = await props.editing.onSave(text, blocks);
        if (!ok) return;
        return;
      }
      const channelId = props.channelId;
      const threadTs = props.threadTs;
      const isSlashAttempt = text.startsWith("/");
      const blocks = isSlashAttempt || editor.isEmpty() ? undefined : docToBlocks(editor.getDoc());
      const key = draftCacheKey(channelId, threadTs);
      await submitComposerPayload({
        blocks,
        files: pendingFiles.files(),
        isSlashAttempt,
        onSuccess: () => {
          editor.clear();
          pendingFiles.clear(key);
          clearPersistedDraft(channelId, threadTs);
          props.replyTo?.onSent();
        },
        runCommand: () => store.commands.handleSlashCommand(channelId, threadTs, text),
        sendMessage: (b) => store.messages.sendMessage(channelId, text, threadTs, b),
        uploadFiles: () => uploadFiles(channelId, pendingFiles.files(), threadTs, text),
      });
    } catch (err) {
      actionFeedback.flash(
        feedbackKey(),
        err instanceof Error ? err.message : "Failed to send message.",
        "error",
      );
    } finally {
      setSending(false);
    }
  };

  const handleDateSelect = (timestamp: number, format: string) => {
    setDateOpen(false);
    editor.insertAtomAtCaret(ATOM_DATE, {
      fallbackText: formatSlackDateTokens(format, timestamp),
      format,
      timestamp,
    });
    editor.focus();
  };

  const handlePlusClick = () => {
    if (plusClickTimer) {
      clearTimeout(plusClickTimer);
      plusClickTimer = undefined;
      return; // second click of a double-click — let onDblClick handle it
    }
    plusClickTimer = setTimeout(() => {
      plusClickTimer = undefined;
      setMenuOpen(true);
    }, 220);
  };
  const handlePlusDblClick = () => {
    if (plusClickTimer) {
      clearTimeout(plusClickTimer);
      plusClickTimer = undefined;
    }
    fileInputRef?.click();
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
          <Menu
            class="composer-plus-menu"
            onClose={() => setMenuOpen(false)}
            open={menuOpen()}
            panelClass="menu-panel composer-tools-menu"
            trigger={
              <IconButton
                circular
                icon="plus"
                label="Add attachment or date (double-click to attach)"
                onClick={handlePlusClick}
                onDblClick={handlePlusDblClick}
                size="md"
              />
            }
          >
            <MenuItem
              icon="attachment"
              onClick={() => {
                setMenuOpen(false);
                fileInputRef?.click();
              }}
            >
              Attach file
            </MenuItem>
            <MenuItem
              icon="calendar"
              onClick={() => {
                setMenuOpen(false);
                setDateOpen(true);
              }}
            >
              Insert date
            </MenuItem>
          </Menu>
          <input
            class="composer-file-input"
            multiple
            onChange={(e) => {
              if (e.currentTarget.files) pendingFiles.add(e.currentTarget.files);
              e.currentTarget.value = "";
            }}
            ref={fileInputRef}
            type="file"
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
          <Show when={suggest()}>
            {(state) => (
              <div class="menu-panel composer-suggest-popover" ref={setSuggestPopoverRef}>
                <For each={state().items}>
                  {(item, i) => (
                    <button
                      class="composer-suggest-row flex-align-center"
                      classList={{ active: i() === state().active }}
                      onClick={() => suggestionCtl.applySuggestion(i())}
                      onMouseEnter={() => suggestionCtl.setActiveSuggestion(i())}
                      type="button"
                    >
                      {suggestItemContent(item)}
                    </button>
                  )}
                </For>
              </div>
            )}
          </Show>
        </div>
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
