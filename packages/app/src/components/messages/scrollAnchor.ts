const FLASH_MS = 1500;

interface ScrollAnchor {
  el: HTMLElement;
  offset: number;
}

export interface RememberedScrollAnchor {
  offset: number;
  ts: string;
}

const rememberedAnchors = new Map<string, RememberedScrollAnchor>();

export function rememberScrollAnchor(viewId: string, anchor: RememberedScrollAnchor) {
  rememberedAnchors.set(viewId, anchor);
}

export function getRememberedScrollAnchor(viewId: string): RememberedScrollAnchor | undefined {
  return rememberedAnchors.get(viewId);
}

const BOTTOM_EPSILON_PX = 2;
const FLASH_RENDER_TIMEOUT_MS = 2000;

export function isScrolledToBottom(container: HTMLElement, thresholdPx = BOTTOM_EPSILON_PX) {
  return container.scrollHeight - container.scrollTop - container.clientHeight <= thresholdPx;
}

export function scrollToBottom(container: HTMLElement) {
  container.scrollTop = container.scrollHeight;
}

function findTopAnchor(container: HTMLElement): ScrollAnchor | null {
  const containerTop = container.getBoundingClientRect().top;
  const rows = container.querySelectorAll<HTMLElement>("[data-message-ts]");
  let low = 0;
  let high = rows.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (rows[mid].getBoundingClientRect().bottom > containerTop) high = mid;
    else low = mid + 1;
  }
  const row = rows[low];
  return row ? { el: row, offset: row.getBoundingClientRect().top - containerTop } : null;
}

function findBottomAnchor(container: HTMLElement): ScrollAnchor | null {
  const { bottom: containerBottom, top: containerTop } = container.getBoundingClientRect();
  const rows = [...container.querySelectorAll<HTMLElement>("[data-message-ts]")];
  const row = rows.findLast((candidate) => candidate.getBoundingClientRect().top < containerBottom);
  return row ? { el: row, offset: row.getBoundingClientRect().top - containerTop } : null;
}

export function captureScrollAnchor(
  container: HTMLElement,
  edge: "bottom" | "top" = "top",
): ScrollAnchor | null {
  return edge === "top" ? findTopAnchor(container) : findBottomAnchor(container);
}

export function restoreScrollAnchor(container: HTMLElement, anchor: ScrollAnchor | null) {
  if (!anchor) return;
  const containerTop = container.getBoundingClientRect().top;
  const newOffset = anchor.el.getBoundingClientRect().top - containerTop;
  container.scrollTop += newOffset - anchor.offset;
}

export function flashMessageElement(el: HTMLElement) {
  el.classList.add("message-flash");
  const timer = setTimeout(() => el.classList.remove("message-flash"), FLASH_MS);
  return () => {
    clearTimeout(timer);
    el.classList.remove("message-flash");
  };
}

export function waitForMessageElement(
  container: HTMLElement,
  ts: string,
  onFound: (element: HTMLElement) => void,
): () => void {
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
  const tryFind = () => {
    if (stopped) return false;
    const element = container.querySelector<HTMLElement>(selector);
    if (!element) return false;
    onFound(element);
    stop();
    return true;
  };

  if (tryFind()) return stop;
  observer = new MutationObserver(tryFind);
  observer.observe(container, { childList: true, subtree: true });
  timeout = setTimeout(stop, FLASH_RENDER_TIMEOUT_MS);
  return stop;
}

export function jumpToMessageInContainer(container: HTMLElement, ts: string) {
  const el = container.querySelector<HTMLElement>(`[data-message-ts="${CSS.escape(ts)}"]`);
  if (!el) return () => {};
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const stopFlash = flashMessageElement(el);
  return stopFlash;
}
