import type { JSX } from "@solidjs/web";

export default function RowButton(props: {
  active: boolean;
  children: JSX.Element;
  class?: string;
  onActivate: (split: boolean) => void;
  onHover: () => void;
}) {
  return (
    <button
      class={["search-row btn-reset flex-align-center", props.class, { active: props.active }]}
      onClick={(event) => props.onActivate(event.shiftKey)}
      onMouseMove={() => props.onHover()}
      tabindex={-1}
      type="button"
    >
      {props.children}
    </button>
  );
}
