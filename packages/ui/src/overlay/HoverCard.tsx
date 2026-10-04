import { type Accessor, createEffect, type JSX } from "solid-js";
import { useHoverIntent } from "../useHoverIntent";
import FloatingPanel, {
  type FloatingAlign,
  type VerticalPlacement,
} from "./floating/FloatingPanel";
import "./HoverCard.css";

export interface HoverCardProps {
  align?: FloatingAlign;
  anchorClass?: string;
  children?: JSX.Element;
  content: (close: () => void) => JSX.Element;
  onOpenChange?: (open: boolean) => void;
  openWhen?: Accessor<boolean>;
  panelClass?: string;
  placement?: VerticalPlacement;
  width?: number;
  anchor?: () => HTMLElement | undefined;
  hoverIntent?: ReturnType<typeof useHoverIntent>;
}

export default function HoverCard(props: HoverCardProps) {
  let anchorRef: HTMLSpanElement | undefined;
  let panelRef: HTMLDivElement | undefined;
  const ownHoverIntent = useHoverIntent();
  const { cancelClose, close, open, openNow, scheduleClose, scheduleOpen } =
    props.hoverIntent ?? ownHoverIntent;

  createEffect(() => props.onOpenChange?.(open()));

  const handleFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && (anchorRef?.contains(next) || panelRef?.contains(next))) return;
    close();
  };

  const panel = (
    <FloatingPanel
      align={props.align ?? "start"}
      anchor={props.anchor ?? (() => anchorRef)}
      class={`hover-card flex-col ${props.panelClass ?? ""}`}
      onFocusOut={handleFocusOut}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
      onScroll={close}
      open={open() && (props.openWhen?.() ?? true)}
      panelRef={(element) => {
        panelRef = element;
      }}
      placement={props.placement ?? "top"}
      style={props.width ? { width: `${props.width}px` } : undefined}
    >
      {props.content(close)}
    </FloatingPanel>
  );

  if (props.anchor) return panel;

  return (
    <span
      class={`hover-card-anchor ${props.anchorClass ?? ""}`}
      onFocusIn={openNow}
      onFocusOut={handleFocusOut}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      ref={(element) => {
        anchorRef = element;
      }}
    >
      {props.children}
      {panel}
    </span>
  );
}
