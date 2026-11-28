import { clamp } from "@slock/core";
import type { JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import { createEffect, onSettled, Show } from "solid-js";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useEscapeClose } from "../../hooks/useEscapeClose";
import { FloatingMountContext } from "../floating/FloatingPanel";
import "./ContextMenu.css";
import "./Menu.css";
import { createMenuRovingFocus, useMenuShortcuts } from "./rovingMenuFocus";

interface ContextMenuProps {
  children: JSX.Element;
  class?: string;
  onClose: () => void;
  open: boolean;
  x: number;
  y: number;
}

export default function ContextMenu(props: ContextMenuProps) {
  createEffect(
    () => props.open,
    (isOpen) => {
      if (!isOpen) return;
      const previouslyFocused =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      return () => {
        if (previouslyFocused?.isConnected) previouslyFocused.focus();
      };
    },
  );

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

const EDGE_GAP = 8;

function placeAxis(point: number, size: number, viewport: number) {
  const start = point + size + EDGE_GAP > viewport ? point - size : point;
  return clamp(start, EDGE_GAP, viewport - size - EDGE_GAP);
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

  onSettled(() => {
    if (!ref) return;
    const panel = ref;
    panel.dataset.menuPanel = "";
    const place = () => {
      const rect = panel.getBoundingClientRect();
      panel.style.left = `${placeAxis(props.x, rect.width, window.innerWidth)}px`;
      panel.style.top = `${placeAxis(props.y, rect.height, window.innerHeight)}px`;
    };
    place();
    roving.focusMenuItem(0);
    const observer = new ResizeObserver(place);
    observer.observe(panel);
    return () => observer.disconnect();
  });

  useMenuShortcuts(roving, () => ref);
  useClickOutside(() => ref, props.onClose);
  useEscapeClose(props.onClose);

  return (
    <div
      class={["menu-panel context-menu", props.class]}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(event) => roving.handleKeyDown(event, props.onClose)}
      ref={ref}
      style={{ left: `${props.x}px`, top: `${props.y}px` }}
    >
      <FloatingMountContext value={() => ref}>{props.children}</FloatingMountContext>
    </div>
  );
}
