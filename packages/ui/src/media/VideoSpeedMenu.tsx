import { createSignal, For } from "solid-js";
import Menu from "../overlay/menu/Menu";
import MenuItem from "../overlay/menu/MenuItem";
import Icon from "./Icon";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export default function VideoSpeedMenu(props: { onSpeed: (value: number) => void; speed: number }) {
  const [open, setOpen] = createSignal(false);
  return (
    <Menu
      onClose={() => setOpen(false)}
      open={open()}
      panelClass="menu-panel video-player-speed-panel"
      trigger={
        <button
          class="video-player-speed video-player-chrome btn-reset flex-align-center"
          onClick={() => setOpen(!open())}
          type="button"
        >
          {props.speed}x
          <Icon name="caret-down" size={9} />
        </button>
      }
    >
      <For each={SPEEDS}>
        {(value) => (
          <MenuItem
            classList={{ active: props.speed === value }}
            onClick={() => {
              props.onSpeed(value);
              setOpen(false);
            }}
          >
            {value}x
          </MenuItem>
        )}
      </For>
    </Menu>
  );
}
