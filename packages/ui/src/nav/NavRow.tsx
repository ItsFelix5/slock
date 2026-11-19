import { splitProps } from "solid-js";
import type { JSX } from "@solidjs/web";

const NESTED_INTERACTIVE = "a[href], button, input, select, textarea, summary, [role='button']";

export interface NavRowProps
  extends Omit<JSX.HTMLAttributes<HTMLDivElement>, "onClick" | "onKeyDown"> {
  onActivate: () => void;
  tabIndex: number;
}

export default function NavRow(props: NavRowProps) {
  const [local, rest] = splitProps(props, ["class", "classList", "onActivate"]);
  return (
    <div
      {...rest}
      class={`btn-reset ${local.class ?? ""}`}
      classList={local.classList}
      data-nav-row
      onClick={(event) => {
        const nested = event.target instanceof Element && event.target.closest(NESTED_INTERACTIVE);
        if (!nested || nested === event.currentTarget) local.onActivate();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (!event.repeat) local.onActivate();
      }}
      role="button"
    />
  );
}
