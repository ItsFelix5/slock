import { createSignal, onCleanup, onMount } from "solid-js";
import { type ScrollDirection, scrollDirection } from "../../../lib/scrollMath";
import { observeComposerOverlay } from "../composerOverlay";
import { anchorDrift, captureAnchors, type FeedAnchor, shiftAnchors } from "./feedAnchors";
import { findGroup, flashGroup, groupTs } from "./feedDom";
import { createGlide, glideSnap, glideStep, prefersReducedMotion } from "./feedGlide";
import { observeFeed } from "./feedObserver";
import { alignedTop, maxScrollTop, offsetTop, revealTop } from "./feedPosition";

export type LandTarget =
  | { at: "bottom" }
  | { at: "row"; ts: string; align: "start" | "center"; flash?: boolean }
  | { at: "offset"; ts: string; offset: number };

const BOTTOM_SLACK_PX = 2;
const SUBPIXEL_PX = 0.5;

const nearBottom = (scroller: HTMLElement) =>
  scroller.scrollTop >= maxScrollTop(scroller) - BOTTOM_SLACK_PX;

function targetTop(scroller: HTMLElement, target: LandTarget) {
  if (target.at === "bottom") return maxScrollTop(scroller);
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
  const [topTs, setTopTs] = createSignal<string>();

  let scroller: HTMLElement | undefined;
  let following = true;
  let target: LandTarget | undefined;
  let destination: ((scroller: HTMLElement) => number | undefined) | undefined;
  let anchors: FeedAnchor[] = [];
  let lastTop = 0;
  let seenMaxTop = 0;
  let pendingMove = 0;
  let hidden = false;
  let landRun = 0;
  let gesturing = false;

  function write(el: HTMLElement, top: number) {
    if (Math.abs(top - el.scrollTop) >= SUBPIXEL_PX) el.scrollTop = top;
    lastTop = el.scrollTop;
  }

  const glide = createGlide((elapsedMs) => {
    const el = scroller;
    const goal = el && destination?.(el);
    if (!el || goal === undefined) return true;
    const distance = Math.min(Math.max(goal, 0), maxScrollTop(el)) - el.scrollTop;
    const jump = glideSnap(distance, el.clientHeight);
    const remaining = distance - jump;
    const before = el.scrollTop;
    write(
      el,
      before + jump + (prefersReducedMotion() ? remaining : glideStep(remaining, elapsedMs)),
    );
    const moved = el.scrollTop - before;
    pendingMove += moved;
    const arrived = Math.abs(distance - moved) <= SUBPIXEL_PX || moved === 0;
    if (arrived) {
      destination = undefined;
      following = options.isLive() && nearBottom(el);
    }
    return arrived;
  });

  function absorb(el: HTMLElement) {
    const moved = el.scrollTop - lastTop;
    const currentMax = maxScrollTop(el);
    const clampedByShrink =
      moved < 0 && currentMax < seenMaxTop && el.scrollTop >= currentMax - SUBPIXEL_PX;
    if (moved === 0 || clampedByShrink) return;
    shiftAnchors(anchors, moved);
    pendingMove += moved;
    target = undefined;
    destination = undefined;
    glide.stop();
    following =
      options.isLive() && el.scrollTop >= Math.min(seenMaxTop, currentMax) - BOTTOM_SLACK_PX;
  }

  function apply(el: HTMLElement) {
    const top = target && targetTop(el, target);
    if (top !== undefined) write(el, top);
    else if (following && options.isLive()) write(el, maxScrollTop(el));
    else write(el, el.scrollTop + anchorDrift(el, anchors));
    if (target && nearBottom(el) && options.isLive()) {
      following = true;
      target = undefined;
    }
  }

  function settle() {
    const el = scroller;
    if (!el) return;
    if (el.clientHeight === 0) {
      hidden = true;
      gesturing = false;
      return;
    }
    if (hidden) hidden = false;
    else absorb(el);
    if (!(glide.active() || gesturing)) apply(el);
    lastTop = el.scrollTop;
    if (!gesturing) anchors = captureAnchors(el);
    seenMaxTop = maxScrollTop(el);
    setAtBottom(nearBottom(el));
    setAtTop(el.scrollTop <= el.clientHeight / 2);
    setTopTs(anchors[0] && groupTs(anchors[0].group));
    const direction = scrollDirection(pendingMove);
    pendingMove = 0;
    options.onMove?.(direction);
  }

  function attach(el: HTMLElement) {
    scroller = el;
    el.style.overflowAnchor = "none";
    lastTop = el.scrollTop;
    const onScroll = () => {
      gesturing = true;
      settle();
    };
    const onScrollEnd = () => {
      gesturing = false;
      settle();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", onScrollEnd);
    const stopObserving = observeFeed(el, settle);
    onMount(() => onCleanup(observeComposerOverlay(el, settle)));
    onCleanup(() => {
      glide.stop();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", onScrollEnd);
      stopObserving();
      scroller = undefined;
    });
  }

  function reset() {
    landRun += 1;
    glide.stop();
    destination = undefined;
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
      glide.stop();
      destination = undefined;
      const missing = next.at !== "bottom" && !findGroup(el, next.ts);
      target = missing ? { at: "bottom" } : next;
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

  function moveTo(next: (el: HTMLElement) => number | undefined) {
    target = undefined;
    following = false;
    destination = next;
    glide.start();
  }

  function glideTo(ts: string) {
    const group = scroller && findGroup(scroller, ts);
    if (!group) return;
    flashGroup(group);
    moveTo((el) => alignedTop(el, ts, "center"));
  }

  return {
    atBottom,
    atTop,
    attach,
    element: () => scroller,
    glideTo,
    land,
    ready,
    reset,
    reveal: (ts: string) => moveTo((el) => revealTop(el, ts)),
    scrollEdge: (edge: "start" | "end") =>
      moveTo((el) => (edge === "start" ? 0 : maxScrollTop(el))),
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
