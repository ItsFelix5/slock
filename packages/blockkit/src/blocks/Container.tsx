import type { Block } from "@slock/slack-api";
import { For, type JSX } from "solid-js";

export default function Container(props: {
  blocks: Block[];
  render: (block: Block) => JSX.Element;
}) {
  return (
    <section class="bk-container">
      <For each={props.blocks}>{props.render}</For>
    </section>
  );
}
