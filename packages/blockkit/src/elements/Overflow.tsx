import type { OverflowElement } from "@slock/slack-api";
import { Icon, Menu } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import BkText from "../BkText";

export default function Overflow(props: { el: OverflowElement }) {
  const [open, setOpen] = createSignal(false);
  const [unsupported, setUnsupported] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  return (
    <Menu
      class="bk-overflow-wrap"
      panelClass="menu-panel bk-overflow-menu"
      open={open()}
      onClose={() => {
        setOpen(false);
        setUnsupported(false);
      }}
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
              if (opt.url) {
                setOpen(false);
                window.open(opt.url, "_blank", "noopener,noreferrer");
                return;
              }
              clearTimeout(timer);
              setUnsupported(true);
              timer = setTimeout(() => setUnsupported(false), 2000);
            }}
          >
            <BkText text={opt.text} />
          </button>
        )}
      </For>
      <Show when={unsupported()}>
        <div class="bk-overflow-unsupported">This option needs its app to respond.</div>
      </Show>
    </Menu>
  );
}
