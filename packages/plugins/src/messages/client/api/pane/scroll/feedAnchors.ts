import { defined } from "@slock/core";
import { firstIndexWhere } from "../../../lib/scrollMath";
import { feedGroups } from "./feedDom";

export interface FeedAnchor {
  group: HTMLElement;
  offset: number;
}

const ANCHOR_COUNT = 4;

export function captureAnchors(scroller: HTMLElement): FeedAnchor[] {
  const { top } = scroller.getBoundingClientRect();
  const groups = feedGroups(scroller);
  const first = firstIndexWhere(
    groups.length,
    (i) => defined(groups[i]).getBoundingClientRect().bottom > top,
  );
  const anchors: FeedAnchor[] = [];
  for (let i = first; i < Math.min(groups.length, first + ANCHOR_COUNT); i++) {
    const group = defined(groups[i]);
    anchors.push({ group, offset: group.getBoundingClientRect().top - top });
  }
  return anchors;
}

export function anchorDrift(scroller: HTMLElement, anchors: FeedAnchor[]) {
  const anchor = anchors.find((candidate) => candidate.group.isConnected);
  if (!anchor) return 0;
  return (
    anchor.group.getBoundingClientRect().top - scroller.getBoundingClientRect().top - anchor.offset
  );
}

export function shiftAnchors(anchors: FeedAnchor[], scrolled: number) {
  for (const anchor of anchors) anchor.offset -= scrolled;
}
