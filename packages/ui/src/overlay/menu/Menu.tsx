import { createEffect, type JSX, onCleanup } from "solid-js";
import { listNavigationIndex } from "../../form/listNavigation";
import { useClickOutside } from "../../useClickOutside";
import { useEscapeClose } from "../../useEscapeClose";
import FloatingPanel, { type FloatingAlign, type Placement } from "../floating/FloatingPanel";
import "./MenuButton.css";

export interface MenuProps {
  align?: FloatingAlign;
  children: JSX.Element;
  class?: string;
  onClose: () => void;
  onOpen?: () => void;
  open: boolean;
  openOnHover?: boolean;
  panelClass?: string;
  placement?: Placement;
  trigger: JSX.Element;
}

export default function Menu(props: MenuProps) {
  // biome-ignore lint/suspicious/noUnassignedVariables: standard Solid ref pattern
  let rootRef: HTMLDivElement | undefined;
  let panelRef: HTMLDivElement | undefined;
  let restoreAfterKeyboardAction = false;
  let hoverCloseTimer: ReturnType<typeof setTimeout> | undefined;

  const cancelHoverClose = () => {
    if (hoverCloseTimer) clearTimeout(hoverCloseTimer);
    hoverCloseTimer = undefined;
  };
  const openFromHover = () => {
    if (!props.openOnHover) return;
    cancelHoverClose();
    props.onOpen?.();
  };
  const closeFromHover = () => {
    if (!props.openOnHover) return;
    cancelHoverClose();
    hoverCloseTimer = setTimeout(props.onClose, 120);
  };
  onCleanup(cancelHoverClose);

  const trigger = () =>
    rootRef?.querySelector<HTMLElement>(
      "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])",
    );
  const focusTrigger = () => {
    const element = trigger();
    if (element?.isConnected) element.focus();
  };
  const menuItems = () =>
    [...(panelRef?.querySelectorAll<HTMLElement>(".menu-item:not([disabled])") ?? [])].filter(
      (element) =>
        element.closest("[data-menu-panel]") === panelRef && element.getClientRects().length > 0,
    );
  const focusMenuItem = (index: number) => queueMicrotask(() => menuItems()[index]?.focus());

  const onRootKeyDown = (event: KeyboardEvent) => {
    if (!props.open || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    event.stopPropagation();
    const items = menuItems();
    focusMenuItem(event.key === "ArrowDown" ? 0 : items.length - 1);
  };

  const onPanelKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const { target } = event;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    )
      return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      props.onClose();
      queueMicrotask(focusTrigger);
      return;
    }
    if (event.key === "Enter" || event.key === " ") restoreAfterKeyboardAction = true;
    const items = menuItems();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = listNavigationIndex(event.key, current < 0 ? null : current, items.length, {
      wrap: true,
    });
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    focusMenuItem(next);
  };

  useClickOutside([() => rootRef, () => panelRef], () => {
    if (props.open) props.onClose();
  });
  useEscapeClose(props.onClose, () => props.open);

  createEffect(() => {
    const isOpen = props.open;
    const triggerElement = trigger();
    triggerElement?.setAttribute("aria-expanded", String(isOpen));
    triggerElement?.setAttribute("aria-haspopup", "true");
    if (!isOpen) return;
    onCleanup(() => {
      if (restoreAfterKeyboardAction) queueMicrotask(focusTrigger);
      restoreAfterKeyboardAction = false;
    });
  });

  return (
    <div
      class={props.class}
      onKeyDown={onRootKeyDown}
      onMouseEnter={openFromHover}
      onMouseLeave={closeFromHover}
      ref={rootRef}
    >
      {props.trigger}
      <FloatingPanel
        align={props.align ?? "start"}
        anchor={() => rootRef}
        class={props.panelClass}
        onKeyDown={onPanelKeyDown}
        onMouseEnter={openFromHover}
        onMouseLeave={closeFromHover}
        onScroll={props.onClose}
        open={props.open}
        panelRef={(element) => {
          panelRef = element;
          if (element) element.dataset.menuPanel = "";
        }}
        placement={props.placement ?? "bottom"}
      >
        {props.children}
      </FloatingPanel>
    </div>
  );
}
