import { service } from "@slock/core/solid";
import type { JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import { onSettled } from "solid-js";
import { captureFocus, focusableWithin, tabWrapTarget } from "./dialog/focusTrap";
import { FloatingMountContext } from "./floating/FloatingPanel";
import "./Overlay.css";

const ui = service("ui");

type OverlayLabel =
  | { ariaLabel: string; ariaLabelledBy?: never }
  | { ariaLabel?: never; ariaLabelledBy: string };

type OverlayProps = OverlayLabel & {
  align?: "center" | "top";
  children: JSX.Element;
  onClose: () => void;
};

export default function Overlay(props: OverlayProps) {
  let overlayRef: HTMLDivElement | undefined;
  let pressStartedOnBackdrop = false;
  const returnFocus = captureFocus();

  onSettled(() => {
    const { focusLayers } = ui;
    const layer = focusLayers.push({});
    queueMicrotask(() => {
      if (!(focusLayers.isTop(layer) && overlayRef) || overlayRef.contains(document.activeElement))
        return;
      (focusableWithin(overlayRef)[0] ?? overlayRef).focus();
    });

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !focusLayers.isTop(layer) || !overlayRef) return;
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
    return () => {
      document.removeEventListener("keydown", keepFocusInside);
      const { wasTop, revealed } = focusLayers.pop(layer);
      if (wasTop) returnFocus(() => focusLayers.isTop(revealed));
    };
  });

  return (
    <Portal mount={document.body}>
      <div
        aria-label={props.ariaLabel}
        aria-labelledby={props.ariaLabelledBy}
        aria-modal="true"
        class={["overlay flex-center", { "overlay-top": props.align === "top" }]}
        onClick={(event) => {
          if (pressStartedOnBackdrop && event.target === event.currentTarget) props.onClose();
        }}
        onContextMenu={(event) => {
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          pressStartedOnBackdrop = event.target === event.currentTarget;
        }}
        ref={overlayRef}
        role="dialog"
        tabindex={-1}
      >
        <FloatingMountContext value={() => overlayRef}>{props.children}</FloatingMountContext>
      </div>
    </Portal>
  );
}
