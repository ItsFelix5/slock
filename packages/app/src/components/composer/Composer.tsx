import { Icon, InlineFeedback, Menu, Tooltip } from "@slock/ui";
import { For, Show } from "solid-js";
import { actionFeedback, composerFeedbackKey } from "../../lib/store";
import AttachmentCard from "../messages/parts/media/AttachmentCard";
import { type ComposerProps, createComposerController } from "./composerController";
import { suggestItemContent } from "./lib/suggestTypes";
import { linkPreviewToAttachment } from "./lib/textDetection";
import ComposeDatePicker from "./popovers/ComposeDatePicker";
import ComposeLinkEditor from "./popovers/ComposeLinkEditor";
import ComposeUserPicker from "./popovers/ComposeUserPicker";
import "./Composer.css";
export default function Composer(props: ComposerProps) {
  const {
    toolsOpen,
    setToolsOpen,
    mentionOpen,
    setMentionOpen,
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
    submit,
    onKeyDown,
    onInput,
    onPaste,
    onEditorClick,
    setSuggestPopoverRef,
    getFileInputRef,
  } = createComposerController(props);
  return (
    <form
      class="composer"
      classList={{ "composer-editing": !!props.editing, "drag-over": dragOver() }}
      onDragLeave={() => setDragOver(false)}
      onDragOver={(e) => {
        e.preventDefault();
        if (!props.editing && targetChannelId()) setDragOver(true);
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
              <span class="composer-file-chip flex-align-center">
                {file.name}
                <Tooltip content="Remove">
                  <button
                    aria-label="Remove"
                    class="btn-reset"
                    onClick={() => removeFile(i())}
                    type="button"
                  >
                    <Icon name="close" size={12} />
                  </button>
                </Tooltip>
              </span>
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
                <Tooltip content="Remove preview">
                  <button
                    aria-label="Remove preview"
                    class="composer-link-preview-remove btn-reset flex-center"
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
          <Show when={mentionOpen()}>
            <div class="composer-mention-popover">
              <ComposeUserPicker
                onClose={() => setMentionOpen(false)}
                onSelect={(id) => {
                  editor.restoreSelection();
                  editor.insertMentionChipAtCaret(id);
                  setMentionOpen(false);
                }}
              />
            </div>
          </Show>
          <Show when={dateOpen()}>
            <div class="composer-mention-popover">
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
                url={le().url}
              />
            )}
          </Show>
        </div>
        <input
          class="composer-file-input"
          multiple
          onChange={(e) => {
            if (e.currentTarget.files?.length) addFiles(e.currentTarget.files);
            e.currentTarget.value = "";
          }}
          ref={getFileInputRef}
          type="file"
        />
      </div>
    </form>
  );
}
