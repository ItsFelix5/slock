const MESSAGE_CONTENT_ELEMENT_SELECTOR =
  "a, button, input, textarea, select, img, video, audio, canvas, svg, iframe, object, embed";

function rectContainsPoint(rect: DOMRect, x: number, y: number) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function pointIntersectsText(root: HTMLElement, x: number, y: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node = walker.nextNode();
  while (node) {
    if (node.textContent?.trim()) {
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      for (let index = 0; index < rects.length; index += 1) {
        if (rectContainsPoint(rects[index], x, y)) return true;
      }
    }
    node = walker.nextNode();
  }
  return false;
}

function hasVisibleBox(element: Element) {
  const style = getComputedStyle(element);
  const hasBackground =
    style.backgroundImage !== "none" ||
    (style.backgroundColor !== "transparent" && style.backgroundColor !== "rgba(0, 0, 0, 0)");
  const hasBorder =
    (style.borderTopStyle !== "none" && Number.parseFloat(style.borderTopWidth) > 0) ||
    (style.borderRightStyle !== "none" && Number.parseFloat(style.borderRightWidth) > 0) ||
    (style.borderBottomStyle !== "none" && Number.parseFloat(style.borderBottomWidth) > 0) ||
    (style.borderLeftStyle !== "none" && Number.parseFloat(style.borderLeftWidth) > 0);
  return hasBackground || hasBorder || style.boxShadow !== "none";
}

export function isMessageBackgroundContextMenu(
  event: MouseEvent & { currentTarget: HTMLDivElement },
) {
  const { currentTarget, target } = event;
  if (!(target instanceof Element)) return false;

  const contentElement = target.closest(MESSAGE_CONTENT_ELEMENT_SELECTOR);
  if (contentElement && currentTarget.contains(contentElement)) return false;
  if (pointIntersectsText(currentTarget, event.clientX, event.clientY)) return false;

  let element: Element | null = target;
  while (element && element !== currentTarget) {
    if (hasVisibleBox(element)) return false;
    element = element.parentElement;
  }
  return true;
}
