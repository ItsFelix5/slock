import type {
  ActionsBlock,
  AlertBlock,
  Block,
  CardBlock,
  CarouselBlock,
  ContainerBlock,
  ContextActionsBlock,
  ContextBlock,
  DataVisualizationBlock,
  FileBlock,
  HeaderBlock,
  ImageBlock,
  InputBlock,
  MarkdownBlock,
  PlanBlock,
  RichTextBlock,
  SectionBlock,
  TableBlock,
  TaskCardBlock,
  VideoBlock,
} from "@slock/types";
import { For, type JSX, Match, Show, Switch } from "solid-js";
import "./blockkit.css";
import { Dynamic } from "solid-js/web";
import Alert from "./blocks/Alert";
import { Card, Carousel } from "./blocks/Card";
import Container from "./blocks/Container";
import Context from "./blocks/Context";
import { DataVisualization } from "./blocks/DataVisualization";
import Image from "./blocks/Image";
import Input from "./blocks/Input";
import RichText from "./blocks/RichText";
import Section from "./blocks/Section";
import { Table } from "./blocks/Table";
import { Plan, TaskCard } from "./blocks/TaskCard";
import Video from "./blocks/Video";
import ElementRenderer from "./elements/ElementRenderer";
import EmojiText from "./emoji/EmojiText";
import Mrkdwn from "./mrkdwn";

export interface BlockActionContext {
  botId?: string;
  botUserId?: string;
  channelId: string;
  messageTs: string;
  threadTs?: string;
}

function narrowBlock<T extends Block>(block: Block, matches: boolean): T | undefined {
  const generic: any = block;
  return matches ? generic : undefined;
}

function Divider() {
  return <hr class="bk-divider" />;
}

function Header(props: { block: HeaderBlock }) {
  return (
    <Dynamic component={"h" + (props.block.level ?? 1)} class="bk-header">
      <EmojiText text={props.block.text.text} />
    </Dynamic>
  );
}

function File(props: { block: FileBlock }) {
  return (
    <div class="bk-file" title={props.block.external_id}>
      Remote file shared from Slack
    </div>
  );
}

function Markdown(props: { block: MarkdownBlock }) {
  return (
    <div class="bk-markdown">
      <Mrkdwn text={props.block.text} />
    </div>
  );
}

function Actions(props: { block: ActionsBlock; context?: BlockActionContext }) {
  return (
    <div class="bk-actions">
      <For each={props.block.elements}>
        {(el) => <ElementRenderer blockId={props.block.block_id} context={props.context} el={el} />}
      </For>
    </div>
  );
}

function BlockView(props: { block: Block; context?: BlockActionContext; trailing?: JSX.Element }) {
  return (
    <Switch fallback={<div class="bk-unsupported">[unsupported block: {props.block.type}]</div>}>
      <Match when={narrowBlock<SectionBlock>(props.block, props.block.type === "section")}>
        {(block) => <Section block={block()} context={props.context} />}
      </Match>
      <Match when={props.block.type === "divider"}>
        <Divider />
      </Match>
      <Match when={narrowBlock<HeaderBlock>(props.block, props.block.type === "header")}>
        {(block) => <Header block={block()} />}
      </Match>
      <Match when={narrowBlock<ContextBlock>(props.block, props.block.type === "context")}>
        {(block) => <Context block={block()} />}
      </Match>
      <Match when={narrowBlock<ImageBlock>(props.block, props.block.type === "image")}>
        {(block) => <Image block={block()} />}
      </Match>
      <Match when={narrowBlock<ActionsBlock>(props.block, props.block.type === "actions")}>
        {(block) => <Actions block={block()} context={props.context} />}
      </Match>
      <Match when={narrowBlock<InputBlock>(props.block, props.block.type === "input")}>
        {(block) => <Input block={block()} context={props.context} />}
      </Match>
      <Match when={narrowBlock<RichTextBlock>(props.block, props.block.type === "rich_text")}>
        {(block) => <RichText block={block()} trailing={props.trailing} />}
      </Match>
      <Match when={narrowBlock<MarkdownBlock>(props.block, props.block.type === "markdown")}>
        {(block) => <Markdown block={block()} />}
      </Match>
      <Match when={narrowBlock<FileBlock>(props.block, props.block.type === "file")}>
        {(block) => <File block={block()} />}
      </Match>
      <Match when={narrowBlock<VideoBlock>(props.block, props.block.type === "video")}>
        {(block) => <Video block={block()} />}
      </Match>
      <Match when={narrowBlock<CardBlock>(props.block, props.block.type === "card")}>
        {(block) => <Card block={block()} context={props.context} />}
      </Match>
      <Match when={narrowBlock<CarouselBlock>(props.block, props.block.type === "carousel")}>
        {(block) => <Carousel block={block()} context={props.context} />}
      </Match>
      <Match when={narrowBlock<ContainerBlock>(props.block, props.block.type === "container")}>
        {(block) => (
          <Container
            block={block()}
            render={(inner) => <BlockView block={inner} context={props.context} />}
          />
        )}
      </Match>
      <Match
        when={narrowBlock<ContextActionsBlock>(props.block, props.block.type === "context_actions")}
      >
        {(block) => <Actions block={{ ...block(), type: "actions" }} context={props.context} />}
      </Match>
      <Match
        when={narrowBlock<TableBlock>(
          props.block,
          props.block.type === "table" || props.block.type === "data_table",
        )}
      >
        {(block) => <Table block={block()} />}
      </Match>
      <Match
        when={narrowBlock<DataVisualizationBlock>(
          props.block,
          props.block.type === "data_visualization",
        )}
      >
        {(block) => <DataVisualization block={block()} />}
      </Match>
      <Match when={narrowBlock<TaskCardBlock>(props.block, props.block.type === "task_card")}>
        {(block) => <TaskCard block={block()} />}
      </Match>
      <Match when={narrowBlock<PlanBlock>(props.block, props.block.type === "plan")}>
        {(block) => <Plan block={block()} />}
      </Match>
      <Match when={narrowBlock<AlertBlock>(props.block, props.block.type === "alert")}>
        {(block) => <Alert block={block()} />}
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
    const lastBlock = props.blocks.at(-1);
    if (!lastBlock) return false;
    const richText = narrowBlock<RichTextBlock>(lastBlock, lastBlock.type === "rich_text");
    return richText?.elements.at(-1)?.type === "rich_text_section";
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
