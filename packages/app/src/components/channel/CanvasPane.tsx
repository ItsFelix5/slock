import { EmojiText } from "@slock/blockkit";
import { diffNodes } from "@slock/canvas";
import type { CanvasVersion } from "@slock/types";
import {
  Button,
  focusedPaneId,
  IconButton,
  InlineFeedback,
  type Pane,
  PanelHeader,
  useShortcut,
} from "@slock/ui";
import { createEffect, createMemo, createResource, createSignal, on, Show } from "solid-js";
import {
  fetchCanvasVersion,
  fetchCanvasVersions,
  openCanvasComment,
  restoreCanvasVersion,
} from "../../lib/api";
import type { OutlineItem, OutlineSource } from "../../lib/canvas/canvasOutline";
import { actionFeedback, flashCaughtError } from "../../lib/feedback";
import { copyCanvasLink } from "../../lib/messageLinks";
import { store } from "../../lib/store";
import type { CanvasPaneContent } from "../../lib/store/slices/types";
import "./CanvasPane.css";
import CanvasEditor from "./CanvasEditor";
import CanvasHistory, { versionAuthor, versionLabel } from "./CanvasHistory";
import CanvasOutlineNav from "./CanvasOutlineNav";
import FileDetailModal from "./FileDetailModal";

export default function CanvasPane(props: { pane: Pane<CanvasPaneContent> }) {
  const fileId = () => props.pane.content.fileId;

  const [content, { mutate, refetch }] = createResource(fileId, store.canvas.loadCanvasContent);
  const [permalink] = createResource(fileId, store.canvas.loadCanvasPermalink);

  const [detailOpen, setDetailOpen] = createSignal(false);
  const [historyOpen, setHistoryOpen] = createSignal(false);
  const [selected, setSelected] = createSignal<CanvasVersion | null>(null);
  const [showChanges, setShowChanges] = createSignal(true);
  const [versions] = createResource(
    () => (historyOpen() ? fileId() : undefined),
    fetchCanvasVersions,
  );
  const [viewing] = createResource(
    () => {
      const version = selected();
      const meta = content()?.doc?.meta;
      const list = versions() ?? [];
      return version && meta ? { list, meta, version } : undefined;
    },
    async ({ list, meta, version }) => {
      const older = list[list.indexOf(version) + 1];
      const [doc, previous] = await Promise.all([
        fetchCanvasVersion(fileId(), version, meta),
        older ? fetchCanvasVersion(fileId(), older, meta) : null,
      ]);
      return doc ? { doc, previous } : null;
    },
  );
  const viewKey = createMemo(() => {
    const version = selected();
    return viewing()?.doc && version
      ? { key: `${version.versionId}:${showChanges()}`, version }
      : undefined;
  });
  const diff = createMemo(() => {
    const view = viewing();
    return view && showChanges()
      ? diffNodes(view.previous?.nodes ?? [], view.doc.nodes)
      : undefined;
  });
  createEffect(
    on(fileId, () => {
      setHistoryOpen(false);
      setSelected(null);
    }),
  );

  async function openComment(annotationId: string) {
    try {
      const { channelId, ts } = await openCanvasComment(fileId(), annotationId);
      store.viewState.openThread(channelId, ts, undefined, { pinned: true });
    } catch (error) {
      flashCaughtError(fileId(), error, "Couldn't open the comment");
    }
  }

  async function restore(version: CanvasVersion) {
    try {
      await restoreCanvasVersion(fileId(), version);
      setSelected(null);
      setHistoryOpen(false);
      await refetch();
    } catch (error) {
      flashCaughtError(fileId(), error, "Couldn't restore this version");
    }
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
      const el = outline()?.element(index);
      if (el && el.getBoundingClientRect().top - containerTop <= 32) current = index;
    }
    setActiveIndex(current);
  }

  createEffect(() => {
    content();
    outline()?.items();
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
          <IconButton
            icon="info"
            iconSize={15}
            label="File details"
            onClick={() => setDetailOpen(true)}
            size="sm"
          />
          <IconButton
            active={historyOpen()}
            class="canvas-panel-history"
            icon="history"
            iconSize={15}
            label="Version history"
            onClick={() => {
              setHistoryOpen(!historyOpen());
              setSelected(null);
            }}
            size="sm"
          />
          <InlineFeedback feedback={actionFeedback.get(fileId())} priority={2} variant="icon" />
        </div>
      </PanelHeader>
      <Show when={detailOpen()}>
        <FileDetailModal
          file={{
            filetype: "quip",
            id: fileId(),
            isImage: false,
            name: props.pane.content.title,
            title: props.pane.content.title,
            urlPrivate: "",
          }}
          onClose={() => setDetailOpen(false)}
        />
      </Show>
      <div class="canvas-panel-body" onScroll={updateActiveHeading} ref={bodyRef}>
        <Show when={content.loading}>
          <div class="canvas-panel-loading flex-center text-dim text-sm">Loading…</div>
        </Show>
        <Show when={!(content.loading || content()?.doc)}>
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
        <Show when={!content.loading && content()?.doc}>
          <div class="canvas-panel-scroll-row">
            <Show
              fallback={
                <Show keyed when={content()?.doc}>
                  {(doc) => (
                    <CanvasEditor
                      doc={doc}
                      editable={content()?.editable ?? false}
                      fileId={fileId()}
                      onComment={(annotationId) => void openComment(annotationId)}
                      onOutline={setEditorOutline}
                      fetchLatest={() => store.canvas.loadCanvasContent(fileId())}
                      onRemoteChange={(latest) => mutate(latest)}
                      onReload={() => void refetch()}
                      onTitle={(title) =>
                        store.canvas.setCanvasTitle(props.pane.id, fileId(), title)
                      }
                    />
                  )}
                </Show>
              }
              keyed
              when={viewKey()}
            >
              {(version) => (
                <div class="canvas-version-view">
                  <div class="canvas-version-banner" role="status">
                    Viewing the version from {versionLabel(version.version)} by{" "}
                    {versionAuthor(version.version)}
                  </div>
                  <Show keyed when={viewing()?.doc}>
                    {(doc) => (
                      <CanvasEditor
                        diff={diff()}
                        doc={doc}
                        editable={false}
                        fetchLatest={() => Promise.resolve(null)}
                        fileId={fileId()}
                        onOutline={setEditorOutline}
                        onReload={() => undefined}
                        onRemoteChange={() => undefined}
                      />
                    )}
                  </Show>
                </div>
              )}
            </Show>
            <Show when={historyOpen()}>
              <div class="canvas-history-slot">
                <CanvasHistory
                  error={!!versions.error}
                  loading={versions.loading || viewing.loading}
                  onClose={() => {
                    setHistoryOpen(false);
                    setSelected(null);
                  }}
                  onRestore={restore}
                  onSelect={setSelected}
                  onToggleChanges={setShowChanges}
                  selected={selected()}
                  showChanges={showChanges()}
                  versions={versions() ?? []}
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
