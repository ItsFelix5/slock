import { service } from "@slock/core/solid";
import { Icon } from "@slock/ui";
import { createEffect, createMemo, createSignal, Show } from "solid-js";
import "./ConnectionStatus.css";

const env = service("env");

export type ConnectionStatusState = "connected" | "connecting" | "offline" | "reconnecting";

export default function ConnectionStatus(props: {
  onRetry: () => void;
  state: ConnectionStatusState;
}) {
  const [graceOver, setGraceOver] = createSignal(false);
  const hasConnected = createMemo((seen?: boolean) => seen || props.state === "connected");

  createEffect(
    () => !hasConnected() && props.state !== "offline",
    (waiting) => {
      if (!waiting) return;
      const timer = env.setTimeout(() => setGraceOver(true), 1000);
      return () => env.clearTimeout(timer);
    },
  );

  const shown = () =>
    props.state !== "connected" && (props.state === "offline" || hasConnected() || graceOver());
  return (
    <div
      class={[
        "connection-status surface-popover flex-align-center gap-sm",
        { "connection-status-shown": shown() },
      ]}
    >
      <Icon name={props.state === "offline" ? "cloud-offline" : "refresh"} size={15} />
      <span>{props.state}</span>
      <Show when={props.state === "reconnecting"}>
        <button class="connection-status-retry" onClick={props.onRetry} type="button">
          Retry now
        </button>
      </Show>
    </div>
  );
}
