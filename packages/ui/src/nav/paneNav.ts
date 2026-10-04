import { type ListDirection, listNavigationIndex, rovingTabIndex } from "../form/listNavigation";
import { useListShortcuts } from "../useNavShortcuts";
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

let focusGeneration = 0;
const ROVING_ROW_SELECTOR = '[data-message-ts][tabindex="0"]';
const ROVING_ROW_WAIT_MS = 2000;

function focusFallbackTarget(pane: HTMLElement) {
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

function waitForRovingRow(pane: HTMLElement) {
  const generation = focusGeneration;
  let observer: MutationObserver | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    observer?.disconnect();
    clearTimeout(timeout);
  };
  const tryFind = () => {
    if (generation !== focusGeneration) {
      stop();
      return true;
    }
    const row = pane.querySelector<HTMLElement>(ROVING_ROW_SELECTOR);
    if (!row) return false;
    row.focus();
    stop();
    return true;
  };
  if (tryFind()) return;
  observer = new MutationObserver(tryFind);
  observer.observe(pane, { childList: true, subtree: true });
  timeout = setTimeout(() => {
    stop();
    if (generation === focusGeneration) focusFallbackTarget(pane);
  }, ROVING_ROW_WAIT_MS);
}

function focusPaneEntry(pane: HTMLElement) {
  focusGeneration++;
  const rows = paneRows(pane);
  if (rows.length > 0) {
    const remembered = lastRowIndex.get(pane.dataset.pane ?? "") ?? 0;
    rows[Math.min(remembered, rows.length - 1)]?.focus();
    return;
  }

  const rovingMessageListRow = pane.querySelector<HTMLElement>(ROVING_ROW_SELECTOR);
  if (rovingMessageListRow) {
    rovingMessageListRow.focus();
    return;
  }

  if (pane.querySelector(".message-list")) {
    waitForRovingRow(pane);
    return;
  }

  focusFallbackTarget(pane);
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

function moveListItem(direction: ListDirection) {
  const pane = activePane();
  if (!pane) return;
  const rows = paneRows(pane);
  const current = focusedRowIndex(rows);
  const next = listNavigationIndex(direction, current < 0 ? null : current, rows.length);
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
  useListShortcuts({ enabled: listRowEnabled, move: moveListItem });

  const paneEnabled = () => !!document.activeElement?.closest(PANE_SELECTOR);
  useShortcut({
    allowRepeat: false,
    combo: { key: "ArrowLeft" },
    enabled: paneEnabled,
    handler: () => movePane(-1),
    id: "nav.paneLeft",
    label: "Switch to the pane on the left",
    scope: "general",
    group: "Panes",
  });
  useShortcut({
    allowRepeat: false,
    combo: { key: "ArrowRight" },
    enabled: paneEnabled,
    handler: () => movePane(1),
    id: "nav.paneRight",
    label: "Switch to the pane on the right",
    scope: "general",
    group: "Panes",
  });
}
