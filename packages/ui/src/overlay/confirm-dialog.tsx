import { createSignal, Show } from "solid-js";
import Button from "../button/Button";
import Modal, { ModalHeader } from "./Modal";
import "./confirm-dialog.css";

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

export function ConfirmDialogHost() {
  const close = (ok: boolean) => {
    pending()?.resolve(ok);
    setPending(null);
  };
  return (
    <Show when={pending()}>
      {(p) => (
        <Modal
          ariaLabel={p().title ?? "Confirm"}
          class="confirm-dialog"
          onClose={() => close(false)}
        >
          <ModalHeader onClose={() => close(false)} title={p().title} />
          <div class="confirm-dialog-message">{p().message}</div>
          <div class="confirm-dialog-actions">
            <Button onClick={() => close(false)} variant="ghost">
              {p().cancelLabel ?? "Cancel"}
            </Button>
            <Button onClick={() => close(true)} variant={p().danger ? "danger" : "primary"}>
              {p().confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </Modal>
      )}
    </Show>
  );
}
