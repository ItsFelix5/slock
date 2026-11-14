import { service } from "@slock/core/solid";
import type { Message } from "@slock/types";
import { createEffect, createSignal, onCleanup } from "solid-js";
import type { ChannelMessageTarget, View } from "../../conversations/client/api/types";
import { observeComposerOverlay } from "./api/pane/composerOverlay";
import {
  captureScrollAnchor,
  correctScrollAfterContentChange,
  isScrolledToBottom,
  restoreScrollAnchor,
} from "./api/pane/scrollAnchor";
import { historyLoadOnScroll, historyLoadToFillViewport, scrollDirection } from "./lib/scrollMath";
import { createMessageListLanding } from "./messageListLanding";

const messagesStore = service("messages");
const unreadStore = service("unread");

const historyAvailability = (viewId: string) => ({
  canLoadNewer:
    messagesStore.hasNewerHistory(viewId) && !messagesStore.hasNewerHistoryError(viewId),
  canLoadOlder: messagesStore.hasMoreHistory(viewId) && !messagesStore.hasOlderHistoryError(viewId),
});

const isAtLiveBottom = (el: HTMLElement, viewId: string) =>
  isScrolledToBottom(el) && !messagesStore.hasNewerHistory(viewId);

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
    if (view)
      unreadStore.setBottomSeen(view.id, readyViewId() === view.id && isAtLiveBottom(el, view.id));
  }
  createEffect(() => {
    const id = deps.paneView()?.id;
    if (id) onCleanup(() => unreadStore.setBottomSeen(id, false));
  });

  const visibleDay = () => {
    const ts = topVisibleTs();
    return ts === undefined ? undefined : deps.messages().find((m) => m.ts === ts)?.day;
  };

  function correctScrollForContentChange() {
    const el = deps.scrollRef();
    if (el) correctScrollAfterContentChange(el, shouldFollowBottom(), lastAnchor);
  }
  let filledViewId: string | undefined;
  function fillViewportIfUnderfull() {
    const el = deps.scrollRef();
    const view = deps.paneView();
    if (!(el && view)) return;
    if (readyViewId() !== view.id || filledViewId === view.id) return;
    if (messagesStore.isLoadingHistory(view.id)) return;
    const load = historyLoadToFillViewport(el, historyAvailability(view.id));
    if (!load) return;
    filledViewId = view.id;
    if (load === "older") void loadOlderMessagesPreservingScroll(view.id);
    else void loadNewerMessages(view.id);
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
    const el = deps.scrollRef();
    if (!el) return;
    const anchor = captureScrollAnchor(el, "bottom");
    setIsLoadingNewer(true);
    try {
      await messagesStore.loadNewerMessages(channelId);
    } finally {
      setIsLoadingNewer(false);
    }
    if (deps.scrollRef() !== el || deps.paneView()?.id !== channelId) return;
    if (anchor?.el.isConnected && !shouldFollowBottom()) restoreScrollAnchor(el, anchor);
    updateTopVisible();
  }

  const OLDER_LOAD_COOLDOWN_MS = 250;
  let olderLoadCooldownUntil = 0;
  async function loadOlderMessagesPreservingScroll(channelId: string) {
    const el = deps.scrollRef();
    if (!el) return;
    const anchor = captureScrollAnchor(el);
    await messagesStore.loadOlderMessages(channelId);
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
    const direction = preferredDirection ?? scrollDirection(el.scrollTop - lastScrollTop);
    lastScrollTop = el.scrollTop;
    if (isPinning()) return;
    setShouldFollowBottom(isAtLiveBottom(el, view.id));

    if (readyViewId() !== view.id) return;
    if (messagesStore.isLoadingHistory(view.id)) return;

    const load = historyLoadOnScroll({
      ...historyAvailability(view.id),
      direction,
      metrics: el,
      olderCoolingDown: Date.now() < olderLoadCooldownUntil,
    });
    if (load === "newer") void loadNewerMessages(view.id);
    else if (load === "older") void loadOlderMessagesPreservingScroll(view.id);
  }

  function handleWheel(event: WheelEvent) {
    cancelLanding();
    const direction = scrollDirection(event.deltaY);
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
        : scrollDirection(touchStartY - endY);
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
