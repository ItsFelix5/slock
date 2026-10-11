import { Mrkdwn } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import { IconButton, Menu, MenuItem } from "@slock/ui";
import { createEffect, createSignal, For, on, Show } from "solid-js";
import type { MessageHeaderProps } from "../../../messages/client/api";
import "./HeaderCanvasMenu.css";

const canvas = service("canvas");

export default function HeaderCanvasMenu(props: MessageHeaderProps) {
  const [open, setOpen] = createSignal(false);
  const canvases = () => (props.kind === "channel" ? canvas.canvasesFor(props.id) : []);
  createEffect(
    on(
      () => props.id,
      () => setOpen(false),
      { defer: true },
    ),
  );
  return (
    <Show when={canvases().length > 0}>
      <Menu
        align="end"
        onClose={() => setOpen(false)}
        open={open()}
        panelClass="menu-panel channel-header-canvas-menu"
        trigger={
          <IconButton
            class="channel-header-btn"
            icon="canvas-browser"
            onClick={() => setOpen(!open())}
            size="md"
          />
        }
      >
        <For each={canvases()}>
          {(item) => (
            <MenuItem
              icon="canvas-content"
              onClick={() => {
                setOpen(false);
                canvas.openCanvasPane(item.fileId, item.title);
              }}
            >
              <span class="truncate">
                <Mrkdwn text={item.title || "Untitled canvas"} />
              </span>
            </MenuItem>
          )}
        </For>
      </Menu>
    </Show>
  );
}
