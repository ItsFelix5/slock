import { EmojiText } from "@slock/blockkit";
import type { Setup } from "@slock/core";
import { lazyChunk, service } from "@slock/core/solid";
import { gatewayHandler } from "@slock/plugins/realtime/client/api";
import type { PaneContent } from "@slock/plugins/shell/client/api/types";
import { mentionText } from "@slock/plugins/users/client/api";
import { hostedFileId, isChannelId, isFileId, isTs } from "@slock/slack";
import { narrowPaneContent, type Pane } from "@slock/ui";
import { Show } from "solid-js";
import type { CanvasPaneContent } from "./api";
import { noteCommentActivity } from "./lib/canvasComments";
import { openCanvasLinksOnClick } from "./lib/canvasLinks";
import { titleUntitledPanes } from "./lib/titleUntitledPanes";
import { createCanvasStore } from "./store";
import CommentQuote from "./views/CommentQuote";
import { commentThread } from "./views/commentThread";

const CanvasPane = lazyChunk(() => import("./views/CanvasPane"));

function CanvasView(props: { pane: Pane<PaneContent | null> }) {
  return (
    <Show keyed when={narrowPaneContent<PaneContent, CanvasPaneContent>(props.pane, "canvas")}>
      {(pane) => <CanvasPane pane={pane} />}
    </Show>
  );
}

const setup: Setup = (ctx) => {
  const panes = service("shell.panes");
  const store = createCanvasStore({ panes });
  ctx.provide("canvas", store);
  titleUntitledPanes(panes, store.rawCanvasTitle);
  ctx.onCleanup(openCanvasLinksOnClick(store.openCanvasPane));
  ctx.add("realtime.handler", {
    run: (event) => {
      if (event.type === "canvas_created" && event.channel_id && isChannelId(event.channel_id))
        store.invalidateChannel(event.channel_id);
    },
    types: ["canvas_created"],
  });
  ctx.add("realtime.handler", {
    run: (event) => {
      if ("file_id" in event && event.file_id && isFileId(event.file_id))
        store.noteRemoteChange(event.file_id);
    },
    types: ["document_update", "file_change"],
  });
  const users = service("users");
  ctx.add(
    "realtime.handler",
    gatewayHandler(["message", "reaction_added", "reaction_removed"], (event) => {
      const channelId = event.type === "message" ? event.channel : event.item.channel;
      if (!(channelId && isChannelId(channelId))) return;
      const reply =
        event.type === "message" && event.user === users.currentUserId()
          ? event.thread_ts
          : undefined;
      noteCommentActivity(channelId, reply && isTs(reply) ? reply : undefined);
    }),
  );
  ctx.add("messages.quote", (msg, channelId) =>
    msg.canvasComment ? (
      <CommentQuote
        fileId={hostedFileId(channelId)}
        text={msg.text}
        threadId={msg.canvasComment.threadId}
      />
    ) : undefined,
  );
  ctx.add("threads.override", commentThread);
  ctx.add("messages.blockKit", {
    onCanvasClick: store.openCanvasPane,
    resolveCanvasTitle: store.canvasTitle,
  });
  ctx.add(
    "shell.pane",
    {
      identity: (content) => (content.kind === "canvas" ? { ...content, title: "" } : content),
      kind: "canvas",
      tabLabel: (content) =>
        content.kind === "canvas" ? <EmojiText text={mentionText(content.title)} /> : "…",
      url: {
        parse: (segment) =>
          isFileId(segment) ? { fileId: segment, kind: "canvas", title: "" } : null,
        serialize: (content) => (content.kind === "canvas" ? content.fileId : ""),
      },
      view: CanvasView,
    },
    { order: 0 },
  );
};

export default setup;
