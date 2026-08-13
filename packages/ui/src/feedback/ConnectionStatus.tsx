import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import Icon from "../media/Icon";
import "./ConnectionStatus.css";

export type ConnectionStatusState = "connected" | "connecting" | "offline" | "reconnecting";

export default function ConnectionStatus(props: {
  onRetry: () => void;
  state: ConnectionStatusState;
}) {
  const [visible, setVisible] = createSignal(props.state === "offline");
  let hasConnected = props.state === "connected";

  createEffect(() => {
    const { state } = props;
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
    onCleanup(() => clearTimeout(timer));
  });

  const message = () => {
    if (props.state === "offline") {
      return "You're offline. Messages and drafts will retry when your connection returns.";
    }
    if (props.state === "reconnecting") return "Live updates are delayed. Reconnecting…";
    return "Connecting to live updates…";
  };

  return (
    <Show when={visible() && props.state !== "connected"}>
      <div class="connection-status">
        <Icon name={props.state === "offline" ? "cloud-offline" : "refresh"} size={15} />
        <span>{message()}</span>
        <Show when={props.state === "reconnecting"}>
          <button class="connection-status-retry" onClick={props.onRetry} type="button">
            Retry now
          </button>
        </Show>
      </div>
    </Show>
  );
}
