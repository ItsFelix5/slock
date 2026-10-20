import { service } from "@slock/core/solid";
import {
  CopyJsonButton,
  IconButton,
  JsonTree,
  Modal,
  ModalHeader,
  SegmentedControl,
} from "@slock/ui";
import { createQuery } from "@tanstack/solid-query";
import { createSignal, For, Show } from "solid-js";
import type { CanvasDocModel } from "../../../../canvas/client/api";
import { defineKey } from "../../../../query/client/api";
import { type CanvasDebugTabs, loadCanvasDebug } from "./canvasDebugData";
import "./CanvasDebugDialog.css";

const canvasDebugKey = defineKey<[string]>("canvasDebug");

const query = service("query");

const TABS: (keyof CanvasDebugTabs)[] = [
  "Overview",
  "Nodes",
  "Records",
  "Embeds",
  "Threads",
  "Versions",
  "File",
  "Raw",
];

export default function CanvasDebugDialog(props: {
  doc: CanvasDocModel | null;
  fileId: string;
  onClose(): void;
}) {
  const [tab, setTab] = createSignal<keyof CanvasDebugTabs>("Overview");
  const data = createQuery(
    () => ({
      gcTime: 0,
      queryFn: () => loadCanvasDebug(props.fileId, props.doc),
      queryKey: canvasDebugKey(props.fileId),
    }),
    () => query.client,
  );
  const current = () => data.data?.[tab()];

  return (
    <Modal ariaLabel="Canvas debug" class="canvas-debug-dialog" onClose={props.onClose}>
      <ModalHeader
        buttons={
          <>
            <IconButton
              icon="refresh"
              label="Reload"
              onClick={() => void data.refetch()}
              size="sm"
            />
            <CopyJsonButton value={current()} />
          </>
        }
        onClose={props.onClose}
        title={`Canvas ${props.fileId}`}
      />
      <SegmentedControl class="canvas-debug-tabs">
        <For each={TABS}>
          {(name) => (
            <button
              class="segmented-control-btn"
              classList={{ active: tab() === name }}
              onClick={() => setTab(name)}
              type="button"
            >
              {name}
            </button>
          )}
        </For>
      </SegmentedControl>
      <div class="canvas-debug-body">
        <Show fallback={<span class="text-dim">Loading...</span>} when={data.data}>
          <JsonTree value={current()} />
        </Show>
      </div>
    </Modal>
  );
}
