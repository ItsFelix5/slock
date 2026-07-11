import type { JSX } from "solid-js";
import "./ButtonGroup.css";

export interface ButtonGroupProps {
  children: JSX.Element;
  class?: string;
}

export default function ButtonGroup(props: ButtonGroupProps) {
  return <div class={`btn-group ${props.class || ""}`}>{props.children}</div>;
}
