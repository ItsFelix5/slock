import type { JSX } from "solid-js";
import { useHoverIntent } from "../useHoverIntent";
import FloatingPanel, { type VerticalPlacement } from "./floating/FloatingPanel";
import "./Tooltip.css";

export interface TooltipProps {
  align?: "start" | "center" | "end";
  children: JSX.Element;
  class?: string;
  content: JSX.Element;
  disabled?: boolean;
  placement?: VerticalPlacement;
}

export default function Tooltip(props: TooltipProps) {
  // biome-ignore lint/suspicious/noUnassignedVariables: standard Solid ref pattern
  let anchorRef: HTMLSpanElement | undefined;
  const { close, open, scheduleClose, scheduleOpen } = useHoverIntent();

  const showable = () => !props.disabled && props.content != null && props.content !== "";

  return (
    <span
      class={`tooltip-anchor${props.class ? ` ${props.class}` : ""}`}
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
        onScroll={close}
        open={open() && showable()}
        placement={props.placement ?? "top"}
      >
        {props.content}
      </FloatingPanel>
    </span>
  );
}
