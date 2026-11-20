import { findGroup, leadOf } from "./feedDom";

export const maxScrollTop = (scroller: HTMLElement) =>
  Math.max(0, scroller.scrollHeight - scroller.clientHeight);

const contentTop = (scroller: HTMLElement, node: HTMLElement) =>
  scroller.scrollTop + node.getBoundingClientRect().top - scroller.getBoundingClientRect().top;

export function alignedTop(scroller: HTMLElement, ts: string, align: "start" | "center") {
  const group = findGroup(scroller, ts);
  if (!group) return;
  const { height } = group.getBoundingClientRect();
  if (align === "center" && height < scroller.clientHeight)
    return contentTop(scroller, group) - (scroller.clientHeight - height) / 2;
  return contentTop(scroller, leadOf(group));
}

export function offsetTop(scroller: HTMLElement, ts: string, offset: number) {
  const group = findGroup(scroller, ts);
  return group ? contentTop(scroller, group) - offset : undefined;
}

export function revealTop(scroller: HTMLElement, ts: string) {
  const group = findGroup(scroller, ts);
  if (!group) return;
  const top = contentTop(scroller, group);
  const bottom = top + group.getBoundingClientRect().height;
  const inset = Number.parseFloat(getComputedStyle(scroller).paddingBottom) || 0;
  const visibleBottom = scroller.scrollTop + scroller.clientHeight - inset;
  const above = top < scroller.scrollTop;
  const below = bottom > visibleBottom;
  if (above && below) return scroller.scrollTop;
  if (above) return top;
  return below ? Math.min(top, scroller.scrollTop + bottom - visibleBottom) : scroller.scrollTop;
}
