import { IconButton } from "@slock/ui";
import type { JSX } from "@solidjs/web";
import "../views/AttachmentCard.css";

export default function RemovableAttachment(props: {
  children: JSX.Element;
  onRemove: () => void;
}) {
  return (
    <div class="attachment-removable">
      <div class="attachment-removable-card flex-col">{props.children}</div>
      <IconButton
        class="attachment-remove icon-shift"
        icon="close"
        label="Remove link preview"
        onClick={props.onRemove}
        size="sm"
      />
    </div>
  );
}
