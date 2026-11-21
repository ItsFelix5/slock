import type { Setup } from "@slock/core";
import { lazyChunk } from "@slock/core/solid";
import type { PaneContent } from "@slock/plugins/shell/client/api/types";
import { narrowPaneContent, type Pane } from "@slock/ui";
import { Show } from "solid-js";
import type { DebugPaneContent } from "./api";
import { entities } from "./entities";
import {
  ActivityDebugItem,
  CanvasDebugButton,
  ChannelDebugItem,
  MessageDebugItem,
  ProfileDebugButton,
} from "./views/debugItems";

const DebugPane = lazyChunk(() => import("./views/DebugPane"));
const IconsTab = lazyChunk(() => import("./views/IconsTab"));
const CacheTab = lazyChunk(() => import("./views/CacheTab"));

const SEGMENT_PREFIX = "debug:";

function DebugView(props: { pane: Pane<PaneContent | null> }) {
  return (
    <Show keyed when={narrowPaneContent<PaneContent, DebugPaneContent>(props.pane, "debug")}>
      {(pane) => <DebugPane pane={pane} />}
    </Show>
  );
}

const setup: Setup = (ctx) => {
  ctx.add(
    "shell.pane",
    {
      kind: "debug",
      tabLabel: (content) =>
        content.kind === "debug" ? (entities[content.entity]?.title(content.id) ?? "Debug") : "…",
      url: {
        parse: (segment) => {
          if (!segment.startsWith(SEGMENT_PREFIX)) return null;
          const [entity = "", ...id] = segment.slice(SEGMENT_PREFIX.length).split(":");
          return { entity, id: id.join(":"), kind: "debug" };
        },
        serialize: (content) =>
          content.kind === "debug" ? `${SEGMENT_PREFIX}${content.entity}:${content.id}` : "",
      },
      view: DebugView,
    },
    { order: 90 },
  );
  ctx.add("canvas.headerAction", CanvasDebugButton, { order: 90 });
  ctx.add("profile.meta", ProfileDebugButton, { order: 90 });
  ctx.add("messages.menu", MessageDebugItem, { order: 70 });
  ctx.add("messages.channelMenu", ChannelDebugItem, { order: 70 });
  ctx.add("activity.menu", ActivityDebugItem, { order: 70 });
  ctx.add("settings.tab", { id: "cache", label: "Cache", view: CacheTab }, { order: 89 });
  ctx.add("settings.tab", { id: "icons", label: "Icons", view: IconsTab }, { order: 90 });
};

export default setup;
