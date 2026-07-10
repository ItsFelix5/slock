import { Skeleton } from "@slock/ui";
import { createEffect, createMemo, For, Show } from "solid-js";
import {
  activeView,
  bootstrap,
  channelById,
  channelDisplayName,
  dmById,
  hasMoreHistory,
  isLoadingHistory,
  loadOlderMessages,
  messagesByChannel,
  openThread,
  userById,
} from "../../lib/store";
import MessageRows from "./MessageRows";
import "./MessageList.css";

const NEAR_BOTTOM_PX = 120;
const NEAR_TOP_PX = 200;

// Placeholder rows shown in place of real history until bootstrap resolves —
// varied text widths so it reads as "text loading", not a repeated block.
const SKELETON_ROWS = [
  { name: 60, lines: [92, 70] },
  { name: 80, lines: [55] },
  { name: 70, lines: [80, 40, 60] },
];

function MessageListSkeleton() {
  return (
    <div class="message-list-skeleton" aria-hidden="true">
      <For each={SKELETON_ROWS}>
        {(row) => (
          <div class="message-row">
            <Skeleton width={36} height={36} radius={6} />
            <div class="message-body">
              <Skeleton width={row.name} height={13} />
              <div class="message-skeleton-lines">
                <For each={row.lines}>{(pct) => <Skeleton width={`${pct}%`} height={13} />}</For>
              </div>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

export default function MessageList() {
  let scrollRef: HTMLDivElement | undefined;
  let lastViewId: string | undefined;
  // Set right before requesting an older page, so the effect below can restore
  // the reader's viewport onto the same messages instead of the browser leaving
  // scrollTop untouched (which would visually yank the view down as content is
  // inserted above it).
  let olderPageAnchor: { scrollHeight: number; scrollTop: number } | null = null;

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

    if (olderPageAnchor) {
      const anchor = olderPageAnchor;
      olderPageAnchor = null;
      if (!switchedView) {
        queueMicrotask(() => {
          if (scrollRef)
            scrollRef.scrollTop = scrollRef.scrollHeight - anchor.scrollHeight + anchor.scrollTop;
        });
        return;
      }
    }

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (switchedView || nearBottom) {
      queueMicrotask(() => {
        if (scrollRef) scrollRef.scrollTop = scrollRef.scrollHeight;
      });
    }
  });

  function handleScroll() {
    const el = scrollRef;
    const view = activeView();
    if (!el || !view || el.scrollTop > NEAR_TOP_PX) return;
    if (!hasMoreHistory(view.id) || isLoadingHistory(view.id)) return;
    olderPageAnchor = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
    loadOlderMessages(view.id);
  }

  return (
    <div class="message-list" ref={scrollRef} onScroll={handleScroll}>
      <Show when={!bootstrap.loading} fallback={<MessageListSkeleton />}>
        <Show when={activeView()}>
          {(v) => (
            <>
              <Show when={hasMoreHistory(v().id)}>
                <div class="message-list-loading-older">
                  <Show when={isLoadingHistory(v().id)}>Loading earlier messages…</Show>
                </div>
              </Show>
              <Show when={!hasMoreHistory(v().id)}>
                <div class="message-list-intro">
                  <div class="message-list-intro-icon">#</div>
                  <h2>{channelName()}</h2>
                </div>
              </Show>
              <MessageRows
                messages={messages()}
                channelId={v().id}
                onOpenThread={(ts) => openThread(v().id, ts)}
              />
            </>
          )}
        </Show>
      </Show>
    </div>
  );
}
