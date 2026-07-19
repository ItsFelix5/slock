const FLASH_MS = 1500;

interface ScrollAnchor {
  el: HTMLElement;
  offset: number;
}

/** Topmost message row still (partially) below the container's visible top —
 * the row a reader's eye is actually on, used to keep that spot stable across
 * a layout change instead of leaving scrollTop as a raw pixel offset. */
function findTopAnchor(container: HTMLElement): ScrollAnchor | null {
  const containerTop = container.getBoundingClientRect().top;
  for (const row of container.querySelectorAll<HTMLElement>("[data-message-ts]")) {
    const rect = row.getBoundingClientRect();
    if (rect.bottom > containerTop) return { el: row, offset: rect.top - containerTop };
  }
  return null;
}

export function captureScrollAnchor(container: HTMLElement): ScrollAnchor | null {
  return findTopAnchor(container);
}

/** Re-pins `anchor` to the viewport offset it had when captured. Call after a
 * layout-affecting change (e.g. a panel width resize reflowing message text)
 * so the reader's spot doesn't silently drift. */
export function restoreScrollAnchor(container: HTMLElement, anchor: ScrollAnchor | null) {
  if (!anchor) return;
  const containerTop = container.getBoundingClientRect().top;
  const newOffset = anchor.el.getBoundingClientRect().top - containerTop;
  container.scrollTop += newOffset - anchor.offset;
}

/** Scrolls to a message and flashes it, then keeps it centered for a short
 * window afterward. Attachments (images, files) often resolve their real
 * height a beat after the message renders, which would otherwise nudge the
 * target out of view right after landing on it. */
export function jumpToMessageInContainer(container: HTMLElement, ts: string) {
  const el = container.querySelector<HTMLElement>(`[data-message-ts="${CSS.escape(ts)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("message-flash");

  const resizeObserver = new ResizeObserver(() => el.scrollIntoView({ block: "center" }));
  for (const row of container.querySelectorAll<HTMLElement>("[data-message-ts]"))
    resizeObserver.observe(row);

  setTimeout(() => {
    resizeObserver.disconnect();
    el.classList.remove("message-flash");
  }, FLASH_MS);
}
