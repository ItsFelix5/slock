import { listNavigationIndex } from "../form/listNavigation";
import { plainKey, useShortcut } from "../useShortcut";

const PANE_SELECTOR = "[data-pane]";

function paneRows(pane: Element): HTMLElement[] {
  return [...pane.querySelectorAll<HTMLElement>("[data-nav-row]:not([disabled])")];
}

function activePane(): HTMLElement | null {
  return document.activeElement?.closest<HTMLElement>(PANE_SELECTOR) ?? null;
}

const lastRowIndex = new Map<string, number>();

function focusPaneEntry(pane: HTMLElement) {
  const rows = paneRows(pane);
  if (rows.length > 0) {
    const remembered = lastRowIndex.get(pane.dataset.pane ?? "") ?? 0;
    rows[Math.min(remembered, rows.length - 1)]?.focus();
    return;
  }

  const rovingTarget = pane.querySelector<HTMLElement>('[tabindex="0"]');
  if (rovingTarget) {
    rovingTarget.focus();
    return;
  }
  pane
    .querySelector<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
    ?.focus();
}

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
