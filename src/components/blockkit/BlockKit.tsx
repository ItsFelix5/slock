import { For, Match, Switch } from "solid-js";
import Actions from "./blocks/Actions";
import Context from "./blocks/Context";
import Divider from "./blocks/Divider";
import Header from "./blocks/Header";
import Image from "./blocks/Image";
import RichText from "./blocks/RichText";
import Section from "./blocks/Section";
import type { Block } from "./types";
import "./blockkit.css";

function BlockView(props: { block: Block }) {
  return (
    <Switch fallback={<div class="bk-unsupported">[unsupported block: {props.block.type}]</div>}>
      <Match when={props.block.type === "section"}>
        <Section block={props.block as any} />
      </Match>
      <Match when={props.block.type === "divider"}>
        <Divider />
      </Match>
      <Match when={props.block.type === "header"}>
        <Header block={props.block as any} />
      </Match>
      <Match when={props.block.type === "context"}>
        <Context block={props.block as any} />
      </Match>
      <Match when={props.block.type === "image"}>
        <Image block={props.block as any} />
      </Match>
      <Match when={props.block.type === "actions"}>
        <Actions block={props.block as any} />
      </Match>
      <Match when={props.block.type === "rich_text"}>
        <RichText block={props.block as any} />
      </Match>
    </Switch>
  );
}

export default function BlockKit(props: { blocks: Block[] }) {
  return (
    <div class="bk-root">
      <For each={props.blocks}>{(b) => <BlockView block={b} />}</For>
    </div>
  );
}
