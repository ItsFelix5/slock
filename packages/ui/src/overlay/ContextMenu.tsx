import { type JSX, onMount, Show } from "solid-js";
import { useClickOutside } from "../useClickOutside";
import { useEscapeClose } from "../useEscapeClose";
import "./MenuButton.css";
import "./ContextMenu.css";

export interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  children: JSX.Element;
  class?: string;
}

// Right-click menu positioned at an arbitrary cursor point rather than
// anchored to a trigger element (what Menu/Popover do) — used for message
// and channel context menus. Reuses Menu's panel look (.menu-panel/.menu-item)
// so it's visually identical to the "..." menus everywhere else.
export default function ContextMenu(props: ContextMenuProps) {
  let panelRef: HTMLDivElement | undefined;

  useClickOutside(
    () => panelRef,
    () => {
      if (props.open) props.onClose();
    },
  );
  useEscapeClose(() => {
    if (props.open) props.onClose();
  });

  return (
    <Show when={props.open}>
      <ContextMenuPanel
        x={props.x}
        y={props.y}
        class={props.class}
        setRef={(el) => {
          panelRef = el;
        }}
      >
        {props.children}
      </ContextMenuPanel>
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
  let ref: HTMLDivElement | undefined;

  // Clamped to the viewport once we know the panel's real size — starts at
  // the cursor point and nudges back on-screen only if it would overflow.
  onMount(() => {
    if (!ref) return;
    props.setRef(ref);
    const rect = ref.getBoundingClientRect();
    const left = Math.max(8, Math.min(props.x, window.innerWidth - rect.width - 8));
    const top = Math.max(8, Math.min(props.y, window.innerHeight - rect.height - 8));
    ref.style.left = `${left}px`;
    ref.style.top = `${top}px`;
  });

  return (
    <div
      class={`menu-panel context-menu ${props.class ?? ""}`}
      style={{ left: `${props.x}px`, top: `${props.y}px` }}
      ref={ref}
    >
      {props.children}
    </div>
  );
}
