import { createEffect, type JSX, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { listNavigationIndex } from "../../form/listNavigation";
import { useClickOutside } from "../../useClickOutside";
import { useEscapeClose } from "../../useEscapeClose";
import { FloatingMountContext } from "../floating/floatingMountContext";
import { clamp } from "../floating/viewportClamp";
import "./MenuButton.css";
import "./ContextMenu.css";

export interface ContextMenuProps {
  children: JSX.Element;
  class?: string;
  onClose: () => void;
  open: boolean;
  x: number;
  y: number;
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
  useEscapeClose(props.onClose, () => props.open);

  // Mirrors Overlay's own focus-restore: whatever had focus when the menu
  // opened (a right-clicked row isn't necessarily focused itself) gets it
  // back on close, so closing via Escape or an item's action never strands
  // focus on a removed/portaled node.
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
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let ref: HTMLDivElement | undefined;

  // Scoped to direct children only — a nested Menu (e.g. "Remind me",
  // "More message shortcuts") portals its own items into this same ref via
  // FloatingMountContext, and marks its own root the same way, so matching
  // on "closest marked ancestor is me" keeps this panel's arrow-key nav from
  // fighting over index math with whatever submenu is currently open.
  const menuItems = () =>
    [...(ref?.querySelectorAll<HTMLElement>(".menu-item:not([disabled])") ?? [])].filter(
      (element) => element.closest("[data-menu-panel]") === ref,
    );
  const focusMenuItem = (index: number) => queueMicrotask(() => menuItems()[index]?.focus());

  // Clamped to the viewport once we know the panel's real size — starts at
  // the cursor point and nudges back on-screen only if it would overflow.
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

  // Same roving-focus behavior as Menu.tsx's dropdown menus, so a right-click
  // menu isn't a second-class citizen next to the "..." menus it's visually
  // identical to — Up/Down/Home/End move between items, wrapping at the ends.
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
    // biome-ignore lint/a11y/noStaticElementInteractions: roving-focus key handling for the .menu-item buttons inside, same pattern as FloatingPanel
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
