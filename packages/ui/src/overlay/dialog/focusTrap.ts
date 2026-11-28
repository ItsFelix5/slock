const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex^='-'])",
].join(",");

export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) =>
      !element.hidden &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden",
  );
}

export function tabWrapTarget(
  position: number | "outside",
  count: number,
  backwards: boolean,
): "first" | "last" | undefined {
  if (count === 0) return;
  if (position === "outside") return backwards ? "last" : "first";
  if (backwards) return position === 0 ? "last" : undefined;
  return position === count - 1 ? "first" : undefined;
}

export function captureFocus() {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return (allowed: () => boolean = () => true) =>
    queueMicrotask(() => {
      const active = document.activeElement;
      if (active !== document.body && active?.isConnected) return;
      if (previous?.isConnected && allowed()) previous.focus({ preventScroll: true });
    });
}
