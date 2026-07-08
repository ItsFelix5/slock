import { type JSX, Show } from "solid-js";
import { useClickOutside } from "./useClickOutside";
import { useEscapeClose } from "./useEscapeClose";

export interface MenuProps {
  open: boolean;
  onClose: () => void;
  trigger: JSX.Element;
  children: JSX.Element;
  class?: string;
  panelClass?: string;
}

// Thin structural wrapper around a trigger + a click-outside/Escape-closeable panel —
// replaces several previously hand-rolled dropdown implementations. Nesting a <Menu>
// inside another <Menu>'s children works for free: the inner instance's own root ref
// is contained within the outer's root ref, so a click inside the submenu never
// registers as "outside" the outer menu.
export default function Menu(props: MenuProps) {
  let rootRef: HTMLDivElement | undefined;

  useClickOutside(
    () => rootRef,
    () => {
      if (props.open) props.onClose();
    },
  );
  useEscapeClose(() => {
    if (props.open) props.onClose();
  });

  return (
    <div class={props.class} ref={rootRef}>
      {props.trigger}
      <Show when={props.open}>
        <div class={props.panelClass}>{props.children}</div>
      </Show>
    </div>
  );
}
