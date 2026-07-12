import type { JSX } from "solid-js";
import "./SegmentedControl.css";

export interface SegmentedControlProps {
  children: JSX.Element;
  class?: string;
}

export default function SegmentedControl(props: SegmentedControlProps) {
  return <div class={`segmented-control ${props.class || ""}`}>{props.children}</div>;
}
