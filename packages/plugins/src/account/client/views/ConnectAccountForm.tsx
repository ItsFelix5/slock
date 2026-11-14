import { Slot } from "@slock/core/solid";
import { createSignal } from "solid-js";
import "./ConnectAccountForm.css";

export default function ConnectAccountForm(props: { onConnected: () => void }) {
  const [error, setError] = createSignal<string | null>(null);

  return (
    <div class="connect-account-form flex-col">
      <Slot connected={props.onConnected} point="account.connect" setError={setError} />
      <p class="connect-account-error">{error()}</p>
    </div>
  );
}
