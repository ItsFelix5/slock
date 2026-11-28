import ReactionRow from "@slock/plugins/reactions/client/api/ReactionRow";
import type { CanvasCommentThread, FileId } from "@slock/types";
import { Show } from "solid-js";
import type { CanvasCommentsController } from "../lib/canvasComments";

export default function CommentReactions(props: {
  canReact: boolean;
  comments: CanvasCommentsController;
  fileId: FileId;
  thread: CanvasCommentThread;
}) {
  return (
    <Show when={props.thread.reactions.length > 0}>
      <ReactionRow
        allowAdd={props.canReact}
        feedbackKey={props.fileId}
        onToggle={(name) => props.comments.reactToThread(props.thread, name)}
        reactions={props.thread.reactions}
        readOnly={!props.canReact}
      />
    </Show>
  );
}
