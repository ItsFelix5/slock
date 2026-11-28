import type { Env, TimerHandle } from "@slock/core";
import { service } from "@slock/core/solid";
import { type ListDirection, listNavigationIndex, rovingTabIndex } from "../form/listNavigation";
import { isTypingTarget } from "../hooks/shortcutRegistry";
import { useListShortcuts } from "../hooks/useNavShortcuts";
import { useShortcut } from "../hooks/useShortcut";

const ui = service("ui");
const PANE_SELECTOR = "[data-pane]";
const ROVING_ROW_SELECTOR = '[data-message-ts][tabindex="0"]';
const COMPOSER_SELECTOR = '.composer [contenteditable="true"]';
const ENTRY_WAIT_MS = 2000;

export type PaneEntry = "composer";

function focusEntryTarget(el: HTMLElement) {
  el.focus({ preventScroll: !!el.closest(".message-list") });
}

function paneRows(pane: Element): HTMLElement[] {
  return [...pane.querySelectorAll<HTMLElement>("[data-nav-row]:not([disabled])")];
}

function activePane(): HTMLElement | null {
  return document.activeElement?.closest<HTMLElement>(PANE_SELECTOR) ?? null;
}

function isHeaderOrComposerElement(el: HTMLElement): boolean {
  return !!(
    el.closest(".panel-header-wrap") ||
    el.closest(".channel-header") ||
    el.closest(".composer")
  );
}

function focusFallbackTarget(pane: HTMLElement) {
  const rovingTarget = [...pane.querySelectorAll<HTMLElement>('[tabindex="0"]')].find(
    (el) => !isHeaderOrComposerElement(el),
  );
  if (rovingTarget) {
    focusEntryTarget(rovingTarget);
    return;
  }

  const focusableExcludingOptedOut =
    'button:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';
  const candidates = [...pane.querySelectorAll<HTMLElement>(focusableExcludingOptedOut)];
  const bodyTarget = candidates.find((el) => !isHeaderOrComposerElement(el));
  const target = bodyTarget ?? candidates[0];
  if (target) focusEntryTarget(target);
}

function paneElementById(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-pane="${CSS.escape(id)}"]`);
}

function typingIn(pane: Element): boolean {
  const el = document.activeElement;
  return pane.contains(el) && isTypingTarget(el);
}

export const isTypingInPane = (id: string): boolean => {
  const pane = paneElementById(id);
  return !!pane && typingIn(pane);
};

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

export function createPaneNav(env: Env) {
  const lastRowIndex = new Map<string, number>();
  let focusGeneration = 0;

  function focusWhenReady(pane: HTMLElement, selector: string) {
    const generation = focusGeneration;
    const initial = document.activeElement;
    const superseded = () =>
      generation !== focusGeneration || (document.activeElement !== initial && typingIn(pane));
    let observer: MutationObserver | undefined;
    let timeout: TimerHandle | undefined;
    const stop = () => {
      observer?.disconnect();
      env.clearTimeout(timeout);
    };
    const tryFind = () => {
      if (superseded()) {
        stop();
        return true;
      }
      const target = pane.querySelector<HTMLElement>(selector);
      if (!target) return false;
      focusEntryTarget(target);
      stop();
      return true;
    };
    if (tryFind()) return;
    observer = new MutationObserver(tryFind);
    observer.observe(pane, { childList: true, subtree: true });
    timeout = env.setTimeout(() => {
      stop();
      if (!superseded()) focusFallbackTarget(pane);
    }, ENTRY_WAIT_MS);
  }

  function focusEntry(pane: HTMLElement) {
    focusGeneration++;
    const rows = paneRows(pane);
    if (rows.length > 0) {
      const remembered = lastRowIndex.get(pane.dataset.pane ?? "") ?? 0;
      const row = rows[Math.min(remembered, rows.length - 1)];
      if (row) focusEntryTarget(row);
      return;
    }

    const rovingMessageListRow = pane.querySelector<HTMLElement>(ROVING_ROW_SELECTOR);
    if (rovingMessageListRow) {
      focusEntryTarget(rovingMessageListRow);
      return;
    }

    if (pane.querySelector(".message-list")) {
      focusWhenReady(pane, ROVING_ROW_SELECTOR);
      return;
    }

    focusFallbackTarget(pane);
  }

  return {
    focusById(id: string, entry?: PaneEntry): boolean {
      const pane = paneElementById(id);
      if (!pane) return false;
      if (entry === "composer") {
        focusGeneration++;
        focusWhenReady(pane, COMPOSER_SELECTOR);
      } else focusEntry(pane);
      return true;
    },
    movePane(direction: -1 | 1) {
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
      const index = focusedRowIndex(paneRows(current));
      if (index >= 0) lastRowIndex.set(current.dataset.pane ?? "", index);
      focusEntry(target);
    },
  };
}

export const focusPaneById = (id: string, entry?: PaneEntry): boolean =>
  ui.paneNav.focusById(id, entry);

export function usePaneNavigation() {
  const listRowEnabled = () => !!document.activeElement?.closest("[data-nav-row]");
  useListShortcuts({ enabled: listRowEnabled, move: moveListItem });

  const paneEnabled = () => !!document.activeElement?.closest(PANE_SELECTOR);
  useShortcut({
    allowRepeat: false,
    combo: { key: "ArrowLeft" },
    enabled: paneEnabled,
    handler: () => ui.paneNav.movePane(-1),
    id: "nav.paneLeft",
    label: "Switch to the pane on the left",
    scope: "general",
    group: "Panes",
  });
  useShortcut({
    allowRepeat: false,
    combo: { key: "ArrowRight" },
    enabled: paneEnabled,
    handler: () => ui.paneNav.movePane(1),
    id: "nav.paneRight",
    label: "Switch to the pane on the right",
    scope: "general",
    group: "Panes",
  });
}
