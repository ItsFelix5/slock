import { createSignal, Show } from "solid-js";
import IconButton from "../button/IconButton";
import { createCopyFeedback } from "../feedback/copyFeedback";
import "./DebugInfoDialog.css";
import JsonTabs from "./JsonTabs";
import Modal, { ModalHeader } from "./Modal";

interface PendingDebugInfo {
  title: string;
  data: unknown;
}

const [pending, setPending] = createSignal<PendingDebugInfo | null>(null);

export function showDebugInfo(title: string, data: unknown) {
  setPending({ title, data });
}

export function CopyJsonButton(props: { value: unknown }) {
  const [copiedKey, copy] = createCopyFeedback();
  return (
    <IconButton
      icon={copiedKey() === "json" ? "check" : "copy"}
      label="Copy raw JSON"
      onClick={() => void copy(JSON.stringify(props.value, null, 2) ?? "", "json")}
      size="sm"
    />
  );
}

export function DebugInfoDialog() {
  const close = () => setPending(null);

  return (
    <Show when={pending()}>
      {(p) => (
        <Modal ariaLabel={p().title} class="debug-info-dialog" onClose={close}>
          <ModalHeader
            onClose={close}
            title={p().title}
            buttons={<CopyJsonButton value={p().data} />}
          />
          <JsonTabs value={p().data} />
        </Modal>
      )}
    </Show>
  );
}
