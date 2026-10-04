import type { Message } from "@slock/types";
import { createEffect, createSignal, onCleanup } from "solid-js";
import type { ChannelMessageTarget, View } from "../../lib/store";
import { store } from "../../lib/store";
import { observeComposerOverlay } from "./composerOverlay";
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
  contentRef: () => HTMLDivElement | undefined;
  messages: () => Message[];
  messageTarget: () => ChannelMessageTarget | null;
  paneView: () => View | null;
  scrollRef: () => HTMLDivElement | undefined;
}) {
  const {
    cancelLanding,
    isPinning,
    jumpToBeginning,
    jumpToDate,
    jumpToMessage,
    readyViewId,
    setShouldFollowBottom,
    shouldFollowBottom,
    trackScrollAnchor,
  } = createMessageListLanding(deps);

  let lastScrollTop = 0;
  let touchStartY: number | undefined;
  let lastAnchor: ReturnType<typeof captureScrollAnchor> = null;
  const [isLoadingNewer, setIsLoadingNewer] = createSignal(false);
  const [topVisibleTs, setTopVisibleTs] = createSignal<string>();

  function updateTopVisible() {
    const el = deps.scrollRef();
    const view = deps.paneView();
    if (!el) return;
    lastAnchor = captureScrollAnchor(el);
    const ts = lastAnchor?.el.dataset.messageTs;
    setTopVisibleTs(ts);
    if (view && ts && lastAnchor) trackScrollAnchor(view.id, { offset: lastAnchor.offset, ts });
  }

  const visibleDay = () => {
    const messageByTs = new Map(deps.messages().map((m) => [m.ts, m]));
    return messageByTs.get(topVisibleTs() ?? "")?.day;
  };

  function correctScrollForContentChange() {
    const el = deps.scrollRef();
    if (!el) return;
    if (shouldFollowBottom()) scrollToBottom(el);
    else if (lastAnchor?.el.isConnected) restoreScrollAnchor(el, lastAnchor);
  }
  function fillViewportIfUnderfull() {
    const el = deps.scrollRef();
    const view = deps.paneView();
    if (!(el && view)) return;
    if (readyViewId() !== view.id) return;
    if (store.messages.isLoadingHistory(view.id)) return;
    if (el.clientHeight === 0 || el.scrollHeight > el.clientHeight) return;
    if (store.messages.hasMoreHistory(view.id) && !store.messages.hasOlderHistoryError(view.id)) {
      void loadOlderMessagesPreservingScroll(view.id);
    } else if (
      store.messages.hasNewerHistory(view.id) &&
      !store.messages.hasNewerHistoryError(view.id)
    ) {
      void loadNewerMessages(view.id);
    }
  }
  createEffect(() => {
    deps.messages();
    readyViewId();
    queueMicrotask(() => {
      correctScrollForContentChange();
      updateTopVisible();
      fillViewportIfUnderfull();
    });
  });
  createEffect(() => {
    const el = deps.scrollRef();
    const content = deps.contentRef();
    if (!(el && content)) return;
    const observer = new ResizeObserver(() => {
      correctScrollForContentChange();
      fillViewportIfUnderfull();
    });
    observer.observe(el);
    observer.observe(content);
    onCleanup(() => observer.disconnect());
  });
  createEffect(() => {
    const el = deps.scrollRef();
    if (!el) return;
    onCleanup(observeComposerOverlay(el, shouldFollowBottom));
  });

  async function loadNewerMessages(channelId: string) {
    setIsLoadingNewer(true);
    try {
      await store.messages.loadNewerMessages(channelId);
    } finally {
      setIsLoadingNewer(false);
    }
  }

  const OLDER_LOAD_COOLDOWN_MS = 250;
  let olderLoadCooldownUntil = 0;
  async function loadOlderMessagesPreservingScroll(channelId: string) {
    const el = deps.scrollRef();
    if (!el) return;
    const anchor = captureScrollAnchor(el);
    await store.messages.loadOlderMessages(channelId);
    olderLoadCooldownUntil = Date.now() + OLDER_LOAD_COOLDOWN_MS;
    if (deps.scrollRef() !== el || deps.paneView()?.id !== channelId) return;
    if (anchor?.el.isConnected) restoreScrollAnchor(el, anchor);
    updateTopVisible();
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
    if (isPinning()) return;
    setShouldFollowBottom(isScrolledToBottom(el) && !store.messages.hasNewerHistory(view.id));

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
      Date.now() >= olderLoadCooldownUntil &&
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
