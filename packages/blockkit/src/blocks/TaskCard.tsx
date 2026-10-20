import type { PlanBlock, TaskCardBlock } from "@slock/types";
import { Icon } from "@slock/ui";
import { For, type JSX, Show } from "solid-js";
import BkText from "../BkText";
import RichText from "./RichText";
import "./TaskCard.css";

function Disclosure(props: {
  children: JSX.Element;
  status?: TaskCardBlock["status"];
  title: JSX.Element;
}) {
  return (
    <details class="bk-disclosure" open>
      <summary class="bk-disclosure-summary flex-align-center">
        <Show
          fallback={<span class={`bk-task-status bk-task-status--${props.status ?? "pending"}`} />}
          when={props.status === "complete"}
        >
          <Icon class="bk-task-done" name="check-circle-filled" size={14} />
        </Show>
        <span>{props.title}</span>
        <Icon class="bk-disclosure-caret" name="caret-down" size={12} />
      </summary>
      <div class="bk-disclosure-body flex-col">{props.children}</div>
    </details>
  );
}

export function TaskCard(props: { block: TaskCardBlock }) {
  return (
    <Disclosure status={props.block.status} title={props.block.title}>
      <Show when={props.block.details}>{(details) => <RichText block={details()} />}</Show>
      <Show when={props.block.output}>{(output) => <RichText block={output()} />}</Show>
      <Show when={props.block.sources?.length}>
        <div class="bk-task-sources">
          <For each={props.block.sources}>
            {(source) => (
              <a class="bk-link" href={source.url} rel="noopener noreferrer" target="_blank">
                {source.text}
              </a>
            )}
          </For>
        </div>
      </Show>
    </Disclosure>
  );
}

export function Plan(props: { block: PlanBlock }) {
  const tasks = () => props.block.tasks ?? [];
  return (
    <Disclosure
      status={tasks().every((task) => task.status === "complete") ? "complete" : "pending"}
      title={
        typeof props.block.title === "string" ? (
          props.block.title
        ) : (
          <BkText text={props.block.title} />
        )
      }
    >
      <For each={tasks()}>{(task) => <TaskCard block={task} />}</For>
    </Disclosure>
  );
}
