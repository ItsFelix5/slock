export const FLASH_MS = 1500;

interface ScrollAnchor {
  el: HTMLElement;
  offset: number;
}

const BOTTOM_EPSILON_PX = 2;
const FLASH_RENDER_TIMEOUT_MS = 2000;

export function isScrolledToBottom(container: HTMLElement, thresholdPx = BOTTOM_EPSILON_PX) {
  return container.scrollHeight - container.scrollTop - container.clientHeight <= thresholdPx;
}

export function scrollToBottom(container: HTMLElement) {
  container.scrollTop = container.scrollHeight;
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

/** Briefly highlights a "jumped to" message, e.g. after a reply-reference
 * click, then removes the highlight. Shared by jumpToMessageInContainer
 * below (ThreadPanel's plain, unwindowed render) and MessageList.tsx's own
 * virtualizer-based jump (which finds the element itself once
 * virtualizer.scrollToIndex has brought it into the rendered window). */
export function flashMessageElement(el: HTMLElement) {
  el.classList.add("message-flash");
  const timer = setTimeout(() => el.classList.remove("message-flash"), FLASH_MS);
  return () => {
    clearTimeout(timer);
    el.classList.remove("message-flash");
  };
}

/** Waits for a virtualized row to enter the DOM before highlighting it.
 * Returns a cancellation function so a channel switch cannot flash a row
 * from the conversation that replaced the original target. */
export function flashMessageWhenRendered(container: HTMLElement, ts: string): () => void {
  let observer: MutationObserver | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const selector = `[data-message-ts="${CSS.escape(ts)}"]`;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    observer?.disconnect();
    clearTimeout(timeout);
  };
  const tryFlash = () => {
    if (stopped) return false;
    const element = container.querySelector<HTMLElement>(selector);
    if (!element) return false;
    flashMessageElement(element);
    stop();
    return true;
  };

  if (tryFlash()) return stop;
  observer = new MutationObserver(tryFlash);
  observer.observe(container, { childList: true, subtree: true });
  timeout = setTimeout(stop, FLASH_RENDER_TIMEOUT_MS);
  return stop;
}

/** Scrolls to a message and flashes it, then keeps it centered for a short
 * window afterward. Attachments (images, files) often resolve their real
 * height a beat after the message renders, which would otherwise nudge the
 * target out of view right after landing on it. Only used by the
 * non-virtualized render path (ThreadPanel) — the virtualized channel view
 * uses virtualizer.scrollToIndex instead (see MessageList.tsx), which
 * already keeps a smooth-scroll target aligned as nearby rows resize. */
export function jumpToMessageInContainer(container: HTMLElement, ts: string) {
  const el = container.querySelector<HTMLElement>(`[data-message-ts="${CSS.escape(ts)}"]`);
  if (!el) return () => {};
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const stopFlash = flashMessageElement(el);

  const resizeObserver = new ResizeObserver(() => el.scrollIntoView({ block: "center" }));
  for (const row of container.querySelectorAll<HTMLElement>("[data-message-ts]"))
    resizeObserver.observe(row);

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    resizeObserver.disconnect();
    stopFlash();
  };
  timer = setTimeout(stop, FLASH_MS);
  return stop;
}
