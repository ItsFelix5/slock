import { listNavigationIndex } from "../form/listNavigation";
import { plainKey, useShortcut } from "../useShortcut";

// Plain attribute markers, same convention as [data-nav-row]: a pane is just
// whatever DOM subtree is currently mounted with data-pane="id" on its root —
// no registry to keep in sync, panes come and go with Show/conditional
// rendering exactly like nav rows already do.
const PANE_SELECTOR = "[data-pane]";

function paneRows(pane: Element): HTMLElement[] {
  return [...pane.querySelectorAll<HTMLElement>("[data-nav-row]:not([disabled])")];
}

function activePane(): HTMLElement | null {
  return document.activeElement?.closest<HTMLElement>(PANE_SELECTOR) ?? null;
}

// Remembers, per pane id, which row index to land on next time that pane is
// entered via Left/Right — so switching away and back doesn't always reset
// to the top of the list.
const lastRowIndex = new Map<string, number>();

function focusPaneEntry(pane: HTMLElement) {
  const rows = paneRows(pane);
  if (rows.length > 0) {
    const remembered = lastRowIndex.get(pane.dataset.pane ?? "") ?? 0;
    rows[Math.min(remembered, rows.length - 1)]?.focus();
    return;
  }
  // Panes with their own native roving-focus scheme (the message list's
  // Up/Down system) mark exactly one element tabIndex 0 — prefer that over
  // just grabbing the first focusable thing.
  const rovingTarget = pane.querySelector<HTMLElement>('[tabindex="0"]');
  if (rovingTarget) {
    rovingTarget.focus();
    return;
  }
  pane
    .querySelector<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
    ?.focus();
}

// Mount once near the app root. Left/Right switches which pane has keyboard
// focus (vim/tmux-style window navigation); j/k moves within whichever pane
// is currently active. Both only engage once the user is already navigating
// a list (focus sits on a [data-nav-row]) — that's what keeps this from ever
// competing with EmojiPicker's own grid Left/Right, sliders, or text editing,
// none of which ever focus a nav row.
export function usePaneNavigation() {
  useShortcut({
    allowRepeat: true,
    enabled: () => !!document.activeElement?.closest("[data-nav-row]"),
    handler: (e) => {
      const pane = activePane();
      if (!pane) return;
      const rows = paneRows(pane);
      const current = rows.indexOf(document.activeElement as HTMLElement);
      const key = e.key === "j" ? "ArrowDown" : e.key === "k" ? "ArrowUp" : e.key;
      const next = listNavigationIndex(key, current < 0 ? null : current, rows.length);
      if (next === undefined) return;
      rows[next]?.focus();
    },
    keys: "j / k",
    label: "Move between list items (channels, activity, saved, pinned, files…)",
    match: plainKey("j", "k", "Home", "End"),
    scope: "general",
  });

  useShortcut({
    allowRepeat: false,
    // Broader than j/k's gate: also fires from inside the message list, whose
    // roving-focus row isn't a [data-nav-row] (it has its own Up/Down scheme)
    // but does live inside a registered pane.
    enabled: () => !!document.activeElement?.closest(PANE_SELECTOR),
    handler: (e) => {
      const panes = [...document.querySelectorAll<HTMLElement>(PANE_SELECTOR)];
      const current = activePane();
      const currentIndex = current ? panes.indexOf(current) : -1;
      if (currentIndex < 0) return;
      const target = panes[e.key === "ArrowLeft" ? currentIndex - 1 : currentIndex + 1];
      if (!target) return;
      if (current) {
        const rows = paneRows(current);
        const index = rows.indexOf(document.activeElement as HTMLElement);
        if (index >= 0) lastRowIndex.set(current.dataset.pane ?? "", index);
      }
      focusPaneEntry(target);
    },
    keys: "← / →",
    label: "Switch between panes (sidebar, messages, details)",
    match: plainKey("ArrowLeft", "ArrowRight"),
    scope: "general",
  });
}
