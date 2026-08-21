import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { Message } from "../../lib/api";
import type { ChannelMessageTarget, View } from "../../lib/store";
import { store } from "../../lib/store";
import { createMessageListLanding } from "./messageListLanding";
import {
  captureScrollAnchor,
  isScrolledToBottom,
  restoreScrollAnchor,
  scrollToBottom,
} from "./scrollAnchor";

const NEAR_HISTORY_EDGE_VIEWPORT_FRACTION = 2;

export function createMessageListScroll(deps: {
  clearMessageTarget: () => void;
  messages: () => Message[];
  messageTarget: () => ChannelMessageTarget | null;
  paneView: () => View | null;
  scrollRef: () => HTMLDivElement | undefined;
}) {
  const {
    cancelLanding,
    jumpToBeginning,
    jumpToDate,
    jumpToMessage,
    readyViewId,
    setShouldFollowBottom,
    shouldFollowBottom,
  } = createMessageListLanding(deps);

  let lastScrollTop = 0;
  let touchStartY: number | undefined;
  let lastAnchor: ReturnType<typeof captureScrollAnchor> = null;
  const [isLoadingNewer, setIsLoadingNewer] = createSignal(false);
  const [topVisibleTs, setTopVisibleTs] = createSignal<string>();

  function updateTopVisible() {
    const el = deps.scrollRef();
    if (!el) return;
    lastAnchor = captureScrollAnchor(el);
    setTopVisibleTs(lastAnchor?.el.dataset.messageTs);
  }

  const visibleDay = createMemo(() => deps.messages().find((m) => m.ts === topVisibleTs())?.day);

  createEffect(() => {
    deps.messages();
    readyViewId();
    queueMicrotask(updateTopVisible);
  });

  createEffect(() => {
    deps.messages();
    const el = deps.scrollRef();
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const current = deps.scrollRef();
      if (!current) return;
      if (shouldFollowBottom()) scrollToBottom(current);
      else if (lastAnchor?.el.isConnected) restoreScrollAnchor(current, lastAnchor);
    });
    for (const row of el.querySelectorAll<HTMLElement>("[data-message-ts]")) observer.observe(row);
    onCleanup(() => observer.disconnect());
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
    const el = deps.scrollRef();
    if (!el) return;
    const prevScrollHeight = el.scrollHeight;
    await store.messages.loadOlderMessages(channelId);
    if (deps.scrollRef() !== el || deps.paneView()?.id !== channelId) return;
    el.scrollTop += el.scrollHeight - prevScrollHeight;
  }

  let scrollCheckRaf = 0;
  let pendingScrollDirection: "newer" | "older" | undefined;
  function scheduleScrollCheck(direction?: "newer" | "older") {
    if (direction) pendingScrollDirection = direction;
    if (scrollCheckRaf) return;
    scrollCheckRaf = requestAnimationFrame(() => {
      scrollCheckRaf = 0;
      const dir = pendingScrollDirection;
      pendingScrollDirection = undefined;
      handleScroll(dir);
    });
  }
  onCleanup(() => scrollCheckRaf && cancelAnimationFrame(scrollCheckRaf));

  function handleScroll(preferredDirection?: "newer" | "older") {
    const el = deps.scrollRef();
    const view = deps.paneView();
    updateTopVisible();
    if (!(el && view)) return;
    const direction =
      preferredDirection ??
      (el.scrollTop > lastScrollTop ? "newer" : el.scrollTop < lastScrollTop ? "older" : undefined);
    lastScrollTop = el.scrollTop;
    setShouldFollowBottom(isScrolledToBottom(el));

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

  return {
    handleTouchEnd,
    handleTouchStart,
    handleWheel,
    isLoadingNewer,
    jumpToBeginning,
    jumpToDate,
    jumpToMessage,
    loadNewerMessages,
    loadOlderMessagesPreservingScroll,
    readyViewId,
    scheduleScrollCheck,
    visibleDay,
  };
}
