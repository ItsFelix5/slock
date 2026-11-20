import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { ifPresent, isChannelId, parseChannelId, parseTs } from "@slock/slack";
import { narrowPaneContent, type Pane, useShortcut } from "@slock/ui";
import { createEffect, lazy, Show } from "solid-js";
import { liveOnly } from "../../messages/client/api/deletedMessages";
import type { PaneContent } from "../../shell/client/api/types";
import type { PinnedPaneContent } from "./api";
import { createPinnedSlice } from "./store";
import PinItem from "./views/PinItem";
import PinnedBadge from "./views/PinnedBadge";
import ViewPinnedItem from "./views/ViewPinnedItem";

const messageFocus = service("messages.focus");
const active = () => messageFocus.active();
const PinnedPane = lazy(() => import("./views/PinnedPane"));
const PINNED_MARK = "*";

function PinnedView(props: { pane: Pane<PaneContent | null> }) {
  return (
    <Show keyed when={narrowPaneContent<PaneContent, PinnedPaneContent>(props.pane, "pinned")}>
      {(pane) => <PinnedPane pane={pane} />}
    </Show>
  );
}

const setup: Setup = (ctx) => {
  const titles = service("titles");
  ctx.add(
    "shell.pane",
    {
      kind: "pinned",
      tabLabel: (content) =>
        content.kind === "pinned" ? `Pinned in ${titles.label(content.channelId)}` : "…",
      url: {
        parse: (segment) => {
          const channelId = segment.endsWith(PINNED_MARK) ? segment.slice(0, -1) : undefined;
          return channelId && isChannelId(channelId) ? { channelId, kind: "pinned" } : null;
        },
        serialize: (content) =>
          content.kind === "pinned" ? `${content.channelId}${PINNED_MARK}` : "",
      },
      view: PinnedView,
    },
    { order: 20 },
  );
  const store = createPinnedSlice({ panes: service("shell.panes") });
  ctx.provide("pins", store);
  createEffect(
    () => service("conversations").activeView(),
    (view) => {
      if (view) store.ensurePinsLoaded(view.id);
    },
  );
  ctx.add("realtime.handler", {
    run: (event) => {
      if (event.type !== "pin_added" && event.type !== "pin_removed") return;
      const channelId = ifPresent(parseChannelId, event.channel_id);
      const ts = ifPresent(parseTs, event.ts);
      if (channelId && ts) store.applyPinEvent(channelId, ts, event.type === "pin_added");
    },
    types: ["pin_added", "pin_removed"],
  });
  useShortcut({
    combo: { key: "p" },
    enabled: () => active()?.focusedLiveTs() != null,
    group: "Message actions",
    handler: () => {
      const focus = active();
      const ts = focus?.focusedTs();
      const channelId = focus?.channelId();
      if (ts != null && channelId) store.togglePinMessage(channelId, ts);
    },
    id: "messages.pin",
    label: "Pin / unpin",
    scope: "messages",
  });
  ctx.add("messages.badge", PinnedBadge, { order: 20 });
  ctx.add("messages.menu", liveOnly(PinItem), { order: 20 });
  ctx.add("messages.channelMenu", ViewPinnedItem, { order: 30 });
};

export default setup;
