import type { AlertBlock } from "@slock/types";
import { Show } from "solid-js";
import BkText from "../BkText";

export default function Alert(props: { block: AlertBlock }) {
  return (
    <section class={`bk-alert bk-alert--${props.block.level ?? "default"}`}>
      <Show when={props.block.title}>
        <strong>
          <BkText text={props.block.title} />
        </strong>
      </Show>
      <Show when={props.block.text}>
        <BkText text={props.block.text} />
      </Show>
    </section>
  );
}
