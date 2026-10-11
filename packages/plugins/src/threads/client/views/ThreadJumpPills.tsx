import { Icon } from "@slock/ui";
import { Show } from "solid-js";

export default function ThreadJumpPills(props: {
  atBottom: boolean;
  atTop: boolean;
  onLatest: () => void;
  onFirst: () => void;
}) {
  return (
    <>
      <Show when={!props.atTop}>
        <button
          class="thread-panel-jump thread-panel-jump-top message-list-date-pill surface-popover btn-reset"
          onClick={props.onFirst}
          type="button"
        >
          <Icon name="arrow-up" size={12} />
          First message
        </button>
      </Show>
      <Show when={!props.atBottom}>
        <button
          class="thread-panel-jump thread-panel-jump-bottom message-list-date-pill surface-popover btn-reset"
          onClick={props.onLatest}
          type="button"
        >
          <Icon name="arrow-down" size={12} />
          Latest reply
        </button>
      </Show>
    </>
  );
}
