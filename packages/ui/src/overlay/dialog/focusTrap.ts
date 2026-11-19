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

const layers: object[] = [];

export function pushFocusLayer(): object {
  const layer = {};
  layers.push(layer);
  return layer;
}

export function isTopFocusLayer(layer: object | undefined): boolean {
  return layers.at(-1) === layer;
}

export function popFocusLayer(layer: object): {
  wasTop: boolean;
  revealed: object | undefined;
} {
  const wasTop = isTopFocusLayer(layer);
  const index = layers.indexOf(layer);
  if (index >= 0) layers.splice(index, 1);
  return { wasTop, revealed: layers.at(-1) };
}

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
