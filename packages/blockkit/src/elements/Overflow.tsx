import type { OverflowElement } from "@slock/slack-api";
import { Icon, showToast } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import BkText from "../BkText";

export default function Overflow(props: { el: OverflowElement }) {
  const [open, setOpen] = createSignal(false);

  return (
    <div class="bk-overflow-wrap">
      <button
        type="button"
        class="bk-overflow-btn"
        onClick={() => setOpen(!open())}
        title="More options"
      >
        <Icon name="ellipsis-vertical-filled" size={16} />
      </button>
      <Show when={open()}>
        <div class="bk-overflow-menu">
          <For each={props.el.options}>
            {(opt) => (
              <button
                type="button"
                class="bk-overflow-item"
                onClick={() => {
                  setOpen(false);
                  if (opt.url) window.open(opt.url, "_blank", "noopener,noreferrer");
                  else
                    showToast(
                      "This option needs its app to respond — not supported in this client.",
                    );
                }}
              >
                <BkText text={opt.text} />
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
