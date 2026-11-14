const GROUP = "message-row-group";
const DIVIDER = "message-divider";
const FLASH_CLASS = "message-flash";
const FLASH_MS = 1500;

export function feedGroups(scroller: HTMLElement) {
  return scroller.querySelectorAll<HTMLElement>(`:scope > .${GROUP}`);
}

export function groupTs(group: HTMLElement) {
  return group.querySelector<HTMLElement>("[data-message-ts]")?.dataset.messageTs;
}

export function findGroup(scroller: HTMLElement, ts: string) {
  const row = scroller.querySelector(`[data-message-ts="${CSS.escape(ts)}"]`);
  return row?.closest<HTMLElement>(`.${GROUP}`) ?? null;
}

export function leadOf(group: HTMLElement) {
  const previous = group.previousElementSibling;
  return previous instanceof HTMLElement && previous.classList.contains(DIVIDER) ? previous : group;
}

export function flashGroup(group: HTMLElement) {
  const row = group.querySelector<HTMLElement>("[data-message-ts]");
  if (!row) return;
  row.classList.add(FLASH_CLASS);
  setTimeout(() => row.classList.remove(FLASH_CLASS), FLASH_MS);
}
