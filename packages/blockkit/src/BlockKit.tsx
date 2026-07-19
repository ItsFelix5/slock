import type {
  ActionsBlock,
  Block,
  ContextBlock,
  HeaderBlock,
  ImageBlock,
  InputBlock,
  RichTextBlock,
  SectionBlock,
} from "@slock/slack-api";
import { For, type JSX, Match, Show, Switch } from "solid-js";
import Actions from "./blocks/Actions";
import Context from "./blocks/Context";
import Divider from "./blocks/Divider";
import Header from "./blocks/Header";
import Image from "./blocks/Image";
import Input from "./blocks/Input";
import RichText from "./blocks/RichText";
import Section from "./blocks/Section";
import "./blockkit.css";

// The message a set of blocks was posted as, threaded down to interactive
// elements (Button, Overflow) so a click can be dispatched back to the app
// that owns it — see runBlockAction. Omitted (e.g. a link-unfurl preview in
// AttachmentCard) when there's no real message to act on, in which case
// interactive elements fall back to their "unsupported" placeholder.
export interface BlockActionContext {
  botId?: string;
  channelId: string;
  messageTs: string;
  threadTs?: string;
}

function BlockView(props: { block: Block; context?: BlockActionContext; trailing?: JSX.Element }) {
  return (
    <Switch fallback={<div class="bk-unsupported">[unsupported block: {props.block.type}]</div>}>
      <Match when={props.block.type === "section"}>
        <Section block={props.block as SectionBlock} context={props.context} />
      </Match>
      <Match when={props.block.type === "divider"}>
        <Divider />
      </Match>
      <Match when={props.block.type === "header"}>
        <Header block={props.block as HeaderBlock} />
      </Match>
      <Match when={props.block.type === "context"}>
        <Context block={props.block as ContextBlock} />
      </Match>
      <Match when={props.block.type === "image"}>
        <Image block={props.block as ImageBlock} />
      </Match>
      <Match when={props.block.type === "actions"}>
        <Actions block={props.block as ActionsBlock} context={props.context} />
      </Match>
      <Match when={props.block.type === "input"}>
        <Input block={props.block as InputBlock} />
      </Match>
      <Match when={props.block.type === "rich_text"}>
        <RichText block={props.block as RichTextBlock} trailing={props.trailing} />
      </Match>
    </Switch>
  );
}

export default function BlockKit(props: {
  blocks: Block[];
  context?: BlockActionContext;
  trailing?: JSX.Element;
}) {
  const canPlaceTrailingInline = () => {
    const { blocks } = props;
    const lastBlock = blocks.at(-1);
    if (lastBlock?.type !== "rich_text") return false;
    const { elements } = lastBlock as RichTextBlock;
    return elements.at(-1)?.type === "rich_text_section";
  };

  return (
    <>
      <div class="bk-root">
        <For each={props.blocks}>
          {(b, index) => (
            <BlockView
              block={b}
              context={props.context}
              trailing={
                index() === props.blocks.length - 1 && canPlaceTrailingInline()
                  ? props.trailing
                  : undefined
              }
            />
          )}
        </For>
      </div>
      <Show when={props.trailing && !canPlaceTrailingInline()}>{props.trailing}</Show>
    </>
  );
}
