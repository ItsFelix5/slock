import { EmojiText } from "@slock/blockkit";
import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { narrowPaneContent, type Pane } from "@slock/ui";
import { createEffect, lazy, Show } from "solid-js";
import type { PaneContent } from "../../shell/client/api/types";
import type { CanvasPaneContent } from "./api";
import { openCanvasLinksOnClick } from "./lib/canvasLinks";
import { fetchCanvasTitle } from "./lib/canvasRequests";
import { createCanvasStore } from "./store";

const CanvasPane = lazy(() => import("./views/CanvasPane"));
const FILE_SEGMENT = /^F/;

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
  const requestedTitles = new Set<string>();
  createEffect(() => {
    for (const { content, id } of panes.panes()) {
      if (content?.kind !== "canvas" || content.title) continue;
      const { fileId } = content;
      if (requestedTitles.has(`${id}:${fileId}`)) continue;
      requestedTitles.add(`${id}:${fileId}`);
      void fetchCanvasTitle(fileId).then((title) => {
        if (title) panes.setPaneContent(id, { fileId, kind: "canvas", title });
      });
    }
  });
  ctx.onCleanup(openCanvasLinksOnClick(store.openCanvasPane));
  ctx.add("realtime.handler", {
    run: (event) => {
      if (event.type === "canvas_created" && event.channel_id)
        store.invalidateChannel(event.channel_id);
    },
    types: ["canvas_created"],
  });
  ctx.add("messages.blockKit", {
    onCanvasClick: store.openCanvasPane,
    resolveCanvasTitle: store.canvasTitle,
  });
  ctx.add(
    "shell.pane",
    {
      identity: (content) => (content.kind === "canvas" ? { ...content, title: "" } : content),
      kind: "canvas",
      tabLabel: (content) => (content.kind === "canvas" ? <EmojiText text={content.title} /> : "…"),
      url: {
        parse: (segment) =>
          FILE_SEGMENT.test(segment) ? { fileId: segment, kind: "canvas", title: "" } : null,
        serialize: (content) => (content.kind === "canvas" ? content.fileId : ""),
      },
      view: CanvasView,
    },
    { order: 0 },
  );
};

export default setup;
