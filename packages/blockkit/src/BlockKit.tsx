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
} from "@slock/slack-api";
import { For, type JSX, Match, Show, Switch } from "solid-js";
import "./blockkit.css";
import Actions from "./blocks/Actions";
import Alert from "./blocks/Alert";
import { Card, Carousel } from "./blocks/Card";
import Container from "./blocks/Container";
import Context from "./blocks/Context";
import { DataVisualization } from "./blocks/DataVisualization";
import Divider from "./blocks/Divider";
import File from "./blocks/File";
import Header from "./blocks/Header";
import Image from "./blocks/Image";
import Input from "./blocks/Input";
import Markdown from "./blocks/Markdown";
import RichText from "./blocks/RichText";
import Section from "./blocks/Section";
import { Table } from "./blocks/Table";
import { Plan, TaskCard } from "./blocks/TaskCard";
import Video from "./blocks/Video";

export interface BlockActionContext {
  botId?: string;
  botUserId?: string;
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
        <Input block={props.block as InputBlock} context={props.context} />
      </Match>
      <Match when={props.block.type === "rich_text"}>
        <RichText block={props.block as RichTextBlock} trailing={props.trailing} />
      </Match>
      <Match when={props.block.type === "markdown"}>
        <Markdown block={props.block as MarkdownBlock} />
      </Match>
      <Match when={props.block.type === "file"}>
        <File block={props.block as FileBlock} />
      </Match>
      <Match when={props.block.type === "video"}>
        <Video block={props.block as VideoBlock} />
      </Match>
      <Match when={props.block.type === "card"}>
        <Card block={props.block as CardBlock} context={props.context} />
      </Match>
      <Match when={props.block.type === "carousel"}>
        <Carousel block={props.block as CarouselBlock} context={props.context} />
      </Match>
      <Match when={props.block.type === "container"}>
        <Container
          block={props.block as ContainerBlock}
          render={(block) => <BlockView block={block} context={props.context} />}
        />
      </Match>
      <Match when={props.block.type === "context_actions"}>
        <Actions
          block={{ ...(props.block as ContextActionsBlock), type: "actions" }}
          context={props.context}
        />
      </Match>
      <Match when={props.block.type === "table" || props.block.type === "data_table"}>
        <Table block={props.block as TableBlock} />
      </Match>
      <Match when={props.block.type === "data_visualization"}>
        <DataVisualization block={props.block as DataVisualizationBlock} />
      </Match>
      <Match when={props.block.type === "task_card"}>
        <TaskCard block={props.block as TaskCardBlock} />
      </Match>
      <Match when={props.block.type === "plan"}>
        <Plan block={props.block as PlanBlock} />
      </Match>
      <Match when={props.block.type === "alert"}>
        <Alert block={props.block as AlertBlock} />
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
