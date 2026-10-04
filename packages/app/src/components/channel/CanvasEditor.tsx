import { Button, indexAlignedText, QuillEditor, scrollActiveListOption } from "@slock/ui";
import type Quill from "quill";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { type LoadedCanvas, postCanvasEdit } from "../../lib/api";
import { type CanvasDocModel, canvasTitle, canvasToOps } from "../../lib/canvas/canvasDelta";
import { applyIdFixes, bindCanvasKeys } from "../../lib/canvas/canvasEditorSetup";
import { createCanvasNames } from "../../lib/canvas/canvasNames";
import {
  type OutlineItem,
  type OutlineSource,
  outlineFromOps,
  titleItem,
} from "../../lib/canvas/canvasOutline";
import { type CanvasSaveStatus, createCanvasSync } from "../../lib/canvas/canvasSync";
import { store } from "../../lib/store";
import ComposerSuggestPopover from "../composer/ComposerSuggestPopover";
import { createMentionHoverController } from "../composer/lib/mentionHover";
import { useMentionResolution } from "../composer/lib/mentionResolution";
import { insertSuggestionAt } from "../composer/lib/mrkdwnInsert";
import { wireEmojiAutoconvert } from "../composer/lib/quillEmoji";
import {
  createSuggestionController,
  syncSuggestionsAfterChange,
} from "../composer/lib/suggestionController";
import { type SuggestState, suggestOpen } from "../composer/lib/suggestTypes";
import { useSuggestShortcuts } from "../composer/lib/useSuggestShortcuts";
import { useSuggestUi } from "../composer/lib/useSuggestUi";
import MentionHoverCard from "../composer/MentionHoverCard";
import CanvasToolbar from "./CanvasToolbar";
import { CANVAS_FORMATS } from "./canvasBlots";
import "./CanvasEditor.css";
import "./CanvasEditorLists.css";

const STATUS_LABELS: Record<CanvasSaveStatus, string> = {
  conflict: "This canvas changed somewhere else",
  dirty: "Saving…",
  error: "Couldn't save",
  saved: "Saved",
  saving: "Saving…",
};

export default function CanvasEditor(props: {
  doc: CanvasDocModel;
  fileId: string;
  onOutline: (source: OutlineSource | null) => void;
  fetchLatest: () => Promise<LoadedCanvas | null>;
  onRemoteChange: (latest: LoadedCanvas) => void;
  onReload: () => void;
  onTitle?: (title: string) => void;
}) {
  const names = createCanvasNames();
  const [title, setTitle] = createSignal(canvasTitle(props.doc));
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  const ops = canvasToOps(props.doc, names);
  const [headings, setHeadings] = createSignal<OutlineItem[]>(outlineFromOps(ops));
  let outlineTimer: ReturnType<typeof setTimeout> | undefined;
  const [editor, setEditor] = createSignal<Quill>();
  let quill: Quill | undefined;
  let caretIndex = 0;
  let titleRef: HTMLTextAreaElement | undefined;
  let suggestPopoverRef: HTMLDivElement | undefined;
  const resolveMention = useMentionResolution(() => quill);
  const mentionHover = createMentionHoverController();
  const sync = createCanvasSync({
    applyFixes: (fixes) => quill && applyIdFixes(quill, fixes),
    embeds: props.doc.embeds,
    getOps: () => quill?.getContents().ops ?? [],
    getTitle: title,
    initialLines: props.doc.blocks.flatMap((block) => {
      if (block.type === "paragraph" && block.id) return [{ html: block.text, id: block.id }];
      if (block.type === "bulletList" || block.type === "orderedList" || block.type === "checklist")
        return block.items.flatMap((item) => (item.id ? [{ html: item.text, id: item.id }] : []));
      return [];
    }),
    initialOps: ops,
    initialTitle: title(),
    names,
    send: (edit) => postCanvasEdit(props.fileId, edit),
    shardChars: props.doc.meta.shardChars,
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
    },
    includeBroadcastMentions: false,
    includeCommands: false,
    setSuggest,
    suggest,
  });
  useSuggestUi(() => suggestPopoverRef, suggest, setSuggest);
  useSuggestShortcuts({ setSuggest, suggest, suggestions });
  createEffect(() => {
    suggest();
    scrollActiveListOption(() => suggestPopoverRef);
  });
  function refreshOutline() {
    clearTimeout(outlineTimer);
    outlineTimer = setTimeout(() => {
      if (quill) setHeadings(outlineFromOps(quill.getContents().ops));
    }, 250);
  }

  props.onOutline({
    element: (index) =>
      index === 0
        ? (titleRef ?? null)
        : (quill?.root.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6")[index - 1] ?? null),
    items: () => [titleItem(title()), ...headings()],
  });
  onCleanup(() => {
    clearTimeout(outlineTimer);
    props.onOutline(null);
  });

  function resizeTitle() {
    if (!titleRef) return;
    titleRef.style.height = "auto";
    titleRef.style.height = `${titleRef.scrollHeight}px`;
  }

  function mount(instance: Quill) {
    const editor = instance;
    quill = editor;
    setEditor(editor);
    editor.setContents(ops, "silent");
    for (const embed of props.doc.embeds.values()) {
      if (embed.type === "user" && !store.users.userById(embed.userId))
        resolveMention(embed.userId);
    }
    bindCanvasKeys(editor);
    wireEmojiAutoconvert(editor);
    onCleanup(mentionHover.bind(editor));
    editor.on("text-change", (_delta, _old, source) => {
      if (source === "silent") return;
      sync.markDirty();
      refreshOutline();
      syncSuggestionsAfterChange(editor, indexAlignedText(editor), suggestions, (index) => {
        caretIndex = index;
      });
    });
    editor.root.addEventListener("blur", () => void sync.flush());
  }

  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (sync.isPending()) event.preventDefault();
  };
  async function checkRemote() {
    if (sync.isPending() || quill?.hasFocus()) return;
    const latest = await props.fetchLatest();
    if (!latest?.doc || sync.isPending() || quill?.hasFocus()) return;
    if (sync.differsFromRemote(canvasToOps(latest.doc, names), canvasTitle(latest.doc)))
      props.onRemoteChange(latest);
  }
  const onVisibility = () => {
    if (document.visibilityState === "hidden") void sync.flush();
    else void checkRemote();
  };
  const onWindowFocus = () => void checkRemote();
  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("focus", onWindowFocus);
  document.addEventListener("visibilitychange", onVisibility);
  onCleanup(() => {
    window.removeEventListener("beforeunload", beforeUnload);
    window.removeEventListener("focus", onWindowFocus);
    document.removeEventListener("visibilitychange", onVisibility);
    void sync.flush();
    sync.dispose();
  });

  function focusEnd(event: MouseEvent) {
    if (event.target !== event.currentTarget || !quill) return;
    quill.focus();
    quill.setSelection(Math.max(quill.getLength() - 1, 0), 0);
  }

  return (
    <div class="canvas-editor" onClick={focusEnd}>
      <CanvasToolbar editor={editor}>
        <div class="canvas-editor-status" data-status={sync.status()} role="status">
          <div class="canvas-editor-status-pill">
            <span>{STATUS_LABELS[sync.status()]}</span>
            <Show when={sync.status() === "error"}>
              <Button onClick={() => void sync.retry()} size="sm">
                Retry
              </Button>
            </Show>
            <Show when={sync.status() === "conflict"}>
              <Button onClick={props.onReload} size="sm">
                Reload
              </Button>
            </Show>
          </div>
        </div>
      </CanvasToolbar>
      <textarea
        aria-label="Canvas title"
        class="canvas-editor-title"
        onInput={(event) => {
          setTitle(event.currentTarget.value);
          props.onTitle?.(event.currentTarget.value);
          resizeTitle();
          sync.markDirty();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          quill?.focus();
          quill?.setSelection(0, 0);
        }}
        placeholder="Untitled"
        ref={(el) => {
          titleRef = el;
          queueMicrotask(resizeTitle);
        }}
        rows={1}
        value={title()}
      />
      <QuillEditor
        ariaLabel="Canvas"
        ariaMultiline
        formats={CANVAS_FORMATS}
        id={`canvas-editor-${props.fileId}`}
        keepPastedHeaders
        onReady={mount}
        placeholder="Write something…"
      />
      <MentionHoverCard hoverIntent={mentionHover.hoverIntent} state={mentionHover.state} />
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
  );
}
