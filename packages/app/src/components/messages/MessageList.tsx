// biome-ignore-all lint/style/noExcessiveLinesPerFile: History loading and scroll landing form one state machine.
import { Button, Icon } from "@slock/ui";
import { createEffect, createMemo, createSignal, onCleanup, Show } from "solid-js";
import { usePaneView } from "../../lib/paneView";
import { channelDisplayName, dmDisplayName, findUnreadDividerIndex, store } from "../../lib/store";
import "./MessageList.css";
import MessageRows from "./MessageRows";
import { createMessageFocus } from "./messageFocus";
import MessageListDateNav from "./parts/MessageListDateNav";
import {
  isScrolledToBottom,
  jumpToMessageInContainer,
  scrollToBottom,
  waitForMessageElement,
} from "./scrollAnchor";

// temporary: set localStorage.debugScroll="1" in the console to trace the
// open/landing sequence
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
  const { clearMessageTarget, messageTarget, view: paneView } = usePaneView();
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let scrollRef: HTMLDivElement | undefined;
  let lastViewId: string | undefined;
  let lastScrollTop = 0;
  let touchStartY: number | undefined;
  // Which view we've already performed the post-switch landing scroll for —
  // history usually finishes loading a tick after the switch itself, so this
  // stays unset (rather than being keyed off switchedView) until real messages
  // are on screen to land on.
  let positionedViewId: string | undefined;
  // Identifies the currently in-flight landing. Bumped every time a new one
  // starts, so an older one's still-pending row-wait notices it's been
  // superseded (a second jump, a channel switch, the reader taking scroll
  // back) and quietly stops touching the DOM instead of fighting whatever
  // superseded it.
  let landingRun = 0;
  // True only while the reader is at (or was left at) the bottom of the
  // list — a trailing message arriving, or an already-visible row resizing
  // (an image/embed finishing load), re-triggers scrollToBottom for as long
  // as this stays true. Cleared the moment the reader scrolls away, and by
  // any landing that puts them somewhere other than the bottom on purpose
  // (the unread divider, a jump-to-message/date).
  let shouldFollowBottom = true;
  let requestedMessageTarget: ReturnType<typeof messageTarget> = null;
  let cancelPendingFlash: (() => void) | undefined;
  // Older-page fetches spent per view trying to backfill far enough to reach
  // its read cursor — reset once we land (or give up) so a later reopen gets
  // a fresh budget.
  const backfillAttempts: Record<string, number> = {};
  // A conversation is only made visible after its unread backfill and initial
  // landing have settled. This prevents the initially loaded tail from
  // painting first and visibly moving once older pages land or a jump lands
  // somewhere else.
  const [readyViewId, setReadyViewId] = createSignal<string>();
  const [isLoadingNewer, setIsLoadingNewer] = createSignal(false);
  // ts of the topmost row still (partially) below the viewport's top edge —
  // drives the sticky date pill showing which day is in view.
  const [topVisibleTs, setTopVisibleTs] = createSignal<string>();

  const messages = createMemo(() => {
    const v = paneView();
    if (!v) return [];
    return store.messages.messagesByChannel[v.id] ?? [];
  });
  const activeChannelId = () => paneView()?.id ?? "";
  const messageFocus = createMessageFocus(messages, () => scrollRef, activeChannelId, {
    onOpenThread: (ts) => {
      const v = paneView();
      if (v) store.viewState.openThread(v.id, ts);
    },
  });

  const channelName = createMemo(() => {
    const v = paneView();
    if (!v) return "";
    if (v.kind === "channel") return channelDisplayName(store.channels.channelById(v.id), v.id);
    return dmDisplayName(store.dms.dmById(v.id), store.users.userById);
  });

  function updateTopVisible() {
    const el = scrollRef;
    if (!el) return;
    const containerTop = el.getBoundingClientRect().top;
    for (const row of el.querySelectorAll<HTMLElement>("[data-message-ts]")) {
      if (row.getBoundingClientRect().bottom > containerTop) {
        setTopVisibleTs(row.dataset.messageTs);
        return;
      }
    }
    setTopVisibleTs(undefined);
  }

  // Day currently at the top of the viewport, shown on the sticky date pill
  // that replaces the scrollbar as the primary way to navigate history.
  const visibleDay = createMemo(() => messages().find((m) => m.ts === topVisibleTs())?.day);

  createEffect(() => {
    messages();
    readyViewId();
    queueMicrotask(updateTopVisible);
  });

  // Keep the reader pinned to the bottom for as long as they were already
  // there: a genuinely new trailing message arriving, or an already-rendered
  // row resizing (an image/embed finishing load), both fire this since every
  // row is observed. Re-observing on every messages() change (rather than
  // once) is what catches a newly appended row immediately — ResizeObserver
  // reports an initial size on every fresh observe() call.
  createEffect(() => {
    messages();
    const el = scrollRef;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (shouldFollowBottom && scrollRef) scrollToBottom(scrollRef);
    });
    for (const row of el.querySelectorAll<HTMLElement>("[data-message-ts]")) observer.observe(row);
    onCleanup(() => observer.disconnect());
  });

  function landOnBottom(viewId: string) {
    const run = ++landingRun;
    shouldFollowBottom = true;
    queueMicrotask(() => {
      if (run !== landingRun || paneView()?.id !== viewId || !scrollRef) return;
      scrollToBottom(scrollRef);
      setReadyViewId(viewId);
    });
  }

  function landOnMessage(viewId: string, ts: string, align: ScrollLogicalPosition) {
    const el = scrollRef;
    if (!el) return;
    const run = ++landingRun;
    shouldFollowBottom = false;
    cancelPendingFlash?.();
    cancelPendingFlash = waitForMessageElement(el, ts, (row) => {
      if (run !== landingRun || paneView()?.id !== viewId) return;
      row.scrollIntoView({ block: align });
      setReadyViewId(viewId);
    });
  }

  // Lands on the unread divider, unless everything from it to the newest
  // message is shorter than the viewport — forcing the divider to the top in
  // that case would leave a large, unnatural gap below the unread tail, so
  // the ordinary bottom landing already shows all of it.
  function landOnDivider(viewId: string, dividerTs: string) {
    const el = scrollRef;
    if (!el) return;
    const run = ++landingRun;
    shouldFollowBottom = false;
    cancelPendingFlash?.();
    cancelPendingFlash = waitForMessageElement(el, dividerTs, (dividerRow) => {
      if (run !== landingRun || paneView()?.id !== viewId || !scrollRef) return;
      const containerRect = scrollRef.getBoundingClientRect();
      const dividerRect = dividerRow.getBoundingClientRect();
      const unreadContentHeight =
        scrollRef.scrollHeight - (dividerRect.top - containerRect.top + scrollRef.scrollTop);
      if (unreadContentHeight <= scrollRef.clientHeight) {
        shouldFollowBottom = true;
        scrollToBottom(scrollRef);
      } else {
        dividerRow.scrollIntoView({ block: "start" });
      }
      setReadyViewId(viewId);
    });
  }

  // Invalidates whatever landing is currently in flight and hands scroll
  // control back to the browser/reader — called the moment the reader
  // physically scrolls (wheel or touch). Also makes sure a landing that gets
  // interrupted before it ever finished never leaves the view stranded
  // hidden (aria-hidden / message-list-rows-pending never clears on its own
  // otherwise).
  function cancelLanding() {
    landingRun += 1;
    const view = paneView();
    if (view && readyViewId() !== view.id) setReadyViewId(view.id);
  }

  // Jump to the newest message whenever the channel changes or its history first
  // loads — without this the list sits at its natural scroll position (the top,
  // i.e. the oldest loaded message) instead of where a chat view is expected to open.
  // Live messages arriving, and older history loading in above the fold, are both
  // handled without any per-message-list bookkeeping now — a native `overflow-anchor`
  // (see MessageList.css) keeps the reader's spot stable as content is prepended
  // above the viewport, and the ResizeObserver effect above keeps a follow-bottom
  // reader pinned to new trailing content — this effect only owns the one-time
  // initial landing.
  createEffect(() => {
    const view = paneView();
    const msgs = messages();
    const switchedView = view?.id !== lastViewId;
    lastViewId = view?.id;
    if (switchedView) {
      dbg("switch view", { view: view?.id, msgs: msgs.length });
      landingRun += 1;
      positionedViewId = undefined;
      lastScrollTop = 0;
      shouldFollowBottom = true;
      cancelPendingFlash?.();
      cancelPendingFlash = undefined;
    }
    const el = scrollRef;
    if (!el) return;

    // A deliberate "view in channel" navigation owns the landing position;
    // don't let the usual unread/newest positioning race it.
    const target = messageTarget();
    if (target?.channelId === view?.id) return;

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
      // Only ever a sentinel, not an incrementing count: the one bounded
      // catch-up call below already walks up to MAX_BACKFILL_LOADS pages
      // itself, so there's only ever one "attempt" per view to gate on.
      const alreadyAttempted = (backfillAttempts[view.id] ?? 0) >= MAX_BACKFILL_LOADS;
      let gaveUpBackfill = false;
      if (readCursorNotYetLoaded && store.messages.hasMoreHistory(view.id)) {
        if (store.messages.hasOlderHistoryError(view.id)) return;
        // Keep all automatic catch-up pages under one loading state. If each
        // page completes separately, the in-flow loading header repeatedly
        // appears and disappears while new rows are prepended, which looks
        // like several loading windows jumping upward.
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
      const dividerTs = dividerIndex >= 0 ? msgs[dividerIndex]?.ts : undefined;
      dbg("land decision", {
        view: view.id,
        msgs: msgs.length,
        dividerIndex,
        gaveUpBackfill,
        landing: dividerTs ? "divider" : "bottom",
      });
      if (dividerTs) landOnDivider(view.id, dividerTs);
      else landOnBottom(view.id);
    }
  });

  async function loadNewerMessages(channelId: string) {
    setIsLoadingNewer(true);
    try {
      await store.messages.loadNewerMessages(channelId);
    } finally {
      setIsLoadingNewer(false);
    }
  }

  // handleScroll reads scrollHeight/clientHeight, which forces a synchronous
  // layout right after new rows are inserted for the same event — doing that
  // on every scroll event is a read-after-write thrash that stutters the
  // list. Coalesce every trigger (native scroll, wheel and touch edge
  // fallbacks) into one check per frame so the reflow happens at most once,
  // after layout has settled.
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
    const view = paneView();
    updateTopVisible();
    if (!(el && view)) return;
    const direction =
      preferredDirection ??
      (el.scrollTop > lastScrollTop ? "newer" : el.scrollTop < lastScrollTop ? "older" : undefined);
    lastScrollTop = el.scrollTop;
    shouldFollowBottom = isScrolledToBottom(el);
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

  function handleWheel(event: WheelEvent) {
    cancelLanding();
    // A short anchored page may already be at its lower scroll clamp, in
    // which case the browser emits no scroll event. Recheck after cancelling
    // any in-flight landing so a downward wheel still loads.
    const direction = event.deltaY > 0 ? "newer" : event.deltaY < 0 ? "older" : undefined;
    if (direction) scheduleScrollCheck(direction);
  }

  function handleTouchStart(event: TouchEvent) {
    cancelLanding();
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
    const container = scrollRef;
    if (!container) return;
    shouldFollowBottom = false;
    cancelPendingFlash?.();
    cancelPendingFlash = jumpToMessageInContainer(container, ts);
  }

  onCleanup(() => cancelPendingFlash?.());

  function jumpToDate(dateMs: number) {
    const view = paneView();
    if (!view) return;
    void store.messages.jumpToDate(view.id, dateMs).then((ok) => {
      if (!ok || paneView()?.id !== view.id) return;
      queueMicrotask(() => {
        const [first] = messages();
        if (first) landOnMessage(view.id, first.ts, "start");
      });
    });
  }

  // There's no Slack API call that returns "the first page of the channel"
  // directly (conversations.history always answers relative to `latest`,
  // newest-first) — the only way to reach an arbitrarily old beginning
  // without walking every older page by hand is to anchor on a known nearby
  // timestamp, same as jumpToDate. store.messages.jumpToBeginning does
  // exactly that off the channel's own creation date (one bounded request,
  // never a loop).
  function jumpToBeginning() {
    const view = paneView();
    if (!view) return;
    void store.messages.jumpToBeginning(view.id).then((ok) => {
      if (!ok || paneView()?.id !== view.id) return;
      queueMicrotask(() => {
        const [first] = messages();
        if (first) landOnMessage(view.id, first.ts, "start");
      });
    });
  }

  createEffect(() => {
    const target = messageTarget();
    const view = paneView();
    if (!(target && view?.id === target.channelId)) return;

    const index = messages().findIndex((candidate) => candidate.ts === target.ts);
    if (index >= 0) {
      requestedMessageTarget = target;
      // A message-link jump into a channel that isn't already open/ready needs
      // the same wait-for-render treatment as the ordinary open-channel landing
      // above — otherwise the list is revealed before the target row exists. A
      // jump within an already-ready channel (e.g. clicking a reply reference)
      // has nothing to wait for, so it skips straight to scrolling instead of
      // hiding an already-visible view.
      const coldOpen = readyViewId() !== view.id;
      clearMessageTarget();
      if (coldOpen) {
        landOnMessage(view.id, target.ts, "center");
      } else {
        jumpToMessage(target.ts);
      }
      return;
    }

    if (requestedMessageTarget === target) return;
    requestedMessageTarget = target;
    void store.messages.ensureChannelMessage(target.channelId, target.ts).then((found) => {
      if (!found && messageTarget() === target) clearMessageTarget();
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
        <Show when={paneView()}>
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
              <div>
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
              <div
                aria-hidden={readyViewId() !== v().id}
                classList={{ "message-list-rows-pending": readyViewId() !== v().id }}
              >
                <MessageRows
                  channelId={v().id}
                  editingTs={messageFocus.editingTs}
                  focusedTs={messageFocus.focusedTs}
                  listFocused={messageFocus.listFocused}
                  messages={messages()}
                  onJumpToMessage={jumpToMessage}
                  onOpenThread={(ts) => store.viewState.openThread(v().id, ts)}
                  onStartEdit={messageFocus.onStartEdit}
                  onStopEdit={messageFocus.onStopEdit}
                />
                <Show when={store.messages.hasNewerHistoryError(v().id)}>
                  <div class="message-list-load-error" role="alert">
                    <span>Couldn’t load newer messages.</span>
                    <Button onClick={() => void loadNewerMessages(v().id)} size="sm">
                      Try again
                    </Button>
                  </div>
                </Show>
                <Show when={isLoadingNewer()}>
                  <div aria-live="polite" class="message-list-loading-older">
                    Loading messages…
                  </div>
                </Show>
              </div>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
}
