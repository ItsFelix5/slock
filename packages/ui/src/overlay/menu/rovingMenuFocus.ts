import { type ListDirection, listNavigationIndex } from "../../form/listNavigation";
import { useListShortcuts } from "../../useNavShortcuts";

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

  const moveByDirection = (current: HTMLElement | null, direction: ListDirection): boolean => {
    const items = menuItems();
    const index = current ? items.indexOf(current) : -1;
    const next = listNavigationIndex(direction, index < 0 ? null : index, items.length, {
      wrap: true,
    });
    if (next === undefined) return false;
    focusMenuItem(next);
    return true;
  };

  return { focusMenuItem, menuItems, moveByDirection };
}

export function useMenuShortcuts(
  roving: ReturnType<typeof createMenuRovingFocus>,
  root: Parameters<typeof useListShortcuts>[0]["root"],
  enabled?: () => boolean,
) {
  useListShortcuts({
    allowInInputs: false,
    enabled,
    move: (direction) =>
      roving.moveByDirection(
        document.activeElement instanceof HTMLElement ? document.activeElement : null,
        direction,
      ),
    root,
  });
}
