import { type JSX, Show } from "solid-js";
import { useClickOutside } from "../useClickOutside";
import { useEscapeClose } from "../useEscapeClose";
import "./Popover.css";

export interface PopoverProps {
  children: JSX.Element;
  class?: string;
  onClose: () => void;
  open: boolean;
  panelClass?: string;
  placement?: "top" | "bottom" | "left" | "right";
  trigger: JSX.Element;
}

export default function Popover(props: PopoverProps) {
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
    <div class={`popover-root ${props.class || ""}`} ref={rootRef}>
      {props.trigger}
      <Show when={props.open}>
        <div class={`popover popover-${props.placement ?? "bottom"} ${props.panelClass || ""}`}>
          {props.children}
        </div>
      </Show>
    </div>
  );
}
