import { createEffect, type JSX, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { listNavigationIndex } from "../../form/listNavigation";
import { useClickOutside } from "../../useClickOutside";
import { useEscapeClose } from "../../useEscapeClose";
import { FloatingMountContext } from "../floating/floatingMountContext";
import { clamp } from "../floating/viewportClamp";
import "./ContextMenu.css";
import "./MenuButton.css";

export interface ContextMenuProps {
  children: JSX.Element;
  class?: string;
  onClose: () => void;
  open: boolean;
  x: number;
  y: number;
}

export default function ContextMenu(props: ContextMenuProps) {
  let panelRef: HTMLDivElement | undefined;

  useClickOutside(
    () => panelRef,
    () => {
      if (props.open) props.onClose();
    },
  );
  useEscapeClose(props.onClose, () => props.open);

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
        <ContextMenuPanel
          class={props.class}
          setRef={(el) => {
            panelRef = el;
          }}
          x={props.x}
          y={props.y}
        >
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
  setRef: (el: HTMLDivElement) => void;
  children: JSX.Element;
}) {
  // biome-ignore lint/suspicious/noUnassignedVariables: standard Solid ref pattern
  let ref: HTMLDivElement | undefined;

  const menuItems = () =>
    [...(ref?.querySelectorAll<HTMLElement>(".menu-item:not([disabled])") ?? [])].filter(
      (element) => element.closest("[data-menu-panel]") === ref,
    );
  const focusMenuItem = (index: number) => queueMicrotask(() => menuItems()[index]?.focus());

  onMount(() => {
    if (!ref) return;
    props.setRef(ref);
    ref.dataset.menuPanel = "";
    const rect = ref.getBoundingClientRect();
    const left = clamp(props.x, 8, window.innerWidth - rect.width - 8);
    const top = clamp(props.y, 8, window.innerHeight - rect.height - 8);
    ref.style.left = `${left}px`;
    ref.style.top = `${top}px`;
    focusMenuItem(0);
  });

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
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

  return (
    <div
      class={`menu-panel context-menu ${props.class ?? ""}`}
      onKeyDown={onKeyDown}
      ref={ref}
      style={{ left: `${props.x}px`, top: `${props.y}px` }}
    >
      <FloatingMountContext.Provider value={() => ref}>
        {props.children}
      </FloatingMountContext.Provider>
    </div>
  );
}
