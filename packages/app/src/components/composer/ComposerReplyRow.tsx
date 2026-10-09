import { IconButton } from "@slock/ui";
import ReplyReferenceRow from "../messages/parts/ReplyReferenceRow";
import type { ComposerReplyToProps } from "./composerTypes";
import "./ComposerReplyRow.css";

export default function ComposerReplyRow(props: { replyTo: ComposerReplyToProps }) {
  return (
    <div class="composer-reply-row flex-align-center">
      <ReplyReferenceRow message={props.replyTo.message} onJump={props.replyTo.onJump} />
      <IconButton
        hideTooltip
        icon="close"
        iconSize={14}
        label="Cancel reply"
        onClick={props.replyTo.onCancel}
        size="sm"
      />
    </div>
  );
}
