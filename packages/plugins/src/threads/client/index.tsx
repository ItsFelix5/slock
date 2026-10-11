import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { narrowPaneContent, type Pane } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageBodyProps, ThreadPaneContent } from "../../messages/client/api";
import { liveOnly } from "../../messages/client/api/deletedMessages";
import type { PaneContent } from "../../shell/client/api/types";
import BroadcastBadge from "./views/BroadcastBadge";
import BroadcastItem from "./views/BroadcastItem";
import MessageRepliesButton from "./views/MessageRepliesButton";
import ThreadButton from "./views/ThreadButton";
import ThreadPane from "./views/ThreadPane";

function RepliesBody(props: MessageBodyProps) {
  return (
    <Show when={props.onOpenThread && (props.msg.replyCount ?? 0) > 0}>
      <MessageRepliesButton msg={props.msg} onOpenThread={props.onOpenThread ?? (() => {})} />
    </Show>
  );
}

const THREAD_SEPARATOR = "~";
const PINNED_MARK = "!";

function ThreadView(props: { pane: Pane<PaneContent | null> }) {
  return (
    <Show keyed when={narrowPaneContent<PaneContent, ThreadPaneContent>(props.pane, "thread")}>
      {(pane) => <ThreadPane pane={pane} />}
    </Show>
  );
}

const setup: Setup = (ctx) => {
  const titles = service("titles");
  const panes = service("shell.panes");
  ctx.add("conversations.opened", (opened) => {
    const thread = panes
      .panes()
      .find(({ content }) => content?.kind === "thread" && !content.pinned);
    if (thread?.content?.kind === "thread" && thread.content.channelId !== opened.id)
      panes.closePane(thread.id);
  });
  ctx.add(
    "shell.pane",
    {
      followsFocus: true,
      kind: "thread",
      singleton: (content) => content.kind !== "thread" || !content.pinned,
      tabLabel: (content) =>
        content.kind === "thread" ? `Thread in ${titles.label(content.channelId)}` : "…",
      url: {
        parse: (segment) => {
          const split = segment.indexOf(THREAD_SEPARATOR);
          if (split < 0) return null;
          const channelId = segment.slice(0, split);
          const rest = segment.slice(split + 1);
          const pinned = rest.endsWith(PINNED_MARK);
          const ts = pinned ? rest.slice(0, -1) : rest;
          return { channelId, kind: "thread", pinned: pinned || undefined, ts };
        },
        serialize: (content) =>
          content.kind === "thread"
            ? `${content.channelId}${THREAD_SEPARATOR}${content.ts}${content.pinned ? PINNED_MARK : ""}`
            : "",
      },
      view: ThreadView,
    },
    { order: 10 },
  );
  ctx.add("messages.badge", BroadcastBadge, { order: 30 });
  ctx.add("messages.body", liveOnly(RepliesBody), { order: 40 });
  ctx.add("messages.bar", liveOnly(ThreadButton), { order: 20 });
  ctx.add("messages.menu", liveOnly(BroadcastItem), { order: 30 });
};

export default setup;
