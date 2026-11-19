import "./IconButton.css";
import { omit, Show } from "solid-js";
import type { JSX } from "@solidjs/web";
import Icon, { type IconName } from "../media/Icon";
import Tooltip from "../overlay/Tooltip";

export interface IconButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  circular?: boolean;
  hideTooltip?: boolean;
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
    "hideTooltip",
    "icon",
    "iconSize",
    "label",
    "size",
    "tone",
  );

  const button = (
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

  return (
    <Show fallback={button} when={props.label && !props.hideTooltip}>
      {(label) => <Tooltip content={label()}>{button}</Tooltip>}
    </Show>
  );
}
