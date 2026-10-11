import { getHost } from "@slock/core/solid";
import type { Message } from "@slock/types";
import { Show } from "solid-js";
import { Dynamic } from "solid-js/web";

export default function EditedLabel(props: { msg: Message }) {
  const history = () => getHost().items("messages.edited")[0];
  return (
    <Show
      fallback={<span class="message-edited"> (edited)</span>}
      when={props.msg.editHistory?.length ? history() : undefined}
    >
      {(component) => <Dynamic component={component()} msg={props.msg} />}
    </Show>
  );
}
