import { createSignal, Show } from "solid-js";
import Button from "../button/Button";
import "./ConfirmDialog.css";
import { useShortcut } from "../useShortcut";
import Modal from "./Modal";

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PendingConfirm extends ConfirmDialogOptions {
  resolve: (ok: boolean) => void;
}

const [pending, setPending] = createSignal<PendingConfirm | null>(null);

export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => setPending({ ...options, resolve }));
}

export function ConfirmDialog() {
  const close = (ok: boolean) => {
    pending()?.resolve(ok);
    setPending(null);
  };
  useShortcut({
    combo: { key: "Enter" },
    id: "confirm.accept",
    label: "Confirm dialog",
    scope: "general",
    group: "App",
    enabled: () => pending() !== null,
    target: (element) => !(element instanceof HTMLButtonElement),
    handler: () => close(true),
  });
  return (
    <Show when={pending()}>
      {(p) => (
        <Modal
          ariaLabel={p().title ?? p().message}
          class="confirm-dialog"
          onClose={() => close(false)}
        >
          <div class="confirm-dialog-body">
            <Show when={p().title}>
              <h2 class="confirm-dialog-title">{p().title}</h2>
            </Show>
            <p class="confirm-dialog-message">{p().message}</p>
          </div>
          <div class="confirm-dialog-actions">
            <Button onClick={() => close(true)} variant={p().danger ? "danger" : "primary"}>
              {p().confirmLabel ?? "Confirm"}
            </Button>
            <Button onClick={() => close(false)}>{p().cancelLabel ?? "Cancel"}</Button>
          </div>
        </Modal>
      )}
    </Show>
  );
}
