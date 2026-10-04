import type { PlanBlock, TaskCardBlock } from "@slock/types";
import { For, Show } from "solid-js";
import BkText from "../BkText";
import RichText from "./RichText";
import "./TaskCard.css";

export function TaskCard(props: { block: TaskCardBlock }) {
  return (
    <article class="bk-task-card">
      <div class="bk-task-heading flex-align-center">
        <span class={`bk-task-status bk-task-status--${props.block.status ?? "pending"}`} />
        <strong>{props.block.title}</strong>
      </div>
      <Show when={props.block.details}>
        {(details) => (
          <div class="bk-task-details">
            <RichText block={details()} />
          </div>
        )}
      </Show>
      <Show when={props.block.output}>
        {(output) => (
          <div class="bk-task-output">
            <RichText block={output()} />
          </div>
        )}
      </Show>
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
    </article>
  );
}

export function Plan(props: { block: PlanBlock }) {
  return (
    <section class="bk-plan flex-col">
      <div class="bk-plan-title">
        {typeof props.block.title === "string" ? (
          props.block.title
        ) : (
          <BkText text={props.block.title} />
        )}
      </div>
      <For each={props.block.tasks}>{(task) => <TaskCard block={task} />}</For>
    </section>
  );
}
