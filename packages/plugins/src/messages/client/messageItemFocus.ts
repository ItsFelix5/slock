const ITEMS = 'a[href], button:not(:disabled), [role="button"], [tabindex="0"]';

function itemsOf(row: HTMLElement) {
  return [...row.querySelectorAll<HTMLElement>(`.message-body :is(${ITEMS})`)].filter(
    (item) => !item.closest(".message-meta") && item.getClientRects().length > 0,
  );
}

export function stepMessageItem(row: Element | null | undefined, delta: 1 | -1) {
  if (!(row instanceof HTMLElement)) return;
  const items = itemsOf(row);
  const current = items.findIndex((item) => item.contains(document.activeElement));
  const next = current + delta;
  if (next < 0) row.focus();
  else items[Math.min(next, items.length - 1)]?.focus();
}
