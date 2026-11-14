import { createSignal, Show } from "solid-js";
import IconButton from "../button/IconButton";
import { createCopyFeedback } from "../feedback/copyFeedback";
import "./DebugInfoDialog.css";
import JsonTree from "./JsonTree";
import Modal, { ModalHeader } from "./Modal";

interface PendingDebugInfo {
  title: string;
  data: unknown;
}

const [pending, setPending] = createSignal<PendingDebugInfo | null>(null);

export function showDebugInfo(title: string, data: unknown) {
  setPending({ title, data });
}

export function CopyJsonButton(props: { value: unknown; label?: string; icon?: "copy" | "files" }) {
  const [copiedKey, copy] = createCopyFeedback();
  return (
    <IconButton
      icon={copiedKey() === "json" ? "check" : (props.icon ?? "copy")}
      label={props.label ?? "Copy all"}
      onClick={() => void copy(JSON.stringify(props.value, null, 2) ?? "", "json")}
      size="sm"
    />
  );
}

function DebugInfoContent(props: { info: PendingDebugInfo; close(): void }) {
  return (
    <Modal ariaLabel={props.info.title} class="debug-info-dialog" onClose={props.close}>
      <ModalHeader
        buttons={<CopyJsonButton value={props.info.data} />}
        onClose={props.close}
        title={props.info.title}
      />
      <div class="debug-info-body">
        <JsonTree openDepth={4} value={props.info.data} />
      </div>
    </Modal>
  );
}

export function DebugInfoDialog() {
  const close = () => setPending(null);
  return <Show when={pending()}>{(info) => <DebugInfoContent close={close} info={info()} />}</Show>;
}
