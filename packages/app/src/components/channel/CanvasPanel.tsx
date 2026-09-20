import { EmojiText, Mrkdwn } from "@slock/blockkit";
import { type CanvasBlock, mapFile, resolveMediaUrl } from "@slock/types";
import {
  Button,
  ConstrainedImage,
  constrainMediaDimensions,
  focusedPaneId,
  IconButton,
  InlineFeedback,
  type Pane,
  PanelHeader,
  useShortcut,
} from "@slock/ui";
import { createEffect, createResource, createSignal, For, Match, Show, Switch } from "solid-js";
import {
  bulletListMarkerType,
  orderedListEntries,
  orderedListMarkerType,
} from "../../lib/canvasListMarkers";
import { actionFeedback } from "../../lib/feedback";
import { copyCanvasLink } from "../../lib/messageLinks";
import { store } from "../../lib/store";
import type { CanvasPaneContent } from "../../lib/store/slices/types";
import "./CanvasPanel.css";

function CanvasBlockView(props: { block: CanvasBlock; index: number }) {
  return (
    <Switch>
      <Match when={props.block.type === "title"}>
        <h1 data-canvas-index={props.index}>
          <Mrkdwn text={props.block.text} />
        </h1>
      </Match>
      <Match when={props.block.type === "heading" && props.block.level === 1}>
        <h2 data-canvas-index={props.index}>
          <Mrkdwn text={props.block.text} />
        </h2>
      </Match>
      <Match when={props.block.type === "heading" && props.block.level === 2}>
        <h3 data-canvas-index={props.index}>
          <Mrkdwn text={props.block.text} />
        </h3>
      </Match>
      <Match when={props.block.type === "heading" && (props.block.level ?? 0) >= 3}>
        <h4 data-canvas-index={props.index}>
          <Mrkdwn text={props.block.text} />
        </h4>
      </Match>
      <Match when={props.block.type === "code"}>
        <pre class="canvas-panel-code">{props.block.text}</pre>
      </Match>
      <Match when={props.block.type === "callout"}>
        <div class="canvas-panel-callout">
          <Mrkdwn text={props.block.text} />
        </div>
      </Match>
      <Match when={props.block.type === "blockquote"}>
        <blockquote>
          <Mrkdwn text={props.block.text} />
        </blockquote>
      </Match>
      <Match when={props.block.type === "bulletList"}>
        <ul>
          <For each={props.block.items ?? []}>
            {(item) => (
              <li
                class="canvas-panel-list-item"
                style={{
                  "--indent": item.indent,
                  "list-style-type": bulletListMarkerType(item.indent),
                }}
              >
                <Mrkdwn text={item.text} />
              </li>
            )}
          </For>
        </ul>
      </Match>
      <Match when={props.block.type === "orderedList"}>
        <ol>
          <For each={orderedListEntries(props.block.items ?? [])}>
            {(item) => (
              <li
                class="canvas-panel-list-item"
                style={{
                  "--indent": item.indent,
                  "list-style-type": orderedListMarkerType(item.indent),
                }}
                value={item.value}
              >
                <Mrkdwn text={item.text} />
              </li>
            )}
          </For>
        </ol>
      </Match>
      <Match when={props.block.type === "checklist"}>
        <ul class="canvas-panel-checklist">
          <For each={props.block.items ?? []}>
            {(item) => (
              <li class="canvas-panel-list-item" style={{ "--indent": item.indent }}>
                <input checked={item.checked ?? false} disabled type="checkbox" />
                <Mrkdwn text={item.text} />
              </li>
            )}
          </For>
        </ul>
      </Match>
      <Match when={props.block.type === "image"}>
        <div class="canvas-panel-images">
          <For each={(props.block.files ?? []).map(mapFile)}>
            {(file) => {
              const dimensions = () =>
                constrainMediaDimensions(file.width, file.height, 480, 480, 320, 240);
              return (
                <ConstrainedImage
                  alt={file.title || file.name}
                  blurSrc={file.thumbTiny ? `data:image/jpeg;base64,${file.thumbTiny}` : undefined}
                  class="canvas-panel-image"
                  fullSrc={resolveMediaUrl(file.urlPrivate)}
                  height={dimensions().height}
                  src={file.thumbUrl ?? resolveMediaUrl(file.urlPrivate)}
                  width={dimensions().width}
                />
              );
            }}
          </For>
        </div>
      </Match>
      <Match when={props.block.type === "section"}>
        <div class="canvas-panel-section">
          <For each={props.block.columns ?? []}>
            {(column) => (
              <div>
                <Mrkdwn text={column} />
              </div>
            )}
          </For>
        </div>
      </Match>
      <Match when={props.block.type === "table"}>
        <div class="canvas-panel-table-wrap">
          <table>
            <Show when={props.block.colWidths?.some((width) => width > 0)}>
              <colgroup>
                <For each={props.block.colWidths}>
                  {(width) => <col style={{ width: width > 0 ? `${width}px` : undefined }} />}
                </For>
              </colgroup>
            </Show>
            <tbody>
              <For each={props.block.rows ?? []}>
                {(row) => (
                  <tr>
                    <For each={row}>
                      {(cell) => (
                        <td>
                          <Mrkdwn text={cell} />
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </Match>
      <Match when={props.block.type === "paragraph" && !props.block.text.trim()}>
        <div class="canvas-panel-spacer" />
      </Match>
      <Match when={props.block.type === "paragraph"}>
        <p>
          <Mrkdwn text={props.block.text} />
        </p>
      </Match>
    </Switch>
  );
}

function headingLevel(block: CanvasBlock): number {
  return block.type === "title" ? 0 : (block.level ?? 1);
}

function CanvasOutlineNav(props: {
  headings: { block: CanvasBlock; index: number }[];
  activeIndex: number | null;
  onNavigate: (index: number) => void;
}) {
  return (
    <Show when={props.headings.length > 1}>
      <nav aria-label="Canvas outline" class="canvas-outline-nav">
        <div class="canvas-outline-rail">
          <For each={props.headings}>
            {({ block, index }) => (
              <button
                aria-label={block.text}
                classList={{
                  "canvas-outline-mark": true,
                  active: index === props.activeIndex,
                }}
                data-level={headingLevel(block)}
                onClick={() => props.onNavigate(index)}
                type="button"
              />
            )}
          </For>
        </div>
        <div class="canvas-outline-popout">
          <For each={props.headings}>
            {({ block, index }) => (
              <button
                classList={{
                  "canvas-outline-popout-row": true,
                  truncate: true,
                  active: index === props.activeIndex,
                }}
                data-level={headingLevel(block)}
                onClick={() => props.onNavigate(index)}
                type="button"
              >
                <Mrkdwn text={block.text} />
              </button>
            )}
          </For>
        </div>
      </nav>
    </Show>
  );
}

export default function CanvasPanel(props: { pane: Pane<CanvasPaneContent> }) {
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
  });
  useShortcut({
    combo: { alt: true, key: "ArrowUp" },
    enabled: () => focusedPaneId() === props.pane.id && headings().length > 1,
    handler: () => jumpRelative(-1),
    id: "canvas.jumpPrevHeading",
    label: "Jump to the previous heading",
    scope: "general",
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
            <span>Something went wrong.</span>
            <Button onClick={() => refetch()} size="sm">
              Try again
            </Button>
          </div>
        </Show>
        <Show when={!content.loading && content() != null}>
          <div class="canvas-panel-scroll-row">
            <div class="canvas-panel-content input-reset">
              <For each={content() ?? []}>
                {(block, index) => <CanvasBlockView block={block} index={index()} />}
              </For>
            </div>
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
