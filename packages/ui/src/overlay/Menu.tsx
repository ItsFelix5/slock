import type { JSX } from "solid-js";
import { useClickOutside } from "../useClickOutside";
import { useEscapeClose } from "../useEscapeClose";
import FloatingPanel, { type FloatingAlign, type Placement } from "./floating/FloatingPanel";
import "./MenuButton.css";

export interface MenuProps {
  align?: FloatingAlign;
  children: JSX.Element;
  class?: string;
  onClose: () => void;
  open: boolean;
  panelClass?: string;
  placement?: Placement;
  trigger: JSX.Element;
}

// Thin structural wrapper around a trigger + a click-outside/Escape-closeable panel,
// positioned via FloatingPanel (auto-flip + viewport clamp on both axes). Nesting a
// <Menu> inside another <Menu>'s children works for the trigger/root part for free —
// the inner instance's own root ref is contained within the outer's root ref. The
// portaled panel is covered too, but only because FloatingPanel portals into the
// nearest ancestor panel (via FloatingMountContext) instead of always into
// document.body — otherwise a click inside a nested panel would land in a DOM
// subtree the outer instance's useClickOutside can't see, reading as "outside"
// and closing the whole stack before the click's own handler ever runs.
export default function Menu(props: MenuProps) {
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let rootRef: HTMLDivElement | undefined;
  let panelRef: HTMLDivElement | undefined;

  useClickOutside([() => rootRef, () => panelRef], () => {
    if (props.open) props.onClose();
  });
  useEscapeClose(() => {
    if (props.open) props.onClose();
  });

  return (
    <div class={props.class} ref={rootRef}>
      {props.trigger}
      <FloatingPanel
        align={props.align ?? "start"}
        anchor={() => rootRef}
        class={props.panelClass}
        open={props.open}
        panelRef={(element) => {
          panelRef = element;
        }}
        placement={props.placement ?? "bottom"}
      >
        {props.children}
      </FloatingPanel>
    </div>
  );
}
