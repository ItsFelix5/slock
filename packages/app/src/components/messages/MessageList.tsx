import { Icon, Skeleton } from "@slock/ui";
import { createEffect, createMemo, For, Show } from "solid-js";
import { channelDisplayName, dmDisplayName, store } from "../../lib/store";
import "./MessageList.css";
import MessageRows from "./MessageRows";

const NEAR_BOTTOM_PX = 120;
const NEAR_TOP_PX = 200;
// Cap on the older-history pages we'll fetch automatically to reach a read
// cursor that's further back than what's loaded — bounds how much a channel
// nobody's opened in weeks will pull in on open, rather than backfilling
// forever. If the cursor is still out of reach after this many pages, we
// land on whatever's loaded instead of chasing it further.
const MAX_BACKFILL_LOADS = 5;

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
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let scrollRef: HTMLDivElement | undefined;
  let lastViewId: string | undefined;
  // Which view we've already performed the post-switch landing scroll for —
  // history usually finishes loading a tick after the switch itself, so this
  // stays unset (rather than being keyed off switchedView) until real messages
  // are on screen to land on.
  let positionedViewId: string | undefined;
  let requestedMessageTarget: ReturnType<typeof store.viewState.channelMessageTarget> = null;
  // Older-page fetches spent per view trying to backfill far enough to reach
  // its read cursor — reset once we land (or give up) so a later reopen gets
  // a fresh budget.
  const backfillAttempts: Record<string, number> = {};
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
    const msgs = messages();
    const switchedView = view?.id !== lastViewId;
    lastViewId = view?.id;
    if (switchedView) positionedViewId = undefined;
    const el = scrollRef;
    if (!el) return;

    // A deliberate "view in channel" navigation owns the landing position;
    // don't let the usual unread/newest positioning race it.
    const messageTarget = store.viewState.channelMessageTarget();
    if (messageTarget?.channelId === view?.id) return;

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

    if (view && positionedViewId !== view.id && msgs.length > 0) {
      // The read cursor sits before every loaded message (nothing loaded is
      // "read" yet) — the true divider position is further back than what
      // we've fetched. Pull a few more pages so it lands with some read
      // context above it instead of pinned to the top of an arbitrary page.
      const anchor = store.unread.unreadDividerTsForChannel(view.id);
      const readCursorNotYetLoaded = parseFloat(msgs[0].ts) * 1000 > anchor;
      const attempts = backfillAttempts[view.id] ?? 0;
      if (
        readCursorNotYetLoaded &&
        attempts < MAX_BACKFILL_LOADS &&
        store.messages.hasMoreHistory(view.id)
      ) {
        if (!store.messages.isLoadingHistory(view.id)) {
          backfillAttempts[view.id] = attempts + 1;
          store.messages.loadOlderMessages(view.id);
        }
        return;
      }

      delete backfillAttempts[view.id];
      positionedViewId = view.id;
      // Land on the unread divider (if the channel has one) rather than always
      // jumping to the newest loaded message — that's where a reader left off.
      queueMicrotask(() => {
        if (!scrollRef) return;
        const divider = scrollRef.querySelector<HTMLElement>(".unread-divider");
        if (divider) divider.scrollIntoView({ block: "center" });
        else scrollRef.scrollTop = scrollRef.scrollHeight;
      });
      return;
    }

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    if (nearBottom) {
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

  function jumpToMessage(ts: string) {
    const el = scrollRef?.querySelector<HTMLElement>(`[data-message-ts="${CSS.escape(ts)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("message-flash");
    setTimeout(() => el.classList.remove("message-flash"), 1500);
  }

  createEffect(() => {
    const target = store.viewState.channelMessageTarget();
    const view = store.viewState.activeView();
    if (!(target && view?.id === target.channelId)) return;

    const message = messages().find((candidate) => candidate.ts === target.ts);
    if (message) {
      requestedMessageTarget = target;
      positionedViewId = view.id;
      queueMicrotask(() => {
        if (store.viewState.channelMessageTarget() !== target) return;
        jumpToMessage(target.ts);
        store.viewState.setChannelMessageTarget(null);
      });
      return;
    }

    if (requestedMessageTarget === target) return;
    requestedMessageTarget = target;
    void store.messages.ensureChannelMessage(target.channelId, target.ts).then((found) => {
      if (!found && store.viewState.channelMessageTarget() === target)
        store.viewState.setChannelMessageTarget(null);
    });
  });

  return (
    <div class="message-list" onScroll={handleScroll} ref={scrollRef}>
      <Show fallback={<MessageListSkeleton />} when={!store.resources.bootstrap.loading}>
        <Show when={store.viewState.activeView()}>
          {(v) => (
            <>
              <Show
                fallback={
                  <div class="message-list-intro">
                    <div class="message-list-intro-icon flex-center">
                      <Icon name="lock" size={26} />
                    </div>
                    <h2>Can't load this conversation</h2>
                    <p>You may not have access to it.</p>
                  </div>
                }
                when={!(store.messages.hasHistoryError(v().id) && messages().length === 0)}
              >
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
              </Show>
              <MessageRows
                channelId={v().id}
                messages={messages()}
                onJumpToMessage={jumpToMessage}
                onOpenThread={(ts) => store.viewState.openThread(v().id, ts)}
              />
            </>
          )}
        </Show>
      </Show>
    </div>
  );
}
