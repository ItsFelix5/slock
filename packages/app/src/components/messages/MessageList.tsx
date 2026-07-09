import { createEffect, createMemo, Show } from "solid-js";
import {
  activeView,
  channelById,
  channelDisplayName,
  dmById,
  messagesByChannel,
  openThread,
  userById,
} from "../../lib/store";
import MessageRows from "./MessageRows";
import "./MessageList.css";

const NEAR_BOTTOM_PX = 120;

export default function MessageList() {
  let scrollRef: HTMLDivElement | undefined;
  let lastViewId: string | undefined;

  const messages = createMemo(() => {
    const v = activeView();
    if (!v) return [];
    return messagesByChannel[v.id] ?? [];
  });

  const channelName = createMemo(() => {
    const v = activeView();
    if (!v) return "";
    if (v.kind === "channel") return channelDisplayName(channelById(v.id), v.id);
    const dm = dmById(v.id);
    return dm ? (userById(dm.userId)?.name ?? "") : "";
  });

  // Jump to the newest message whenever the channel changes or its history first
  // loads — without this the list sits at its natural scroll position (the top,
  // i.e. the oldest loaded message) instead of where a chat view is expected to open.
  // Once already open, a live message only pulls the view down if the reader was
  // already near the bottom — otherwise it'd yank them away from history they're reading.
  createEffect(() => {
    const view = activeView();
    messages();
    const switchedView = view?.id !== lastViewId;
    lastViewId = view?.id;
    const el = scrollRef;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (switchedView || nearBottom) {
      queueMicrotask(() => {
        if (scrollRef) scrollRef.scrollTop = scrollRef.scrollHeight;
      });
    }
  });

  return (
    <div class="message-list" ref={scrollRef}>
      <div class="message-list-intro">
        <div class="message-list-intro-icon">#</div>
        <h2>{channelName()}</h2>
        <p>This is the very beginning of your conversation. Say hello!</p>
      </div>

      <Show when={activeView()}>
        {(v) => (
          <MessageRows
            messages={messages()}
            channelId={v().id}
            location={{ store: "channel", key: v().id }}
            onOpenThread={(ts) => openThread(v().id, ts)}
          />
        )}
      </Show>
    </div>
  );
}
