import type { JSX } from "solid-js";

export default function ClickableInline(props: {
  children: JSX.Element;
  class?: string;
  onActivate: () => void;
}) {
  return (
    <button
      class={`btn-reset clickable-name ${props.class ?? ""}`}
      onClick={(e) => {
        e.stopPropagation();
        props.onActivate();
      }}
      type="button"
    >
      {props.children}
    </button>
  );
}
