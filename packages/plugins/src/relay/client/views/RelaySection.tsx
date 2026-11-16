import { errorMessage } from "@slock/core";
import { service } from "@slock/core/solid";
import { Button } from "@slock/ui";
import { createSignal, Show } from "solid-js";
import { createKeyedQuery, defineKey } from "../../../query/client/api";
import { connectRelay, disconnectRelay, fetchRelayStatus } from "../api";
import "./RelaySection.css";

const query = service("query");
const statusKey = defineKey<[]>("relayStatus");

function ConnectForm(props: { busy: boolean; onConnect: (token: string) => void }) {
  const [token, setToken] = createSignal("");
  return (
    <form
      class="settings-relay-form flex-align-center"
      onSubmit={(event) => {
        event.preventDefault();
        if (token().trim()) props.onConnect(token());
      }}
    >
      <input
        aria-label="Relay token"
        autocomplete="off"
        class="settings-status-input text-field"
        onInput={(event) => setToken(event.currentTarget.value)}
        placeholder="slockrelay_…"
        spellcheck={false}
        type="password"
        value={token()}
      />
      <Button disabled={props.busy || !token().trim()} type="submit">
        {props.busy ? "Connecting…" : "Connect"}
      </Button>
    </form>
  );
}

function Connected(props: { busy: boolean; onDisconnect: () => void }) {
  return (
    <div class="settings-relay-form flex-align-center">
      <span class="text-dim">Connected</span>
      <Button disabled={props.busy} onClick={props.onDisconnect} variant="secondary">
        Disconnect
      </Button>
    </div>
  );
}

export default function RelaySection() {
  const status = createKeyedQuery(() => ({ queryFn: fetchRelayStatus, queryKey: statusKey() }));
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string>();

  async function run(change: () => Promise<void>) {
    setError(undefined);
    setBusy(true);
    try {
      await change();
      await query.client.invalidateQueries({ queryKey: statusKey() });
    } catch (err) {
      setError(errorMessage(err, "Something went wrong."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Show when={status.data?.available}>
      <div class="settings-row">
        <div class="settings-row-label">Relay token</div>
        <div class="settings-row-meta text-dim">
          Lets @channel messages carry files. Run <code>/slock-relay token</code> in Slack to get
          one.
        </div>
        <Show
          fallback={
            <ConnectForm busy={busy()} onConnect={(token) => void run(() => connectRelay(token))} />
          }
          when={status.data?.connected}
        >
          <Connected busy={busy()} onDisconnect={() => void run(disconnectRelay)} />
        </Show>
        <Show when={error()}>
          {(message) => <div class="settings-account-error">{message()}</div>}
        </Show>
      </div>
    </Show>
  );
}
