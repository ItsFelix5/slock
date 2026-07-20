import { Icon, InlineFeedback, Overlay, PanelHeader, Tooltip, useEscapeClose } from "@slock/ui";
import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { actionFeedback, channelDisplayName, store } from "../../lib/store";
import "../composer/Composer.css";
import { createEditorCommands } from "../composer/lib/editor/editorCommands";
import { handleMarkShortcut } from "../composer/lib/editor/markShortcuts";
import { MARKDOWN_DIALECT } from "../composer/lib/richtext";
import "./CanvasPanel.css";

const MARK_TOOLS = [
  { icon: "bold", mark: "bold", title: "Bold (Ctrl+B)" },
  { icon: "italic", mark: "italic", title: "Italic (Ctrl+I)" },
  { icon: "strikethrough", mark: "strike", title: "Strikethrough (Ctrl+Shift+X)" },
  { icon: "code", mark: "code", title: "Inline code (Ctrl+Shift+C)" },
] as const;

const HEADING_TOOLS = [
  { icon: "heading-1", level: 1, title: "Heading 1" },
  { icon: "heading-2", level: 2, title: "Heading 2" },
  { icon: "heading-3", level: 3, title: "Heading 3" },
] as const;

export default function CanvasPanel() {
  const channelId = store.canvas.openCanvasChannelId;
  useEscapeClose(store.canvas.closeChannelCanvas);

  const fileId = () => {
    const id = channelId();
    return id ? store.canvas.canvasByChannel[id]?.fileId : undefined;
  };

  const [content, { mutate }] = createResource(fileId, store.canvas.loadCanvasContent);
  const [saving, setSaving] = createSignal(false);
  const [dirty, setDirty] = createSignal(false);
  const [text, setText] = createSignal("");

  const editor = createEditorCommands({
    closeSuggestions: () => {},
    dialect: MARKDOWN_DIALECT,
    resetLinkPreviews: () => {},
    setText: (v) => {
      setText(v);
      setDirty(true);
    },
  });

  // Only reloads the editor's DOM when a *different* canvas has finished
  // loading — reacting to every content() change would also fire right
  // after our own save() below (mutate() updates it to the just-saved
  // text), which would wipe the caret position for no reason.
  let loadedFileId: string | undefined;
  createEffect(() => {
    if (content.loading) return;
    const id = fileId();
    if (id === loadedFileId) return;
    loadedFileId = id;
    const value = content() ?? "";
    setText(value);
    setDirty(false);
    editor.loadDraftIntoEditor(value);
  });

  const save = async () => {
    const id = fileId();
    if (!id) return;
    setSaving(true);
    await store.canvas.saveChannelCanvas(id, text());
    mutate(text());
    setDirty(false);
    setSaving(false);
  };

  const onInput = () => {
    editor.normalizeStrayEmptyBlock();
    if (editor.maybeApplyLineTrigger()) return;
    editor.maybeLinkifyTypedUrl();
    editor.syncFromDom();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (handleMarkShortcut(e, editor)) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (!(editor.handleShiftEnterInHeader() || editor.handleShiftEnterInList())) {
        editor.insertLineBreak();
      }
      return;
    }
    if (
      e.key === "Backspace" &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      (editor.handleBackspaceOnQuote() ||
        editor.handleBackspaceOnHeading() ||
        editor.handleBackspaceOnDivider())
    ) {
      e.preventDefault();
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData?.getData("text/plain") ?? "";
    if (pasted) {
      editor.insertPlainTextAtCaret(pasted);
      editor.linkifyAll();
    }
  };

  // Every toolbar button needs this: a plain click blurs the editor and
  // collapses its selection before onClick fires, so applyMark/applyHeader
  // etc. would find nothing selected to act on.
  const preserveSelection = (e: MouseEvent) => e.preventDefault();

  return (
    <Show when={channelId()}>
      {(id) => (
        <Overlay onClose={store.canvas.closeChannelCanvas}>
          <div class="canvas-panel-card flex-col">
            <PanelHeader onClose={store.canvas.closeChannelCanvas}>
              <div class="canvas-panel-title">
                Canvas · #{channelDisplayName(store.channels.channelById(id()), id())}
              </div>
            </PanelHeader>
            <Show
              fallback={
                <div class="canvas-panel-loading flex-center text-dim text-sm">Loading canvas…</div>
              }
              when={!content.loading}
            >
              <div class="canvas-panel-toolbar flex-align-center">
                <For each={MARK_TOOLS}>
                  {(tool) => (
                    <Tooltip content={tool.title}>
                      <button
                        aria-label={tool.title}
                        class="canvas-toolbar-btn btn-reset flex-center"
                        onClick={() => editor.applyMark(tool.mark)}
                        onMouseDown={preserveSelection}
                        type="button"
                      >
                        <Icon name={tool.icon} size={15} />
                      </button>
                    </Tooltip>
                  )}
                </For>
                <span class="canvas-toolbar-divider" />
                <For each={HEADING_TOOLS}>
                  {(tool) => (
                    <Tooltip content={tool.title}>
                      <button
                        aria-label={tool.title}
                        class="canvas-toolbar-btn btn-reset flex-center"
                        onClick={() => editor.applyHeader(tool.level)}
                        onMouseDown={preserveSelection}
                        type="button"
                      >
                        <Icon name={tool.icon} size={15} />
                      </button>
                    </Tooltip>
                  )}
                </For>
                <span class="canvas-toolbar-divider" />
                <Tooltip content="Bulleted list">
                  <button
                    aria-label="Bulleted list"
                    class="canvas-toolbar-btn btn-reset flex-center"
                    onClick={() => editor.applyList(false)}
                    onMouseDown={preserveSelection}
                    type="button"
                  >
                    <Icon name="bulleted-list" size={15} />
                  </button>
                </Tooltip>
                <Tooltip content="Numbered list">
                  <button
                    aria-label="Numbered list"
                    class="canvas-toolbar-btn btn-reset flex-center"
                    onClick={() => editor.applyList(true)}
                    onMouseDown={preserveSelection}
                    type="button"
                  >
                    <Icon name="numbered-list" size={15} />
                  </button>
                </Tooltip>
                <Tooltip content="Quote">
                  <button
                    aria-label="Quote"
                    class="canvas-toolbar-btn btn-reset flex-center"
                    onClick={() => editor.applyQuote()}
                    onMouseDown={preserveSelection}
                    type="button"
                  >
                    <Icon name="quote" size={15} />
                  </button>
                </Tooltip>
                <Tooltip content="Code block">
                  <button
                    aria-label="Code block"
                    class="canvas-toolbar-btn btn-reset flex-center"
                    onClick={() => editor.applyCodeBlock()}
                    onMouseDown={preserveSelection}
                    type="button"
                  >
                    <Icon name="code-block" size={15} />
                  </button>
                </Tooltip>
                <Tooltip content="Divider">
                  <button
                    aria-label="Divider"
                    class="canvas-toolbar-btn btn-reset flex-center"
                    onClick={() => editor.insertDividerAtCaret()}
                    onMouseDown={preserveSelection}
                    type="button"
                  >
                    <Icon name="divider" size={15} />
                  </button>
                </Tooltip>
              </div>
              {/* biome-ignore lint/a11y/useSemanticElements: rich-text formatting needs a real contenteditable, not <textarea> */}
              <div
                aria-multiline="true"
                class="canvas-panel-editor composer-input input-reset"
                contentEditable
                data-placeholder="Write something for this channel…"
                onInput={onInput}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                ref={editor.setRef}
                role="textbox"
                tabIndex={0}
              />
              <div class="canvas-panel-footer flex-between">
                <InlineFeedback feedback={actionFeedback.get(fileId() ?? "")} />
                <button
                  class="canvas-panel-save btn-reset"
                  disabled={saving() || !dirty()}
                  onClick={save}
                  type="button"
                >
                  {saving() ? "Saving…" : "Save"}
                </button>
              </div>
            </Show>
          </div>
        </Overlay>
      )}
    </Show>
  );
}
