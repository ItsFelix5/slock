import type { OverflowElement } from "@slock/types";
import { confirmDialog, Icon, Menu } from "@slock/ui";
import { createSignal, For, Show } from "solid-js";
import BkText from "../BkText";
import type { BlockActionContext } from "../BlockKit";
import { useBlockActionDispatch } from "../useBlockActionDispatch";
import "./Controls.css";

export default function Overflow(props: {
  blockId?: string;
  context?: BlockActionContext;
  el: OverflowElement;
}) {
  const [open, setOpen] = createSignal(false);
  const { canDispatch, dispatch, flashUnsupported, unsupported } = useBlockActionDispatch(
    () => props.context,
  );

  const selectOption = async (opt: OverflowElement["options"][number]) => {
    if (opt.url) {
      setOpen(false);
      window.open(opt.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (props.el.confirm) {
      const c = props.el.confirm;
      const ok = await confirmDialog({
        cancelLabel: c.deny.text,
        confirmLabel: c.confirm.text,
        danger: c.style === "danger",
        message: c.text.text,
        title: c.title.text,
      });
      if (!ok) return;
    }
    if (!canDispatch(props.el.action_id)) {
      flashUnsupported();
      return;
    }
    setOpen(false);
    dispatch({
      action_id: props.el.action_id,
      block_id: props.blockId,
      selected_option: {
        text: opt.text,
        ...(opt.value === undefined ? {} : { value: opt.value }),
      },
      type: "overflow",
    });
  };

  return (
    <Menu
      class="bk-overflow-wrap"
      onClose={() => setOpen(false)}
      open={open()}
      panelClass="menu-panel bk-overflow-menu"
      trigger={
        <button
          class="bk-overflow-btn"
          onClick={() => setOpen(!open())}
          title={
            canDispatch(props.el.action_id) ? "More options" : "This menu needs its app to respond"
          }
          type="button"
        >
          <Icon name="ellipsis-vertical-filled" size={16} />
        </button>
      }
    >
      <For each={props.el.options}>
        {(opt) => (
          <button class="menu-item" onClick={() => selectOption(opt)} type="button">
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
