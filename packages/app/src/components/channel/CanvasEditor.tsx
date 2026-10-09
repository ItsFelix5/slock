import { type DiffEntry, newSectionId } from "@slock/canvas";
import type { CanvasCommentThread } from "@slock/types";
import { FloatingPanel, scrollActiveListOption } from "@slock/ui";
import { indexAlignedText } from "@slock/ui/editor/quillText";
import type Quill from "quill";
import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { type LoadedCanvas, postCanvasEdit } from "../../lib/api";
import { createCanvasCommandContext, lineElement } from "../../lib/canvas/canvasCommandContext";
import { canvasCommandItems, runCanvasCommand } from "../../lib/canvas/canvasCommands";
import { type CanvasDocModel, canvasTitle, canvasToOps } from "../../lib/canvas/canvasDelta";
import { diffToOps } from "../../lib/canvas/canvasDiffView";
import { applyIdFixes } from "../../lib/canvas/canvasEditorSetup";
import { annotateSelection, commentAnchorAt } from "../../lib/canvas/canvasFormatting";
import { createCanvasNames } from "../../lib/canvas/canvasNames";
import {
  headingElement,
  type OutlineItem,
  type OutlineSource,
  outlineFromDom,
  titleItem,
} from "../../lib/canvas/canvasOutline";
import { watchRemoteChanges } from "../../lib/canvas/canvasRemoteWatch";
import { createCanvasSync } from "../../lib/canvas/canvasSync";
import ComposerSuggestPopover from "../composer/ComposerSuggestPopover";
import { insertSuggestionAt } from "../composer/lib/mrkdwnInsert";
import {
  createSuggestionController,
  syncSuggestionsAfterChange,
} from "../composer/lib/suggestionController";
import { type SuggestState, suggestOpen } from "../composer/lib/suggestTypes";
import { useSuggestShortcuts } from "../composer/lib/useSuggestShortcuts";
import { useSuggestUi } from "../composer/lib/useSuggestUi";
import CanvasCommandPicker from "./CanvasCommandPicker";
import CanvasMarginThreads from "./CanvasMarginThreads";
import CanvasSelectionActions from "./CanvasSelectionActions";
import CanvasSurface from "./CanvasSurface";
import { CANVAS_FORMATS } from "./canvasBlots";
import { type CanvasServices, provideCanvasServices } from "./canvasBlots/canvasServices";
import { useCanvasSelectionShortcuts } from "./lib/useCanvasSelectionShortcuts";
import "./CanvasBlocks.css";
import "./CanvasEditor.css";
import "./CanvasLayouts.css";
import "./CanvasEditorLists.css";

export default function CanvasEditor(props: {
  diff?: DiffEntry[];
  doc: CanvasDocModel;
  editable: boolean;
  fileId: string;
  onOutline: (source: OutlineSource | null) => void;
  fetchLatest: () => Promise<LoadedCanvas | null>;
  onComment?: (annotationId: string) => void;
  onOpenThread?: (thread: CanvasCommentThread) => void;
  onReact?: (annotationId: string, name: string) => void;
  onReactToThread?: (thread: CanvasCommentThread, name: string) => void;
  onRemoteChange: (latest: LoadedCanvas) => void;
  onTitle?: (title: string) => void;
  threads?: CanvasCommentThread[];
}) {
  const [container, setContainer] = createSignal<HTMLElement>();
  const names = createCanvasNames();
  const [title, setTitle] = createSignal(canvasTitle(props.doc));
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  const ops = props.diff ? diffToOps(props.diff, props.doc, names) : canvasToOps(props.doc, names);
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
      if (item.kind === "command") {
        quill.deleteText(state.start, caretIndex - state.start, "user");
        quill.setSelection(state.start, 0, "user");
        runCanvasCommand(item.name, quill, commands.contextFor(quill));
        return;
      }
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
    lineCommands: () => canvasCommandItems(active()),
    setSuggest,
    suggest,
  });
  const commands = createCanvasCommandContext({
    annotate: annotationFor,
    newId,
    onComment: (annotationId) => props.onComment?.(annotationId),
  });
  const runOnSelection = useCanvasSelectionShortcuts({
    contextFor: commands.contextFor,
    editable: props.editable,
    quill: active,
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

  watchRemoteChanges({
    fetchLatest: props.fetchLatest,
    isEditing: () => !!root?.hasFocus(),
    names,
    onRemoteChange: props.onRemoteChange,
    sync,
  });

  async function annotationFor(quill: Quill) {
    const existing = commentAnchorAt(quill);
    if (existing) return existing;
    const id = newId();
    if (!annotateSelection(quill, id)) return null;
    await sync.flush();
    return id;
  }

  function focusEnd(event: MouseEvent) {
    const mark = event.target instanceof Element ? event.target.closest("[data-annotation]") : null;
    if (mark instanceof HTMLElement && mark.dataset.annotation) {
      props.onComment?.(mark.dataset.annotation);
      return;
    }
    if (event.target !== event.currentTarget || !root) return;
    root.focus();
    root.setSelection(Math.max(root.getLength() - 1, 0), 0);
  }

  return (
    <div
      class="canvas-editor"
      onClick={focusEnd}
      ref={(element) => {
        setContainer(element);
        onCleanup(provideCanvasServices(element, services));
      }}
    >
      <CanvasCommandPicker
        onClose={commands.close}
        onReact={(annotationId, name) => props.onReact?.(annotationId, name)}
        picker={commands.picker()}
      />
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
        placeholder={props.editable ? "Write something, or press / for commands" : ""}
        scope={() => ""}
        services={services}
      />
      <Show when={container()}>
        {(element) => (
          <>
            <CanvasMarginThreads
              container={element()}
              fileId={props.fileId}
              onOpen={(thread) => props.onOpenThread?.(thread)}
              onReact={(thread, name) => props.onReactToThread?.(thread, name)}
              threads={props.threads ?? []}
            />
            <Show when={props.editable}>
              <CanvasSelectionActions
                container={element()}
                onComment={() => runOnSelection("Comment")}
                onReact={() => runOnSelection("React")}
              />
            </Show>
          </>
        )}
      </Show>
      <Show when={suggestOpen(suggest()) ? suggest() : undefined}>
        {(state) => (
          <Show when={active()}>
            {(quill) => (
              <FloatingPanel anchor={() => lineElement(quill())} open>
                <ComposerSuggestPopover
                  floating
                  onHover={suggestions.setActiveSuggestion}
                  onPick={suggestions.applySuggestion}
                  ref={(el) => {
                    suggestPopoverRef = el;
                  }}
                  state={state()}
                />
              </FloatingPanel>
            )}
          </Show>
        )}
      </Show>
    </div>
  );
}
