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
import { createMessageFocus } from "./messageFocus";
import MessageListDateNav from "./parts/MessageListDateNav";
import { flashMessageWhenRendered, scrollToBottom } from "./scrollAnchor";
import type { VirtualRowsApi } from "./VirtualizedRows";

// temporary: set localStorage.debugScroll="1" in the console to trace the
// open/landing sequence. remove once the "messed up scroll on open" bug is found
const dbg = (...args: unknown[]) => {
  if (typeof localStorage !== "undefined" && localStorage.getItem("debugScroll"))
    console.log("[scroll]", ...args);
};

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
  // The row the initial open is landing on: a positive index for an unread
  // divider (align "start"), or -1 for the ordinary newest-message bottom
  // landing. Both need the reactive re-land effect below, because rows measure
  // in one at a time after the first scroll — until the total settles, an
  // estimate-based landing can be wildly off (a whole channel can estimate
  // shorter than the viewport, making the first scrollToBottom a no-op that
  // leaves you at the top). Cleared once the user scrolls or a new view lands.
  let landingTarget:
    | { epoch: number; viewId: string; index: number; align: "start" | "end" | "center" }
    | undefined;
  let revealTimer: ReturnType<typeof setTimeout> | undefined;
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
  const activeChannelId = () => store.viewState.activeView()?.id ?? "";
  const messageFocus = createMessageFocus(messages, virtualApi, () => scrollRef, activeChannelId, {
    onOpenThread: (ts) => {
      const v = store.viewState.activeView();
      if (v) store.viewState.openThread(v.id, ts);
    },
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
        dbg("scrollMargin nudge", {
          from: scrollMargin(),
          to: next,
          delta,
          scrollTop: el.scrollTop,
        });
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

  // Re-lands on the landing target and reveals the view once the virtualizer's
  // measured total size has gone quiet — called once up front and then again
  // every time `totalSize` changes. Rows measure in one at a time as they
  // mount (each with its own real height replacing its estimate), and
  // re-anchoring on every single one of those ticks was fighting that
  // process: interrupting a `scrollToIndex` mid-flight changed which rows the
  // virtualizer considered "in range" to measure next, so only one row a
  // frame ever finished — the rest sat stuck at their pre-measurement offset.
  // Debouncing lets the whole batch settle first and corrects position once.
  //
  // On settle, the divider case (align "start") safely re-issues scrollToIndex
  // at the same index — it's the same row that's been in range measuring the
  // whole time, so it doesn't disturb anything. The bottom case (align "end",
  // last index) must NOT do that: re-targeting the virtualizer's own
  // anchorTo:"end" pin (which already follows the bottom as rows measure in)
  // narrows its render window back down and stalls further measurement — that
  // was leaving the reveal stuck on a half-measured, way-too-small total. It
  // only needs the one forced jump in the initial land (to get anything
  // rendered/measuring at all); settling just needs a plain scrollTop write.
  function scheduleReveal(
    viewId: string,
    epoch: number,
    index: number,
    align: "start" | "end" | "center",
  ) {
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => {
      if (epoch !== positioningEpoch || positionedViewId !== viewId) return;
      const api = virtualApi();
      if (align !== "end") api?.scrollToIndex(index, { align });
      else if (scrollRef) scrollToBottom(scrollRef);
      dbg("reveal", {
        viewId,
        index,
        align,
        scrollTop: scrollRef?.scrollTop,
        scrollHeight: scrollRef?.scrollHeight,
        clientHeight: scrollRef?.clientHeight,
        itemStart: api?.itemStart(index),
        itemSize: api?.itemSize(index),
        totalSize: api?.totalSize(),
      });
      setReadyViewId(viewId);
    }, 120);
  }
  onCleanup(() => clearTimeout(revealTimer));

  // Driven entirely by the virtualizer's own totalSize signal — it only runs
  // when something really resized, never on a timer/frame loop.
  createEffect(
    on(
      () => virtualApi()?.totalSize(),
      (total) => {
        if (!landingTarget) return;
        const { epoch, viewId, index, align } = landingTarget;
        if (epoch !== positioningEpoch || positionedViewId !== viewId) return;
        dbg("totalSize changed -> reschedule reveal", { viewId, index, align, total });
        scheduleReveal(viewId, epoch, index, align);
      },
      { defer: true },
    ),
  );

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
      dbg("switch view", { view: view?.id, msgs: msgs.length });
      positioningEpoch += 1;
      positionedViewId = undefined;
      lastScrollTop = 0;
      setLandingSpace(undefined);
      landingTarget = undefined;
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
      const dividerStart = api.itemStart(dividerIndex);
      const unreadContentHeight =
        dividerStart === undefined ? undefined : api.totalSize() - dividerStart;
      const unreadLandingIndex = resolveUnreadLandingIndex(dividerIndex, msgs.length, {
        unreadContentHeight,
        viewportHeight: el.clientHeight,
      });
      // Land the newest-message case on the last row via scrollToIndex too,
      // rather than a raw scrollToBottom. scrollToBottom is a no-op whenever the
      // still-being-measured total is shorter than the viewport, so it can't
      // force the virtualizer to render/measure the bottom rows — it just sits
      // at the top forever. scrollToIndex(last, "end") pulls the tail into the
      // render window so measurement (and the reactive re-land) can converge.
      const onDivider = unreadLandingIndex >= 0;
      const landIndex = onDivider ? unreadLandingIndex : msgs.length - 1;
      const align: "start" | "end" = onDivider ? "start" : "end";
      const epoch = positioningEpoch;
      dbg("land decision", {
        view: view.id,
        msgs: msgs.length,
        dividerIndex,
        gaveUpBackfill,
        estUnreadContentHeight: unreadContentHeight,
        viewport: el.clientHeight,
        landIndex,
        align,
        landing: onDivider ? "divider" : "bottom",
        scrollMargin: scrollMargin(),
        estTotalSize: api.totalSize(),
      });
      setLandingSpace(onDivider ? { height: el.clientHeight, viewId: view.id } : undefined);
      landingTarget = { epoch, index: landIndex, viewId: view.id, align };
      queueMicrotask(() => {
        if (epoch !== positioningEpoch || !scrollRef) return;
        api.scrollToIndex(landIndex, { align });
        dbg("initial land", {
          landing: onDivider ? "divider" : "bottom",
          index: landIndex,
          align,
          scrollTop: scrollRef.scrollTop,
          scrollHeight: scrollRef.scrollHeight,
          clientHeight: scrollRef.clientHeight,
          itemStart: api.itemStart(landIndex),
        });
        scheduleReveal(view.id, epoch, landIndex, align);
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

  // handleScroll reads scrollHeight/clientHeight, which forces a synchronous
  // layout right after the virtualizer has mutated the row DOM for the same
  // event — doing that on every scroll event is the read-after-write thrash
  // that was stuttering the list. Coalesce every trigger (native scroll, wheel
  // and touch edge fallbacks) into one check per frame so the reflow happens
  // at most once, after layout has settled.
  let scrollCheckRaf = 0;
  let pendingScrollDirection: "newer" | "older" | undefined;
  function scheduleScrollCheck(direction?: "newer" | "older") {
    if (direction) pendingScrollDirection = direction;
    if (scrollCheckRaf) return;
    scrollCheckRaf = requestAnimationFrame(() => {
      scrollCheckRaf = 0;
      const direction = pendingScrollDirection;
      pendingScrollDirection = undefined;
      handleScroll(direction);
    });
  }
  onCleanup(() => scrollCheckRaf && cancelAnimationFrame(scrollCheckRaf));

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
    ) {
      dbg("loadOlder (near top)", {
        scrollTop: el.scrollTop,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      });
      store.messages.loadOlderMessages(view.id);
    }
  }

  function releaseLandingSpace() {
    const view = store.viewState.activeView();
    if (!(view && readyViewId() === view.id)) return;
    if (landingSpace()?.viewId === view.id) setLandingSpace(undefined);
    // Stop the re-land effect once the user takes over scrolling, or it would
    // keep snapping a bottom-landed view back down as later rows/embeds grow it.
    if (landingTarget?.viewId === view.id) landingTarget = undefined;
  }

  function handleWheel(event: WheelEvent) {
    releaseLandingSpace();
    // A short anchored page may already be at its lower scroll clamp, in
    // which case the browser emits no scroll event. Recheck after Solid has
    // removed any temporary landing space so a downward wheel still loads.
    const direction = event.deltaY > 0 ? "newer" : event.deltaY < 0 ? "older" : undefined;
    if (direction) scheduleScrollCheck(direction);
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
    if (direction) scheduleScrollCheck(direction);
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

  // Day currently at the top of the viewport, shown on the sticky date pill
  // that replaces the scrollbar as the primary way to navigate history.
  const visibleDay = createMemo(() => {
    const index = virtualApi()?.topVisibleIndex();
    if (index === undefined) return;
    return messages()[index]?.day;
  });

  // Deliberate date/beginning jumps land the same way the initial-open
  // effect above does: own positionedViewId so the ordinary unread/newest
  // landing effect doesn't race it, then drive the same landingTarget/
  // scheduleReveal settle loop. A single one-shot scrollToIndex isn't enough
  // here — jumpToDate swaps in a whole new run of unmeasured (estimate-only)
  // rows, and jumpToBeginning can prepend thousands of them; both need the
  // same "wait for measurements to settle, then correct" treatment the
  // codebase already built for the ordinary channel-open landing above.
  function landAt(viewId: string, index: number) {
    const epoch = positioningEpoch;
    positionedViewId = viewId;
    setLandingSpace(undefined);
    landingTarget = { align: "start", epoch, index, viewId };
    queueMicrotask(() => {
      if (epoch !== positioningEpoch || store.viewState.activeView()?.id !== viewId) return;
      virtualApi()?.scrollToIndex(index, { align: "start" });
      scheduleReveal(viewId, epoch, index, "start");
    });
  }

  function jumpToDate(dateMs: number) {
    const view = store.viewState.activeView();
    if (!view) return;
    void store.messages.jumpToDate(view.id, dateMs).then((ok) => {
      if (ok) landAt(view.id, 0);
    });
  }

  // There's no Slack API call that returns "the first page of the channel"
  // directly (conversations.history always answers relative to `latest`,
  // newest-first), so reaching an arbitrarily old beginning means walking
  // every older page via cursor. Land on whatever's loaded now, same as any
  // other jump, then drive that walk explicitly (loadOlderMessagesToBeginning)
  // rather than leaving it to scroll events — see that function for why.
  function jumpToBeginning() {
    const view = store.viewState.activeView();
    if (!view) return;
    landAt(view.id, 0);
    void store.messages.loadOlderMessagesToBeginning(view.id);
  }

  createEffect(() => {
    const target = store.viewState.channelMessageTarget();
    const view = store.viewState.activeView();
    if (!(target && view?.id === target.channelId)) return;

    const index = messages().findIndex((candidate) => candidate.ts === target.ts);
    if (index >= 0) {
      requestedMessageTarget = target;
      // A message-link jump into a channel that isn't already open/ready needs
      // the same wait-for-measurements-to-settle treatment as the ordinary
      // open-channel landing above — otherwise the list is revealed the
      // instant scrollToIndex is called, while rows around the target are
      // still on their raw estimates, which visibly overlap/jump as each one
      // measures in. A jump within an already-ready channel (e.g. clicking a
      // reply reference) has nothing to wait for, so it skips straight to
      // scrolling instead of hiding an already-visible view.
      const coldOpen = readyViewId() !== view.id;
      if (coldOpen) positioningEpoch += 1;
      const epoch = positioningEpoch;
      positionedViewId = view.id;
      if (coldOpen) landingTarget = { align: "center", epoch, index, viewId: view.id };
      queueMicrotask(() => {
        if (epoch !== positioningEpoch || store.viewState.channelMessageTarget() !== target) return;
        setLandingSpace(undefined);
        jumpToMessage(target.ts);
        store.viewState.setChannelMessageTarget(null);
        if (coldOpen) scheduleReveal(view.id, epoch, index, "center");
        else setReadyViewId(view.id);
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
      onFocusIn={messageFocus.onContainerFocusIn}
      onFocusOut={messageFocus.onContainerFocusOut}
      onScroll={() => scheduleScrollCheck()}
      on:touchend={{ handleEvent: handleTouchEnd, passive: true }}
      on:touchstart={{ handleEvent: handleTouchStart, passive: true }}
      on:wheel={{ handleEvent: handleWheel, passive: true }}
      ref={scrollRef}
    >
      <Show when={!store.resources.bootstrap.loading}>
        <Show when={store.viewState.activeView()}>
          {(v) => (
            <>
              <Show when={visibleDay()}>
                {(day) => (
                  <MessageListDateNav
                    day={day()}
                    onJumpToBeginning={jumpToBeginning}
                    onJumpToDate={jumpToDate}
                  />
                )}
              </Show>
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
                  editingTs={messageFocus.editingTs}
                  focusedTs={messageFocus.focusedTs}
                  followOnAppend={followOnAppend()}
                  messages={messages()}
                  onApi={setVirtualApi}
                  onJumpToMessage={jumpToMessage}
                  onOpenThread={(ts) => store.viewState.openThread(v().id, ts)}
                  onStartEdit={messageFocus.onStartEdit}
                  onStopEdit={messageFocus.onStopEdit}
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
