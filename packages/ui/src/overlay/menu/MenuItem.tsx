import type { JSX } from "@solidjs/web";
import { omit, Show } from "solid-js";
import Icon, { type IconName } from "../../media/Icon";
import "./Menu.css";

export interface MenuItemProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  danger?: boolean;
  icon?: IconName;
  iconSize?: number;
  leading?: JSX.Element;
}

export default function MenuItem(props: MenuItemProps) {
  const rest = omit(props, "class", "danger", "icon", "iconSize", "leading", "children");
  return (
    <button class={["menu-item", { danger: props.danger }, props.class]} type="button" {...rest}>
      {props.leading}
      <Show when={props.icon}>{(name) => <Icon name={name()} size={props.iconSize ?? 15} />}</Show>
      {props.children}
    </button>
  );
}
