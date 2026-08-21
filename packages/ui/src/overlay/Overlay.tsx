import { type JSX, onCleanup, onMount } from "solid-js";
import { Portal } from "solid-js/web";
import { FloatingMountContext } from "./floating/floatingMountContext";
import "./Overlay.css";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const focusTrapLayers: object[] = [];

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
  const previouslyFocused =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const layer = {};

  const focusableElements = () =>
    [...(overlayRef?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])].filter(
      (element) =>
        !element.hidden &&
        element.getAttribute("aria-hidden") !== "true" &&
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden",
    );

  onMount(() => {
    focusTrapLayers.push(layer);
    queueMicrotask(() => {
      if (
        focusTrapLayers.at(-1) !== layer ||
        !overlayRef ||
        overlayRef.contains(document.activeElement)
      )
        return;
      (focusableElements()[0] ?? overlayRef).focus();
    });

    const keepFocusInside = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || focusTrapLayers.at(-1) !== layer || !overlayRef) return;
      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        overlayRef.focus();
        return;
      }

      const [first] = focusable;
      const last = focusable.at(-1);
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !overlayRef.contains(active))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (active === last || !overlayRef.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", keepFocusInside);
    onCleanup(() => {
      document.removeEventListener("keydown", keepFocusInside);
      const wasTopLayer = focusTrapLayers.at(-1) === layer;
      const index = focusTrapLayers.indexOf(layer);
      if (index >= 0) focusTrapLayers.splice(index, 1);
      if (!(wasTopLayer && previouslyFocused?.isConnected)) return;
      const revealedLayer = focusTrapLayers.at(-1);
      queueMicrotask(() => {
        if (focusTrapLayers.at(-1) === revealedLayer && previouslyFocused.isConnected)
          previouslyFocused.focus();
      });
    });
  });

  return (
    <Portal mount={document.body}>
      <div
        aria-label={props.ariaLabel}
        aria-labelledby={props.ariaLabelledBy}
        aria-modal="true"
        class={`overlay ${props.align === "top" ? "overlay-top" : ""}`}
        onClick={(e) => e.target === e.currentTarget && props.onClose()}
        ref={overlayRef}
        role="dialog"
        tabIndex={-1}
      >
        <FloatingMountContext.Provider value={() => overlayRef}>
          {props.children}
        </FloatingMountContext.Provider>
      </div>
    </Portal>
  );
}
