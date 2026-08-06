import { Button, Icon, InlineFeedback, Menu, Tooltip } from "@slock/ui";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { actionFeedback, composerFeedbackKey } from "../../lib/store";
import AttachmentCard from "../messages/parts/media/AttachmentCard";
import { createComposerController } from "./composerController";
import type { ComposerProps } from "./composerTypes";
import { suggestItemContent } from "./lib/suggestTypes";
import { linkPreviewToAttachment } from "./lib/textDetection";
import ComposeDatePicker from "./popovers/ComposeDatePicker";
import ComposeLinkEditor from "./popovers/ComposeLinkEditor";
import "./Composer.css";

function FileChipThumbnail(props: { file: File }) {
  if (!props.file.type.startsWith("image/")) return null;
  const url = URL.createObjectURL(props.file);
  onCleanup(() => URL.revokeObjectURL(url));
  return <img alt="" class="composer-file-chip-thumb" src={url} />;
}

function FileChip(props: {
  file: File;
  disabled: boolean;
  onRemove: () => void;
  onRename: (name: string) => void;
}) {
  const [renaming, setRenaming] = createSignal(false);
  const [draft, setDraft] = createSignal("");

  const startRename = () => {
    if (props.disabled) return;
    setDraft(props.file.name);
    setRenaming(true);
  };
  const commit = () => {
    if (!renaming()) return;
    setRenaming(false);
    props.onRename(draft());
  };

  return (
    <span class="composer-file-chip flex-align-center">
      <FileChipThumbnail file={props.file} />
      <Show
        fallback={
          <input
            autofocus
            class="composer-file-chip-rename-input"
            onBlur={commit}
            onInput={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setRenaming(false);
              }
            }}
            ref={(el) => requestAnimationFrame(() => el.select())}
            value={draft()}
          />
        }
        when={!renaming()}
      >
        <button
          aria-label={`Rename ${props.file.name}`}
          class="composer-file-chip-name btn-reset"
          disabled={props.disabled}
          onClick={startRename}
          type="button"
        >
          {props.file.name}
        </button>
      </Show>
      <Tooltip content="Remove">
        <button
          aria-label={`Remove ${props.file.name}`}
          class="btn-reset"
          disabled={props.disabled}
          onClick={props.onRemove}
          type="button"
        >
          <Icon name="close" size={12} />
        </button>
      </Tooltip>
    </span>
  );
}

export default function Composer(props: ComposerProps) {
  const {
    toolsOpen,
    setToolsOpen,
    dateOpen,
    setDateOpen,
    linkEditor,
    setLinkEditor,
    pendingFiles,
    dragOver,
    setDragOver,
    suggest,
    setSuggest,
    linkPreviews,
    editor,
    suggestions,
    targetChannelId,
    feedbackKey,
    disabled,
    placeholder,
    runTool,
    availableTools,
    addFiles,
    removeFile,
    renameFile,
    submit,
    onKeyDown,
    onInput,
    onPaste,
    onCopy,
    onCut,
    onEditorClick,
    setSuggestPopoverRef,
    setFileInputRef,
    sending,
    draftSyncError,
    retryDraftSync,
    retryingDraft,
    retrySlashCommandSuggestions,
    slashCommandSuggestionsError,
    slashCommandSuggestionsLoading,
  } = createComposerController(props);
  return (
    <form
      aria-busy={sending()}
      class="composer"
      classList={{ "composer-editing": !!props.editing, "drag-over": dragOver() }}
      onDragLeave={() => setDragOver(false)}
      onDragOver={(e) => {
        e.preventDefault();
        if (!(props.editing || sending()) && targetChannelId()) setDragOver(true);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!props.editing && e.dataTransfer?.files.length) addFiles(e.dataTransfer.files);
      }}
      onSubmit={submit}
    >
      <Show when={!props.editing && pendingFiles().length > 0}>
        <div class="composer-file-chips">
          <For each={pendingFiles()}>
            {(file, i) => (
              <FileChip
                disabled={sending()}
                file={file}
                onRemove={() => removeFile(i())}
                onRename={(name) => renameFile(i(), name)}
              />
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
                <Tooltip class="composer-link-preview-remove-anchor" content="Remove preview">
                  <button
                    aria-label="Remove preview"
                    class="composer-link-preview-remove btn-reset flex-center"
                    disabled={sending()}
                    onClick={() => linkPreviews.dismissLinkPreview(preview.url)}
                    type="button"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </Tooltip>
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={!props.editing}>
        <InlineFeedback
          class="composer-feedback"
          feedback={actionFeedback.get(composerFeedbackKey(feedbackKey()))}
        />
      </Show>
      <Show when={!props.editing && draftSyncError()}>
        <div class="composer-draft-warning flex-between" role="alert">
          <span>Draft sync is unavailable. Keep this tab open until it is saved.</span>
          <Button
            disabled={retryingDraft()}
            onClick={() => void retryDraftSync()}
            size="sm"
            variant="ghost"
          >
            {retryingDraft() ? "Retrying…" : "Retry now"}
          </Button>
        </div>
      </Show>
      <Show when={!props.editing && slashCommandSuggestionsLoading()}>
        <div class="composer-capability-notice" role="status">
          Loading slash-command suggestions…
        </div>
      </Show>
      <Show when={!props.editing && slashCommandSuggestionsError()}>
        <div class="composer-capability-notice composer-capability-error flex-between" role="alert">
          <span>Couldn’t load slash-command suggestions. Commands can still be typed.</span>
          <Button onClick={() => void retrySlashCommandSuggestions()} size="sm" variant="ghost">
            Try again
          </Button>
        </div>
      </Show>
      <div class="composer-row">
        <div class="composer-tools-wrap">
          <Menu
            onClose={() => setToolsOpen(false)}
            open={toolsOpen()}
            panelClass="menu-panel composer-tools-menu"
            placement="top"
            trigger={
              <Tooltip content="Add formatting or a block">
                <button
                  aria-label="Add formatting or a block"
                  class="composer-tool btn-reset flex-center flex-shrink-0"
                  classList={{ active: toolsOpen() }}
                  disabled={disabled()}
                  onClick={() => setToolsOpen(!toolsOpen())}
                  onMouseDown={(e) => e.preventDefault()}
                  type="button"
                >
                  <Icon name="plus" size={16} />
                </button>
              </Tooltip>
            }
          >
            <For each={availableTools()}>
              {(tool) => (
                <button
                  class="menu-item"
                  onClick={() => runTool(tool)}
                  onMouseDown={(e) => e.preventDefault()}
                  type="button"
                >
                  <Icon name={tool.icon} size={15} />
                  {tool.title}
                </button>
              )}
            </For>
          </Menu>
          <Show when={dateOpen()}>
            <div class="composer-date-popover">
              <ComposeDatePicker
                onClose={() => setDateOpen(false)}
                onSelect={(ts, format) => {
                  editor.restoreSelection();
                  editor.insertDateChipAtCaret(ts, format);
                  setDateOpen(false);
                }}
              />
            </div>
          </Show>
        </div>
        <div class="composer-input-wrap">
          {/* biome-ignore lint/a11y/useSemanticElements: rich-text formatting needs a real contenteditable, not <textarea> */}
          <div
            aria-label={dragOver() ? "Drop to attach" : placeholder()}
            aria-multiline="true"
            class="composer-input input-reset"
            classList={{ disabled: disabled() }}
            contentEditable={!disabled()}
            data-placeholder={dragOver() ? "Drop to attach" : placeholder()}
            onBlur={() => setSuggest(null)}
            onClick={onEditorClick}
            onCopy={onCopy}
            onCut={onCut}
            onInput={onInput}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            ref={editor.setRef}
            role="textbox"
            tabIndex={0}
          />
          <Show when={suggest()}>
            {(s) => (
              <div class="menu-panel composer-suggest-popover" ref={setSuggestPopoverRef}>
                <For each={s().items}>
                  {(item, i) => (
                    <button
                      class="composer-suggest-row btn-reset flex-align-center"
                      classList={{ active: i() === s().active }}
                      onClick={() => suggestions.applySuggestion(i())}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => suggestions.setActiveSuggestion(i())}
                      type="button"
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
                currentLabel={le().label}
                linkEl={le().el}
                onClose={() => setLinkEditor(null)}
                onSync={editor.syncFromDom}
                url={le().url}
              />
            )}
          </Show>
        </div>
        <input
          class="composer-file-input"
          disabled={disabled()}
          multiple
          onChange={(e) => {
            if (e.currentTarget.files?.length) addFiles(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
          ref={setFileInputRef}
          type="file"
        />
        <Show when={sending()}>
          <span class="composer-send-status" role="status">
            {props.editing
              ? "Saving…"
              : pendingFiles().length > 0
                ? `Uploading ${pendingFiles().length === 1 ? "file" : `${pendingFiles().length} files`}…`
                : "Sending…"}
          </span>
        </Show>
      </div>
    </form>
  );
}
