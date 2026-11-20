import { getHost } from "@slock/core/solid";
import type { Message } from "@slock/types";
import { dynamic } from "@solidjs/web";
import { Show } from "solid-js";

export default function EditedLabel(props: { msg: Message }) {
  const history = () => getHost().items("messages.edited")[0];
  const History = dynamic(history);
  return (
    <Show
      fallback={<span class="message-edited"> (edited)</span>}
      when={props.msg.editHistory?.length ? history() : undefined}
    >
      <History msg={props.msg} />
    </Show>
  );
}
