import { createEffect, createSignal, Show } from "solid-js";
import Icon from "../media/Icon";
import "./ConnectionStatus.css";

export type ConnectionStatusState = "connected" | "connecting" | "offline" | "reconnecting";

export default function ConnectionStatus(props: {
  onRetry: () => void;
  state: ConnectionStatusState;
}) {
  const [visible, setVisible] = createSignal(props.state === "offline");
  let hasConnected = props.state === "connected";

  createEffect(
    () => props.state,
    (state) => {
      if (state === "connected") {
        hasConnected = true;
        setVisible(false);
        return;
      }
      if (state === "offline" || hasConnected) {
        setVisible(true);
        return;
      }
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    },
  );

  const shown = () => visible() && props.state !== "connected";
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
