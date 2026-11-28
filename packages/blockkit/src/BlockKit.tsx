import { narrowByType } from "@slock/core";
import { Isolated } from "@slock/core/solid";
import type {
  ActionsBlock,
  AlertBlock,
  Block,
  CardBlock,
  CarouselBlock,
  ChannelId,
  ContainerBlock,
  ContextActionsBlock,
  ContextBlock,
  DataVisualizationBlock,
  FileBlock,
  HeaderBlock,
  ImageBlock,
  InputBlock,
  LayoutBlock,
  MarkdownBlock,
  PlanBlock,
  RichTextBlock,
  SectionBlock,
  TableBlock,
  TaskCardBlock,
  Ts,
  VideoBlock,
} from "@slock/types";
import type { JSX } from "@solidjs/web";
import { For, Match, Show, Switch } from "solid-js";
import Mrkdwn from "./mrkdwn/mrkdwn";
import "./BlockKit.css";
import { dynamic } from "@solidjs/web";
import type { ViewState } from "./actions/viewState";
import Alert from "./blocks/Alert";
import { Card, Carousel } from "./blocks/Card";
import Container from "./blocks/Container";
import Context from "./blocks/Context";
import { DataVisualization } from "./blocks/DataVisualization";
import Image from "./blocks/Image";
import Input from "./blocks/Input";
import Layout from "./blocks/Layout";
import RichText from "./blocks/RichText";
import Section from "./blocks/Section";
import { Table } from "./blocks/Table";
import { Plan, TaskCard } from "./blocks/TaskCard";
import Video from "./blocks/Video";
import ElementRenderer from "./elements/ElementRenderer";
import EmojiText from "./emoji/EmojiText";
import Unsupported from "./Unsupported";

export interface BlockActionContext {
  attachmentId?: number;
  botId?: string;
  botTeamId?: string;
  botUserId?: string;
  channelId?: ChannelId;
  isEphemeral?: boolean;
  messageTs?: Ts;
  threadTs?: Ts;
  view?: {
    blocks: () => Block[];
    errors: () => Record<string, string>;
    id: string;
    state: ViewState;
  };
}

function Divider() {
  return <hr class="bk-divider" />;
}

function Header(props: { block: HeaderBlock }) {
  const Heading = dynamic(() => `h${props.block.level ?? 1}` as const);
  return (
    <Heading class="bk-header">
      <EmojiText text={props.block.text.text} />
    </Heading>
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

type BlockViewProps = { block: Block; context?: BlockActionContext; trailing?: JSX.Element };

function BlockView(props: BlockViewProps) {
  return (
    <Isolated fallback={<div class="bk-unsupported">Can't show this block</div>} name="block">
      <BlockSwitch {...props} />
    </Isolated>
  );
}

function BlockSwitch(props: BlockViewProps) {
  const renderBlock = (inner: Block) => <BlockView block={inner} context={props.context} />;
  return (
    <Switch fallback={<Unsupported kind="block" type={props.block.type} />}>
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
        {(block) => <Container block={block()} render={renderBlock} />}
      </Match>
      <Match when={narrowByType<Block, LayoutBlock>(props.block, "layout")}>
        {(block) => <Layout block={block()} render={renderBlock} />}
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
        {(block) => <Table block={block()} context={props.context} />}
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
  inert?: boolean;
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
      <div class="bk-root flex-col gap-sm" inert={props.inert}>
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
