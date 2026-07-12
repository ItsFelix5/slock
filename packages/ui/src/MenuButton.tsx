import { createSignal, Show } from "solid-js";
import Icon, { type IconName } from "./Icon";
import Menu, { type MenuProps } from "./Menu";
import "./MenuButton.css";

export interface MenuButtonProps extends Omit<MenuProps, "trigger" | "class" | "open" | "onClose"> {
  icon: IconName;
  label?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  class?: string;
  panelClass?: string;
}

// Self-contained trigger + menu: unlike Menu itself (which is fully controlled by
// its caller), MenuButton owns its own open state so the button it renders is
// clickable out of the box.
export default function MenuButton(props: MenuButtonProps) {
  const [open, setOpen] = createSignal(false);
  return (
    <Menu
      class={`menu-button-wrap ${props.class || ""}`}
      panelClass={`menu-panel ${props.panelClass || ""}`}
      open={open()}
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          class={`menu-button btn-${props.variant || "secondary"} btn-${props.size || "md"}`}
          onClick={() => setOpen(!open())}
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
