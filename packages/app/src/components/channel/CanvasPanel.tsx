import {
  Button,
  Icon,
  type IconName,
  InlineFeedback,
  Overlay,
  PanelHeader,
  Tooltip,
  useEscapeClose,
} from "@slock/ui";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { actionFeedback, channelDisplayName, store } from "../../lib/store";
import "../composer/Composer.css";
import type { EditorCommands } from "../composer/lib/editor/editorCommands";
import { createEditorCommands } from "../composer/lib/editor/editorCommands";
import { handleMarkShortcut } from "../composer/lib/editor/markShortcuts";
import { MARKDOWN_DIALECT } from "../composer/lib/richtext";
import { createCanvasEditorLoadTracker } from "./canvas/canvasEditorLoadTracker";
import { createCanvasSaveController } from "./canvas/canvasSaveController";
import "./CanvasPanel.css";

type ToolbarTool = { icon: IconName; title: string; onClick: () => void };

// Grouped into three `<For>` runs (marks, headings, block formats) so the
// dividers between them stay meaningful, but all rendered through the one
// ToolbarButton below instead of five near-identical Tooltip+button blocks.
function toolbarGroups(editor: EditorCommands): ToolbarTool[][] {
  return [
    [
      { icon: "bold", onClick: () => editor.applyMark("bold"), title: "Bold (Ctrl+B)" },
      { icon: "italic", onClick: () => editor.applyMark("italic"), title: "Italic (Ctrl+I)" },
      {
        icon: "strikethrough",
        onClick: () => editor.applyMark("strike"),
        title: "Strikethrough (Ctrl+Shift+X)",
      },
      {
        icon: "code",
        onClick: () => editor.applyMark("code"),
        title: "Inline code (Ctrl+Shift+C)",
      },
    ],
    [
      { icon: "heading-1", onClick: () => editor.applyHeader(1), title: "Heading 1" },
      { icon: "heading-2", onClick: () => editor.applyHeader(2), title: "Heading 2" },
      { icon: "heading-3", onClick: () => editor.applyHeader(3), title: "Heading 3" },
    ],
    [
      {
        icon: "bulleted-list",
        onClick: () => editor.applyList(false),
        title: "Bulleted list",
      },
      { icon: "numbered-list", onClick: () => editor.applyList(true), title: "Numbered list" },
      { icon: "quote", onClick: () => editor.applyQuote(), title: "Quote" },
      { icon: "code-block", onClick: () => editor.applyCodeBlock(), title: "Code block" },
      { icon: "divider", onClick: () => editor.insertDividerAtCaret(), title: "Divider" },
    ],
  ];
}

// A plain click blurs the editor and collapses its selection before onClick
// fires, so applyMark/applyHeader etc. would find nothing selected to act on.
function preserveSelection(e: MouseEvent) {
  e.preventDefault();
}

function ToolbarButton(props: ToolbarTool) {
  return (
    <Tooltip content={props.title}>
      <button
        aria-label={props.title}
        class="canvas-toolbar-btn btn-reset flex-center"
        onClick={props.onClick}
        onMouseDown={preserveSelection}
        type="button"
      >
        <Icon name={props.icon} size={15} />
      </button>
    </Tooltip>
  );
}

export default function CanvasPanel() {
  const open = store.canvas.openCanvas;

  const fileId = () => {
    const o = open();
    if (!o) return;
    return o.kind === "channel" ? store.canvas.canvasByChannel[o.channelId]?.fileId : o.fileId;
  };
  const title = createMemo(() => {
    const o = open();
    if (!o) return "";
    return o.kind === "channel"
      ? `#${channelDisplayName(store.channels.channelById(o.channelId), o.channelId)}`
      : o.title;
  });

  const [content, { mutate, refetch }] = createResource(fileId, store.canvas.loadCanvasContent);
  const [fileUrl] = createResource(fileId, store.canvas.loadCanvasFileUrl);
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
  const editorLoadTracker = createCanvasEditorLoadTracker();
  createEffect(() => {
    const id = fileId();
    const value = content();
    const shouldLoad = editorLoadTracker.shouldLoad(id, !content.loading && value != null);
    if (!shouldLoad || value == null) return;
    editor.loadHtmlIntoEditor(value);
    editor.syncFromDom();
    setDirty(false);
  });

  const { flush, save } = createCanvasSaveController({
    dirty,
    fileId,
    onSaved: mutate,
    persist: store.canvas.saveChannelCanvas,
    setDirty,
    setSaving,
    text,
  });

  const close = async () => {
    if (await flush()) store.canvas.closeCanvas();
  };

  useEscapeClose(
    () => void close(),
    () => !!open(),
  );

  // Debounced autosave: every keystroke clears and reschedules this, so a
  // save only actually fires ~1.2s after typing stops (same pattern as
  // composer draft persistence, see drafts.ts). Also fires (harmlessly,
  // since dirty() is false) when a canvas switch resets dirty — clearing
  // unconditionally up front is what stops a stale timer from a *previous*
  // canvas surviving into the newly loaded one.
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
  createEffect(() => {
    text();
    const isDirty = dirty();
    const isSaving = saving();
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = isDirty && !isSaving ? setTimeout(save, 1200) : undefined;
  });
  onCleanup(() => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
  });

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

  return (
    <Show when={open()}>
      {(_open) => (
        <Overlay ariaLabel={`Canvas: ${title()}`} onClose={() => void close()}>
          <div class="canvas-panel-card flex-col">
            <PanelHeader onClose={() => void close()}>
              <div class="canvas-panel-header-info flex-align-center">
                <div class="canvas-panel-title">Canvas · {title()}</div>
                <Show when={fileUrl()}>
                  {(url) => (
                    <Tooltip content="Open the underlying file">
                      <a
                        class="canvas-panel-file-link btn-reset flex-center"
                        href={url()}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <Icon name="open-in-tab" size={15} />
                      </a>
                    </Tooltip>
                  )}
                </Show>
              </div>
            </PanelHeader>
            <Show when={content.loading}>
              <div class="canvas-panel-loading flex-center text-dim text-sm">Loading canvas…</div>
            </Show>
            <Show when={!content.loading && content() === null}>
              <div class="canvas-panel-load-error flex-center flex-col" role="alert">
                <span>Couldn’t load this canvas.</span>
                <InlineFeedback feedback={actionFeedback.get(fileId() ?? "")} priority={2} />
                <Button onClick={() => refetch()} size="sm">
                  Try again
                </Button>
              </div>
            </Show>
            <Show when={!content.loading && content() !== null}>
              <div class="canvas-panel-toolbar flex-align-center">
                <For each={toolbarGroups(editor)}>
                  {(group, i) => (
                    <>
                      <Show when={i() > 0}>
                        <span class="canvas-toolbar-divider" />
                      </Show>
                      <For each={group}>{(tool) => <ToolbarButton {...tool} />}</For>
                    </>
                  )}
                </For>
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
