import { createEffect, type JSX, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { useClickOutside } from "../../useClickOutside";
import { useEscapeClose } from "../../useEscapeClose";
import { clamp, FloatingMountContext } from "../floating/FloatingPanel";
import "./ContextMenu.css";
import "./Menu.css";
import { createMenuRovingFocus, useMenuShortcuts } from "./rovingMenuFocus";

export interface ContextMenuProps {
  children: JSX.Element;
  class?: string;
  onClose: () => void;
  open: boolean;
  x: number;
  y: number;
}

export default function ContextMenu(props: ContextMenuProps) {
  createEffect(() => {
    if (!props.open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    onCleanup(() => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    });
  });

  return (
    <Show when={props.open}>
      <Portal mount={document.body}>
        <ContextMenuPanel class={props.class} onClose={props.onClose} x={props.x} y={props.y}>
          {props.children}
        </ContextMenuPanel>
      </Portal>
    </Show>
  );
}

function ContextMenuPanel(props: {
  x: number;
  y: number;
  class?: string;
  onClose: () => void;
  children: JSX.Element;
}) {
  let ref: HTMLDivElement | undefined;

  const roving = createMenuRovingFocus(() => ref);

  onMount(() => {
    if (!ref) return;
    ref.dataset.menuPanel = "";
    const rect = ref.getBoundingClientRect();
    const left = clamp(props.x, 8, window.innerWidth - rect.width - 8);
    const top = clamp(props.y, 8, window.innerHeight - rect.height - 8);
    ref.style.left = `${left}px`;
    ref.style.top = `${top}px`;
    roving.focusMenuItem(0);
  });

  useMenuShortcuts(roving, () => ref);
  useClickOutside(() => ref, props.onClose);
  useEscapeClose(props.onClose);

  return (
    <div
      class={`menu-panel context-menu ${props.class ?? ""}`}
      ref={ref}
      style={{ left: `${props.x}px`, top: `${props.y}px` }}
    >
      <FloatingMountContext.Provider value={() => ref}>
        {props.children}
      </FloatingMountContext.Provider>
    </div>
  );
}
