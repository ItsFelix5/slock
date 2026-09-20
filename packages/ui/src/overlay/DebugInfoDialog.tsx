import { createMemo, createSignal, Show } from "solid-js";
import IconButton from "../button/IconButton";
import { createCopyFeedback } from "../feedback/copyFeedback";
import "./DebugInfoDialog.css";
import Modal, { ModalHeader } from "./Modal";

interface PendingDebugInfo {
  title: string;
  data: unknown;
}

const [pending, setPending] = createSignal<PendingDebugInfo | null>(null);

const DEBUG_MODE_KEY = "slock-debug-mode";
const [debugMode, setDebugModeSignal] = createSignal(localStorage.getItem(DEBUG_MODE_KEY) === "1");

export function setDebugMode(on: boolean) {
  setDebugModeSignal(on);
  localStorage.setItem(DEBUG_MODE_KEY, on ? "1" : "0");
}

export { debugMode };

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
