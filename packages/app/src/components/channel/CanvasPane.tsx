import { EmojiText } from "@slock/blockkit";
import {
  Button,
  focusedPaneId,
  IconButton,
  InlineFeedback,
  type Pane,
  PanelHeader,
  useShortcut,
} from "@slock/ui";
import { createEffect, createResource, createSignal, Show } from "solid-js";
import { actionFeedback } from "../../lib/feedback";
import { copyCanvasLink } from "../../lib/messageLinks";
import { store } from "../../lib/store";
import type { CanvasPaneContent } from "../../lib/store/slices/types";
import "./CanvasPane.css";
import CanvasContent from "./CanvasContent";
import CanvasOutlineNav from "./CanvasOutlineNav";

export default function CanvasPane(props: { pane: Pane<CanvasPaneContent> }) {
  const fileId = () => props.pane.content.fileId;

  const [content, { refetch }] = createResource(fileId, store.canvas.loadCanvasContent);
  const [permalink] = createResource(fileId, store.canvas.loadCanvasPermalink);

  let bodyRef: HTMLDivElement | undefined;
  const [activeIndex, setActiveIndex] = createSignal<number | null>(null);

  const headings = () =>
    (content() ?? [])
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.type === "title" || block.type === "heading");

  function jumpTo(index: number) {
    bodyRef
      ?.querySelector(`[data-canvas-index="${index}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function jumpRelative(delta: number) {
    const items = headings();
    if (items.length === 0) return;
    const currentPos = items.findIndex((h) => h.index === activeIndex());
    const nextPos = Math.min(Math.max(currentPos + delta, 0), items.length - 1);
    jumpTo(items[nextPos].index);
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
    let current = items[0].index;
    for (const { index } of items) {
      const el = bodyRef.querySelector(`[data-canvas-index="${index}"]`);
      if (el && el.getBoundingClientRect().top - containerTop <= 32) current = index;
    }
    setActiveIndex(current);
  }

  createEffect(() => {
    content();
    queueMicrotask(updateActiveHeading);
  });

  return (
    <div class="canvas-panel-card flex-col surface-card" data-pane={props.pane.id}>
      <PanelHeader
        canClose={store.viewState.canCloseTile()}
        onClose={() => store.viewState.closeTile(props.pane.id)}
      >
        <div class="canvas-panel-header-info flex-align-center">
          <div class="canvas-panel-title truncate">
            <EmojiText text={props.pane.content.title || "Untitled canvas"} />
          </div>
          <Show when={permalink()}>
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
          <InlineFeedback feedback={actionFeedback.get(fileId())} priority={2} variant="icon" />
        </div>
      </PanelHeader>
      <div class="canvas-panel-body" onScroll={updateActiveHeading} ref={bodyRef}>
        <Show when={content.loading}>
          <div class="canvas-panel-loading flex-center text-dim text-sm">Loading…</div>
        </Show>
        <Show when={!content.loading && content() === null}>
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
              when={store.canvas.isCanvasNotVisible(fileId())}
            >
              <span>This canvas is no longer available.</span>
            </Show>
          </div>
        </Show>
        <Show when={!content.loading && content() != null}>
          <div class="canvas-panel-scroll-row">
            <CanvasContent blocks={content() ?? []} />
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
