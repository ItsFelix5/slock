import { errorMessage } from "@slock/core";
import { service } from "@slock/core/solid";
import { type HubEntry, stableKey } from "@slock/resource";
import { IconButton } from "@slock/ui";
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import "./CacheTab.css";

const REFRESH_MS = 1_000;

const query = service("query");
const env = service("env");

const entryId = (entry: HubEntry) => `${entry.cache}:${stableKey(entry.key)}`;

function statusLabel({ state }: HubEntry) {
  return [state.status, state.stale && "stale", state.refreshing && "refreshing"]
    .filter(Boolean)
    .join(" ");
}

function age(entry: HubEntry) {
  return entry.dataAt === 0 ? "-" : `${Math.round((env.now() - entry.dataAt) / 1000)}s`;
}

function CacheRow(props: { entry: HubEntry }) {
  return (
    <tr>
      <td class="debug-cache-name">{props.entry.cache}</td>
      <td class="debug-cache-key">{stableKey(props.entry.key)}</td>
      <td>{statusLabel(props.entry)}</td>
      <td>{age(props.entry)}</td>
      <td>{props.entry.subscribers}</td>
      <td class="debug-cache-error">
        <Show when={props.entry.state.error}>{(error) => errorMessage(error())}</Show>
      </td>
      <td class="debug-cache-actions flex-align-center">
        <IconButton
          icon="refresh"
          iconSize={15}
          label="Refresh"
          onClick={() => void props.entry.refresh().catch(() => {})}
          size="sm"
        />
        <IconButton
          icon="clock"
          iconSize={15}
          label="Invalidate"
          onClick={props.entry.invalidate}
          size="sm"
        />
      </td>
    </tr>
  );
}

export default function CacheTab() {
  const [tick, setTick] = createSignal(0);
  const timer = env.setInterval(() => setTick((value) => value + 1), REFRESH_MS);
  onCleanup(() => env.clearInterval(timer));
  const entries = createMemo(() => {
    tick();
    return query.hub.inspect();
  });

  return (
    <>
      <h2>Cache</h2>
      <div class="debug-cache-scroll">
        <table class="debug-cache-table">
          <thead>
            <tr>
              <th>Query</th>
              <th>Key</th>
              <th>Status</th>
              <th>Age</th>
              <th>Subs</th>
              <th>Error</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <For each={entries()} keyed={entryId}>
              {(entry) => <CacheRow entry={entry()} />}
            </For>
          </tbody>
        </table>
      </div>
    </>
  );
}
