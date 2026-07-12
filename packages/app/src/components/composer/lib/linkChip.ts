// Composer-side representation of a link: a plain, still-editable <span>
// while its display text matches the URL (so you can keep typing/backspacing
// through it like normal text), promoted to a non-editable chip — the same
// pattern as the @mention/#channel chips in richtext.ts — the moment its
// display text is customized to something else via ComposeLinkEditor, since
// text and label can no longer stay in sync once they differ.
export function createLinkSpan(url: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "composer-link";
  span.dataset.linkUrl = url;
  span.textContent = url;
  return span;
}

export function createLinkChip(url: string, label: string): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className = "composer-chip composer-link-chip";
  chip.contentEditable = "false";
  chip.dataset.linkUrl = url;
  chip.textContent = label;
  return chip;
}

export function serializeLinkElement(el: HTMLElement): string {
  const url = el.dataset.linkUrl ?? "";
  if (el.classList.contains("composer-link-chip")) {
    const label = (el.textContent ?? "").replace(/\|/g, "");
    return label && label !== url ? `<${url}|${label}>` : `<${url}>`;
  }
  return `<${(el.textContent ?? url).replace(/\|/g, "")}>`;
}

export function replaceLinkElement(el: HTMLElement, url: string, label: string): HTMLElement {
  const next = label && label !== url ? createLinkChip(url, label) : createLinkSpan(url);
  el.replaceWith(next);
  return next;
}

export function unlinkElement(el: HTMLElement): Text {
  const text = document.createTextNode(el.dataset.linkUrl ?? el.textContent ?? "");
  el.replaceWith(text);
  return text;
}
