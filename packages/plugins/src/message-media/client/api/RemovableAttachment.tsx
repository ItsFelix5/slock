import { IconButton } from "@slock/ui";
import { type JSX, Show } from "solid-js";
import "../views/AttachmentCard.css";

export default function RemovableAttachment(props: {
  alwaysShowRemove?: boolean;
  children: JSX.Element;
  onRemove?: () => void;
}) {
  return (
    <div class="attachment-removable" classList={{ "remove-visible": props.alwaysShowRemove }}>
      <div class="attachment-removable-card flex-col">{props.children}</div>
      <Show when={props.onRemove}>
        {(onRemove) => (
          <IconButton
            class="attachment-remove icon-shift"
            icon="close"
            label="Remove link preview"
            onClick={onRemove()}
            size="sm"
          />
        )}
      </Show>
    </div>
  );
}
