import type { Ts } from "@slock/types";
import { createSignal, onCleanup, onSettled } from "solid-js";
import { type ScrollDirection, scrollDirection } from "../../../lib/scrollMath";
import { observeComposerOverlay } from "../composerOverlay";
import { anchorDrift, captureAnchors, type FeedAnchor, shiftAnchors } from "./feedAnchors";
import { findGroup, flashGroup, groupTs } from "./feedDom";
import { observeFeed } from "./feedObserver";
import { alignedTop, bottomInset, maxScrollTop, offsetTop, revealTop } from "./feedPosition";

export type LandTarget =
  | { at: "bottom" }
  | { at: "top" }
  | { at: "reveal"; ts: Ts }
  | { at: "row"; ts: Ts; align: "start" | "center"; flash?: boolean }
  | { at: "offset"; ts: Ts; offset: number };

const BOTTOM_SLACK_PX = 2;
const SUBPIXEL_PX = 0.5;

const nearBottom = (scroller: HTMLElement) =>
  scroller.scrollTop >= maxScrollTop(scroller) - bottomInset(scroller) - BOTTOM_SLACK_PX;

function targetTop(scroller: HTMLElement, target: LandTarget) {
  if (target.at === "bottom") return maxScrollTop(scroller);
  if (target.at === "top") return 0;
  if (target.at === "reveal") return revealTop(scroller, target.ts);
  if (target.at === "offset") return offsetTop(scroller, target.ts, target.offset);
  return alignedTop(scroller, target.ts, target.align);
}

export function createFeedScroll(options: {
  isLive: () => boolean;
  onMove?: (direction: ScrollDirection | undefined) => void;
}) {
  const [ready, setReady] = createSignal(false);
  const [atBottom, setAtBottom] = createSignal(true);
  const [atTop, setAtTop] = createSignal(true);
  const [topTs, setTopTs] = createSignal<Ts>();

  // `scroller` is the synchronous truth; the signal publishes it to effects once flushed.
  let scroller: HTMLElement | undefined;
  const [element, setElement] = createSignal<HTMLElement | undefined>(undefined, {
    ownedWrite: true,
  });
  let following = true;
  let target: LandTarget | undefined;
  let anchors: FeedAnchor[] = [];
  let lastTop = 0;
  let seenMaxTop = 0;
  let pendingMove = 0;
  let hidden = false;
  let landRun = 0;

  function write(el: HTMLElement, top: number) {
    if (Math.abs(top - el.scrollTop) >= SUBPIXEL_PX) el.scrollTop = top;
    lastTop = el.scrollTop;
  }

  function absorb(el: HTMLElement) {
    const moved = el.scrollTop - lastTop;
    const currentMax = maxScrollTop(el);
    const clampedByShrink =
      moved < 0 && currentMax < seenMaxTop && el.scrollTop >= currentMax - SUBPIXEL_PX;
    if (moved === 0 || clampedByShrink) return false;
    shiftAnchors(anchors, moved);
    pendingMove += moved;
    target = undefined;
    following =
      options.isLive() && el.scrollTop >= Math.min(seenMaxTop, currentMax) - BOTTOM_SLACK_PX;
    return currentMax === seenMaxTop;
  }

  function apply(el: HTMLElement, onlyUserMoved: boolean) {
    const top = target && targetTop(el, target);
    if (top !== undefined) write(el, top);
    else if (following && options.isLive()) {
      if (!onlyUserMoved) write(el, maxScrollTop(el));
    } else write(el, el.scrollTop + anchorDrift(el, anchors));
    const live = options.isLive();
    if (target && nearBottom(el) && (live || target.at === "bottom")) {
      following = live;
      target = undefined;
    }
  }

  function settle() {
    const el = scroller;
    if (!el) return;
    if (el.clientHeight === 0) {
      hidden = true;
      return;
    }
    const onlyUserMoved = !hidden && absorb(el);
    hidden = false;
    apply(el, onlyUserMoved);
    lastTop = el.scrollTop;
    anchors = captureAnchors(el);
    seenMaxTop = maxScrollTop(el);
    setAtBottom(nearBottom(el));
    setAtTop(el.scrollTop <= el.clientHeight / 2);
    setTopTs(anchors[0] && groupTs(anchors[0].group));
    const direction = scrollDirection(pendingMove);
    pendingMove = 0;
    options.onMove?.(direction);
  }

  let detach: (() => void) | undefined;

  function attach(el: HTMLElement) {
    detach?.();
    scroller = el;
    setElement(el);
    el.style.overflowAnchor = "none";
    lastTop = el.scrollTop;
    el.addEventListener("scroll", settle, { passive: true });
    const stopObserving = observeFeed(el, settle);
    detach = () => {
      el.removeEventListener("scroll", settle);
      stopObserving();
      scroller = undefined;
      setElement(undefined);
      detach = undefined;
    };
  }

  onSettled(() => (scroller ? observeComposerOverlay(scroller, settle) : undefined));
  onCleanup(() => detach?.());

  function reset() {
    landRun += 1;
    target = undefined;
    anchors = [];
    following = true;
    pendingMove = 0;
    setReady(false);
  }

  function land(next: LandTarget) {
    const run = ++landRun;
    queueMicrotask(() => {
      const el = scroller;
      if (!el || run !== landRun) return;
      target = next;
      following = false;
      lastTop = el.scrollTop;
      settle();
      if (next.at === "row" && next.flash) {
        const group = findGroup(el, next.ts);
        if (group) flashGroup(group);
      }
      setReady(true);
    });
  }

  function moveTo(next: LandTarget) {
    const el = scroller;
    if (!el) return;
    target = next;
    following = false;
    lastTop = el.scrollTop;
    settle();
  }

  function jumpTo(ts: Ts) {
    const el = scroller;
    const group = el && findGroup(el, ts);
    if (!(el && group)) return;
    flashGroup(group);
    moveTo({ align: "center", at: "row", ts });
  }

  return {
    atBottom,
    atTop,
    attach,
    element,
    jumpTo,
    land,
    ready,
    reset,
    reveal: (ts: Ts) => moveTo({ at: "reveal", ts }),
    scrollEdge: (edge: "start" | "end") =>
      moveTo(edge === "start" ? { at: "top" } : { at: "bottom" }),
    settle,
    topAnchor: () => {
      const [first] = anchors;
      const ts = first && groupTs(first.group);
      return first && ts ? { offset: first.offset, ts } : undefined;
    },
    topTs,
  };
}

export type FeedScroll = ReturnType<typeof createFeedScroll>;
