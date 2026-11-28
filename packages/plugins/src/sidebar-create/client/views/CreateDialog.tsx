import { defineMutation } from "@slock/plugins/query/client/api";
import { Button, Modal, ModalHeader } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import { createSignal, Show } from "solid-js";
import "./CreateDialog.css";

const creating = defineMutation<{
  create: () => Promise<void>;
  fail: (error: unknown) => void;
}>({
  mode: "single",
  onError: (error, { fail }) => fail(error),
  run: ({ create }) => create(),
});

export default function CreateDialog(props: {
  canSubmit: boolean;
  children: JSX.Element;
  errors?: Record<string, string>;
  fallbackError: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  title: string;
}) {
  const [error, setError] = createSignal<string>();
  const pending = () => creating.pending();
  const close = () => !pending() && props.onClose();

  async function submit() {
    if (pending() || !props.canSubmit) return;
    setError(undefined);
    const created = await creating.run({
      create: props.onSubmit,
      fail: (failure) => {
        const code = failure instanceof Error ? failure.message : "";
        setError(props.errors?.[code] ?? props.fallbackError);
      },
    });
    if (created) props.onClose();
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
