import { EmojiText } from "@slock/blockkit";
import { Slot, service } from "@slock/core/solid";
import {
  Button,
  focusedPaneId,
  IconButton,
  InlineFeedback,
  type Pane,
  PanelHeader,
  useShortcut,
} from "@slock/ui";
import { createEffect, createSignal, on, Show } from "solid-js";
import { copyCanvasLink } from "../../../message-links/client/api/messageLinks";
import type { CanvasPaneContent } from "../api";
import { createCanvasComments } from "../lib/canvasComments";
import { createCanvasHistory } from "../lib/canvasHistory";
import type { OutlineItem, OutlineSource } from "../lib/canvasOutline";
import "./CanvasPane.css";
import { defined } from "@slock/core";
import CanvasEditor from "./CanvasEditor";
import CanvasHistory from "./CanvasHistory";
import CanvasOutlineNav from "./CanvasOutlineNav";
import CanvasVersionBanner from "./CanvasVersionBanner";

const feedback = service("feedback");

const viewStore = service("shell.view");

export default function CanvasPane(props: { pane: Pane<CanvasPaneContent> }) {
  const fileId = () => props.pane.content.fileId;

  const content = service("canvas").createCanvasContentQuery(fileId);
  const permalink = service("canvas").createCanvasPermalinkQuery(fileId);
  const refetch = () => content.refetch();

  const files = service("files");
  const history = createCanvasHistory(fileId, () => content.data, refetch);
  const canvasComments = createCanvasComments(fileId);

  let historyButton: HTMLButtonElement | undefined;

  function toggleHistory() {
    history.setOpen(!history.open());
  }

  let bodyRef: HTMLDivElement | undefined;
  const [activeIndex, setActiveIndex] = createSignal<number | null>(null);

  const [editorOutline, setEditorOutline] = createSignal<OutlineSource | null>(null);
  createEffect(on(fileId, () => setEditorOutline(null)));
  const outline = () => editorOutline();
  const headings = (): OutlineItem[] => (outline()?.items() ?? []).filter((item) => item.text);

  function jumpTo(index: number) {
    outline()?.element(index)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function jumpRelative(delta: number) {
    const items = headings();
    if (items.length === 0) return;
    const currentPos = items.findIndex((h) => h.index === activeIndex());
    const nextPos = Math.min(Math.max(currentPos + delta, 0), items.length - 1);
    jumpTo(defined(items[nextPos]).index);
  }

  useShortcut({
    combo: { alt: true, key: "ArrowDown" },
    enabled: () => focusedPaneId() === props.pane.id && headings().length > 1,
    handler: () => jumpRelative(1),
    id: "canvas.jumpNextHeading",
    label: "Jump to the next heading",
    scope: "general",
    group: "Canvas",
  });
  useShortcut({
    combo: { alt: true, key: "ArrowUp" },
    enabled: () => focusedPaneId() === props.pane.id && headings().length > 1,
    handler: () => jumpRelative(-1),
    id: "canvas.jumpPrevHeading",
    label: "Jump to the previous heading",
    scope: "general",
    group: "Canvas",
  });

  function updateActiveHeading() {
    if (!bodyRef) return;
    const items = headings();
    if (items.length === 0) return;
    const containerTop = bodyRef.getBoundingClientRect().top;
    let current = defined(items[0]).index;
    for (const { index } of items) {
      const el = outline()?.element(index);
      if (el && el.getBoundingClientRect().top - containerTop <= 32) current = index;
    }
    setActiveIndex(current);
  }

  createEffect(
    on([() => content.data, () => outline()?.items()], () => queueMicrotask(updateActiveHeading)),
  );

  return (
    <div class="canvas-panel-card flex-col surface-card" data-pane={props.pane.id}>
      <PanelHeader
        canClose={viewStore.canCloseTile()}
        onClose={() => viewStore.closeTile(props.pane.id)}
      >
        <div class="canvas-panel-header-info flex-align-center">
          <div class="canvas-panel-title truncate title-sm">
            <EmojiText text={props.pane.content.title || "Untitled canvas"} />
          </div>
          <Show when={permalink.data}>
            {(link) => (
              <IconButton
                class="canvas-panel-copy-link"
                icon="link"
                iconSize={15}
                label="Copy link"
                onClick={() => copyCanvasLink(fileId(), link())}
                size="sm"
              />
            )}
          </Show>
          <IconButton
            icon="info"
            iconSize={15}
            label="File details"
            onClick={() =>
              files.open({
                filetype: "quip",
                id: fileId(),
                isImage: false,
                name: props.pane.content.title,
                title: props.pane.content.title,
                urlPrivate: "",
              })
            }
            size="sm"
          />
          <IconButton
            active={history.open()}
            class="canvas-panel-history"
            icon="history"
            iconSize={15}
            label="Version history"
            onClick={toggleHistory}
            ref={(element) => {
              historyButton = element;
            }}
            size="sm"
          />
          <Slot doc={content.data?.doc ?? null} fileId={fileId()} point="canvas.headerAction" />
          <InlineFeedback feedback={feedback.get(fileId())} priority={2} variant="icon" />
        </div>
      </PanelHeader>
      <div class="canvas-panel-body" onScroll={updateActiveHeading} ref={bodyRef}>
        <Show when={content.isLoading}>
          <div class="canvas-panel-loading flex-center text-dim text-sm">Loading…</div>
        </Show>
        <Show when={!(content.isLoading || content.data?.doc)}>
          <div class="canvas-panel-load-error flex-center flex-col" role="alert">
            <Show
              fallback={
                <>
                  <span>Something went wrong.</span>
                  <Button onClick={() => refetch()} size="sm">
                    Try again
                  </Button>
                </>
              }
              when={service("canvas").isCanvasNotVisible(fileId())}
            >
              <span>This canvas is no longer available.</span>
            </Show>
          </div>
        </Show>
        <Show when={!content.isLoading && content.data?.doc}>
          <div class="canvas-panel-scroll-row">
            <Show
              fallback={
                <Show keyed when={content.data?.doc}>
                  {(doc) => (
                    <CanvasEditor
                      doc={doc}
                      editable={content.data?.editable ?? false}
                      fileId={fileId()}
                      onComment={(annotationId) => void canvasComments.openAnnotation(annotationId)}
                      onOpenThread={(thread) => canvasComments.openThread(thread)}
                      onReact={(annotationId, name) =>
                        void canvasComments.reactToAnnotation(annotationId, name)
                      }
                      onReactToThread={(thread, name) =>
                        void canvasComments.reactToThread(thread, name)
                      }
                      threads={canvasComments.comments()?.threads}
                      onOutline={setEditorOutline}
                      fetchLatest={() => service("canvas").loadLatestCanvas(fileId())}
                      onRemoteChange={(latest) =>
                        service("canvas").setCanvasContent(fileId(), latest)
                      }
                      onTitle={(title) =>
                        service("canvas").setCanvasTitle(props.pane.id, fileId(), title)
                      }
                    />
                  )}
                </Show>
              }
              keyed
              when={history.selected()}
            >
              {(version) => (
                <div class="canvas-version-view">
                  <CanvasVersionBanner
                    canRestore={content.data?.editable ?? false}
                    onExit={() => history.setSelected(null)}
                    onRestore={() => void history.restore(version)}
                    restoring={history.restoring()}
                    version={version}
                  />
                  <Show keyed when={history.viewing.data?.doc}>
                    {(doc) => (
                      <CanvasEditor
                        diff={history.diff()}
                        doc={doc}
                        editable={false}
                        fetchLatest={() => Promise.resolve(null)}
                        fileId={fileId()}
                        onOutline={setEditorOutline}
                        onRemoteChange={() => undefined}
                      />
                    )}
                  </Show>
                </div>
              )}
            </Show>
            <Show when={history.open()}>
              <div class="canvas-history-slot">
                <CanvasHistory
                  anchor={() => historyButton}
                  error={!!history.versions.error}
                  loading={history.versions.isFetching || history.viewing.isFetching}
                  onClose={() => history.setOpen(false)}
                  onSelect={history.setSelected}
                  selected={history.selected()}
                  versions={history.versions.data ?? []}
                />
              </div>
            </Show>
            <CanvasOutlineNav
              activeIndex={activeIndex()}
              headings={headings()}
              onNavigate={jumpTo}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}
