import { defined } from "@slock/core";
import { distanceFromBottom, firstIndexWhere } from "../../lib/scrollMath";

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

export function forgetScrollAnchors() {
  rememberedAnchors.clear();
}

export function rememberScrollAnchor(viewId: string, anchor: RememberedScrollAnchor) {
  rememberedAnchors.set(viewId, anchor);
}

export function getRememberedScrollAnchor(viewId: string): RememberedScrollAnchor | undefined {
  return rememberedAnchors.get(viewId);
}

const BOTTOM_EPSILON_PX = 2;
const FLASH_RENDER_TIMEOUT_MS = 2000;

export function isScrolledToBottom(container: HTMLElement, thresholdPx = BOTTOM_EPSILON_PX) {
  return distanceFromBottom(container) <= thresholdPx;
}

export function scrollToBottom(container: HTMLElement) {
  container.scrollTop = container.scrollHeight;
}

function anchorAt(
  rows: NodeListOf<HTMLElement>,
  index: number,
  containerTop: number,
): ScrollAnchor | null {
  const row = rows[index];
  return row ? { el: row, offset: row.getBoundingClientRect().top - containerTop } : null;
}

function findTopAnchor(container: HTMLElement): ScrollAnchor | null {
  const containerTop = container.getBoundingClientRect().top;
  const rows = container.querySelectorAll<HTMLElement>("[data-message-ts]");
  const index = firstIndexWhere(
    rows.length,
    (i) => defined(rows[i]).getBoundingClientRect().bottom > containerTop,
  );
  return anchorAt(rows, index, containerTop);
}

function findBottomAnchor(container: HTMLElement): ScrollAnchor | null {
  const { bottom: containerBottom, top: containerTop } = container.getBoundingClientRect();
  const rows = container.querySelectorAll<HTMLElement>("[data-message-ts]");
  const firstBelow = firstIndexWhere(
    rows.length,
    (i) => defined(rows[i]).getBoundingClientRect().top >= containerBottom,
  );
  return anchorAt(rows, firstBelow - 1, containerTop);
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

export function correctScrollAfterContentChange(
  container: HTMLElement,
  followBottom: boolean,
  anchor: ScrollAnchor | null,
) {
  if (followBottom) scrollToBottom(container);
  else if (anchor?.el.isConnected) restoreScrollAnchor(container, anchor);
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

const PIN_MS = 1500;

export function pinToRow(
  container: HTMLElement,
  isStale: () => boolean,
  pin: () => void,
  onStop: () => void,
) {
  const observer = new ResizeObserver(() => {
    if (isStale()) stop();
    else pin();
  });
  const timer = setTimeout(stop, PIN_MS);
  function stop() {
    clearTimeout(timer);
    observer.disconnect();
    onStop();
  }
  observer.observe(container);
  for (const child of container.children) observer.observe(child);
  return stop;
}

export function landOnMessageInContainer(container: HTMLElement, ts: string) {
  const el = container.querySelector<HTMLElement>(`[data-message-ts="${CSS.escape(ts)}"]`);
  if (!el) return () => {};
  const pin = () => el.scrollIntoView({ block: "center" });
  pin();
  const stopPinning = pinToRow(
    container,
    () => false,
    pin,
    () => {},
  );
  const stopFlash = flashMessageElement(el);
  return () => {
    stopPinning();
    stopFlash();
  };
}

export function jumpToMessageInContainer(container: HTMLElement, ts: string) {
  const el = container.querySelector<HTMLElement>(`[data-message-ts="${CSS.escape(ts)}"]`);
  if (!el) return () => {};
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const stopFlash = flashMessageElement(el);
  return stopFlash;
}
