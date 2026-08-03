import { Icon, Tooltip } from "@slock/ui";
import { Show } from "solid-js";

export function ActivityRowActions(props: {
  isReacted: boolean;
  isThread: boolean;
  onReact: () => void;
  onUnsubscribe: () => void;
  unsubscribePending: boolean;
}) {
  return (
    <div class="activity-row-actions">
      <Show when={props.isThread}>
        <Tooltip content="Unsubscribe from thread">
          <button
            aria-label="Unsubscribe from thread"
            class="activity-unsubscribe-toggle btn-reset flex-center"
            disabled={props.unsubscribePending}
            onClick={props.onUnsubscribe}
            type="button"
          >
            <Icon name="notifications-off" size={16} />
          </button>
        </Tooltip>
      </Show>
      <Tooltip content={props.isReacted ? "Reacted" : "Move to Reacted"}>
        <button
          aria-label="Move to Reacted"
          class="activity-react-toggle btn-reset flex-center"
          classList={{ active: props.isReacted }}
          onClick={props.onReact}
          type="button"
        >
          <Icon name={props.isReacted ? "check-circle-filled" : "check-circle"} size={17} />
        </button>
      </Tooltip>
    </div>
  );
}
