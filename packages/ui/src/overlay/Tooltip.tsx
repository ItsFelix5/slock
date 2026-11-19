import type { JSX } from "@solidjs/web";
import { children, Show } from "solid-js";
import { useHoverIntent } from "../hooks/useHoverIntent";
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

function TooltipBubble(
  props: TooltipProps & {
    anchor: () => HTMLElement | undefined;
    onScroll: () => void;
  },
) {
  const content = children(() => props.content);
  return (
    <Show when={content()}>
      <FloatingPanel
        align={props.align ?? "center"}
        anchor={props.anchor}
        class="tooltip-bubble"
        onScroll={props.onScroll}
        open
        placement={props.placement ?? "top"}
      >
        {content()}
      </FloatingPanel>
    </Show>
  );
}

export default function Tooltip(props: TooltipProps) {
  let anchorRef: HTMLSpanElement | undefined;
  const { close, open, scheduleClose, scheduleOpen } = useHoverIntent();

  return (
    <span
      class={`tooltip-anchor${props.class ? ` ${props.class}` : ""}`}
      onFocusIn={(event) =>
        !props.disabled && event.target.matches(":focus-visible") && scheduleOpen()
      }
      onFocusOut={scheduleClose}
      onMouseEnter={() => !props.disabled && scheduleOpen()}
      onMouseLeave={scheduleClose}
      ref={anchorRef}
    >
      {props.children}
      <Show when={open() && !props.disabled}>
        <TooltipBubble {...props} anchor={() => anchorRef} onScroll={close} />
      </Show>
    </span>
  );
}
