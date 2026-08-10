import { Icon, Tooltip } from "@slock/ui";
import { Show } from "solid-js";

export function ActivityRowActions(props: {
  isThread: boolean;
  onUnsubscribe: () => void;
  unsubscribePending: boolean;
}) {
  return (
    <Show when={props.isThread}>
      <div class="activity-row-actions">
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
      </div>
    </Show>
  );
}
