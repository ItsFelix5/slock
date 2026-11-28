import ReplyReferenceRow from "@slock/plugins/messages/client/api/cards/ReplyReferenceRow";
import { IconButton } from "@slock/ui";
import type { ComposerReplyToProps } from "../composerTypes";
import "./ComposerReplyRow.css";

export default function ComposerReplyRow(props: { replyTo: ComposerReplyToProps }) {
  return (
    <div class="composer-reply-row flex-align-center">
      <ReplyReferenceRow message={props.replyTo.message} onJump={props.replyTo.onJump} />
      <IconButton icon="close" iconSize={14} onClick={props.replyTo.onCancel} size="sm" />
    </div>
  );
}
