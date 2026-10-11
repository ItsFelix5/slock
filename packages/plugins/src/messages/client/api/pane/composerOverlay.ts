import { scrollToBottom } from "./scrollAnchor";

const COMPOSER_OVERLAY_SELECTOR = ":scope > .composer-overlay";
const COMPOSER_OVERLAY_HEIGHT_VAR = "--composer-overlay-h";

export function observeComposerOverlay(
  scrollEl: HTMLElement,
  shouldFollowBottom: () => boolean,
): () => void {
  const parent = scrollEl.parentElement;
  if (!parent) return () => {};

  let resizeObserver: ResizeObserver | undefined;
  let currentOverlay: HTMLElement | null = null;

  const update = () => {
    if (!currentOverlay) return;
    parent.style.setProperty(COMPOSER_OVERLAY_HEIGHT_VAR, `${currentOverlay.offsetHeight}px`);
    if (shouldFollowBottom()) scrollToBottom(scrollEl);
  };

  const sync = () => {
    const overlay = parent.querySelector<HTMLElement>(COMPOSER_OVERLAY_SELECTOR);
    if (overlay === currentOverlay) return;
    resizeObserver?.disconnect();
    currentOverlay = overlay;
    if (!overlay) {
      parent.style.setProperty(COMPOSER_OVERLAY_HEIGHT_VAR, "0px");
      if (shouldFollowBottom()) scrollToBottom(scrollEl);
      return;
    }
    resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(overlay);
    update();
  };

  sync();
  const mutationObserver = new MutationObserver(sync);
  mutationObserver.observe(parent, { childList: true });

  return () => {
    mutationObserver.disconnect();
    resizeObserver?.disconnect();
  };
}
