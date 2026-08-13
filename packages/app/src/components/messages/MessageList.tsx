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

const NEAR_HISTORY_EDGE_VIEWPORT_FRACTION = 2;

const MAX_BACKFILL_LOADS = 5;

export default function MessageList() {
  const { clearMessageTarget, messageTarget, view: paneView } = usePaneView();

  let scrollRef: HTMLDivElement | undefined;
  let lastViewId: string | undefined;
  let lastScrollTop = 0;
  let touchStartY: number | undefined;

  let positionedViewId: string | undefined;

  let landingRun = 0;

  let shouldFollowBottom = true;
  let requestedMessageTarget: ReturnType<typeof messageTarget> = null;
  let cancelPendingFlash: (() => void) | undefined;

  const backfillAttempts: Record<string, number> = {};

  const [readyViewId, setReadyViewId] = createSignal<string>();
  const [isLoadingNewer, setIsLoadingNewer] = createSignal(false);

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

  const visibleDay = createMemo(() => messages().find((m) => m.ts === topVisibleTs())?.day);

  createEffect(() => {
    messages();
    readyViewId();
    queueMicrotask(updateTopVisible);
  });

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

  function cancelLanding() {
    landingRun += 1;
    const view = paneView();
    if (view && readyViewId() !== view.id) setReadyViewId(view.id);
  }

  createEffect(() => {
    const view = paneView();
    const msgs = messages();
    const switchedView = view?.id !== lastViewId;
    lastViewId = view?.id;
    if (switchedView) {
      landingRun += 1;
      positionedViewId = undefined;
      lastScrollTop = 0;
      shouldFollowBottom = true;
      cancelPendingFlash?.();
      cancelPendingFlash = undefined;
    }
    const el = scrollRef;
    if (!el) return;

    const target = messageTarget();
    if (target?.channelId === view?.id) return;

    if (view && positionedViewId !== view.id && msgs.length > 0) {
      const anchor = store.unread.unreadDividerTsForChannel(view.id);

      if (anchor === undefined) return;
      const readCursorNotYetLoaded = parseFloat(msgs[0].ts) * 1000 > anchor;

      const alreadyAttempted = (backfillAttempts[view.id] ?? 0) >= MAX_BACKFILL_LOADS;
      let gaveUpBackfill = false;
      if (readCursorNotYetLoaded && store.messages.hasMoreHistory(view.id)) {
        if (store.messages.hasOlderHistoryError(view.id)) return;

        if (store.messages.isLoadingHistory(view.id)) return;
        if (!alreadyAttempted) {
          backfillAttempts[view.id] = MAX_BACKFILL_LOADS;
          store.messages.loadOlderMessagesThrough(view.id, anchor, MAX_BACKFILL_LOADS);
          return;
        }

        gaveUpBackfill = true;
      }

      delete backfillAttempts[view.id];
      positionedViewId = view.id;

      const dividerIndex = gaveUpBackfill ? -1 : findUnreadDividerIndex(msgs, anchor);
      const dividerTs = dividerIndex >= 0 ? msgs[dividerIndex]?.ts : undefined;
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

  async function loadOlderMessagesPreservingScroll(channelId: string) {
    const el = scrollRef;
    if (!el) return;
    const prevScrollHeight = el.scrollHeight;
    await store.messages.loadOlderMessages(channelId);
    if (scrollRef !== el || paneView()?.id !== channelId) return;
    el.scrollTop += el.scrollHeight - prevScrollHeight;
  }

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
      void loadOlderMessagesPreservingScroll(view.id);
  }

  function handleWheel(event: WheelEvent) {
    cancelLanding();

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
                    <div class="message-list-intro message-list-error">
                      <div class="message-list-intro-icon flex-center">
                        <Icon name="warning" size={26} />
                      </div>
                      <h2>Couldn't load this conversation</h2>
                      <p>Check your connection or access, then try again.</p>
                      <Button onClick={() => store.messages.loadRecentHistory(v().id)} size="sm">
                        Try again
                      </Button>
                    </div>
                  }
                  when={!(store.messages.hasHistoryError(v().id) && messages().length === 0)}
                >
                  <Show when={store.messages.hasHistoryError(v().id) && messages().length > 0}>
                    <div class="message-list-load-error">
                      <span>Couldn't refresh this conversation.</span>
                      <Button onClick={() => store.messages.loadRecentHistory(v().id)} size="sm">
                        Try again
                      </Button>
                    </div>
                  </Show>
                  <Show when={store.messages.hasOlderHistoryError(v().id)}>
                    <div class="message-list-load-error">
                      <span>Couldn't load older messages.</span>
                      <Button
                        onClick={() => void loadOlderMessagesPreservingScroll(v().id)}
                        size="sm"
                      >
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
                  <div class="message-list-load-error">
                    <span>Couldn't load newer messages.</span>
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
