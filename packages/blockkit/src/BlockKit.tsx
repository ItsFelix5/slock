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
import { narrowByType } from "@slock/types";
import { For, type JSX, Match, Show, Switch } from "solid-js";
import Mrkdwn from "./mrkdwn";
import "./BlockKit.css";
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

export interface BlockActionContext {
  botId?: string;
  botUserId?: string;
  channelId: string;
  messageTs: string;
  threadTs?: string;
}

function Divider() {
  return <hr class="bk-divider" />;
}

function Header(props: { block: HeaderBlock }) {
  return (
    <Dynamic component={`h${props.block.level ?? 1}`} class="bk-header">
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
      <Match when={narrowByType<Block, SectionBlock>(props.block, "section")}>
        {(block) => <Section block={block()} context={props.context} />}
      </Match>
      <Match when={props.block.type === "divider"}>
        <Divider />
      </Match>
      <Match when={narrowByType<Block, HeaderBlock>(props.block, "header")}>
        {(block) => <Header block={block()} />}
      </Match>
      <Match when={narrowByType<Block, ContextBlock>(props.block, "context")}>
        {(block) => <Context block={block()} />}
      </Match>
      <Match when={narrowByType<Block, ImageBlock>(props.block, "image")}>
        {(block) => <Image block={block()} />}
      </Match>
      <Match when={narrowByType<Block, ActionsBlock>(props.block, "actions")}>
        {(block) => <Actions block={block()} context={props.context} />}
      </Match>
      <Match when={narrowByType<Block, InputBlock>(props.block, "input")}>
        {(block) => <Input block={block()} context={props.context} />}
      </Match>
      <Match when={narrowByType<Block, RichTextBlock>(props.block, "rich_text")}>
        {(block) => <RichText block={block()} trailing={props.trailing} />}
      </Match>
      <Match when={narrowByType<Block, MarkdownBlock>(props.block, "markdown")}>
        {(block) => <Markdown block={block()} />}
      </Match>
      <Match when={narrowByType<Block, FileBlock>(props.block, "file")}>
        {(block) => <File block={block()} />}
      </Match>
      <Match when={narrowByType<Block, VideoBlock>(props.block, "video")}>
        {(block) => <Video block={block()} />}
      </Match>
      <Match when={narrowByType<Block, CardBlock>(props.block, "card")}>
        {(block) => <Card block={block()} context={props.context} />}
      </Match>
      <Match when={narrowByType<Block, CarouselBlock>(props.block, "carousel")}>
        {(block) => <Carousel block={block()} context={props.context} />}
      </Match>
      <Match when={narrowByType<Block, ContainerBlock>(props.block, "container")}>
        {(block) => (
          <Container
            block={block()}
            render={(inner) => <BlockView block={inner} context={props.context} />}
          />
        )}
      </Match>
      <Match when={narrowByType<Block, ContextActionsBlock>(props.block, "context_actions")}>
        {(block) => <Actions block={{ ...block(), type: "actions" }} context={props.context} />}
      </Match>
      <Match
        when={
          narrowByType<Block, TableBlock>(props.block, "table") ??
          narrowByType<Block, TableBlock>(props.block, "data_table")
        }
      >
        {(block) => <Table block={block()} />}
      </Match>
      <Match when={narrowByType<Block, DataVisualizationBlock>(props.block, "data_visualization")}>
        {(block) => <DataVisualization block={block()} />}
      </Match>
      <Match when={narrowByType<Block, TaskCardBlock>(props.block, "task_card")}>
        {(block) => <TaskCard block={block()} />}
      </Match>
      <Match when={narrowByType<Block, PlanBlock>(props.block, "plan")}>
        {(block) => <Plan block={block()} />}
      </Match>
      <Match when={narrowByType<Block, AlertBlock>(props.block, "alert")}>
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
    const richText = narrowByType<Block, RichTextBlock>(lastBlock, "rich_text");
    return richText?.elements.at(-1)?.type === "rich_text_section";
  };

  return (
    <>
      <div class="bk-root flex-col gap-sm">
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
