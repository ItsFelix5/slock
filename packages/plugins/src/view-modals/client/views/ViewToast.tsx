import { service } from "@slock/core/solid";
import { Show } from "solid-js";

const modals = service("view-modals");

export default function ViewToast() {
  return (
    <Show when={modals.toast()}>
      {(text) => (
        <div class="view-toast surface-popover" role="status">
          {text()}
        </div>
      )}
    </Show>
  );
}
