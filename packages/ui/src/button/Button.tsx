import { type JSX, mergeProps, splitProps } from "solid-js";
import "./Button.css";

export interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  disabled?: boolean;
  icon?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

export default function Button(props: ButtonProps) {
  const merged = mergeProps({ size: "md", variant: "secondary" }, props);
  const [, rest] = splitProps(merged, ["variant", "size", "icon", "disabled", "children"]);

  return (
    <button
      class={[
        "btn",
        `btn-${merged.variant}`,
        `btn-${merged.size}`,
        merged.icon && "btn-icon",
        merged.disabled && "btn-disabled",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={merged.disabled}
      {...rest}
    >
      {merged.children}
    </button>
  );
}
