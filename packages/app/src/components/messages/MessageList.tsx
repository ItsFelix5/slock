import { Button, Icon, Skeleton } from "@slock/ui";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js";
import {
  channelDisplayName,
  dmDisplayName,
  findUnreadDividerIndex,
  resolveUnreadLandingIndex,
  store,
} from "../../lib/store";
import "./MessageList.css";
import MessageRows from "./MessageRows";
import { flashMessageWhenRendered, scrollToBottom } from "./scrollAnchor";
import type { VirtualRowsApi } from "./VirtualizedRows";

// Fraction of the viewport height used as the "near top" trigger zone for
// backfilling older history. A fixed pixel threshold felt fine on a slow
// scroll but got outrun by a fast flick/wheel scroll, so the load would only
// start once the user was already at the very top — a visible pause. Scaling
// with viewport height gives the fetch a head start proportional to how much
// distance is left to cover before hitting bottom.
const NEAR_TOP_VIEWPORT_FRACTION = 1.5;
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
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let headerRef: HTMLDivElement | undefined;
  let lastViewId: string | undefined;
  // Which view we've already performed the post-switch landing scroll for —
  // history usually finishes loading a tick after the switch itself, so this
  // stays unset (rather than being keyed off switchedView) until real messages
  // are on screen to land on.
  let positionedViewId: string | undefined;
  let requestedMessageTarget: ReturnType<typeof store.viewState.channelMessageTarget> = null;
  let cancelPendingFlash: (() => void) | undefined;
  // Older-page fetches spent per view trying to backfill far enough to reach
  // its read cursor — reset once we land (or give up) so a later reopen gets
  // a fresh budget.
  const backfillAttempts: Record<string, number> = {};
  // Handed up by VirtualizedRows once it mounts — lets landing/jump logic
  // below move to a row by index even when it's currently outside the
  // rendered window, instead of querying the DOM for it.
  const [virtualApi, setVirtualApi] = createSignal<VirtualRowsApi | null>(null);
  // Height of the header block (loading indicator / channel intro / error)
  // sitting above the virtualized rows. Handed to the virtualizer as its
  // scrollMargin so scroll landing stays accurate.
  const [scrollMargin, setScrollMargin] = createSignal(0);

  const messages = createMemo(() => {
    const v = store.viewState.activeView();
    if (!v) return [];
    return store.messages.messagesByChannel[v.id] ?? [];
  });

  // Keep scrollMargin in step with the header's real height. When the header
  // grows/shrinks (a load starting/finishing, reaching the channel top) it
  // shoves everything below it, and overflow-anchor is off, so we also nudge
  // scrollTop by the same delta to hold the viewport still — that's what was
  // making the list lurch while loading. Runs synchronously post-render (Solid
  // effects fire after the DOM updates) so the margin is correct before the
  // landing effect below scrolls by index.
  createEffect(
    on(
      () => {
        const view = store.viewState.activeView();
        // Every input that can change the header's height, so this re-measures.
        return [
          store.resources.bootstrap.loading,
          view && store.messages.hasMoreHistory(view.id),
          view && store.messages.isLoadingHistory(view.id),
          view && store.messages.hasHistoryError(view.id),
          view && store.messages.hasOlderHistoryError(view.id),
          messages().length,
        ];
      },
      () => {
        const el = scrollRef;
        if (!(el && headerRef)) return;
        const next = headerRef.offsetHeight;
        const delta = next - scrollMargin();
        if (delta === 0) return;
        if (el.scrollTop > 0) el.scrollTop += delta;
        setScrollMargin(next);
      },
    ),
  );

  const channelName = createMemo(() => {
    const v = store.viewState.activeView();
    if (!v) return "";
    if (v.kind === "channel") return channelDisplayName(store.channels.channelById(v.id), v.id);
    return dmDisplayName(store.dms.dmById(v.id), store.users.userById);
  });

  // Jump to the newest message whenever the channel changes or its history first
  // loads — without this the list sits at its natural scroll position (the top,
  // i.e. the oldest loaded message) instead of where a chat view is expected to open.
  // Live messages arriving, and older history loading in above the fold, are both
  // handled by the virtualizer itself (see anchorTo/followOnAppend in
  // VirtualizedRows.tsx) — this effect only owns the one-time initial landing.
  createEffect(() => {
    const view = store.viewState.activeView();
    const msgs = messages();
    const switchedView = view?.id !== lastViewId;
    lastViewId = view?.id;
    if (switchedView) {
      positionedViewId = undefined;
      cancelPendingFlash?.();
      cancelPendingFlash = undefined;
    }
    const el = scrollRef;
    if (!el) return;

    // A deliberate "view in channel" navigation owns the landing position;
    // don't let the usual unread/newest positioning race it.
    const messageTarget = store.viewState.channelMessageTarget();
    if (messageTarget?.channelId === view?.id) return;

    if (view && positionedViewId !== view.id && msgs.length > 0) {
      // The read cursor sits before every loaded message (nothing loaded is
      // "read" yet) — the true divider position is further back than what
      // we've fetched. Pull a few more pages so it lands with some read
      // context above it instead of pinned to the top of an arbitrary page.
      const anchor = store.unread.unreadDividerTsForChannel(view.id);
      // Not anchored yet — wait rather than landing early, since treating
      // "unknown" as "already loaded" here would skip backfilling far enough
      // back to ever contain the real divider position.
      if (anchor === undefined) return;
      const readCursorNotYetLoaded = parseFloat(msgs[0].ts) * 1000 > anchor;
      const attempts = backfillAttempts[view.id] ?? 0;
      if (
        readCursorNotYetLoaded &&
        attempts < MAX_BACKFILL_LOADS &&
        store.messages.hasMoreHistory(view.id)
      ) {
        if (store.messages.hasOlderHistoryError(view.id)) return;
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
      const dividerIndex = findUnreadDividerIndex(msgs, anchor);
      const unreadLandingIndex = resolveUnreadLandingIndex(dividerIndex, msgs.length);
      queueMicrotask(() => {
        if (!scrollRef) return;
        const api = virtualApi();
        if (unreadLandingIndex >= 0 && api)
          api.scrollToIndex(unreadLandingIndex, { align: "start" });
        else scrollToBottom(scrollRef);
      });
    }
  });

  function handleScroll() {
    const el = scrollRef;
    const view = store.viewState.activeView();
    if (!(el && view) || el.scrollTop > el.clientHeight * NEAR_TOP_VIEWPORT_FRACTION) return;
    if (!store.messages.hasMoreHistory(view.id) || store.messages.isLoadingHistory(view.id)) return;
    if (store.messages.hasOlderHistoryError(view.id)) return;
    store.messages.loadOlderMessages(view.id);
  }

  function jumpToMessage(ts: string) {
    const api = virtualApi();
    const container = scrollRef;
    const index = messages().findIndex((m) => m.ts === ts);
    if (!(api && container && index >= 0)) return;
    api.scrollToIndex(index, { align: "center", behavior: "smooth" });
    cancelPendingFlash?.();
    cancelPendingFlash = flashMessageWhenRendered(container, ts);
  }

  onCleanup(() => cancelPendingFlash?.());

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
              <div ref={headerRef}>
                <Show
                  fallback={
                    <div class="message-list-intro message-list-error" role="alert">
                      <div class="message-list-intro-icon flex-center">
                        <Icon name="warning" size={26} />
                      </div>
                      <h2>Couldn’t load this conversation</h2>
                      <p>Check your connection or access, then try again.</p>
                      <Button onClick={() => store.messages.loadRecentHistory(v().id)} size="sm">
                        Try again
                      </Button>
                    </div>
                  }
                  when={!(store.messages.hasHistoryError(v().id) && messages().length === 0)}
                >
                  <Show when={store.messages.hasHistoryError(v().id) && messages().length > 0}>
                    <div class="message-list-load-error" role="alert">
                      <span>Couldn’t refresh this conversation.</span>
                      <Button onClick={() => store.messages.loadRecentHistory(v().id)} size="sm">
                        Try again
                      </Button>
                    </div>
                  </Show>
                  <Show when={store.messages.hasOlderHistoryError(v().id)}>
                    <div class="message-list-load-error" role="alert">
                      <span>Couldn’t load older messages.</span>
                      <Button onClick={() => store.messages.loadOlderMessages(v().id)} size="sm">
                        Try again
                      </Button>
                    </div>
                  </Show>
                  <Show
                    when={
                      store.messages.hasMoreHistory(v().id) &&
                      store.messages.isLoadingHistory(v().id)
                    }
                  >
                    <div class="message-list-loading-older">Loading messages…</div>
                  </Show>
                  <Show when={!store.messages.hasMoreHistory(v().id)}>
                    <div class="message-list-intro">
                      <div class="message-list-intro-icon flex-center">#</div>
                      <h2>{channelName()}</h2>
                    </div>
                  </Show>
                </Show>
              </div>
              <MessageRows
                channelId={v().id}
                messages={messages()}
                onApi={setVirtualApi}
                onJumpToMessage={jumpToMessage}
                onOpenThread={(ts) => store.viewState.openThread(v().id, ts)}
                scrollContainer={() => scrollRef}
                scrollMargin={scrollMargin()}
                virtualize
              />
            </>
          )}
        </Show>
      </Show>
    </div>
  );
}
