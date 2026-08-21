import type { JSX } from "solid-js";

export default function ClickableInline(props: {
  children: JSX.Element;
  class?: string;
  onActivate: () => void;
}) {
  const activate = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    props.onActivate();
  };
  return (
    <span
      class={`clickable-name ${props.class ?? ""}`}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        activate(e);
      }}
      role="button"
      tabIndex={0}
    >
      {props.children}
    </span>
  );
}
