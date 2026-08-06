import type { JSX } from "solid-js";
import { listNavigationIndex } from "../form/listNavigation";
import "./SegmentedControl.css";

export interface SegmentedControlProps {
  children: JSX.Element;
  class?: string;
}

export default function SegmentedControl(props: SegmentedControlProps) {
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let rootRef: HTMLDivElement | undefined;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    const segments = [
      ...(rootRef?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []),
    ];
    const current = segments.indexOf(document.activeElement as HTMLButtonElement);
    if (current < 0) return;
    const next = listNavigationIndex(
      event.key === "ArrowRight" ? "ArrowDown" : "ArrowUp",
      current,
      segments.length,
    );
    if (next === undefined) return;
    event.preventDefault();
    segments[next]?.focus();
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: delegates arrow-key movement to the caller-provided segment buttons, which are the real interactive elements
    <div class={`segmented-control ${props.class || ""}`} onKeyDown={onKeyDown} ref={rootRef}>
      {props.children}
    </div>
  );
}
