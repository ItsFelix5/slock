import { Mrkdwn } from "@slock/blockkit";
import {
  Button,
  Icon,
  InlineFeedback,
  Menu,
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
  Match,
  onCleanup,
  Show,
  Switch,
} from "solid-js";
import { actionFeedback, store } from "../../lib/store";
import "../composer/Composer.css";
import { createEditorCommands } from "../composer/lib/editor/editorCommands";
import { handleMarkShortcut } from "../composer/lib/editor/markShortcuts";
import { MARKDOWN_DIALECT } from "../composer/lib/richtext";
import { createCanvasEditorLoadTracker } from "./canvas/canvasEditorLoadTracker";
import { createCanvasSaveController } from "./canvas/canvasSaveController";
import "./CanvasPanel.css";

export default function CanvasPanel() {
  const open = store.canvas.openCanvas;
  const channelId = () => {
    const o = open();
    return o?.kind === "channel" || o?.kind === "create" ? o.channelId : undefined;
  };

  const fileId = () => {
    const o = open();
    if (!o) return;
    if (o.kind === "channel") return store.canvas.canvasByChannel[o.channelId]?.fileId;
    return o.kind === "file" ? o.fileId : undefined;
  };
  const title = createMemo(() => {
    const o = open();
    if (!o) return "";
    if (o.kind === "create") return "New canvas";
    if (o.kind === "file") return o.title;
    const fileId = store.canvas.canvasByChannel[o.channelId]?.fileId;
    return (
      store.canvas.canvasesByChannel[o.channelId]?.find((canvas) => canvas.fileId === fileId)
        ?.title ?? "Untitled canvas"
    );
  });
  const feedbackKey = () => fileId() ?? channelId() ?? "";

  createEffect(() => {
    const id = channelId();
    if (id) void store.canvas.ensureCanvasChecked(id);
  });

  const [content, { mutate, refetch }] = createResource(fileId, store.canvas.loadCanvasContent);
  const [fileUrl] = createResource(fileId, store.canvas.loadCanvasFileUrl);
  const [saving, setSaving] = createSignal(false);
  const [dirty, setDirty] = createSignal(false);
  const [text, setText] = createSignal("");
  const [menuOpen, setMenuOpen] = createSignal(false);
  const [newCanvasTitle, setNewCanvasTitle] = createSignal("");

  createEffect(() => {
    if (open()?.kind === "create") setNewCanvasTitle("");
  });

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

  const createCanvas = async () => {
    const id = channelId();
    if (!id) return;
    await store.canvas.createCanvas(id, newCanvasTitle().trim() || "Untitled canvas");
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
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      save();
      return;
    }
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

  const copyLink = async () => {
    setMenuOpen(false);
    const url = fileUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      actionFeedback.flash(fileId() ?? "", "Link copied.");
    } catch {
      actionFeedback.flash(fileId() ?? "", "Couldn’t copy the link.", "error");
    }
  };

  return (
    <Show when={open()}>
      {(_open) => (
        <Overlay ariaLabel={title()} onClose={() => void close()}>
          <div class="canvas-panel-card flex-col">
            <PanelHeader onClose={() => void close()}>
              <div class="canvas-panel-header-info flex-align-center">
                <div class="canvas-panel-title">
                  <Mrkdwn text={title()} />
                </div>
                <Show when={saving()}>
                  <span class="text-dim text-sm">Saving…</span>
                </Show>
                <InlineFeedback feedback={actionFeedback.get(feedbackKey())} />
                <Show when={fileUrl()}>
                  {(url) => (
                    <Menu
                      align="end"
                      onClose={() => setMenuOpen(false)}
                      open={menuOpen()}
                      panelClass="menu-panel canvas-panel-menu"
                      trigger={
                        <Tooltip content="More">
                          <button
                            aria-label="More"
                            class="icon-btn sm icon-action"
                            onClick={() => setMenuOpen(!menuOpen())}
                            type="button"
                          >
                            <Icon name="ellipsis-horizontal-filled" size={15} />
                          </button>
                        </Tooltip>
                      }
                    >
                      <a
                        class="menu-item"
                        href={url()}
                        onClick={() => setMenuOpen(false)}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <Icon name="open-in-tab" size={15} />
                        Open in new tab
                      </a>
                      <button class="menu-item" onClick={copyLink} type="button">
                        <Icon name="link" size={15} />
                        Copy link
                      </button>
                    </Menu>
                  )}
                </Show>
              </div>
            </PanelHeader>
            <Show when={open()?.kind === "create" && channelId()}>
              {(id) => (
                <div class="canvas-panel-create flex-center flex-col">
                  <div class="canvas-panel-create-icon flex-center">
                    <Icon name="add-channel-canvas" size={30} />
                  </div>
                  <h2>Add a canvas</h2>
                  <input
                    autofocus
                    class="canvas-panel-create-title search-input"
                    disabled={store.canvas.canvasCreatingByChannel[id()]}
                    onInput={(event) => setNewCanvasTitle(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void createCanvas();
                    }}
                    placeholder="Canvas title"
                    value={newCanvasTitle()}
                  />
                  <InlineFeedback feedback={actionFeedback.get(id())} priority={2} />
                  <Show
                    fallback={
                      <span class="text-dim text-sm">Join this channel to add a canvas.</span>
                    }
                    when={store.channels.isChannelMember(id())}
                  >
                    <Button
                      disabled={store.canvas.canvasCreatingByChannel[id()]}
                      onClick={() => void createCanvas()}
                      variant="primary"
                    >
                      <Icon name="plus" size={15} />
                      {store.canvas.canvasCreatingByChannel[id()] ? "Adding…" : "Add canvas"}
                    </Button>
                  </Show>
                </div>
              )}
            </Show>
            <Show when={open()?.kind === "channel" && !fileId() && channelId()}>
              {(id) => (
                <Switch>
                  <Match when={store.canvas.canvasCheckingByChannel[id()]}>
                    <div class="canvas-panel-loading flex-center text-dim text-sm">Loading…</div>
                  </Match>
                  <Match when={store.canvas.canvasCheckErrorByChannel[id()]}>
                    <div class="canvas-panel-load-error flex-center flex-col" role="alert">
                      <span>Couldn’t check for a channel canvas.</span>
                      <Button onClick={() => void store.canvas.ensureCanvasChecked(id())} size="sm">
                        Try again
                      </Button>
                    </div>
                  </Match>
                  <Match when={true}>
                    <div class="canvas-panel-load-error flex-center flex-col">
                      <span class="text-dim text-sm">This channel doesn’t have a canvas yet.</span>
                      <Show when={store.channels.isChannelMember(id())}>
                        <Button
                          onClick={() => store.canvas.openCanvasCreator(id())}
                          size="sm"
                          variant="primary"
                        >
                          <Icon name="plus" size={15} />
                          Add canvas
                        </Button>
                      </Show>
                    </div>
                  </Match>
                </Switch>
              )}
            </Show>
            <Show when={fileId()}>
              <Show when={content.loading}>
                <div class="canvas-panel-loading flex-center text-dim text-sm">Loading…</div>
              </Show>
              <Show when={!content.loading && content() === null}>
                <div class="canvas-panel-load-error flex-center flex-col" role="alert">
                  <span>Something went wrong.</span>
                  <InlineFeedback feedback={actionFeedback.get(feedbackKey())} priority={2} />
                  <Button onClick={() => refetch()} size="sm">
                    Try again
                  </Button>
                </div>
              </Show>
              <Show when={!content.loading && content() !== null}>
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
              </Show>
            </Show>
          </div>
        </Overlay>
      )}
    </Show>
  );
}
