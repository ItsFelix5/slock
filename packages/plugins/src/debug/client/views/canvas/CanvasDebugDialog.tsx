import { service } from "@slock/core/solid";
import { CopyJsonButton, IconButton, JsonTree, Modal, ModalHeader } from "@slock/ui";
import { createQuery } from "@tanstack/solid-query";
import { Show } from "solid-js";
import type { CanvasDocModel } from "../../../../canvas/client/api";
import { defineKey } from "../../../../query/client/api";
import { loadCanvasDebug } from "./canvasDebugData";
import "./CanvasDebugDialog.css";

const canvasDebugKey = defineKey<[string]>("canvasDebug");

const query = service("query");

export default function CanvasDebugDialog(props: {
  doc: CanvasDocModel | null;
  fileId: string;
  onClose(): void;
}) {
  const data = createQuery(
    () => ({
      gcTime: 0,
      queryFn: () => loadCanvasDebug(props.fileId, props.doc),
      queryKey: canvasDebugKey(props.fileId),
    }),
    () => query.client,
  );

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
            <CopyJsonButton value={data.data} />
          </>
        }
        onClose={props.onClose}
        title={`Canvas ${props.fileId}`}
      />
      <div class="canvas-debug-body">
        <Show fallback={<span class="text-dim">Loading...</span>} when={data.data}>
          <JsonTree openDepth={4} value={data.data} />
        </Show>
      </div>
    </Modal>
  );
}
