import type { OverflowElement } from "@slock/slack-api";
import { Icon, Menu, showToast } from "@slock/ui";
import { createSignal, For } from "solid-js";
import BkText from "../BkText";

export default function Overflow(props: { el: OverflowElement }) {
  const [open, setOpen] = createSignal(false);

  return (
    <Menu
      class="bk-overflow-wrap"
      panelClass="menu-panel bk-overflow-menu"
      open={open()}
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          class="bk-overflow-btn"
          onClick={() => setOpen(!open())}
          title="More options"
        >
          <Icon name="ellipsis-vertical-filled" size={16} />
        </button>
      }
    >
      <For each={props.el.options}>
        {(opt) => (
          <button
            type="button"
            class="menu-item"
            onClick={() => {
              setOpen(false);
              if (opt.url) window.open(opt.url, "_blank", "noopener,noreferrer");
              else
                showToast("This option needs its app to respond — not supported in this client.");
            }}
          >
            <BkText text={opt.text} />
          </button>
        )}
      </For>
    </Menu>
  );
}
