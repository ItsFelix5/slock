import type { JSX } from "@solidjs/web";
import { type Accessor, createEffect, Show, untrack } from "solid-js";
import { useHoverIntent } from "../hooks/useHoverIntent";
import FloatingPanel, {
  type FloatingAlign,
  type VerticalPlacement,
} from "./floating/FloatingPanel";
import "./HoverCard.css";

interface HoverCardProps {
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
  const intent = () => props.hoverIntent ?? ownHoverIntent;
  const open = () => intent().open();
  const close = () => intent().close();

  createEffect(open, (isOpen) => void untrack(() => props.onOpenChange?.(isOpen)));

  const handleFocusIn = (event: FocusEvent) => {
    if (event.target instanceof Element && event.target.matches(":focus-visible"))
      intent().openNow();
  };

  const handleFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next instanceof Node && (anchorRef?.contains(next) || panelRef?.contains(next))) return;
    close();
  };

  const panel = (
    <Show when={open() && (props.openWhen?.() ?? true)}>
      <FloatingPanel
        align={props.align ?? "start"}
        anchor={props.anchor ?? (() => anchorRef)}
        class={["hover-card flex-col", props.panelClass]}
        onFocusOut={handleFocusOut}
        onMouseEnter={() => intent().cancelClose()}
        onMouseLeave={() => intent().scheduleClose()}
        onScroll={close}
        open
        panelRef={(element) => {
          panelRef = element;
        }}
        placement={props.placement ?? "top"}
        style={props.width ? { width: `${props.width}px` } : undefined}
      >
        {props.content(close)}
      </FloatingPanel>
    </Show>
  );

  if (props.anchor) return panel;

  return (
    <span
      class={["hover-card-anchor", props.anchorClass]}
      onFocusIn={handleFocusIn}
      onFocusOut={handleFocusOut}
      onKeyDown={intent().closeOnPress}
      onMouseEnter={() => intent().scheduleOpen()}
      onMouseLeave={() => intent().scheduleClose()}
      onPointerDown={intent().closeOnPress}
      ref={(element) => {
        anchorRef = element;
      }}
    >
      {props.children}
      {panel}
    </span>
  );
}
