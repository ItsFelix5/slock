import { defined } from "@slock/core";

export const CONTAINER_TOP = 120;

function rect(top: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left: 0,
    right: 0,
    toJSON: () => ({}),
    top,
    width: 0,
    x: 0,
    y: top,
  };
}

export function createScrollFeed(rowHeights: number[], viewportHeight: number) {
  const container = document.createElement("div");
  document.body.append(container);
  const heights = new Map<HTMLElement, number>();
  const rows: HTMLElement[] = [];
  let viewport = viewportHeight;
  let scrolled = 0;
  let nextId = 0;
  let writes = 0;

  const contentHeight = () => rows.reduce((sum, row) => sum + (heights.get(row) ?? 0), 0);
  const maxScroll = () => Math.max(0, contentHeight() - viewport);
  const clampScroll = () => {
    scrolled = Math.min(Math.max(0, scrolled), maxScroll());
  };

  Object.defineProperties(container, {
    clientHeight: { get: () => viewport },
    scrollHeight: { get: () => Math.max(contentHeight(), viewport) },
    scrollTop: {
      get: () => scrolled,
      set: (value: number) => {
        writes += 1;
        scrolled = value;
        clampScroll();
      },
    },
  });
  container.getBoundingClientRect = () => rect(CONTAINER_TOP, viewport);

  function makeRow(height: number) {
    const group = document.createElement("div");
    group.className = "message-row-group";
    const row = document.createElement("div");
    row.dataset.messageTs = String(nextId++);
    group.append(row);
    heights.set(group, height);
    group.getBoundingClientRect = () => {
      const index = rows.indexOf(group);
      if (index < 0) return rect(0, 0);
      const above = rows
        .slice(0, index)
        .reduce((sum, earlier) => sum + (heights.get(earlier) ?? 0), 0);
      return rect(CONTAINER_TOP + above - scrolled, height);
    };
    return group;
  }

  const feed = {
    append(newHeights: number[]) {
      const added = newHeights.map(makeRow);
      rows.push(...added);
      container.append(...added);
    },
    container,
    contentHeight,
    writes: () => writes,
    offsetOf: (row: HTMLElement) => row.getBoundingClientRect().top - CONTAINER_TOP,
    prepend(newHeights: number[]) {
      const added = newHeights.map(makeRow);
      rows.unshift(...added);
      container.prepend(...added);
    },
    remove(row: HTMLElement) {
      rows.splice(rows.indexOf(row), 1);
      row.remove();
      clampScroll();
    },
    resize(height: number) {
      viewport = height;
      clampScroll();
    },
    rows: () => [...rows],
    setHeight(index: number, height: number) {
      heights.set(defined(rows[index]), height);
      clampScroll();
    },
  };
  feed.append(rowHeights);
  return feed;
}
