import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import "./Button.css";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  disabled?: boolean;
  icon?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "danger";
}

export default function Button(props: ButtonProps) {
  const rest = omit(props, "variant", "size", "icon", "disabled", "children", "class");

  return (
    <button
      class={[
        "btn",
        `btn-${props.variant ?? "secondary"}`,
        `btn-${props.size ?? "md"}`,
        { "btn-icon": props.icon, "btn-disabled": props.disabled },
        props.class,
      ]}
      disabled={props.disabled}
      {...rest}
    >
      {props.children}
    </button>
  );
}
