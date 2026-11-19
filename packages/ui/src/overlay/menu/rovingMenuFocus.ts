import { type ListDirection, listNavigationIndex } from "../../form/listNavigation";
import { useListShortcuts } from "../../hooks/useNavShortcuts";
import { isTypeaheadKey, pushTypeahead, type TypeaheadState, typeaheadIndex } from "./typeahead";

export function createMenuRovingFocus(
  panelRef: () => HTMLElement | undefined,
  options?: { requireVisible?: boolean },
) {
  let typeahead: TypeaheadState = { buffer: "", time: Number.NEGATIVE_INFINITY };

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

  const handleKeyDown = (event: KeyboardEvent, closeFromTab: () => void) => {
    const items = menuItems();
    const { target } = event;
    if (!(target instanceof HTMLElement && items.includes(target))) return;
    if (event.key === "Tab") {
      event.preventDefault();
      closeFromTab();
      return;
    }
    if (!isTypeaheadKey(event)) return;
    typeahead = pushTypeahead(typeahead, event.key, event.timeStamp);
    const next = typeaheadIndex(
      items.map((item) => item.textContent ?? ""),
      typeahead.buffer,
      items.indexOf(target),
    );
    if (next === undefined) return;
    event.preventDefault();
    items[next]?.focus();
  };

  return { focusMenuItem, handleKeyDown, menuItems, moveByDirection };
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
