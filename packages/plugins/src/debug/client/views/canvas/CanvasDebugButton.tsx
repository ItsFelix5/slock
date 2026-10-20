import { IconButton } from "@slock/ui";
import { createSignal, lazy, Show } from "solid-js";
import type { CanvasDocModel } from "../../../../canvas/client/api";

const CanvasDebugDialog = lazy(() => import("./CanvasDebugDialog"));

export default function CanvasDebugButton(props: { doc: CanvasDocModel | null; fileId: string }) {
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <IconButton
        icon="bug"
        iconSize={15}
        label="Canvas debug"
        onClick={() => setOpen(true)}
        size="sm"
      />
      <Show when={open()}>
        <CanvasDebugDialog doc={props.doc} fileId={props.fileId} onClose={() => setOpen(false)} />
      </Show>
    </>
  );
}
