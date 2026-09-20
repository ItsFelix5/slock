import { getOwner, type JSX, runWithOwner } from "solid-js";
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
  let anchorRef: HTMLSpanElement | undefined;
  const { close, open, scheduleClose, scheduleOpen } = useHoverIntent();
  const owner = getOwner();

  const showable = () =>
    runWithOwner(owner, () => !props.disabled && props.content != null && props.content !== "") ??
    false;

  return (
    <span
      class={`tooltip-anchor${props.class ? ` ${props.class}` : ""}`}
      onFocusIn={(event) => showable() && event.target.matches(":focus-visible") && scheduleOpen()}
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
