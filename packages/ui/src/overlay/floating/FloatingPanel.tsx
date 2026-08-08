import { createEffect, type JSX, onCleanup, Show, useContext } from "solid-js";
import { Portal } from "solid-js/web";
import { FloatingMountContext } from "./floatingMountContext";
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
  onFocusOut?: JSX.EventHandlerUnion<HTMLDivElement, FocusEvent>;
  onMouseEnter?: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent>;
  onMouseLeave?: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent>;
  onKeyDown?: JSX.EventHandlerUnion<HTMLDivElement, KeyboardEvent>;
  open: boolean;
  panelRef?: (element: HTMLDivElement | undefined) => void;
  placement?: Placement;
  onScroll?: () => void;
  style?: JSX.CSSProperties;
  viewportPadding?: number;
}

export default function FloatingPanel(props: FloatingPanelProps) {
  let panel: HTMLDivElement | undefined;
  let frame: number | undefined;
  let resizeObserver: ResizeObserver | undefined;
  const parentMount = useContext(FloatingMountContext);

  const position = () => {
    const anchorElement = props.anchor();
    if (!(props.open && panel?.isConnected && anchorElement?.isConnected)) return;
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
    if (!props.open) return;
    cancelAnimationFrame(frame ?? 0);
    frame = requestAnimationFrame(() => {
      frame = undefined;
      position();
    });
  };

  // Capture-phase so we hear about scrolls on any ancestor, but that also
  // catches scrolling inside the panel's own content — ignore those.
  const handleScroll = (e: Event) => {
    if (panel && e.target instanceof Node && panel.contains(e.target)) return;
    props.onScroll?.();
  };

  createEffect(() => {
    if (!props.open) return;
    window.addEventListener("resize", schedulePosition);
    if (props.onScroll) window.addEventListener("scroll", handleScroll, true);
    onCleanup(() => {
      cancelAnimationFrame(frame ?? 0);
      resizeObserver?.disconnect();
      resizeObserver = undefined;
      panel = undefined;
      props.panelRef?.(undefined);
      window.removeEventListener("resize", schedulePosition);
      if (props.onScroll) window.removeEventListener("scroll", handleScroll, true);
    });
  });

  return (
    <Show when={props.open && props.anchor()}>
      <Portal mount={parentMount?.() ?? document.body}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: floating panels may use pointer entry/exit to preserve hover intent */}
        <div
          class={props.class}
          onFocusOut={props.onFocusOut}
          onKeyDown={props.onKeyDown}
          onMouseEnter={props.onMouseEnter}
          onMouseLeave={props.onMouseLeave}
          ref={(element) => {
            panel = element;
            props.panelRef?.(element);
            resizeObserver?.disconnect();
            resizeObserver = new ResizeObserver(schedulePosition);
            resizeObserver.observe(element);
            const anchorElement = props.anchor();
            if (anchorElement) resizeObserver.observe(anchorElement);
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
          <FloatingMountContext.Provider value={() => panel}>
            {props.children}
          </FloatingMountContext.Provider>
        </div>
      </Portal>
    </Show>
  );
}
