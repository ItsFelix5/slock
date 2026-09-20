import { IconButton } from "@slock/ui";
import { Show } from "solid-js";

export function ActivityRowActions(props: {
  isArchived: boolean;
  isSaved: boolean;
  isThread: boolean;
  isUnread: boolean;
  onArchive: () => void;
  onMarkRead: () => void;
  onToggleSave: () => void;
  onUnsubscribe: () => void;
  savePending: boolean;
  unsubscribePending: boolean;
}) {
  return (
    <div class="activity-row-actions">
      <Show when={props.isUnread}>
        <IconButton
          class="activity-mark-read-toggle"
          icon="mark-as-read"
          iconSize={14}
          label="Mark as read"
          onClick={props.onMarkRead}
        />
      </Show>
      <Show when={!props.isArchived}>
        <IconButton
          class="activity-archive-toggle"
          icon="archive"
          iconSize={14}
          label="Mark as complete"
          onClick={props.onArchive}
        />
      </Show>
      <IconButton
        active={props.isSaved}
        class="activity-save-toggle"
        disabled={props.savePending}
        icon={props.isSaved ? "bookmark-filled" : "bookmark"}
        iconSize={14}
        label={props.isSaved ? "Remove from Later" : "Save for later"}
        onClick={props.onToggleSave}
      />
      <Show when={props.isThread}>
        <IconButton
          class="activity-unsubscribe-toggle"
          disabled={props.unsubscribePending}
          icon="notifications-off"
          label="Unsubscribe from thread"
          onClick={props.onUnsubscribe}
        />
      </Show>
    </div>
  );
}
