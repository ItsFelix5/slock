import { type JSX, splitProps } from "solid-js";
import Icon, { type IconName } from "../media/Icon";
import Tooltip from "../overlay/Tooltip";

export interface IconButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  circular?: boolean;
  icon: IconName;
  iconSize?: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  tone?: "dim" | "accent";
}

export default function IconButton(props: IconButtonProps) {
  const [local, rest] = splitProps(props, [
    "active",
    "circular",
    "class",
    "icon",
    "iconSize",
    "label",
    "size",
    "tone",
  ]);

  const button = (
    <button
      aria-label={local.label}
      class={[
        "btn-reset icon-btn icon-action",
        local.size,
        local.circular && "circular",
        local.tone && `text-${local.tone}`,
        local.active && "active",
        local.class,
      ]
        .filter(Boolean)
        .join(" ")}
      type="button"
      {...rest}
    >
      <Icon name={local.icon} size={local.iconSize ?? 16} />
    </button>
  );

  return local.label ? <Tooltip content={local.label}>{button}</Tooltip> : button;
}
