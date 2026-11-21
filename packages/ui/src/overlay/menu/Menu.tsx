import { service } from "@slock/core/solid";
import type { TimerHandle } from "@slock/core/types";
import type { JSX } from "@solidjs/web";
import { createEffect, onCleanup, Show } from "solid-js";
import FloatingPanel, { type FloatingAlign, type Placement } from "../floating/FloatingPanel";
import "./Menu.css";
import MenuOpenBehavior from "./MenuOpenBehavior";
import { createMenuRovingFocus } from "./rovingMenuFocus";

const env = service("env");

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
  let rootRef: HTMLDivElement | undefined;
  let panelRef: HTMLDivElement | undefined;
  let restoreAfterKeyboardAction = false;
  let hoverCloseTimer: TimerHandle | undefined;

  const cancelHoverClose = () => {
    env.clearTimeout(hoverCloseTimer);
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
    hoverCloseTimer = env.setTimeout(props.onClose, 120);
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
  const roving = createMenuRovingFocus(() => panelRef, {
    requireVisible: true,
  });

  createEffect(
    () => props.open,
    (isOpen) => {
      const triggerElement = trigger();
      triggerElement?.setAttribute("aria-expanded", String(isOpen));
      triggerElement?.setAttribute("aria-haspopup", "true");
      if (!isOpen) return;
      return () => {
        if (restoreAfterKeyboardAction) queueMicrotask(focusTrigger);
        restoreAfterKeyboardAction = false;
      };
    },
  );

  return (
    <div
      class={props.class}
      onMouseEnter={openFromHover}
      onMouseLeave={closeFromHover}
      ref={rootRef}
    >
      {props.trigger}
      <Show when={props.open}>
        <MenuOpenBehavior
          focusTrigger={focusTrigger}
          onClose={props.onClose}
          panel={() => panelRef}
          roving={roving}
          root={() => rootRef}
        />
      </Show>
      <FloatingPanel
        align={props.align ?? "start"}
        anchor={() => rootRef}
        class={props.panelClass}
        onClick={(event) => {
          restoreAfterKeyboardAction = event.detail === 0;
        }}
        onKeyDown={(event) =>
          roving.handleKeyDown(event, () => {
            props.onClose();
            queueMicrotask(focusTrigger);
          })
        }
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
