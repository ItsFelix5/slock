import { onCleanup, onSettled } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import {
  focusableWithin,
  isTopFocusLayer,
  popFocusLayer,
  pushFocusLayer,
  tabWrapTarget,
} from "./dialog/focusTrap";
import { FloatingMountContext } from "./floating/FloatingPanel";
import "./Overlay.css";

type OverlayLabel =
  | { ariaLabel: string; ariaLabelledBy?: never }
  | { ariaLabel?: never; ariaLabelledBy: string };

export type OverlayProps = OverlayLabel & {
  align?: "center" | "top";
  children: JSX.Element;
  onClose: () => void;
};

export default function Overlay(props: OverlayProps) {
  let overlayRef: HTMLDivElement | undefined;
  let pressStartedOnBackdrop = false;
  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  onSettled(() => {
    const layer = pushFocusLayer();
    queueMicrotask(() => {
      if (!(isTopFocusLayer(layer) && overlayRef) || overlayRef.contains(document.activeElement))
        return;
      (focusableWithin(overlayRef)[0] ?? overlayRef).focus();
    });

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !isTopFocusLayer(layer) || !overlayRef) return;
      const focusable = focusableWithin(overlayRef);
      if (focusable.length === 0) {
        event.preventDefault();
        overlayRef.focus();
        return;
      }
      const active = document.activeElement;
      const position =
        active instanceof HTMLElement && active !== overlayRef && overlayRef.contains(active)
          ? focusable.indexOf(active)
          : "outside";
      if (position === -1) return;
      const wrapTo = tabWrapTarget(position, focusable.length, event.shiftKey);
      if (!wrapTo) return;
      event.preventDefault();
      (wrapTo === "first" ? focusable[0] : focusable.at(-1))?.focus();
    };

    document.addEventListener("keydown", keepFocusInside);
    onCleanup(() => {
      document.removeEventListener("keydown", keepFocusInside);
      const { wasTop, revealed } = popFocusLayer(layer);
      if (!(wasTop && previouslyFocused?.isConnected)) return;
      queueMicrotask(() => {
        if (isTopFocusLayer(revealed) && previouslyFocused.isConnected) previouslyFocused.focus();
      });
    });
  });

  return (
    <Portal mount={document.body}>
      <div
        aria-label={props.ariaLabel}
        aria-labelledby={props.ariaLabelledBy}
        aria-modal="true"
        class={`overlay flex-center ${props.align === "top" ? "overlay-top" : ""}`}
        onClick={(event) => {
          if (pressStartedOnBackdrop && event.target === event.currentTarget) props.onClose();
        }}
        onContextMenu={(event) => event.stopPropagation()}
        onMouseDown={(event) => {
          pressStartedOnBackdrop = event.target === event.currentTarget;
        }}
        ref={overlayRef}
        role="dialog"
        tabIndex={-1}
      >
        <FloatingMountContext value={() => overlayRef}>
          {props.children}
        </FloatingMountContext>
      </div>
    </Portal>
  );
}
