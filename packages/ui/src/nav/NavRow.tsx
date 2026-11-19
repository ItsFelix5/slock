import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";

const NESTED_INTERACTIVE = "a[href], button, input, select, textarea, summary, [role='button']";

export interface NavRowProps
  extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "onClick" | "onKeyDown"> {
  onActivate: () => void;
  tabindex: number;
}

export default function NavRow(props: NavRowProps) {
  const rest = omit(props, "class", "onActivate");
  return (
    <div
      {...rest}
      class={["btn-reset", props.class]}
      data-nav-row
      onClick={(event) => {
        const nested = event.target instanceof Element && event.target.closest(NESTED_INTERACTIVE);
        if (!nested || nested === event.currentTarget) props.onActivate();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (!event.repeat) props.onActivate();
      }}
      role="button"
    />
  );
}
