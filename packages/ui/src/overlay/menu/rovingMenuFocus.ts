import { listNavigationIndex } from "../../form/listNavigation";

export function createMenuRovingFocus(
  panelRef: () => HTMLElement | undefined,
  options?: { requireVisible?: boolean },
) {
  const menuItems = () =>
    [...(panelRef()?.querySelectorAll<HTMLElement>(".menu-item:not([disabled])") ?? [])].filter(
      (element) =>
        element.closest("[data-menu-panel]") === panelRef() &&
        (!options?.requireVisible || element.getClientRects().length > 0),
    );

  const focusMenuItem = (index: number) => queueMicrotask(() => menuItems()[index]?.focus());

  const moveByKey = (current: HTMLElement | null, key: string): boolean => {
    const items = menuItems();
    const index = current ? items.indexOf(current) : -1;
    const next = listNavigationIndex(key, index < 0 ? null : index, items.length, { wrap: true });
    if (next === undefined) return false;
    focusMenuItem(next);
    return true;
  };

  return { focusMenuItem, menuItems, moveByKey };
}
