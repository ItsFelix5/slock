import { EmojiText } from "@slock/blockkit";
import { Slot, service } from "@slock/core/solid";
import { copyCanvasLink } from "@slock/plugins/message-links/client/api/messageLinks";
import { mentionText } from "@slock/plugins/users/client/api";
import { Button, IconButton, InlineFeedback, type Pane, PanelHeader } from "@slock/ui";
import { Show } from "solid-js";
import type { CanvasPaneContent } from "../api";
import { createCanvasComments } from "../lib/canvasComments";
import { createCanvasHistory } from "../lib/canvasHistory";
import { createCanvasFileQuery } from "../lib/canvasRequests";
import "./CanvasPane.css";
import { defined, errorMessage } from "@slock/core";
import CanvasCommentList from "./CanvasCommentList";
import CanvasEditor from "./CanvasEditor";
import CanvasHistory from "./CanvasHistory";
import CanvasOutlineNav from "./CanvasOutlineNav";
import CanvasVersionView from "./CanvasVersionView";
import { useCanvasHeadings } from "./useCanvasHeadings";
import { useCanvasPanels } from "./useCanvasPanels";

const feedback = service("feedback");

const viewStore = service("shell.view");
const panesStore = service("shell.panes");
const canvas = service("canvas");

export default function CanvasPane(props: { pane: Pane<CanvasPaneContent> }) {
  const fileId = () => props.pane.content.fileId;

  const content = canvas.createCanvasContentQuery(fileId);
  const file = createCanvasFileQuery(fileId);
  const loading = () => content().status === "loading";
  // The editor merges new content in place, so it only remounts for another file or access level.
  const editorKey = () => {
    const access = content().data?.doc && content().data?.access;
    return access ? `${access} ${fileId()}` : undefined;
  };
  const refetch = () => canvas.refreshCanvasContent(fileId());

  const files = service("files");
  const history = createCanvasHistory(fileId, () => content().data, refetch);
  const canvasComments = createCanvasComments(fileId);

  let historyButton: HTMLButtonElement | undefined;
  let commentsButton: HTMLButtonElement | undefined;
  let bodyRef: HTMLDivElement | undefined;
  const paneFocused = () => panesStore.focusedPaneId() === props.pane.id;
  const panels = useCanvasPanels({ fileId, focused: paneFocused, history });
  const outline = useCanvasHeadings({
    body: () => bodyRef,
    content: () => content().data,
    fileId,
    focused: paneFocused,
  });

  function revealComment(threadId: string) {
    bodyRef
      ?.querySelector(`[data-annotation*="${CSS.escape(threadId)}"]`)
      ?.scrollIntoView({ block: "center" });
  }

  return (
    <div class="canvas-panel-card flex-col surface-card" data-pane={props.pane.id}>
      <PanelHeader
        canClose={viewStore.canCloseTile()}
        onClose={() => viewStore.closeTile(props.pane.id)}
      >
        <div class="canvas-panel-header-info flex-align-center">
          <div class="canvas-panel-title truncate title-sm">
            <EmojiText text={mentionText(props.pane.content.title) || "Untitled canvas"} />
          </div>
          <Show when={file().data?.permalink}>
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
            active={panels.commentsOpen()}
            icon="comments"
            iconSize={15}
            label="Comments"
            onClick={panels.toggleComments}
            ref={(element) => {
              commentsButton = element;
            }}
            size="sm"
          />
          <IconButton
            active={history.open()}
            class="canvas-panel-history"
            icon="history"
            iconSize={15}
            label="Version history"
            onClick={panels.toggleHistory}
            ref={(element) => {
              historyButton = element;
            }}
            size="sm"
          />
          <Slot doc={content().data?.doc ?? null} fileId={fileId()} point="canvas.headerAction" />
          <InlineFeedback feedback={feedback.get(fileId())} priority={2} variant="icon" />
        </div>
      </PanelHeader>
      <div class="canvas-panel-body" onScroll={outline.updateActive} ref={bodyRef}>
        <Show when={loading()}>
          <div class="canvas-panel-loading flex-center text-dim text-sm">Loading…</div>
        </Show>
        <Show when={!(loading() || content().data?.doc)}>
          <div class="canvas-panel-load-error flex-center flex-col" role="alert">
            <Show
              fallback={
                <>
                  <span>{errorMessage(content().error, "Something went wrong.")}</span>
                  <Button onClick={() => refetch()} size="sm">
                    Try again
                  </Button>
                </>
              }
              when={canvas.isCanvasNotVisible(fileId())}
            >
              <span>This canvas is no longer available.</span>
            </Show>
          </div>
        </Show>
        <Show when={!loading() && content().data?.doc}>
          <div class="canvas-panel-scroll-row">
            <Show
              fallback={
                <Show keyed when={editorKey()}>
                  {(_key) => (
                    <CanvasEditor
                      access={defined(content().data?.access)}
                      doc={defined(content().data?.doc)}
                      fileId={fileId()}
                      latest={content().data}
                      comments={canvasComments}
                      onOutline={outline.setOutline}
                      onTitle={(title) => canvas.setCanvasTitle(props.pane.id, fileId(), title)}
                    />
                  )}
                </Show>
              }
              keyed
              when={history.selected()}
            >
              {(version) => (
                <CanvasVersionView
                  canRestore={content().data?.access === "edit"}
                  fileId={fileId()}
                  history={history}
                  onOutline={outline.setOutline}
                  version={version}
                />
              )}
            </Show>
            <Show when={panels.commentsOpen() && content().data?.doc}>
              {(doc) => (
                <CanvasCommentList
                  access={defined(content().data?.access)}
                  anchor={() => commentsButton}
                  comments={canvasComments}
                  doc={doc()}
                  fileId={fileId()}
                  onClose={panels.closeComments}
                  onReveal={revealComment}
                />
              )}
            </Show>
            <Show when={history.open()}>
              <CanvasHistory
                anchor={() => historyButton}
                error={history.versions().status === "error"}
                loading={history.versions().refreshing || history.viewing().refreshing}
                onClose={() => history.setOpen(false)}
                onSelect={history.setSelected}
                selected={history.selected()}
                versions={history.versions().data ?? []}
              />
            </Show>
            <CanvasOutlineNav
              activeIndex={outline.activeIndex()}
              headings={outline.headings()}
              onNavigate={outline.jumpTo}
            />
          </div>
        </Show>
      </div>
    </div>
  );
}
