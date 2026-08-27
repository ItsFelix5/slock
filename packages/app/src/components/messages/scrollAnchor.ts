const FLASH_MS = 1500;

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

export function restoreScrollAnchor(container: HTMLElement, anchor: ScrollAnchor | null) {
  if (!anchor) return;
  const containerTop = container.getBoundingClientRect().top;
  const newOffset = anchor.el.getBoundingClientRect().top - containerTop;
  container.scrollTop += newOffset - anchor.offset;
}

function flashMessageElement(el: HTMLElement) {
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
