import { Button, indexAlignedText, QuillEditor, scrollActiveListOption } from "@slock/ui";
import type Quill from "quill";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { postCanvasEdit } from "../../lib/api";
import { type CanvasDocModel, canvasTitle, canvasToOps } from "../../lib/canvas/canvasDelta";
import { applyIdFixes, bindCanvasKeys } from "../../lib/canvas/canvasEditorSetup";
import { createCanvasNames } from "../../lib/canvas/canvasNames";
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
  onReload: () => void;
  onTitle?: (title: string) => void;
}) {
  const names = createCanvasNames();
  const [title, setTitle] = createSignal(canvasTitle(props.doc));
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  const ops = canvasToOps(props.doc, names);
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
  function resizeTitle() {
    if (!titleRef) return;
    titleRef.style.height = "auto";
    titleRef.style.height = `${titleRef.scrollHeight}px`;
  }

  function mount(editor: Quill) {
    quill = editor;
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
      syncSuggestionsAfterChange(editor, indexAlignedText(editor), suggestions, (index) => {
        caretIndex = index;
      });
    });
    editor.root.addEventListener("blur", () => void sync.flush());
  }

  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (sync.isPending()) event.preventDefault();
  };
  const onVisibility = () => {
    if (document.visibilityState === "hidden") void sync.flush();
  };
  window.addEventListener("beforeunload", beforeUnload);
  document.addEventListener("visibilitychange", onVisibility);
  onCleanup(() => {
    window.removeEventListener("beforeunload", beforeUnload);
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
      <div class="canvas-editor-status" data-status={sync.status()} role="status">
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
