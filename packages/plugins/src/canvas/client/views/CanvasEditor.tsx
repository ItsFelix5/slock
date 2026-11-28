import { service, useDebouncer } from "@slock/core/solid";
import { insertSuggestionAt } from "@slock/plugins/composer/client/api/editor/mrkdwnInsert";
import {
  createSuggestionController,
  syncSuggestionsAfterChange,
} from "@slock/plugins/composer/client/api/editor/suggestionController";
import type { SuggestState } from "@slock/plugins/composer/client/api/editor/suggestTypes";
import { useSuggestShortcuts } from "@slock/plugins/composer/client/api/editor/useSuggestShortcuts";
import { useSuggestUi } from "@slock/plugins/composer/client/api/editor/useSuggestUi";
import type { CanvasAccess, FileId } from "@slock/types";
import type Quill from "@slock/ui/editor/quill";
import { createEffect, createSignal, onCleanup, Show, untrack } from "solid-js";
import { type DiffEntry, newSectionId } from "../../protocol/api";
import { createCanvasCommandContext } from "../lib/canvasCommandContext";
import { canvasCommandItems, runCanvasCommand } from "../lib/canvasCommands";
import type { CanvasCommentsController } from "../lib/canvasComments";
import { type CanvasDocModel, canvasTitle, canvasToOps } from "../lib/canvasDelta";
import { diffToOps } from "../lib/canvasDiffView";
import { createEditorPort } from "../lib/canvasEditorPort";
import { createCanvasNames } from "../lib/canvasNames";
import type { OutlineSource } from "../lib/canvasOutline";
import { watchRemoteChanges } from "../lib/canvasRemoteWatch";
import { type LoadedCanvas, postCanvasEdit } from "../lib/canvasRequests";
import { createCanvasSync } from "../lib/canvasSync";
import { bindFileDrops, createCanvasUploads } from "../lib/canvasUpload";
import CanvasCommandPicker from "./CanvasCommandPicker";
import CanvasMarginThreads from "./CanvasMarginThreads";
import CanvasSelectionActions from "./CanvasSelectionActions";
import CanvasSuggestions from "./CanvasSuggestions";
import CanvasSurface from "./CanvasSurface";
import CanvasTitle from "./CanvasTitle";
import { CANVAS_FORMATS } from "./canvasBlots";
import { type CanvasServices, provideCanvasServices } from "./canvasBlots/canvasServices";
import { useCanvasAnnotations } from "./useCanvasAnnotations";
import { useCanvasOutline } from "./useCanvasOutline";
import { useCanvasSelectionShortcuts } from "./useCanvasSelectionShortcuts";
import "./CanvasBlocks.css";
import "./CanvasEditor.css";
import "./CanvasLayouts.css";
import "./CanvasEditorLists.css";

const canvas = service("canvas");
const feedback = service("feedback");

export default function CanvasEditor(props: {
  access: CanvasAccess;
  comments?: CanvasCommentsController;
  diff?: DiffEntry[];
  doc: CanvasDocModel;
  fileId: FileId;
  latest?: LoadedCanvas;
  onOutline: (source: OutlineSource | null) => void;
  onTitle?: (title: string) => void;
}) {
  const [container, setContainer] = createSignal<HTMLElement>();
  const names = createCanvasNames();
  const initial = untrack(() => ({ diff: props.diff, doc: props.doc }));
  const editable = untrack(() => props.access === "edit");
  const canComment = untrack(() => props.access !== "view");
  let titleText = canvasTitle(initial.doc, names);
  const [title, setTitle] = createSignal(titleText);
  const [suggest, setSuggest] = createSignal<SuggestState | null>(null);
  const ops = initial.diff
    ? diffToOps(initial.diff, initial.doc, names)
    : canvasToOps(initial.doc, names);
  const [active, setActive] = createSignal<Quill>();
  const surfaces = new Map<Quill, () => string>();
  let root: Quill | undefined;
  let caretIndex = 0;
  let titleRef: HTMLTextAreaElement | undefined;
  let suggestPopoverRef: HTMLDivElement | undefined;
  const outline = useCanvasOutline({
    onOutline: props.onOutline,
    quill: () => root,
    title,
    titleElement: () => titleRef,
  });
  const newId = () => newSectionId(initial.doc.meta.shardChars);

  function findSurface(scope: string): Quill | undefined {
    return [...surfaces].find(([, scopeOf]) => scopeOf() === scope)?.[0];
  }

  // Signal reads lag behind writes until the next flush, and the sync reads right back.
  function writeTitle(next: string) {
    if (next === titleText) return;
    titleText = next;
    setTitle(next);
    props.onTitle?.(next);
  }

  const fileId = untrack(() => props.fileId);
  const refresh = () => canvas.refreshCanvasContent(fileId);
  const sync = createCanvasSync({
    editor: createEditorPort({
      active: () => untrack(active),
      find: findSurface,
      onApply: () => outline.schedule(),
      root: () => root,
      title: () => titleText,
      writeTitle,
    }),
    embeds: initial.doc.embeds,
    initialNodes: initial.doc.nodes,
    initialOps: ops,
    initialTitle: titleText,
    names,
    onError: (error) => feedback.caught(fileId, error, "Couldn't save"),
    refresh,
    send: (edit) => postCanvasEdit(fileId, edit),
    shardChars: initial.doc.meta.shardChars,
  });
  onCleanup(() => void sync.detach());

  let waiting = false;
  function pull() {
    untrack(() => {
      waiting = !sync.receive(props.latest);
    });
  }
  const retryPull = useDebouncer(pull, 0);
  const retryWaiting = () => {
    if (waiting) retryPull.schedule();
  };
  createEffect(() => props.latest, pull, { defer: true });

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
  const annotations = useCanvasAnnotations({ comments: () => props.comments, newId, sync });
  const uploads = createCanvasUploads({ fileId, newId });
  const commands = createCanvasCommandContext({
    annotate: annotations.annotationFor,
    newId,
    onComment: (annotationId) => props.comments?.openAnnotation(annotationId, true),
    onReact: (annotationId, name) => props.comments?.reactToAnnotation(annotationId, name),
    upload: uploads.upload,
  });
  const runOnSelection = useCanvasSelectionShortcuts({
    contextFor: commands.contextFor,
    canComment: () => canComment,
    quill: active,
  });
  useSuggestUi(() => suggestPopoverRef, suggest, setSuggest);
  useSuggestShortcuts({ setSuggest, suggest, suggestions });

  const services: CanvasServices = {
    access: untrack(() => props.access),
    activate: setActive,
    afterChange(quill) {
      // A version view shows old content with diff marks, none of which may reach the canvas.
      if (!canComment) return;
      sync.markDirty();
      outline.schedule();
      syncSuggestionsAfterChange(quill, suggestions, (index) => {
        caretIndex = index;
      });
    },
    movesAnnotation: (id) =>
      sync.hasAnnotation(id) && !root?.root.querySelector(`[data-annotation~="${CSS.escape(id)}"]`),
    names,
    newId,
    register(scope, quill) {
      surfaces.set(quill, scope);
      return () => surfaces.delete(quill);
    },
    upload: uploads.upload,
  };

  function ready(quill: Quill) {
    root = quill;
    setActive(quill);
    sync.adoptLoaded();
    outline.load(quill);
    quill.root.addEventListener("blur", () => void sync.flush());
  }

  if (untrack(() => props.latest))
    watchRemoteChanges({
      fileId,
      refresh,
      remoteChangeTick: () => canvas.remoteChangeTick(fileId),
      sync,
    });

  function clickEditor(event: MouseEvent) {
    if (annotations.openClicked(event.target)) return;
    if (event.target !== event.currentTarget || !root) return;
    root.focus();
    root.setSelection(Math.max(root.getLength() - 1, 0), 0);
  }

  return (
    <div
      class="canvas-editor"
      onClick={clickEditor}
      onCompositionEnd={retryWaiting}
      onFocusOut={retryWaiting}
      ref={(element) => {
        provideCanvasServices(element, services);
        bindFileDrops(element, () => root, uploads.upload);
        setContainer(element);
      }}
    >
      <CanvasCommandPicker onClose={commands.close} picker={commands.picker()} />
      <CanvasTitle
        onEnter={() => {
          root?.focus();
          root?.setSelection(0, 0);
        }}
        onInput={(next) => {
          writeTitle(next);
          sync.markDirty();
        }}
        readonly={!editable}
        ref={(element) => {
          titleRef = element;
        }}
        value={title()}
      />
      <CanvasSurface
        ariaLabel="Canvas"
        formats={CANVAS_FORMATS}
        id={`canvas-editor-${props.fileId}`}
        initialOps={ops}
        onReady={ready}
        placeholder={editable ? "Write something, or press / for commands" : ""}
        scope={() => ""}
        services={services}
      />
      <Show when={uploads.progress() !== undefined}>
        <output class="canvas-upload text-sm">
          Uploading {Math.round((uploads.progress() ?? 0) * 100)}%
        </output>
      </Show>
      <Show when={container()}>
        {(element) => (
          <>
            <Show when={props.comments}>
              {(comments) => (
                <CanvasMarginThreads
                  canReact={canComment}
                  comments={comments()}
                  container={element()}
                  fileId={props.fileId}
                />
              )}
            </Show>
            <Show when={canComment}>
              <CanvasSelectionActions
                container={element()}
                onComment={() => runOnSelection("Comment")}
                onReact={() => runOnSelection("React")}
              />
            </Show>
          </>
        )}
      </Show>
      <CanvasSuggestions
        controller={suggestions}
        popoverRef={(element) => {
          suggestPopoverRef = element;
        }}
        quill={active()}
        state={suggest()}
      />
    </div>
  );
}
