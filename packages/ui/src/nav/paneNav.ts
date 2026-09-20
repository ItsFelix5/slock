import { listNavigationIndex, rovingTabIndex } from "../form/listNavigation";
import { useShortcut } from "../useShortcut";

const PANE_SELECTOR = "[data-pane]";

function paneRows(pane: Element): HTMLElement[] {
  return [...pane.querySelectorAll<HTMLElement>("[data-nav-row]:not([disabled])")];
}

function activePane(): HTMLElement | null {
  return document.activeElement?.closest<HTMLElement>(PANE_SELECTOR) ?? null;
}

const lastRowIndex = new Map<string, number>();

function isHeaderOrComposerElement(el: HTMLElement): boolean {
  return !!(
    el.closest(".panel-header-wrap") ||
    el.closest(".channel-header") ||
    el.closest(".composer")
  );
}

function focusPaneEntry(pane: HTMLElement) {
  const rows = paneRows(pane);
  if (rows.length > 0) {
    const remembered = lastRowIndex.get(pane.dataset.pane ?? "") ?? 0;
    rows[Math.min(remembered, rows.length - 1)]?.focus();
    return;
  }

  const rovingMessageListRow = pane.querySelector<HTMLElement>('[data-message-ts][tabindex="0"]');
  if (rovingMessageListRow) {
    rovingMessageListRow.focus();
    return;
  }

  const rovingTarget = [...pane.querySelectorAll<HTMLElement>('[tabindex="0"]')].find(
    (el) => !isHeaderOrComposerElement(el),
  );
  if (rovingTarget) {
    rovingTarget.focus();
    return;
  }

  const focusableExcludingOptedOut =
    'button:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';
  const candidates = [...pane.querySelectorAll<HTMLElement>(focusableExcludingOptedOut)];
  const bodyTarget = candidates.find((el) => !isHeaderOrComposerElement(el));
  (bodyTarget ?? candidates[0])?.focus();
}

export function paneElementById(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-pane="${CSS.escape(id)}"]`);
}

export function focusPaneById(id: string): boolean {
  const pane = paneElementById(id);
  if (!pane) return false;
  focusPaneEntry(pane);
  return true;
}

export function paneRowsById(id: string): HTMLElement[] {
  const pane = paneElementById(id);
  return pane ? paneRows(pane) : [];
}

function focusedRowIndex(rows: HTMLElement[]): number {
  const el = document.activeElement;
  return el instanceof HTMLElement ? rows.indexOf(el) : -1;
}

function moveListItem(key: "ArrowDown" | "ArrowUp" | "Home" | "End") {
  const pane = activePane();
  if (!pane) return;
  const rows = paneRows(pane);
  const current = focusedRowIndex(rows);
  const next = listNavigationIndex(key, current < 0 ? null : current, rows.length);
  if (next === undefined) return;
  rovingTabIndex(rows, next);
  const target = rows[next];
  target?.focus();
  target?.scrollIntoView({ block: "nearest" });
}

function hiddenTabStripNeighbor(pane: HTMLElement, direction: -1 | 1): HTMLElement | null {
  const tablist = pane.closest(".pane-row-tabbed")?.querySelector<HTMLElement>('[role="tablist"]');
  if (!tablist) return null;
  const tabs = [...tablist.querySelectorAll<HTMLElement>('[role="tab"]')];
  const current = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
  return current < 0 ? null : (tabs[current + direction] ?? null);
}

function movePane(direction: -1 | 1) {
  const current = activePane();
  if (!current) return;
  const tabTarget = hiddenTabStripNeighbor(current, direction);
  if (tabTarget) {
    tabTarget.click();
    return;
  }
  const panes = [...document.querySelectorAll<HTMLElement>(PANE_SELECTOR)];
  const currentIndex = panes.indexOf(current);
  if (currentIndex < 0) return;
  const target = panes[currentIndex + direction];
  if (!target) return;
  const rows = paneRows(current);
  const index = focusedRowIndex(rows);
  if (index >= 0) lastRowIndex.set(current.dataset.pane ?? "", index);
  focusPaneEntry(target);
}

export function usePaneNavigation() {
  const listRowEnabled = () => !!document.activeElement?.closest("[data-nav-row]");
  useShortcut({
    allowRepeat: true,
    combo: { key: "ArrowDown" },
    enabled: listRowEnabled,
    handler: () => moveListItem("ArrowDown"),
    id: "nav.listNext",
    label: "Move to the next list item (activity, saved, pinned, files…)",
    scope: "general",
  });
  useShortcut({
    allowRepeat: true,
    combo: { key: "ArrowUp" },
    enabled: listRowEnabled,
    handler: () => moveListItem("ArrowUp"),
    id: "nav.listPrev",
    label: "Move to the previous list item (activity, saved, pinned, files…)",
    scope: "general",
  });
  useShortcut({
    allowRepeat: true,
    combo: { key: "Home" },
    enabled: listRowEnabled,
    handler: () => moveListItem("Home"),
    id: "nav.listHome",
    label: "Jump to the first list item",
    scope: "general",
  });
  useShortcut({
    allowRepeat: true,
    combo: { key: "End" },
    enabled: listRowEnabled,
    handler: () => moveListItem("End"),
    id: "nav.listEnd",
    label: "Jump to the last list item",
    scope: "general",
  });

  const paneEnabled = () => !!document.activeElement?.closest(PANE_SELECTOR);
  useShortcut({
    allowRepeat: false,
    combo: { key: "ArrowLeft" },
    enabled: paneEnabled,
    handler: () => movePane(-1),
    id: "nav.paneLeft",
    label: "Switch to the pane on the left (sidebar, messages, details)",
    scope: "general",
  });
  useShortcut({
    allowRepeat: false,
    combo: { key: "ArrowRight" },
    enabled: paneEnabled,
    handler: () => movePane(1),
    id: "nav.paneRight",
    label: "Switch to the pane on the right (sidebar, messages, details)",
    scope: "general",
  });
}
