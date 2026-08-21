import { createMemo, createSignal, Show } from "solid-js";
import IconButton from "../button/IconButton";
import { createCopyFeedback } from "../feedback/copyFeedback";
import Modal, { ModalHeader } from "./Modal";
import "./debug-info-dialog.css";

interface PendingDebugInfo {
  title: string;
  data: unknown;
}

const [pending, setPending] = createSignal<PendingDebugInfo | null>(null);

export function showDebugInfo(title: string, data: unknown) {
  setPending({ title, data });
}

export function DebugInfoDialogHost() {
  const [copiedKey, copy] = createCopyFeedback();
  const json = createMemo(() => JSON.stringify(pending()?.data, null, 2) ?? "");
  const close = () => setPending(null);

  return (
    <Show when={pending()}>
      {(p) => (
        <Modal ariaLabel={p().title} class="debug-info-dialog" onClose={close}>
          <ModalHeader
            onClose={close}
            title={p().title}
            buttons={
              <IconButton
                icon={copiedKey() === "debug-info" ? "check" : "copy"}
                label="Copy"
                onClick={() => void copy(json(), "debug-info")}
                size="sm"
              />
            }
          />
          <pre class="debug-info-dialog-content">
            <code>{json()}</code>
          </pre>
        </Modal>
      )}
    </Show>
  );
}
