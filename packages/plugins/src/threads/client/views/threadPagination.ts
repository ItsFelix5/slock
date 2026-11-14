import { service } from "@slock/core/solid";
import {
  captureScrollAnchor,
  restoreScrollAnchor,
} from "../../../messages/client/api/pane/scrollAnchor";

const messagesStore = service("messages");

const NEAR_EDGE_VIEWPORTS = 2;
const EARLIER_COOLDOWN_MS = 250;
const JUMP_START_MS = 400;
const JUMP_SETTLE_MS = 150;

export function createThreadPagination(deps: {
  container: () => HTMLElement | undefined;
  isReady: () => boolean;
  threadTs: () => string;
}) {
  let lastScrollTop = 0;
  let earlierCooldownUntil = 0;
  let jumpTimer: ReturnType<typeof setTimeout> | undefined;
  let jumping = false;

  function setJumping(next: boolean, settleMs = JUMP_SETTLE_MS) {
    clearTimeout(jumpTimer);
    jumping = next;
    if (next) jumpTimer = setTimeout(() => setJumping(false), settleMs);
  }

  function loadMore() {
    const el = deps.container();
    const ts = deps.threadTs();
    if (!(el && deps.isReady())) return;
    if (!messagesStore.hasMoreReplies(ts) || messagesStore.hasMoreRepliesError(ts)) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom <= el.clientHeight * NEAR_EDGE_VIEWPORTS)
      void messagesStore.loadMoreReplies(ts);
  }

  async function loadEarlier() {
    const el = deps.container();
    const ts = deps.threadTs();
    if (!el) return;
    const anchor = captureScrollAnchor(el);
    await messagesStore.loadEarlierReplies(ts);
    earlierCooldownUntil = Date.now() + EARLIER_COOLDOWN_MS;
    if (deps.container() === el && deps.threadTs() === ts) restoreScrollAnchor(el, anchor);
  }

  function loadEarlierIfNeeded() {
    const el = deps.container();
    const ts = deps.threadTs();
    if (!(el && deps.isReady()) || jumping || Date.now() < earlierCooldownUntil) return;
    if (!messagesStore.hasEarlierReplies(ts) || messagesStore.hasEarlierRepliesError(ts)) return;
    if (messagesStore.isLoadingEarlierReplies(ts)) return;
    if (el.scrollTop <= el.clientHeight * NEAR_EDGE_VIEWPORTS) void loadEarlier();
  }

  function onScroll() {
    const el = deps.container();
    if (!el) return;
    const scrolledUp = el.scrollTop < lastScrollTop;
    lastScrollTop = el.scrollTop;
    if (jumping) setJumping(true);
    loadMore();
    if (scrolledUp) loadEarlierIfNeeded();
  }

  function onWheel(event: WheelEvent) {
    setJumping(false);
    if (event.deltaY < 0) loadEarlierIfNeeded();
  }

  return {
    loadEarlier,
    loadMore,
    onScroll,
    onWheel,
    startJump: () => setJumping(true, JUMP_START_MS),
  };
}
