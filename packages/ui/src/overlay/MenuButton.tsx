import { Show } from "solid-js";
import Icon, { type IconName } from "../media/Icon";
import Menu, { type MenuProps } from "./Menu";
import "./MenuButton.css";

export interface MenuButtonProps extends Omit<MenuProps, "trigger" | "class"> {
  icon: IconName;
  label?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  class?: string;
  panelClass?: string;
}

export default function MenuButton(props: MenuButtonProps) {
  return (
    <Menu
      class={`menu-button-wrap ${props.class || ""}`}
      panelClass={`menu-panel ${props.panelClass || ""}`}
      open={props.open}
      onClose={props.onClose}
      trigger={
        <button
          type="button"
          class={`menu-button btn-${props.variant || "secondary"} btn-${props.size || "md"}`}
        >
          <Icon name={props.icon} />
          <Show when={props.label}>{props.label}</Show>
        </button>
      }
    >
      {props.children}
    </Menu>
  );
}
