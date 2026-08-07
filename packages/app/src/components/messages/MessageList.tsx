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
// Rows measure in a frame at a time as the virtualizer's ResizeObserver
// catches up with reality, so a landing keeps re-issuing its scroll for a
// few frames rather than trusting the first (estimate-based) one. Bounded so
// a channel that genuinely never stops resizing (e.g. a firehose of live
// reactions) can't pin this in a loop forever — it just reveals wherever it
// got to.
const MAX_LANDING_FRAMES = 30;
// Two back-to-back frames reporting the same total content size is treated
// as "settled" — one match alone could just be luck between two rows that
// happened to measure in the same frame.
const LANDING_STABLE_STREAK = 2;

type LandingAlign = "start" | "end" | "center";

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

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
  // Identifies the currently in-flight runLanding() call. Bumped every time a
  // new one starts, so an older run's still-pending frame callback notices
  // it's been superseded (a second jump, a channel switch, the reader taking
  // scroll back) and quietly stops touching the DOM instead of fighting
  // whatever superseded it.
  let landingRun = 0;
  // True only while runLanding's own loop is actively driving scrollTop —
  // lets the header-height compensation effect below stay out of its way
  // instead of both adjusting scrollTop in the same frame.
  let landingActive = false;
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
  // A conversation is only made visible after its unread backfill and initial
  // landing have settled. This prevents the initially loaded tail from
  // painting first and visibly moving once older pages land or estimates
  // firm up into real measurements.
  const [readyViewId, setReadyViewId] = createSignal<string>();
  // While actively landing somewhere other than the newest message, keep the
  // virtualizer anchored to that row (rather than its usual "stay pinned to
  // the bottom") so a mid-flight prepend or resize doesn't fight the landing
  // in progress. Reverts to "end" the moment the landing settles or gets
  // superseded — see runLanding.
  const [landingAnchor, setLandingAnchor] = createSignal<"start" | "end">("end");
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
  // making the list lurch while loading. Skipped while a landing is actively
  // driving scrollTop itself (runLanding reads the current scrollMargin fresh
  // on its very next frame regardless, so nothing is lost by not also patching
  // it here) — the two used to both write scrollTop for the same header
  // change and race each other.
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
          landingActive,
        });
        if (el.scrollTop > 0 && !landingActive) {
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

  // The one thing allowed to move scrollTop for "get to this row and stay
  // there" purposes (as opposed to the ordinary pagination/follow behavior
  // the virtualizer already owns — see VirtualizedRows.tsx's anchorTo/
  // followOnAppend). Re-issues its scroll every animation frame — rather
  // than once, or on a fixed debounce — because rows measure in one at a
  // time as the virtualizer's ResizeObserver catches up with reality: an
  // estimate-based scrollToIndex can land short (or, for a divider near the
  // end of a short unread tail, get clamped against a scrollHeight that
  // hasn't grown into its real size yet). Stops as soon as two consecutive
  // frames report the same total content size (or the frame budget runs
  // out) and reveals the view — from then on this row's position is exactly
  // what the browser's own natural scroll math says it should be, no
  // artificial buffer or indefinite "keep re-snapping forever" involved.
  //
  // Cancellable: bumping landingRun (a channel switch, a second jump, the
  // reader grabbing the scrollbar) makes every check below see itself as
  // superseded and return without touching anything.
  async function runLanding(viewId: string, index: number, align: LandingAlign) {
    const run = ++landingRun;
    const isStale = () => run !== landingRun || store.viewState.activeView()?.id !== viewId;
    if (isStale()) return;
    landingActive = true;
    setLandingAnchor(align === "start" ? "start" : "end");
    let lastTotal = -1;
    let stableStreak = 0;
    for (let frame = 0; frame < MAX_LANDING_FRAMES; frame++) {
      const api = virtualApi();
      const el = scrollRef;
      if (api && el) {
        if (align === "end") scrollToBottom(el);
        else api.scrollToIndex(index, { align });
      }
      dbg("landing frame", {
        frame,
        viewId,
        index,
        align,
        scrollTop: el?.scrollTop,
        totalSize: api?.totalSize(),
      });
      await nextFrame();
      if (isStale()) return;
      const total = virtualApi()?.totalSize() ?? -1;
      if (total === lastTotal) {
        stableStreak += 1;
        if (stableStreak >= LANDING_STABLE_STREAK) break;
      } else {
        stableStreak = 0;
        lastTotal = total;
      }
    }
    if (isStale()) return;
    landingActive = false;
    setLandingAnchor("end");
    dbg("landing settled", { viewId, index, align, totalSize: lastTotal });
    setReadyViewId(viewId);
  }

  // Commits to landing this view at `index`/`align` and kicks off runLanding
  // for it. Setting positionedViewId synchronously here (rather than inside
  // the async runLanding) is what actually stops a reactive effect above
  // from re-deciding and double-queuing a landing for the same view during
  // the one-tick gap before runLanding's own body executes — runLanding
  // itself only needs to know how, not whether, to land.
  function beginLanding(viewId: string, index: number, align: LandingAlign) {
    positionedViewId = viewId;
    // One tick so the DOM (and the virtualizer's own count-driven internal
    // effects) have caught up with whatever message-list change got us here
    // before scrollToIndex reads it.
    queueMicrotask(() => void runLanding(viewId, index, align));
  }

  // Invalidates whatever landing is currently in flight and hands scroll
  // control back to the browser/reader — called the moment the reader
  // physically scrolls (wheel or touch). Also makes sure a landing that gets
  // interrupted before it ever finished never leaves the view stranded
  // hidden (aria-hidden / message-list-rows-pending never clears on its own
  // otherwise).
  function cancelLanding() {
    landingRun += 1;
    landingActive = false;
    setLandingAnchor("end");
    const view = store.viewState.activeView();
    if (view && readyViewId() !== view.id) setReadyViewId(view.id);
  }

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
      landingRun += 1;
      landingActive = false;
      setLandingAnchor("end");
      positionedViewId = undefined;
      lastScrollTop = 0;
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
      const onDivider = unreadLandingIndex >= 0;
      const landIndex = onDivider ? unreadLandingIndex : msgs.length - 1;
      const align: LandingAlign = onDivider ? "start" : "end";
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
      beginLanding(view.id, landIndex, align);
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
  // effect above does: run through the same runLanding settle loop. A single
  // one-shot scrollToIndex isn't enough here — jumpToDate swaps in a whole
  // new run of unmeasured (estimate-only) rows, and jumpToBeginning can
  // prepend thousands of them; both need the same "keep correcting until
  // measurements stop moving" treatment as the ordinary channel-open landing.
  function landAt(viewId: string, index: number) {
    beginLanding(viewId, index, "start");
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
      store.viewState.setChannelMessageTarget(null);
      if (coldOpen) {
        beginLanding(view.id, index, "center");
      } else {
        jumpToMessage(target.ts);
      }
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
                  anchorTo={landingAnchor()}
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
              </div>
            </>
          )}
        </Show>
      </Show>
    </div>
  );
}
