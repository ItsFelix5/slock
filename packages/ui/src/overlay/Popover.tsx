import type { JSX } from "solid-js";
import { useClickOutside } from "../useClickOutside";
import { useEscapeClose } from "../useEscapeClose";
import FloatingPanel, { type VerticalPlacement } from "./floating/FloatingPanel";
import "./Popover.css";

export interface PopoverProps {
  align?: "start" | "center" | "end";
  children: JSX.Element;
  class?: string;
  onClose: () => void;
  open: boolean;
  panelClass?: string;
  placement?: VerticalPlacement;
  trigger: JSX.Element;
}

export default function Popover(props: PopoverProps) {
  // biome-ignore lint/suspicious/noUnassignedVariables: standard Solid ref pattern
  let rootRef: HTMLDivElement | undefined;
  let panelRef: HTMLDivElement | undefined;

  useClickOutside([() => rootRef, () => panelRef], () => {
    if (props.open) props.onClose();
  });
  useEscapeClose(props.onClose, () => props.open);

  return (
    <div class={`popover-root ${props.class || ""}`} ref={rootRef}>
      {props.trigger}
      <FloatingPanel
        align={props.align ?? "start"}
        anchor={() => rootRef}
        class={`popover ${props.panelClass || ""}`}
        onScroll={props.onClose}
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
