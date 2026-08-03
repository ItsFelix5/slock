// biome-ignore-all lint/style/noExcessiveLinesPerFile: History loading, virtualized positioning, and their shared DOM measurements form one scroll state machine.
import { Button, Icon } from "@slock/ui";
import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js";
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

// Keep two viewports of history buffered in the direction of travel.
const NEAR_HISTORY_EDGE_VIEWPORT_FRACTION = 2;
// Cap on the older-history pages we'll fetch automatically to reach a read
// cursor that's further back than what's loaded — bounds how much a channel
// nobody's opened in weeks will pull in on open, rather than backfilling
// forever. If the cursor is still out of reach after this many pages, we
// land on whatever's loaded instead of chasing it further.
const MAX_BACKFILL_LOADS = 5;

export default function MessageList() {
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let scrollRef: HTMLDivElement | undefined;
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let headerRef: HTMLDivElement | undefined;
  let lastViewId: string | undefined;
  let lastScrollTop = 0;
  let touchStartY: number | undefined;
  // Which view we've already performed the post-switch landing scroll for —
  // history usually finishes loading a tick after the switch itself, so this
  // stays unset (rather than being keyed off switchedView) until real messages
  // are on screen to land on.
  let positionedViewId: string | undefined;
  let positioningEpoch = 0;
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
  const [followOnAppend, setFollowOnAppend] = createSignal<boolean | ScrollBehavior>("auto");
  // A conversation is only made visible after its unread backfill and both
  // virtualizer landing passes have completed. This prevents the initially
  // loaded tail from painting first and visibly moving once older pages land.
  const [readyViewId, setReadyViewId] = createSignal<string>();
  // A divider near the end of a short unread tail cannot naturally reach the
  // viewport top because the browser clamps at scrollHeight - clientHeight.
  // Keep a full viewport of temporary tail space for the whole landing. Do
  // not trim it to the measured shortage after scrolling: changing the scroll
  // range under an active virtualizer landing is what caused the late snap.
  // The tail is released as soon as the user starts scrolling.
  const [landingSpace, setLandingSpace] = createSignal<{
    height: number;
    viewId: string;
  }>();
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
        if (el.scrollTop > 0) {
          el.scrollTop += delta;
          // The virtualizer tracks scrollTop itself via a native 'scroll'
          // listener, which browsers dispatch asynchronously — so without
          // this, the scrollMargin write below (which the virtualizer *does*
          // react to synchronously) reaches it paired with a stale offset for
          // one frame, and it computes the visible row range from that
          // mismatched pair. Firing the event ourselves resyncs it before
          // that happens, closing the gap that was showing as a flash/jump.
          el.dispatchEvent(new Event("scroll"));
        }
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
      positioningEpoch += 1;
      positionedViewId = undefined;
      lastScrollTop = 0;
      setLandingSpace(undefined);
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
      const api = virtualApi();
      if (!api) return;
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
      // Only ever a sentinel, not an incrementing count: the one bounded
      // catch-up call below already walks up to MAX_BACKFILL_LOADS pages
      // itself, so there's only ever one "attempt" per view to gate on.
      const alreadyAttempted = (backfillAttempts[view.id] ?? 0) >= MAX_BACKFILL_LOADS;
      let gaveUpBackfill = false;
      if (readCursorNotYetLoaded && store.messages.hasMoreHistory(view.id)) {
        if (store.messages.hasOlderHistoryError(view.id)) return;
        // Keep all automatic catch-up pages under one loading state. If each
        // page completes separately, the in-flow loading header repeatedly
        // appears and disappears while the virtualizer anchors newly prepended
        // rows, which looks like several loading windows jumping upward.
        if (store.messages.isLoadingHistory(view.id)) return;
        if (!alreadyAttempted) {
          backfillAttempts[view.id] = MAX_BACKFILL_LOADS;
          store.messages.loadOlderMessagesThrough(view.id, anchor, MAX_BACKFILL_LOADS);
          return;
        }
        // The bounded catch-up wasn't enough to reach the real read cursor.
        // Landing on the unread divider below would resolve to the oldest
        // message of whatever we did manage to load — an arbitrary spot deep
        // in history with even more unloaded history above it — so land on
        // the newest messages instead, same as a channel with no unread at all.
        gaveUpBackfill = true;
      }

      delete backfillAttempts[view.id];
      positionedViewId = view.id;
      // Land on the unread divider (if the channel has one) rather than always
      // jumping to the newest loaded message — that's where a reader left off.
      const dividerIndex = gaveUpBackfill ? -1 : findUnreadDividerIndex(msgs, anchor);
      const unreadLandingIndex = resolveUnreadLandingIndex(dividerIndex, msgs.length, {
        unreadRowHeight: api.itemSize(dividerIndex),
        viewportHeight: el.clientHeight,
      });
      const epoch = positioningEpoch;
      setLandingSpace(
        unreadLandingIndex >= 0 ? { height: el.clientHeight, viewId: view.id } : undefined,
      );
      const land = () => {
        if (!scrollRef) return;
        if (unreadLandingIndex >= 0) api.scrollToIndex(unreadLandingIndex, { align: "start" });
        else scrollToBottom(scrollRef);
      };
      queueMicrotask(() => {
        if (epoch !== positioningEpoch) return;
        land();
        // Give the virtualizer two frames to render and measure the target
        // while it is still hidden. Its own scroll reconciliation keeps the
        // target aligned as those estimates settle; importantly, we never
        // mutate the temporary tail or start a competing second landing.
        requestAnimationFrame(() => {
          if (epoch !== positioningEpoch || positionedViewId !== view.id) return;
          requestAnimationFrame(() => {
            if (epoch !== positioningEpoch || positionedViewId !== view.id) return;
            setReadyViewId(view.id);
          });
        });
      });
    }
  });

  async function loadNewerMessages(channelId: string) {
    setFollowOnAppend(false);
    try {
      await store.messages.loadNewerMessages(channelId);
    } finally {
      requestAnimationFrame(() => setFollowOnAppend("auto"));
    }
  }

  function handleScroll(preferredDirection?: "newer" | "older") {
    const el = scrollRef;
    const view = store.viewState.activeView();
    if (!(el && view)) return;
    const direction =
      preferredDirection ??
      (el.scrollTop > lastScrollTop ? "newer" : el.scrollTop < lastScrollTop ? "older" : undefined);
    lastScrollTop = el.scrollTop;
    // Scroll offsets are still being established while the initial rows are
    // hidden. Do not mistake those programmatic changes for a request to load
    // another page of history.
    if (readyViewId() !== view.id) return;
    if (store.messages.isLoadingHistory(view.id)) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= el.clientHeight * NEAR_HISTORY_EDGE_VIEWPORT_FRACTION;
    if (
      direction === "newer" &&
      nearBottom &&
      store.messages.hasNewerHistory(view.id) &&
      !store.messages.hasNewerHistoryError(view.id)
    ) {
      void loadNewerMessages(view.id);
      return;
    }

    const nearTop = el.scrollTop <= el.clientHeight * NEAR_HISTORY_EDGE_VIEWPORT_FRACTION;
    if (
      direction !== "newer" &&
      nearTop &&
      store.messages.hasMoreHistory(view.id) &&
      !store.messages.hasOlderHistoryError(view.id)
    )
      store.messages.loadOlderMessages(view.id);
  }

  function releaseLandingSpace() {
    const view = store.viewState.activeView();
    if (view && readyViewId() === view.id && landingSpace()?.viewId === view.id)
      setLandingSpace(undefined);
  }

  function handleWheel(event: WheelEvent) {
    releaseLandingSpace();
    // A short anchored page may already be at its lower scroll clamp, in
    // which case the browser emits no scroll event. Recheck after Solid has
    // removed any temporary landing space so a downward wheel still loads.
    const direction = event.deltaY > 0 ? "newer" : event.deltaY < 0 ? "older" : undefined;
    if (direction) queueMicrotask(() => handleScroll(direction));
  }

  function handleTouchStart(event: TouchEvent) {
    releaseLandingSpace();
    touchStartY = event.touches[0]?.clientY;
  }

  function handleTouchEnd(event: TouchEvent) {
    const endY = event.changedTouches[0]?.clientY;
    const direction =
      touchStartY === undefined || endY === undefined
        ? undefined
        : endY < touchStartY
          ? "newer"
          : endY > touchStartY
            ? "older"
            : undefined;
    touchStartY = undefined;
    if (direction) queueMicrotask(() => handleScroll(direction));
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
        setLandingSpace(undefined);
        jumpToMessage(target.ts);
        setReadyViewId(view.id);
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
    <div
      class="message-list"
      onScroll={() => handleScroll()}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onWheel={handleWheel}
      ref={scrollRef}
    >
      <Show when={!store.resources.bootstrap.loading}>
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
                      store.messages.isLoadingHistory(v().id) &&
                      followOnAppend() !== false
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
              <div
                aria-hidden={readyViewId() !== v().id}
                classList={{ "message-list-rows-pending": readyViewId() !== v().id }}
              >
                <MessageRows
                  anchorTo={landingSpace()?.viewId === v().id ? "start" : "end"}
                  channelId={v().id}
                  followOnAppend={followOnAppend()}
                  messages={messages()}
                  onApi={setVirtualApi}
                  onJumpToMessage={jumpToMessage}
                  onOpenThread={(ts) => store.viewState.openThread(v().id, ts)}
                  scrollContainer={() => scrollRef}
                  scrollMargin={scrollMargin()}
                  virtualize
                />
                <Show when={store.messages.hasNewerHistoryError(v().id)}>
                  <div class="message-list-load-error" role="alert">
                    <span>Couldn’t load newer messages.</span>
                    <Button onClick={() => void loadNewerMessages(v().id)} size="sm">
                      Try again
                    </Button>
                  </div>
                </Show>
                <Show when={followOnAppend() === false}>
                  <div aria-live="polite" class="message-list-loading-older">
                    Loading messages…
                  </div>
                </Show>
                <Show when={landingSpace()?.viewId === v().id}>
                  <div aria-hidden="true" style={{ height: `${landingSpace()?.height ?? 0}px` }} />
                </Show>
              </div>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
}
