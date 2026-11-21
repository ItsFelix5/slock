import { errorMessage } from "@slock/core";
import { service } from "@slock/core/solid";
import { isWaiting } from "@slock/resource";
import { CopyJsonButton, IconButton, JsonTree, type Pane, PanelHeader } from "@slock/ui";
import { For, Show } from "solid-js";
import { defineQuery } from "../../../query/client/api";
import type { DebugPaneContent } from "../api";
import { entities } from "../entities";
import "./DebugPane.css";
import IdChip from "./IdChip";

interface DebugTarget {
  entity: string;
  id: string;
}

const debugData = defineQuery<DebugTarget, unknown>({
  load: async ({ entity, id }) => (await entities[entity]?.load(id)) ?? null,
  maxAgeMs: 0,
  name: "debug",
});

const viewStore = service("shell.view");

export default function DebugPane(props: { pane: Pane<DebugPaneContent> }) {
  const content = () => props.pane.content;
  const entity = () => entities[content().entity];
  const target = () => ({ entity: content().entity, id: content().id });
  const data = debugData.state(target);

  const decorate = (value: string) => {
    const match =
      value === content().id
        ? undefined
        : Object.entries(entities).find(
            ([, candidate]) => candidate.pattern?.test(value) && candidate.load(value),
          );
    return match && <IdChip entity={match[0]} id={value} />;
  };

  return (
    <div class="debug-pane flex-col surface-card" data-pane={props.pane.id}>
      <PanelHeader
        canClose={viewStore.canCloseTile()}
        onClose={() => viewStore.closeTile(props.pane.id)}
      >
        <div class="debug-pane-header flex-align-center">
          <div class="debug-pane-title truncate title-sm">{entity()?.title(content().id)}</div>
          <For each={entity()?.related?.(content().id)}>
            {(ref) => <IdChip entity={ref.entity} id={ref.id} />}
          </For>
          <IconButton
            icon="open-in-main-view"
            iconSize={15}
            label={`Open ${entity()?.label}`}
            onClick={() => entity()?.open(content().id)}
            size="sm"
          />
          <IconButton
            icon="refresh"
            iconSize={15}
            label="Reload"
            onClick={() => void debugData.refresh(target()).catch(() => {})}
            size="sm"
          />
          <CopyJsonButton value={data().data} />
        </div>
      </PanelHeader>
      <div class="debug-pane-body">
        <Show
          fallback={
            <span class="text-dim">
              {data().error
                ? errorMessage(data().error)
                : isWaiting(data())
                  ? "Loading..."
                  : "Not stored"}
            </span>
          }
          when={data().data}
        >
          <JsonTree decorate={decorate} openDepth={3} value={data().data} />
        </Show>
      </div>
    </div>
  );
}
