import type { JSX } from "solid-js";
import { useHoverIntent } from "../useHoverIntent";
import FloatingPanel, { type VerticalPlacement } from "./floating/FloatingPanel";
import "./Tooltip.css";

export interface TooltipProps {
  align?: "start" | "center" | "end";
  children: JSX.Element;
  content: JSX.Element;
  disabled?: boolean;
  placement?: VerticalPlacement;
}

export default function Tooltip(props: TooltipProps) {
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let anchorRef: HTMLSpanElement | undefined;
  const { open, scheduleClose, scheduleOpen } = useHoverIntent();

  const showable = () => !props.disabled && props.content != null && props.content !== "";

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-intent wrapper; the actual interactive control is whatever's passed as children
    <span
      class="tooltip-anchor"
      onFocusIn={() => showable() && scheduleOpen()}
      onFocusOut={scheduleClose}
      onMouseEnter={() => showable() && scheduleOpen()}
      onMouseLeave={scheduleClose}
      ref={anchorRef}
    >
      {props.children}
      <FloatingPanel
        align={props.align ?? "center"}
        anchor={() => anchorRef}
        class="tooltip-bubble"
        open={open() && showable()}
        placement={props.placement ?? "top"}
      >
        {props.content}
      </FloatingPanel>
    </span>
  );
}
