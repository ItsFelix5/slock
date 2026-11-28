import type { JSX } from "@solidjs/web";
import { useTabStripShortcuts } from "../hooks/useNavShortcuts";
import "./SegmentedControl.css";

const SEGMENT_SELECTOR = "button:not(:disabled)";

interface SegmentedControlProps {
  children: JSX.Element;
  class?: string;
}

export default function SegmentedControl(props: SegmentedControlProps) {
  let rootRef: HTMLDivElement | undefined;

  useTabStripShortcuts({
    activate: (segment) => segment.focus(),
    items: () => [...(rootRef?.querySelectorAll<HTMLElement>(SEGMENT_SELECTOR) ?? [])],
    root: () => rootRef,
    selector: SEGMENT_SELECTOR,
  });

  return (
    <div class={`segmented-control ${props.class || ""}`} ref={rootRef}>
      {props.children}
    </div>
  );
}
