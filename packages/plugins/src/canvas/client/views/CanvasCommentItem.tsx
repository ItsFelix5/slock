import { BkText } from "@slock/blockkit";
import { getCachedWorkspaceDomain } from "@slock/slack/client";
import type { CanvasAccess, CanvasCommentThread, FileId } from "@slock/types";
import { Button } from "@slock/ui";
import { Show } from "solid-js";
import { type annotationQuote, quoteMrkdwn } from "../../protocol/api";
import type { CanvasCommentsController } from "../lib/canvasComments";
import CommentReactions from "./CommentReactions";

function openLabel({ replyCount }: CanvasCommentThread): string {
  if (replyCount === 0) return "Open";
  return replyCount === 1 ? "1 reply" : `${replyCount} replies`;
}

export default function CanvasCommentItem(props: {
  access: CanvasAccess;
  comments: CanvasCommentsController;
  fileId: FileId;
  onOpen: () => void;
  quote: ReturnType<typeof annotationQuote>;
  thread: CanvasCommentThread;
}) {
  return (
    <li class="canvas-comment-item flex-col">
      <Show
        fallback={<span class="text-dim">{props.thread.quote || "Removed text"}</span>}
        when={props.quote}
      >
        {(quote) => (
          <BkText
            class="canvas-comment-item-quote"
            text={{ text: quoteMrkdwn(quote(), getCachedWorkspaceDomain()), type: "mrkdwn" }}
          />
        )}
      </Show>
      <CommentReactions
        canReact={props.access !== "view"}
        comments={props.comments}
        fileId={props.fileId}
        thread={props.thread}
      />
      <span class="canvas-comment-item-actions flex-align-center">
        <Button data-nav-row onClick={props.onOpen} size="sm">
          {openLabel(props.thread)}
        </Button>
        <Show when={props.access !== "view"}>
          <Button
            class="busy"
            data-nav-row
            disabled={props.comments.resolving(props.thread)}
            onClick={() => props.comments.resolve(props.thread, !props.thread.archived)}
            size="sm"
          >
            {props.thread.archived ? "Reopen" : "Resolve"}
          </Button>
        </Show>
      </span>
    </li>
  );
}
