import { newSectionId } from "@slock/canvas";
import { Button, indexAlignedText, scrollActiveListOption } from "@slock/ui";
import type Quill from "quill";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { type LoadedCanvas, postCanvasEdit } from "../../lib/api";
import { type CanvasDocModel, canvasTitle, canvasToOps } from "../../lib/canvas/canvasDelta";
import { applyIdFixes } from "../../lib/canvas/canvasEditorSetup";
import { createCanvasNames } from "../../lib/canvas/canvasNames";
import {
  headingElement,
  type OutlineItem,
  type OutlineSource,
  outlineFromDom,
  titleItem,
} from "../../lib/canvas/canvasOutline";
import { type CanvasSaveStatus, createCanvasSync } from "../../lib/canvas/canvasSync";
import ComposerSuggestPopover from "../composer/ComposerSuggestPopover";
import { insertSuggestionAt } from "../composer/lib/mrkdwnInsert";
import {
  createSuggestionController,
  syncSuggestionsAfterChange,
} from "../composer/lib/suggestionController";
import { type SuggestState, suggestOpen } from "../composer/lib/suggestTypes";
import { useSuggestShortcuts } from "../composer/lib/useSuggestShortcuts";
import { useSuggestUi } from "../composer/lib/useSuggestUi";
import CanvasSurface from "./CanvasSurface";
import CanvasToolbar from "./CanvasToolbar";
import { CANVAS_FORMATS } from "./canvasBlots";
import { type CanvasServices, provideCanvasServices } from "./canvasBlots/canvasServices";
import "./CanvasBlocks.css";
import "./CanvasEditor.css";
import "./CanvasLayouts.css";
import "./CanvasEditorLists.css";

const STATUS_LABELS: Record<CanvasSaveStatus, string> = {
  conflict: "This canvas changed somewhere else",
  dirty: "Saving…",
  error: "Couldn't save changes",
  saved: "Saved",
  saving: "Saving…",
};

export default function CanvasEditor(props: {
  doc: CanvasDocModel;
  editable: boolean;
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
  const [headings, setHeadings] = createSignal<OutlineItem[]>([]);
  const [active, setActive] = createSignal<Quill>();
  const surfaces = new Map<Quill, () => string>();
  let root: Quill | undefined;
  let outlineTimer: ReturnType<typeof setTimeout> | undefined;
  let caretIndex = 0;
  let titleRef: HTMLTextAreaElement | undefined;
  let suggestPopoverRef: HTMLDivElement | undefined;
  const newId = () => newSectionId(props.doc.meta.shardChars);

  function findSurface(scope: string): Quill | undefined {
    for (const [quill, scopeOf] of surfaces) if (scopeOf() === scope) return quill;
  }

  const sync = createCanvasSync({
    applyFixes: (fixes) => applyIdFixes(findSurface, fixes),
    embeds: props.doc.embeds,
    getOps: () => root?.getContents().ops ?? [],
    getTitle: title,
    initialNodes: props.doc.nodes,
    initialOps: ops,
    initialTitle: title(),
    names,
    send: (edit) => postCanvasEdit(props.fileId, edit),
    shardChars: props.doc.meta.shardChars,
  });

  const suggestions = createSuggestionController({
    applyTextSuggestion: (item, state) => {
      const quill = active();
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
      if (root) setHeadings(outlineFromDom(root.root));
    }, 250);
  }

  const services: CanvasServices = {
    activate: setActive,
    afterChange(quill) {
      sync.markDirty();
      refreshOutline();
      syncSuggestionsAfterChange(quill, indexAlignedText(quill), suggestions, (index) => {
        caretIndex = index;
      });
    },
    names,
    newId,
    readOnly: !props.editable,
    register(scope, quill) {
      surfaces.set(quill, scope);
      return () => surfaces.delete(quill);
    },
  };

  props.onOutline({
    element: (index) =>
      index === 0 ? (titleRef ?? null) : root ? headingElement(root.root, index) : null,
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

  function ready(quill: Quill) {
    root = quill;
    setActive(quill);
    setHeadings(outlineFromDom(quill.root));
    quill.root.addEventListener("blur", () => void sync.flush());
  }

  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (sync.isPending()) event.preventDefault();
  };
  async function checkRemote() {
    if (sync.isPending() || root?.hasFocus()) return;
    const latest = await props.fetchLatest();
    if (!latest?.doc || sync.isPending() || root?.hasFocus()) return;
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
    if (event.target !== event.currentTarget || !root) return;
    root.focus();
    root.setSelection(Math.max(root.getLength() - 1, 0), 0);
  }

  return (
    <div
      class="canvas-editor"
      onClick={focusEnd}
      ref={(element) => {
        onCleanup(provideCanvasServices(element, services));
      }}
    >
      <Show when={props.editable}>
        <CanvasToolbar editor={active} newId={newId}>
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
      </Show>
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
          root?.focus();
          root?.setSelection(0, 0);
        }}
        placeholder="Untitled"
        readOnly={!props.editable}
        ref={(el) => {
          titleRef = el;
          queueMicrotask(resizeTitle);
        }}
        rows={1}
        value={title()}
      />
      <CanvasSurface
        ariaLabel="Canvas"
        formats={CANVAS_FORMATS}
        id={`canvas-editor-${props.fileId}`}
        initialOps={ops}
        onReady={ready}
        placeholder={props.editable ? "Write something…" : ""}
        scope={() => ""}
        services={services}
      />
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
