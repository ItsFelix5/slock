import { Button, Modal, ModalHeader } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { createSignal, Show } from "solid-js";
import "./CreateDialog.css";

export default function CreateDialog(props: {
  canSubmit: boolean;
  children: JSX.Element;
  errors?: Record<string, string>;
  fallbackError: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  title: string;
}) {
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const close = () => !pending() && props.onClose();

  async function submit() {
    if (pending() || !props.canSubmit) return;
    setPending(true);
    setError(undefined);
    try {
      await props.onSubmit();
      props.onClose();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(props.errors?.[code] ?? props.fallbackError);
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal ariaLabel={props.title} class="create-dialog" onClose={close}>
      <ModalHeader onClose={close} title={props.title} />
      <form
        class="create-body"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset class="create-fields" disabled={pending()}>
          {props.children}
        </fieldset>
        <Show when={error()}>
          {(message) => (
            <p class="create-error" role="alert">
              {message()}
            </p>
          )}
        </Show>
        <div class="create-actions flex-between">
          <Button disabled={pending()} onClick={close} type="button">
            Cancel
          </Button>
          <Button disabled={!props.canSubmit || pending()} type="submit" variant="primary">
            {pending() ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
