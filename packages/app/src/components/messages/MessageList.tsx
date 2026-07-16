import { Skeleton } from "@slock/ui";
import { createEffect, createMemo, For, Show } from "solid-js";
import { channelDisplayName, dmDisplayName, store } from "../../lib/store";
import "./MessageList.css";
import MessageRows from "./MessageRows";

const NEAR_BOTTOM_PX = 120;
const NEAR_TOP_PX = 200;

// Placeholder rows shown in place of real history until store.resources.bootstrap resolves —
// varied text widths so it reads as "text loading", not a repeated block.
const SKELETON_ROWS = [
  { lines: [92, 70], name: 60 },
  { lines: [55], name: 80 },
  { lines: [80, 40, 60], name: 70 },
];

function MessageListSkeleton() {
  return (
    <div aria-hidden="true" class="message-list-skeleton">
      <For each={SKELETON_ROWS}>
        {(row) => (
          <div class="message-row">
            <Skeleton height={36} radius={6} width={36} />
            <div class="message-body">
              <Skeleton height={13} width={row.name} />
              <div class="message-skeleton-lines flex-col">
                <For each={row.lines}>{(pct) => <Skeleton height={13} width={`${pct}%`} />}</For>
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
    const v = store.viewState.activeView();
    if (!v) return [];
    return store.messages.messagesByChannel[v.id] ?? [];
  });

  const channelName = createMemo(() => {
    const v = store.viewState.activeView();
    if (!v) return "";
    if (v.kind === "channel") return channelDisplayName(store.channels.channelById(v.id), v.id);
    return dmDisplayName(store.dms.dmById(v.id), store.users.userById);
  });

  // Jump to the newest message whenever the channel changes or its history first
  // loads — without this the list sits at its natural scroll position (the top,
  // i.e. the oldest loaded message) instead of where a chat view is expected to open.
  // Once already open, a live message only pulls the view down if the reader was
  // already near the bottom — otherwise it'd yank them away from history they're reading.
  createEffect(() => {
    const view = store.viewState.activeView();
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
    const view = store.viewState.activeView();
    if (!(el && view) || el.scrollTop > NEAR_TOP_PX) return;
    if (!store.messages.hasMoreHistory(view.id) || store.messages.isLoadingHistory(view.id)) return;
    olderPageAnchor = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop };
    store.messages.loadOlderMessages(view.id);
  }

  return (
    <div class="message-list" onScroll={handleScroll} ref={scrollRef}>
      <Show fallback={<MessageListSkeleton />} when={!store.resources.bootstrap.loading}>
        <Show when={store.viewState.activeView()}>
          {(v) => (
            <>
              <Show when={store.messages.hasMoreHistory(v().id)}>
                <div class="message-list-loading-older">
                  <Show when={store.messages.isLoadingHistory(v().id)}>
                    Loading earlier messages…
                  </Show>
                </div>
              </Show>
              <Show when={!store.messages.hasMoreHistory(v().id)}>
                <div class="message-list-intro">
                  <div class="message-list-intro-icon flex-center">#</div>
                  <h2>{channelName()}</h2>
                </div>
              </Show>
              <MessageRows
                channelId={v().id}
                messages={messages()}
                onOpenThread={(ts) => store.viewState.openThread(v().id, ts)}
              />
            </>
          )}
        </Show>
      </Show>
    </div>
  );
}
