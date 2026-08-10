import { type JSX, Show, splitProps } from "solid-js";
import Icon, { type IconName } from "../../media/Icon";
import "./MenuButton.css";

export interface MenuItemProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  danger?: boolean;
  icon?: IconName;
  iconSize?: number;
  leading?: JSX.Element;
}

export default function MenuItem(props: MenuItemProps) {
  const [local, rest] = splitProps(props, [
    "class",
    "danger",
    "icon",
    "iconSize",
    "leading",
    "children",
  ]);
  return (
    <button
      class={["menu-item", local.danger && "danger", local.class].filter(Boolean).join(" ")}
      type="button"
      {...rest}
    >
      {local.leading}
      <Show when={local.icon}>{(name) => <Icon name={name()} size={local.iconSize ?? 15} />}</Show>
      {local.children}
    </button>
  );
}
