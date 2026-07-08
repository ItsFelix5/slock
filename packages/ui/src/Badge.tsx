import { Show } from "solid-js";
import Icon, { type IconName } from "./Icon";
import "./Badge.css";

export interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger";
  icon?: IconName;
  count?: number;
  dot?: boolean;
  class?: string;
}

export default function Badge(props: BadgeProps) {
  return (
    <div class={`badge badge-${props.variant || "default"} ${props.class || ""}`}>
      <Show when={props.icon}>
        <Icon name={props.icon!} />
      </Show>
      <Show when={!props.icon && props.dot} fallback={<span>{props.count}</span>}>
        <span class="badge-dot" />
      </Show>
    </div>
  );
}
