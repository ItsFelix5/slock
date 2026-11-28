import "./IconButton.css";
import type { JSX } from "@solidjs/web";
import { omit } from "solid-js";
import Icon, { type IconName } from "../media/Icon";

interface IconButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  circular?: boolean;
  icon: IconName;
  iconSize?: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  tone?: "dim" | "accent";
}

export default function IconButton(props: IconButtonProps) {
  const rest = omit(
    props,
    "active",
    "circular",
    "class",
    "icon",
    "iconSize",
    "label",
    "size",
    "tone",
  );

  return (
    <button
      aria-label={props.label}
      class={[
        "btn-reset icon-btn icon-action",
        props.size,
        { circular: props.circular, active: props.active },
        props.tone && `text-${props.tone}`,
        props.class,
      ]}
      type="button"
      {...rest}
    >
      <Icon name={props.icon} size={props.iconSize ?? 16} />
    </button>
  );
}
