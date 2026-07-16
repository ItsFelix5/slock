import { type JSX, onCleanup, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { clamp } from "./viewportClamp";

export type VerticalPlacement = "top" | "bottom";
export type HorizontalPlacement = "left" | "right";
export type Placement = VerticalPlacement | HorizontalPlacement;
export type FloatingAlign = "start" | "center" | "end";

function isVertical(placement: Placement): placement is VerticalPlacement {
  return placement === "top" || placement === "bottom";
}

export function resolveVerticalPlacement(
  anchor: DOMRect,
  panelHeight: number,
  preferred: VerticalPlacement,
  gap = 4,
  viewportPadding = 8,
): VerticalPlacement {
  const spaceAbove = anchor.top - gap - viewportPadding;
  const spaceBelow = window.innerHeight - anchor.bottom - gap - viewportPadding;
  const preferredSpace = preferred === "top" ? spaceAbove : spaceBelow;
  const oppositeSpace = preferred === "top" ? spaceBelow : spaceAbove;
  return preferredSpace >= panelHeight || preferredSpace >= oppositeSpace
    ? preferred
    : preferred === "top"
      ? "bottom"
      : "top";
}

export function resolveHorizontalPlacement(
  anchor: DOMRect,
  panelWidth: number,
  preferred: HorizontalPlacement,
  gap = 4,
  viewportPadding = 8,
): HorizontalPlacement {
  const spaceLeft = anchor.left - gap - viewportPadding;
  const spaceRight = window.innerWidth - anchor.right - gap - viewportPadding;
  const preferredSpace = preferred === "left" ? spaceLeft : spaceRight;
  const oppositeSpace = preferred === "left" ? spaceRight : spaceLeft;
  return preferredSpace >= panelWidth || preferredSpace >= oppositeSpace
    ? preferred
    : preferred === "left"
      ? "right"
      : "left";
}

export interface FloatingPanelProps {
  align?: FloatingAlign;
  anchor: () => HTMLElement | undefined;
  children: JSX.Element;
  class?: string;
  gap?: number;
  onMouseEnter?: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent>;
  onMouseLeave?: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent>;
  open: boolean;
  panelRef?: (element: HTMLDivElement | undefined) => void;
  placement?: Placement;
  style?: JSX.CSSProperties;
  viewportPadding?: number;
}

export default function FloatingPanel(props: FloatingPanelProps) {
  let panel: HTMLDivElement | undefined;
  let frame: number | undefined;

  const position = () => {
    const anchorElement = props.anchor();
    if (!(panel && anchorElement)) return;
    const anchor = anchorElement.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const gap = props.gap ?? 4;
    const padding = props.viewportPadding ?? 8;
    const preferred = props.placement ?? "bottom";

    let left: number;
    let top: number;
    let placement: Placement;

    if (isVertical(preferred)) {
      placement = resolveVerticalPlacement(anchor, panelRect.height, preferred, gap, padding);
      // biome-ignore lint/style/useDestructuring: left is conditionally reassigned below based on align, destructuring doesn't fit
      left = anchor.left;
      if (props.align === "center") left += (anchor.width - panelRect.width) / 2;
      else if (props.align === "end") left = anchor.right - panelRect.width;
      left = clamp(left, padding, window.innerWidth - panelRect.width - padding);
      const desiredTop =
        placement === "top" ? anchor.top - panelRect.height - gap : anchor.bottom + gap;
      top = clamp(desiredTop, padding, window.innerHeight - panelRect.height - padding);
    } else {
      placement = resolveHorizontalPlacement(anchor, panelRect.width, preferred, gap, padding);
      // biome-ignore lint/style/useDestructuring: top is conditionally reassigned below based on align, destructuring doesn't fit
      top = anchor.top;
      if (props.align === "center") top += (anchor.height - panelRect.height) / 2;
      else if (props.align === "end") top = anchor.bottom - panelRect.height;
      top = clamp(top, padding, window.innerHeight - panelRect.height - padding);
      const desiredLeft =
        placement === "left" ? anchor.left - panelRect.width - gap : anchor.right + gap;
      left = clamp(desiredLeft, padding, window.innerWidth - panelRect.width - padding);
    }

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.visibility = "visible";
    panel.dataset.placement = placement;
  };

  const schedulePosition = () => {
    cancelAnimationFrame(frame ?? 0);
    frame = requestAnimationFrame(position);
  };

  onMount(() => {
    window.addEventListener("resize", schedulePosition);
    window.addEventListener("scroll", schedulePosition, true);
    onCleanup(() => {
      cancelAnimationFrame(frame ?? 0);
      window.removeEventListener("resize", schedulePosition);
      window.removeEventListener("scroll", schedulePosition, true);
    });
  });

  return (
    <Show when={props.open && props.anchor()}>
      <Portal>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: floating panels may use pointer entry/exit to preserve hover intent */}
        <div
          class={props.class}
          onMouseEnter={props.onMouseEnter}
          onMouseLeave={props.onMouseLeave}
          ref={(element) => {
            panel = element;
            props.panelRef?.(element);
            schedulePosition();
          }}
          style={{
            ...props.style,
            left: "0",
            position: "fixed",
            top: "0",
            visibility: "hidden",
          }}
        >
          {props.children}
        </div>
      </Portal>
    </Show>
  );
}
