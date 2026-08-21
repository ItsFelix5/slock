import { Icon, Tooltip } from "@slock/ui";
import { Show } from "solid-js";

export function ActivityRowActions(props: {
  isSaved: boolean;
  isThread: boolean;
  isUnread: boolean;
  onMarkRead: () => void;
  onToggleSave: () => void;
  onUnsubscribe: () => void;
  savePending: boolean;
  unsubscribePending: boolean;
}) {
  return (
    <div class="activity-row-actions">
      <Show when={props.isUnread}>
        <Tooltip content="Mark as read">
          <button
            aria-label="Mark as read"
            class="activity-mark-read-toggle btn-reset flex-center"
            onClick={props.onMarkRead}
            type="button"
          >
            <Icon name="mark-as-read" size={14} />
          </button>
        </Tooltip>
      </Show>
      <Tooltip content={props.isSaved ? "Remove from Later" : "Save for later"}>
        <button
          aria-label={props.isSaved ? "Remove from Later" : "Save for later"}
          class="activity-save-toggle btn-reset flex-center"
          classList={{ active: props.isSaved }}
          disabled={props.savePending}
          onClick={props.onToggleSave}
          type="button"
        >
          <Icon name={props.isSaved ? "bookmark-filled" : "bookmark"} size={14} />
        </button>
      </Tooltip>
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
    </div>
  );
}
